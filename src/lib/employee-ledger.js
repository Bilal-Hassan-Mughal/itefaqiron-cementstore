/**
 * Employee ledger — separate from customer/supplier finance ledger.
 * Balance: closing = opening + debit − credit
 *   Positive closing → employee owes company (advances / money taken)
 *   Negative closing → company owes employee
 */

import { prisma as rootPrisma } from '@/lib/prisma';
import {
  resolveEmployeeReceivableBalance,
  resolvePayrollAdvanceDeduction,
  splitEmployeeLedgerForPayroll,
} from '@/lib/hr-payroll';

export {
  resolveEmployeeReceivableBalance,
  resolvePayrollAdvanceDeduction,
  splitEmployeeLedgerForPayroll,
};

let schemaReady = false;

export function employeeOpeningBillNo(empId) {
  return `EMP-OPEN-${empId}`;
}

export function employeeAdvanceBillNo(advanceId) {
  return `EMP-ADV-${advanceId}`;
}

export function employeeAdvanceReversalBillNo(advanceId) {
  return `EMP-ADV-${advanceId}-REV`;
}

export function employeePayrollDeductionBillNo(payrollId) {
  return `EMP-PAYROLL-${payrollId}-DED`;
}

export function employeePayrollRecoveryBillNo(payrollId) {
  return `EMP-PAYROLL-${payrollId}-RECOVERY`;
}

export function employeePayrollPayableBillNo(payrollId) {
  return `EMP-PAYROLL-${payrollId}-PAYABLE`;
}

export function employeeReceiptBillNo(receiptId) {
  return `EMP-RCV-${receiptId}`;
}

function calcClosing(opening, debit, credit) {
  return Number((parseFloat(opening || 0) + parseFloat(debit || 0) - parseFloat(credit || 0)).toFixed(2));
}

async function columnExists(db, table, column) {
  const rows = await db.$queryRawUnsafe(`SHOW COLUMNS FROM \`${table}\` LIKE '${column}'`);
  return Array.isArray(rows) && rows.length > 0;
}

/**
 * Run once per process. Call with branch `prisma` **before** `$transaction`, never with interactive `tx`
 * (MySQL DDL implicit-commit breaks open transactions).
 */
export async function ensureEmployeeLedgerSchema(db) {
  if (schemaReady) return;
  const client = db ?? rootPrisma;
  if (!(await columnExists(client, 'employees', 'opening_balance'))) {
    await client.$executeRawUnsafe(
      'ALTER TABLE employees ADD COLUMN opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0'
    );
  }
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS employee_ledger (
      el_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      branch_id INT NOT NULL DEFAULT 1,
      emp_id INT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      trnx_type VARCHAR(32) NOT NULL,
      bill_no VARCHAR(64) NULL,
      details TEXT NULL,
      debit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      credit_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      opening_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      closing_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
      INDEX idx_emp_ledger_emp (emp_id),
      INDEX idx_emp_ledger_branch (branch_id),
      CONSTRAINT fk_emp_ledger_employee FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await client.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS employee_receipts (
      receipt_id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      branch_id INT NOT NULL DEFAULT 1,
      emp_id INT NOT NULL,
      amount DECIMAL(12,2) NOT NULL,
      receipt_date DATE NOT NULL,
      payment_mode VARCHAR(32) NOT NULL DEFAULT 'CASH',
      account_id INT NOT NULL,
      reference VARCHAR(128) NULL,
      notes TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_emp_receipts_emp (emp_id),
      INDEX idx_emp_receipts_date (receipt_date),
      CONSTRAINT fk_emp_receipts_employee FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  schemaReady = true;
}

export async function recordEmployeeReceiptCredit(db, {
  branchId,
  empId,
  empName,
  receiptId,
  amount,
  notes,
  receiptDate,
}) {
  const amt = parseFloat(amount || 0);
  if (amt <= 0) return;
  await appendEmployeeLedgerEntry(db, {
    branchId,
    empId,
    trnx_type: 'RECEIPT',
    bill_no: employeeReceiptBillNo(receiptId),
    details: [`Payment received from ${empName || 'Employee'}`, notes].filter(Boolean).join(' · '),
    debit_amount: 0,
    credit_amount: amt,
    created_at: receiptDate || new Date(),
  });
}

export async function getEmployeeLedgerClosing(db, empId) {
  const id = parseInt(empId, 10);
  if (!id) return 0;
  const empRows = await db.$queryRawUnsafe(`
    SELECT opening_balance FROM employees WHERE emp_id = ${id} LIMIT 1
  `);
  const opening = parseFloat(empRows?.[0]?.opening_balance || 0);
  const rows = await db.$queryRawUnsafe(`
    SELECT closing_balance FROM employee_ledger
    WHERE emp_id = ${id}
    ORDER BY el_id DESC
    LIMIT 1
  `);
  if (rows?.[0]) {
    return resolveEmployeeReceivableBalance(rows[0].closing_balance, opening);
  }
  return opening;
}

/** Latest closing per employee in one query (for HR lists / payroll batch). */
export async function getEmployeeLedgerClosingsMap(db, empIds) {
  const ids = [...new Set((empIds || []).map((x) => parseInt(x, 10)).filter(Boolean))];
  const map = new Map();
  if (ids.length === 0) return map;

  const idList = ids.join(',');
  const rows = await db.$queryRawUnsafe(`
    SELECT el.emp_id, el.closing_balance
    FROM employee_ledger el
    INNER JOIN (
      SELECT emp_id, MAX(el_id) AS max_el_id
      FROM employee_ledger
      WHERE emp_id IN (${idList})
      GROUP BY emp_id
    ) latest ON latest.max_el_id = el.el_id
  `);
  const openRows = await db.$queryRawUnsafe(`
    SELECT emp_id, opening_balance FROM employees WHERE emp_id IN (${idList})
  `);
  const openingByEmp = new Map();
  for (const e of openRows || []) {
    openingByEmp.set(Number(e.emp_id), parseFloat(e.opening_balance || 0));
  }

  for (const id of ids) {
    const opening = openingByEmp.get(id) ?? 0;
    const ledgerRow = (rows || []).find((r) => Number(r.emp_id) === id);
    const ledgerClosing = ledgerRow ? parseFloat(ledgerRow.closing_balance || 0) : 0;
    map.set(id, resolveEmployeeReceivableBalance(ledgerClosing, opening));
  }
  return map;
}

export function employeeAdvanceSettledBillNo(advanceId) {
  return `${employeeAdvanceBillNo(advanceId)}-SETTLED`;
}

/** Align employee_ledger with employees.opening_balance + all advance rows (fixes legacy data). */
export async function reconcileEmployeeLedgerForEmployee(db, empId, branchId) {
  // Call ensureEmployeeLedgerSchema(prisma) on the root client before $transaction — DDL inside tx breaks MySQL.
  const emp_id = parseInt(empId, 10);
  const empRows = await db.$queryRawUnsafe(`
    SELECT emp_id, emp_name, opening_balance, join_date FROM employees WHERE emp_id = ${emp_id} LIMIT 1
  `);
  const emp = empRows?.[0];
  if (!emp) return 0;

  await setEmployeeOpeningBalance(db, {
    branchId,
    empId: emp_id,
    empName: emp.emp_name,
    openingBalance: parseFloat(emp.opening_balance || 0),
    joinDate: emp.join_date,
  });

  const advances = await db.$queryRawUnsafe(`
    SELECT advance_id, amount, status, advance_date, reason
    FROM employee_advances WHERE emp_id = ${emp_id}
  `);

  for (const a of advances || []) {
    const amt = parseFloat(a.amount || 0);
    if (amt <= 0) continue;
    const advBill = employeeAdvanceBillNo(a.advance_id);
    const settledBill = employeeAdvanceSettledBillNo(a.advance_id);

    const debitRows = await db.$queryRawUnsafe(`
      SELECT 1 AS ok FROM employee_ledger WHERE emp_id = ${emp_id} AND bill_no = '${advBill}' LIMIT 1
    `);
    const hasDebit = !!debitRows?.[0];

    if ((a.status === 'PENDING' || a.status === 'DEDUCTED') && !hasDebit) {
      await recordEmployeeAdvanceDebit(db, {
        branchId,
        empId: emp_id,
        empName: emp.emp_name,
        advanceId: a.advance_id,
        amount: amt,
        reason: a.reason,
        advanceDate: a.advance_date,
      });
    }

    if (a.status === 'DEDUCTED') {
      const debitNow = await db.$queryRawUnsafe(`
        SELECT 1 AS ok FROM employee_ledger WHERE emp_id = ${emp_id} AND bill_no = '${advBill}' LIMIT 1
      `);
      const creditRows = await db.$queryRawUnsafe(`
        SELECT 1 AS ok FROM employee_ledger
        WHERE emp_id = ${emp_id} AND bill_no IN ('${settledBill}', '${advBill}-REV')
        LIMIT 1
      `);
      if (debitNow?.[0] && !creditRows?.[0]) {
        await appendEmployeeLedgerEntry(db, {
          branchId,
          empId: emp_id,
          trnx_type: 'ADVANCE_SETTLED',
          bill_no: settledBill,
          details: `Advance recovered — ${emp.emp_name}`,
          credit_amount: amt,
          created_at: a.advance_date || new Date(),
        });
      }
    }

    if (a.status === 'CANCELLED' && hasDebit) {
      const revRows = await db.$queryRawUnsafe(`
        SELECT 1 AS ok FROM employee_ledger WHERE emp_id = ${emp_id} AND bill_no = '${employeeAdvanceReversalBillNo(a.advance_id)}' LIMIT 1
      `);
      if (!revRows?.[0]) {
        await recordEmployeeAdvanceReversalCredit(db, {
          branchId,
          empId: emp_id,
          empName: emp.emp_name,
          advanceId: a.advance_id,
          amount: amt,
        });
      }
    }
  }

  await db.$executeRawUnsafe(`
    DELETE FROM employee_ledger
    WHERE emp_id = ${emp_id} AND trnx_type = 'SALARY_DED' AND bill_no LIKE 'EMP-PAYROLL-%'
  `);

  const closing = await recalculateEmployeeLedger(db, emp_id);
  return closing;
}

export async function syncEmployeeLedgerBalanceColumn(db, empId) {
  const closing = await getEmployeeLedgerClosing(db, empId);
  return closing;
}

async function appendEmployeeLedgerEntry(db, {
  branchId = 1,
  empId,
  trnx_type,
  bill_no,
  details,
  debit_amount = 0,
  credit_amount = 0,
  created_at = null,
}) {
  const emp_id = parseInt(empId, 10);
  const prev = await getEmployeeLedgerClosing(db, emp_id);
  const debit = parseFloat(debit_amount || 0);
  const credit = parseFloat(credit_amount || 0);
  const closing = calcClosing(prev, debit, credit);
  const billSql = bill_no ? `'${String(bill_no).replace(/'/g, "''")}'` : 'NULL';
  const detSql = details ? `'${String(details).replace(/'/g, "''")}'` : 'NULL';
  const trnxSql = String(trnx_type || 'ENTRY').replace(/'/g, "''");
  const ts = created_at
    ? `'${created_at instanceof Date ? created_at.toISOString().slice(0, 19).replace('T', ' ') : String(created_at).slice(0, 19)}'`
    : 'NOW()';

  await db.$executeRawUnsafe(`
    INSERT INTO employee_ledger (
      branch_id, emp_id, created_at, trnx_type, bill_no, details,
      debit_amount, credit_amount, opening_balance, closing_balance
    ) VALUES (
      ${parseInt(branchId, 10)}, ${emp_id}, ${ts}, '${trnxSql}', ${billSql}, ${detSql},
      ${debit}, ${credit}, ${prev}, ${closing}
    )
  `);
  return closing;
}

export async function recalculateEmployeeLedger(db, empId) {
  const entries = await fetchEmployeeLedgerEntries(db, empId);
  let running = 0;
  for (const e of entries) {
    const opening = running;
    const closing = calcClosing(opening, e.debit_amount, e.credit_amount);
    await db.$executeRawUnsafe(`
      UPDATE employee_ledger
      SET opening_balance = ${opening}, closing_balance = ${closing}
      WHERE el_id = ${parseInt(e.el_id, 10)}
    `);
    running = closing;
  }
  return running;
}

export async function setEmployeeOpeningBalance(db, {
  branchId,
  empId,
  empName,
  openingBalance,
  joinDate = null,
}) {
  const opening = parseFloat(openingBalance || 0);
  const billNo = employeeOpeningBillNo(empId);
  const emp_id = parseInt(empId, 10);
  await db.$executeRawUnsafe(`
    DELETE FROM employee_ledger
    WHERE emp_id = ${emp_id} AND bill_no = '${billNo}'
  `);
  await db.$executeRawUnsafe(`
    UPDATE employees SET opening_balance = ${opening} WHERE emp_id = ${emp_id}
  `);

  if (opening !== 0) {
    const debit = opening > 0 ? opening : 0;
    const credit = opening < 0 ? Math.abs(opening) : 0;
    const label =
      opening > 0
        ? `Opening balance — ${empName || 'Employee'} owes company (pre-system)`
        : `Opening balance — company owes ${empName || 'employee'} (pre-system)`;
    const detSql = `'${label.replace(/'/g, "''")}'`;
    const ts = joinDate
      ? `'${joinDate instanceof Date ? joinDate.toISOString().slice(0, 19).replace('T', ' ') : String(joinDate).slice(0, 19)}'`
      : 'NOW()';
    await db.$executeRawUnsafe(`
      INSERT INTO employee_ledger (
        branch_id, emp_id, created_at, trnx_type, bill_no, details,
        debit_amount, credit_amount, opening_balance, closing_balance
      ) VALUES (
        ${parseInt(branchId, 10)}, ${emp_id}, ${ts}, 'OPENING', '${billNo}', ${detSql},
        ${debit}, ${credit}, 0, 0
      )
    `);
  }

  return recalculateEmployeeLedger(db, emp_id);
}

export async function recordEmployeeAdvanceDebit(db, {
  branchId,
  empId,
  empName,
  advanceId,
  amount,
  reason,
  advanceDate,
}) {
  const amt = parseFloat(amount || 0);
  if (amt <= 0) return;
  await appendEmployeeLedgerEntry(db, {
    branchId,
    empId,
    trnx_type: 'ADVANCE',
    bill_no: employeeAdvanceBillNo(advanceId),
    details: [`Salary advance — ${empName || 'Employee'}`, reason].filter(Boolean).join(' · '),
    debit_amount: amt,
    credit_amount: 0,
    created_at: advanceDate || new Date(),
  });
}

export async function recordEmployeeAdvanceReversalCredit(db, {
  branchId,
  empId,
  empName,
  advanceId,
  amount,
}) {
  const amt = parseFloat(amount || 0);
  if (amt <= 0) return;
  await appendEmployeeLedgerEntry(db, {
    branchId,
    empId,
    trnx_type: 'ADVANCE_REV',
    bill_no: employeeAdvanceReversalBillNo(advanceId),
    details: `Advance cancelled — ${empName || 'Employee'}`,
    debit_amount: 0,
    credit_amount: amt,
  });
}

/** Per-advance credit when payroll marks advances DEDUCTED (avoids double-count with lump sum). */
/** Credit opening / non-advance ledger balance recovered via salary clearance. */
/** Company owed employee (negative ledger); amount paid with salary clearance (debit ledger). */
export async function recordEmployeePayrollPayableSettlement(db, {
  branchId,
  empId,
  empName,
  payrollId,
  amount,
  month,
  year,
}) {
  const amt = parseFloat(amount || 0);
  if (amt <= 0) return;
  const bill = employeePayrollPayableBillNo(payrollId);
  const exists = await db.$queryRawUnsafe(`
    SELECT 1 AS ok FROM employee_ledger WHERE emp_id = ${parseInt(empId, 10)} AND bill_no = '${bill}' LIMIT 1
  `);
  if (exists?.[0]) return;
  await appendEmployeeLedgerEntry(db, {
    branchId,
    empId,
    trnx_type: 'PAYROLL_PAYABLE',
    bill_no: bill,
    details: `Company balance paid with salary ${month}/${year} — ${empName || 'Employee'}`,
    debit_amount: amt,
    credit_amount: 0,
  });
}

export async function recordEmployeePayrollBalanceRecovery(db, {
  branchId,
  empId,
  empName,
  payrollId,
  amount,
  month,
  year,
}) {
  const amt = parseFloat(amount || 0);
  if (amt <= 0) return;
  const bill = employeePayrollRecoveryBillNo(payrollId);
  const exists = await db.$queryRawUnsafe(`
    SELECT 1 AS ok FROM employee_ledger WHERE emp_id = ${parseInt(empId, 10)} AND bill_no = '${bill}' LIMIT 1
  `);
  if (exists?.[0]) return;
  await appendEmployeeLedgerEntry(db, {
    branchId,
    empId,
    trnx_type: 'PAYROLL_RECOVERY',
    bill_no: bill,
    details: `Opening/advance balance recovered in salary ${month}/${year} — ${empName || 'Employee'}`,
    debit_amount: 0,
    credit_amount: amt,
  });
}

export async function reverseEmployeePayrollLedgerCredits(db, empId, { payrollId, advanceIds = [] } = {}) {
  const id = parseInt(empId, 10);
  const pid = parseInt(payrollId, 10);
  if (pid) {
    const recoveryBill = employeePayrollRecoveryBillNo(pid);
    const payableBill = employeePayrollPayableBillNo(pid);
    await db.$executeRawUnsafe(`
      DELETE FROM employee_ledger WHERE emp_id = ${id} AND bill_no IN ('${recoveryBill}', '${payableBill}')
    `);
  }
  for (const advId of advanceIds) {
    const aid = parseInt(advId, 10);
    if (!aid) continue;
    const settledBill = employeeAdvanceSettledBillNo(aid);
    await db.$executeRawUnsafe(`
      DELETE FROM employee_ledger WHERE emp_id = ${id} AND bill_no = '${settledBill}'
    `);
  }
  await recalculateEmployeeLedger(db, id);
}

export async function recordEmployeeAdvanceSettledFromPayroll(db, {
  branchId,
  empId,
  empName,
  advanceId,
  amount,
  month,
  year,
}) {
  const amt = parseFloat(amount || 0);
  if (amt <= 0) return;
  const bill = employeeAdvanceSettledBillNo(advanceId);
  const exists = await db.$queryRawUnsafe(`
    SELECT 1 AS ok FROM employee_ledger WHERE emp_id = ${parseInt(empId, 10)} AND bill_no = '${bill}' LIMIT 1
  `);
  if (exists?.[0]) return;
  await appendEmployeeLedgerEntry(db, {
    branchId,
    empId,
    trnx_type: 'ADVANCE_SETTLED',
    bill_no: bill,
    details: `Advance recovered in salary ${month}/${year} — ${empName || 'Employee'}`,
    debit_amount: 0,
    credit_amount: amt,
  });
}

export async function fetchBranchEmployeeLedgerEntries(db, branchId, {
  empId = null,
  from = null,
  to = null,
  type = null,
  q = null,
  limit = 2500,
} = {}) {
  const bid = parseInt(branchId, 10);
  let sql = `
    SELECT el.*, e.emp_name, e.designation, e.department
    FROM employee_ledger el
    INNER JOIN employees e ON e.emp_id = el.emp_id
    WHERE e.branch_id = ${bid}
  `;
  if (empId) sql += ` AND el.emp_id = ${parseInt(empId, 10)}`;
  if (from) sql += ` AND el.created_at >= '${String(from).slice(0, 10)} 00:00:00'`;
  if (to) sql += ` AND el.created_at <= '${String(to).slice(0, 10)} 23:59:59'`;
  if (type) sql += ` AND el.trnx_type = '${String(type).replace(/'/g, "''")}'`;
  if (q) {
    const safe = String(q).replace(/'/g, "''");
    sql += ` AND (e.emp_name LIKE '%${safe}%' OR el.bill_no LIKE '%${safe}%' OR el.details LIKE '%${safe}%')`;
  }
  sql += ` ORDER BY el.created_at ASC, el.el_id ASC LIMIT ${parseInt(limit, 10)}`;

  const rows = await db.$queryRawUnsafe(sql);
  return (rows || []).map((r) => ({
    el_id: r.el_id,
    emp_id: r.emp_id,
    emp_name: r.emp_name,
    designation: r.designation,
    department: r.department,
    created_at: r.created_at,
    trnx_type: r.trnx_type,
    bill_no: r.bill_no,
    details: r.details,
    debit_amount: parseFloat(r.debit_amount || 0),
    credit_amount: parseFloat(r.credit_amount || 0),
    opening_balance: parseFloat(r.opening_balance || 0),
    closing_balance: parseFloat(r.closing_balance || 0),
  }));
}

export async function fetchEmployeeLedgerEntries(db, empId, { branchId } = {}) {
  const id = parseInt(empId, 10);
  let q = `
    SELECT el.* FROM employee_ledger el
    INNER JOIN employees e ON e.emp_id = el.emp_id
    WHERE el.emp_id = ${id}
  `;
  if (branchId != null) q += ` AND e.branch_id = ${parseInt(branchId, 10)}`;
  q += ' ORDER BY el.created_at ASC, el.el_id ASC';
  const rows = await db.$queryRawUnsafe(q);
  return (rows || []).map((r) => ({
    el_id: r.el_id,
    emp_id: r.emp_id,
    created_at: r.created_at,
    trnx_type: r.trnx_type,
    bill_no: r.bill_no,
    details: r.details,
    debit_amount: parseFloat(r.debit_amount || 0),
    credit_amount: parseFloat(r.credit_amount || 0),
    opening_balance: parseFloat(r.opening_balance || 0),
    closing_balance: parseFloat(r.closing_balance || 0),
  }));
}
