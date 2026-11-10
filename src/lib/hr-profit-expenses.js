/**
 * HR salary clearance + employee advances as profit-report / day-end expense lines
 * (Finance → Expenses does not receive these automatically.)
 *
 * Uses physical table names (PREFIXED / DEDICATED branches) — Prisma employeeAdvance alone
 * can miss rows on live when tables are branch-prefixed.
 */
import { Prisma } from '@prisma/client';
import { sqlTableName, sqlBranchWhere } from '@/lib/prisma';

export function parsePkDateRange(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return null;
  const tzOffset = '+05:00';
  return {
    gte: new Date(`${startDateStr}T00:00:00.000${tzOffset}`),
    lte: new Date(`${endDateStr}T23:59:59.999${tzOffset}`),
  };
}

function tableIdent(base) {
  const name = String(sqlTableName(base) || base).replace(/[^a-zA-Z0-9_]/g, '');
  if (!name) return null;
  return Prisma.raw(`\`${name}\``);
}

function assertYmd(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr).trim())) return null;
  return String(dateStr).trim();
}

/**
 * @returns {Promise<Array<object>>} Synthetic expense-shaped rows for profit report UI
 */
export async function fetchHrEmployeeExpenseLines(prisma, { startDate, endDate, branchId = 1 }) {
  const start = assertYmd(startDate);
  const end = assertYmd(endDate);
  if (!start || !end) return [];

  const dateRange = parsePkDateRange(start, end);
  if (!dateRange) return [];

  const employees = tableIdent('employees');
  const advances = tableIdent('employee_advances');
  const payrolls = tableIdent('payrolls');
  if (!employees || !advances || !payrolls) return [];

  const branchFilter = Prisma.raw(sqlBranchWhere(branchId, 'e'));

  let advanceRows = [];
  let payrollRows = [];

  try {
    advanceRows = await prisma.$queryRaw`
      SELECT
        ea.advance_id,
        ea.emp_id,
        ea.amount,
        ea.advance_date,
        ea.payment_mode,
        ea.reason,
        ea.status,
        ea.created_at,
        e.emp_name
      FROM ${advances} ea
      INNER JOIN ${employees} e ON e.emp_id = ea.emp_id
      WHERE ea.status <> 'CANCELLED'
        AND ${branchFilter}
        AND (
          (ea.advance_date >= ${start} AND ea.advance_date <= ${end})
          OR (ea.created_at >= ${dateRange.gte} AND ea.created_at <= ${dateRange.lte})
        )
      ORDER BY ea.advance_date ASC, ea.advance_id ASC
    `;
  } catch (err) {
    console.error('[hr-profit-expenses] advance query failed:', err?.message || err);
    advanceRows = await fetchHrAdvancesPrismaFallback(prisma, { startDate: start, endDate: end, branchId, dateRange });
  }

  try {
    payrollRows = await prisma.$queryRaw`
      SELECT
        p.payroll_id,
        p.emp_id,
        p.month,
        p.year,
        p.net_salary,
        p.status,
        p.payment_date,
        p.notes,
        p.updated_at,
        e.emp_name
      FROM ${payrolls} p
      INNER JOIN ${employees} e ON e.emp_id = p.emp_id
      WHERE p.status = 'PAID'
        AND ${branchFilter}
        AND (
          (p.payment_date IS NOT NULL AND p.payment_date >= ${start} AND p.payment_date <= ${end})
          OR (
            p.payment_date IS NULL
            AND p.updated_at >= ${dateRange.gte}
            AND p.updated_at <= ${dateRange.lte}
          )
        )
      ORDER BY p.payment_date ASC, p.payroll_id ASC
    `;
  } catch (err) {
    console.error('[hr-profit-expenses] payroll query failed:', err?.message || err);
    payrollRows = await fetchHrPayrollsPrismaFallback(prisma, { startDate: start, endDate: end, branchId, dateRange });
  }

  const lines = [];

  for (const a of advanceRows || []) {
    const amt = parseFloat(a.amount || 0);
    if (amt <= 0) continue;
    const isBank = String(a.payment_mode || '').toUpperCase() === 'BANK_TRANSFER';
    lines.push({
      exp_id: `HR-ADV-${a.advance_id}`,
      exp_amount: amt,
      exp_title: `Salary advance — ${a.emp_name || `Employee #${a.emp_id}`}`,
      exp_detail: a.reason || '',
      created_at: a.created_at,
      expense_title: { title: 'Employee / Salary (HR Advance)' },
      is_employee_expense: true,
      hr_source: 'advance',
      hr_transaction_id: a.advance_id,
      payment_mode: a.payment_mode,
      cash_amount: isBank ? 0 : amt,
      bank_amount: isBank ? amt : 0,
      is_paid: true,
    });
  }

  for (const p of payrollRows || []) {
    const amt = parseFloat(p.net_salary || 0);
    if (amt <= 0) continue;
    lines.push({
      exp_id: `HR-PAY-${p.payroll_id}`,
      exp_amount: amt,
      exp_title: `Salary paid — ${p.emp_name || `Employee #${p.emp_id}`} (${p.month}/${p.year})`,
      exp_detail: p.notes || '',
      created_at: p.payment_date || p.updated_at,
      expense_title: { title: 'Employee / Salary (HR Clearance)' },
      is_employee_expense: true,
      hr_source: 'payroll',
      hr_transaction_id: p.payroll_id,
      payment_mode: 'CASH',
      cash_amount: amt,
      bank_amount: 0,
      is_paid: true,
    });
  }

  return lines;
}

/** SHARED DB fallback when raw SQL fails (e.g. missing prefixed tables during migration). */
async function fetchHrAdvancesPrismaFallback(prisma, { branchId, dateRange, startDate, endDate }) {
  const employeeScope = branchId ? { employee: { branch_id: branchId } } : {};
  const advanceDateGte = startDate ? new Date(`${startDate}T00:00:00.000Z`) : dateRange.gte;
  const advanceDateLte = endDate ? new Date(`${endDate}T00:00:00.000Z`) : dateRange.lte;
  return prisma.employeeAdvance.findMany({
    where: {
      status: { not: 'CANCELLED' },
      OR: [
        { created_at: dateRange },
        {
          advance_date: {
            gte: advanceDateGte,
            lte: advanceDateLte,
          },
        },
      ],
      ...employeeScope,
    },
    include: {
      employee: { select: { emp_id: true, emp_name: true } },
    },
    orderBy: { created_at: 'asc' },
  }).then((rows) => rows.map((a) => ({
    ...a,
    emp_name: a.employee?.emp_name,
  })));
}

async function fetchHrPayrollsPrismaFallback(prisma, { branchId, dateRange, startDate, endDate }) {
  const employeeScope = branchId ? { employee: { branch_id: branchId } } : {};
  const payDateGte = startDate ? new Date(`${startDate}T00:00:00.000Z`) : dateRange.gte;
  const payDateLte = endDate ? new Date(`${endDate}T00:00:00.000Z`) : dateRange.lte;
  return prisma.payroll.findMany({
    where: {
      status: 'PAID',
      OR: [
        {
          payment_date: {
            gte: payDateGte,
            lte: payDateLte,
          },
        },
        {
          payment_date: null,
          updated_at: dateRange,
        },
      ],
      ...employeeScope,
    },
    include: {
      employee: { select: { emp_id: true, emp_name: true } },
    },
    orderBy: { payment_date: 'asc' },
  }).then((rows) => rows.map((p) => ({
    ...p,
    emp_name: p.employee?.emp_name,
  })));
}
