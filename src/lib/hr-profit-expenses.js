/**
 * HR salary clearance + employee advances as profit-report expense lines
 * (Finance → Expenses does not receive these automatically.)
 */
export function parsePkDateRange(startDateStr, endDateStr) {
  if (!startDateStr || !endDateStr) return null;
  const tzOffset = '+05:00';
  return {
    gte: new Date(`${startDateStr}T00:00:00.000${tzOffset}`),
    lte: new Date(`${endDateStr}T23:59:59.999${tzOffset}`),
  };
}

/**
 * @returns {Promise<Array<object>>} Synthetic expense-shaped rows for profit report UI
 */
export async function fetchHrEmployeeExpenseLines(prisma, { startDate, endDate, branchId }) {
  const dateRange = parsePkDateRange(startDate, endDate);
  if (!dateRange) return [];

  const employeeScope = branchId ? { employee: { branch_id: branchId } } : {};

  const [advances, payrolls] = await Promise.all([
    prisma.employeeAdvance.findMany({
      where: {
        status: { not: 'CANCELLED' },
        created_at: dateRange,
        ...employeeScope,
      },
      include: {
        employee: { select: { emp_id: true, emp_name: true } },
      },
      orderBy: { created_at: 'asc' },
    }),
    prisma.payroll.findMany({
      where: {
        status: 'PAID',
        payment_date: dateRange,
        ...employeeScope,
      },
      include: {
        employee: { select: { emp_id: true, emp_name: true } },
      },
      orderBy: { payment_date: 'asc' },
    }),
  ]);

  const lines = [];

  for (const a of advances) {
    const amt = parseFloat(a.amount || 0);
    if (amt <= 0) continue;
    const isBank = String(a.payment_mode || '').toUpperCase() === 'BANK_TRANSFER';
    lines.push({
      exp_id: `HR-ADV-${a.advance_id}`,
      exp_amount: amt,
      exp_title: `Salary advance — ${a.employee?.emp_name || `Employee #${a.emp_id}`}`,
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

  for (const p of payrolls) {
    const amt = parseFloat(p.net_salary || 0);
    if (amt <= 0) continue;
    lines.push({
      exp_id: `HR-PAY-${p.payroll_id}`,
      exp_amount: amt,
      exp_title: `Salary paid — ${p.employee?.emp_name || `Employee #${p.emp_id}`} (${p.month}/${p.year})`,
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
