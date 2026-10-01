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
  parseClearanceSnapshot,
  payrollLedgerBillNo,
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

export function employeePayrollSalaryBillNo(payrollId) {
  return `EMP-PAYROLL-${payrollId}-SALARY`;
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
  paymentMode = 'CASH',
  reference = null,
}) {
  const amt = parseFloat(amount || 0);
  if (amt <= 0) return;
  const modeLabel = String(paymentMode || 'CASH').toUpperCase() === 'BANK' ? 'Bank' : 'Cash';
  await appendEmployeeLedgerEntry(db, {
    branchId,
    empId,
    trnx_type: 'RECEIPT',
    bill_no: employeeReceiptBillNo(receiptId),
    details: [
      `${modeLabel} received from ${empName || 'Employee'}`,
      reference ? `Ref: ${reference}` : null,
      notes,
    ].filter(Boolean).join(' · '),
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
    ORDER BY created_at DESC, el_id DESC
    LIMIT 1
  `);
  if (rows?.[0]) {
    return parseFloat(rows[0].closing_balance ?? 0);
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
      SELECT el2.emp_id AS emp_id, MAX(el2.el_id) AS max_el_id
      FROM employee_ledger el2
      INNER JOIN (
        SELECT emp_id, MAX(created_at) AS max_created
        FROM employee_ledger
        WHERE emp_id IN (${idList})
        GROUP BY emp_id
      ) mc ON mc.emp_id = el2.emp_id AND el2.created_at = mc.max_created
      WHERE el2.emp_id IN (${idList})
      GROUP BY el2.emp_id
    ) latest ON latest.max_el_id = el.el_id AND latest.emp_id = el.emp_id
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
    if (ledgerRow) {
      map.set(id, parseFloat(ledgerRow.closing_balance ?? 0));
    } else {
      map.set(id, opening);
    }
  }
  return map;
}

export function employeeAdvanceSettledBillNo(advanceId) {
  return `${employeeAdvanceBillNo(advanceId)}-SETTLED`;
}

/** Align starting balance, advances, payroll, receipts; recalc account balance (fixes legacy data). */
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
    SELECT advance_id, amount, status, advance_date, reason, payroll_id
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

    if (a.status === 'DEDUCTED' && !parseInt(a.payroll_id, 10)) {
      const debitNow = await db.$queryRawUnsafe(`
        SELECT 1 AS ok FROM employee_ledger WHERE emp_id = ${emp_id} AND bill_no = '${advBill}' LIMIT 1
      `);
      const creditRows = await db.$queryRawUnsafe(`
        SELECT 1 AS ok FROM employee_ledger
        WHERE emp_id = ${emp_id} AND bill_no IN ('${settledBill}', '${advBill}-REV')
        LIMIT 1
      `);
      if (debitNow?.[0] && !creditRows?.[0]) {
        let month = 0;
        let year = 0;
        if (a.advance_date) {
          const d = new Date(a.advance_date);
          if (!Number.isNaN(d.getTime())) {
            month = d.getMonth() + 1;
            year = d.getFullYear();
          }
        }
        await recordEmployeeAdvanceSettledFromPayroll(db, {
          branchId,
          empId: emp_id,
          empName: emp.emp_name,
          advanceId: a.advance_id,
          amount: amt,
          month,
          year,
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

  await syncEmployeeReceipts(db, emp_id, branchId, emp.emp_name);
  await syncEmployeePayrollLedgerMemos(db, emp_id, branchId, emp.emp_name);
  const closing = await recalculateEmployeeLedger(db, emp_id);
  return closing;
}

async function syncEmployeeReceipts(db, empId, branchId, empName) {
  const emp_id = parseInt(empId, 10);
  const rows = await db.$queryRawUnsafe(`
    SELECT receipt_id, amount, notes, receipt_date, payment_mode, reference
    FROM employee_receipts WHERE emp_id = ${emp_id}
    ORDER BY receipt_id ASC
  `);
  for (const r of rows || []) {
    const bill = employeeReceiptBillNo(r.receipt_id);
    const exists = await db.$queryRawUnsafe(`
      SELECT 1 AS ok FROM employee_ledger WHERE emp_id = ${emp_id} AND bill_no = '${bill}' LIMIT 1
    `);
    if (exists?.[0]) continue;
    await recordEmployeeReceiptCredit(db, {
      branchId,
      empId: emp_id,
      empName,
      receiptId: r.receipt_id,
      amount: r.amount,
      notes: r.notes,
      receiptDate: r.receipt_date,
      paymentMode: r.payment_mode,
      reference: r.reference,
    });
  }
}

/** Informational row (0 debit / 0 credit) — salary paid at clearance; does not change running balance. */
export async function recordEmployeePayrollSalaryPayment(db, {
  branchId,
  empId,
  empName,
  payrollId,
  month,
  year,
  netSalary = 0,
  totalPayable = 0,
  cashAmount = 0,
  bankAmount = 0,
  advanceRecovered = 0,
  advanceWithSalary = 0,
  paymentReference = null,
  paymentDate = null,
}) {
  const pid = parseInt(payrollId, 10);
  if (!pid) return;
  const bill = employeePayrollSalaryBillNo(pid);
  const exists = await db.$queryRawUnsafe(`
    SELECT 1 AS ok FROM employee_ledger WHERE emp_id = ${parseInt(empId, 10)} AND bill_no = '${bill}' LIMIT 1
  `);
  if (exists?.[0]) return;

  const parts = [`Salary clearance ${month}/${year} — ${empName || 'Employee'}`];
  const net = parseFloat(netSalary || 0);
  const paid = parseFloat(totalPayable || 0);
  const cash = parseFloat(cashAmount || 0);
  const bank = parseFloat(bankAmount || 0);
  const recovered = parseFloat(advanceRecovered || 0);
  const advWith = parseFloat(advanceWithSalary || 0);
  if (net > 0) parts.push(`Month net Rs ${net.toFixed(2)}`);
  if (recovered > 0) parts.push(`Advance recovered Rs ${recovered.toFixed(2)}`);
  if (advWith > 0) parts.push(`Advance with salary Rs ${advWith.toFixed(2)}`);
  if (paid > 0) parts.push(`Total paid Rs ${paid.toFixed(2)}`);
  if (cash > 0 && bank > 0) parts.push(`Cash Rs ${cash.toFixed(2)} · Bank Rs ${bank.toFixed(2)}`);
  else if (cash > 0) parts.push(`Paid cash Rs ${cash.toFixed(2)}`);
  else if (bank > 0) parts.push(`Paid bank Rs ${bank.toFixed(2)}`);
  if (paymentReference) parts.push(`Ref: ${paymentReference}`);
  parts.push(`Finance bill ${payrollLedgerBillNo(pid)}`);

  await appendEmployeeLedgerEntry(db, {
    branchId,
    empId,
    trnx_type: 'SALARY_PAYMENT',
    bill_no: bill,
    details: parts.join(' · '),
    debit_amount: 0,
    credit_amount: 0,
    created_at: paymentDate || new Date(),
  });
}

async function syncEmployeePayrollLedgerMemos(db, empId, branchId, empName) {
  const emp_id = parseInt(empId, 10);
  const rows = await db.$queryRawUnsafe(`
    SELECT payroll_id, month, year, net_salary, payment_date, notes, advance_deduction
    FROM payrolls WHERE emp_id = ${emp_id} AND status = 'PAID'
    ORDER BY year ASC, month ASC, payroll_id ASC
  `);
  for (const row of rows || []) {
    const snap = parseClearanceSnapshot(row.notes);
    await syncEmployeePayrollClearanceEntries(db, emp_id, branchId, empName, row, snap);

    const advanceRecovered = parseFloat(
      snap?.advance_settled_on_ledger ?? 0
    ) + parseFloat(snap?.opening_balance_recovered ?? 0);
    const recoveredFallback = parseFloat(row.advance_deduction || 0);
    await recordEmployeePayrollSalaryPayment(db, {
      branchId,
      empId: emp_id,
      empName,
      payrollId: row.payroll_id,
      month: row.month,
      year: row.year,
      netSalary: snap?.month_net ?? row.net_salary,
      totalPayable: snap?.total_payable ?? snap?.amount_paid ?? row.net_salary,
      cashAmount: snap?.cash_amount ?? 0,
      bankAmount: snap?.bank_amount ?? 0,
      advanceRecovered: advanceRecovered > 0 ? advanceRecovered : recoveredFallback,
      advanceWithSalary: snap?.advance_with_salary ?? 0,
      paymentReference: snap?.payment_reference ?? null,
      paymentDate: row.payment_date || snap?.cleared_at || null,
    });
  }
}

async function syncEmployeePayrollClearanceEntries(db, empId, branchId, empName, row, snap) {
  const emp_id = parseInt(empId, 10);
  const pid = parseInt(row.payroll_id, 10);
  const month = row.month;
  const year = row.year;
  if (!pid) return;

  const openingRec = parseFloat(snap?.opening_balance_recovered ?? 0);
  if (openingRec > 0.009) {
    await recordEmployeePayrollBalanceRecovery(db, {
      branchId,
      empId: emp_id,
      empName,
      payrollId: pid,
      amount: openingRec,
      month,
      year,
    });
  }

  const payableSettled = parseFloat(snap?.ledger_payable_settled ?? 0);
  if (payableSettled > 0.009) {
    await recordEmployeePayrollPayableSettlement(db, {
      branchId,
      empId: emp_id,
      empName,
      payrollId: pid,
      amount: payableSettled,
      month,
      year,
    });
  }

  const snapDeducted = Array.isArray(snap?.deducted_advances) ? snap.deducted_advances : [];
  if (snapDeducted.length > 0) {
    for (const d of snapDeducted) {
      const aid = parseInt(d.advance_id ?? d.advanceId, 10);
      const damt = parseFloat(d.amount ?? 0);
      if (!aid || damt <= 0) continue;
      await recordEmployeeAdvanceSettledFromPayroll(db, {
        branchId,
        empId: emp_id,
        empName,
        advanceId: aid,
        amount: damt,
        month,
        year,
      });
    }
  } else {
    const advRows = await db.$queryRawUnsafe(`
      SELECT advance_id, amount FROM employee_advances
      WHERE emp_id = ${emp_id} AND payroll_id = ${pid} AND status = 'DEDUCTED'
    `);
    for (const a of advRows || []) {
      await recordEmployeeAdvanceSettledFromPayroll(db, {
        branchId,
        empId: emp_id,
        empName,
        advanceId: a.advance_id,
        amount: a.amount,
        month,
        year,
      });
    }
  }

  let underpaid = parseFloat(snap?.salary_underpaid_carry ?? 0);
  if (underpaid <= 0.009 && snap) {
    const totalPayable = parseFloat(snap.total_payable ?? 0);
    const amountPaid = parseFloat(snap.amount_paid ?? 0);
    if (totalPayable > amountPaid + 0.009) {
      underpaid = Math.round((totalPayable - amountPaid) * 100) / 100;
    }
  }
  if (underpaid > 0.009) {
    await recordEmployeePayrollUnderpaidCarry(db, {
      branchId,
      empId: emp_id,
      empName,
      payrollId: pid,
      amount: underpaid,
      month,
      year,
    });
  }
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
  const id = parseInt(empId, 10);
  const entries = await db.$queryRawUnsafe(`
    SELECT el_id, debit_amount, credit_amount
    FROM employee_ledger
    WHERE emp_id = ${id}
    ORDER BY created_at ASC, el_id ASC
  `);
  let running = 0;
  for (const e of entries || []) {
    const opening = running;
    const debit = parseFloat(e.debit_amount || 0);
    const credit = parseFloat(e.credit_amount || 0);
    const closing = calcClosing(opening, debit, credit);
    await db.$executeRawUnsafe(`
      UPDATE employee_ledger
      SET opening_balance = ${opening}, closing_balance = ${closing}
      WHERE el_id = ${parseInt(e.el_id, 10)}
    `);
    running = closing;
  }
  return running;
}

function employeeOpeningDetailsLabel(opening, empName) {
  const name = empName || 'Employee';
  if (opening > 0) {
    return `Starting account balance — ${name} owes company`;
  }
  if (opening < 0) {
    return `Starting account balance — company owes ${name}`;
  }
  return `Starting account balance — ${name}`;
}

/** Signed amount stored on the OPENING ledger row (+ employee owes, − company owes). */
export async function readEmployeeStartingBalanceFromLedger(db, empId) {
  const emp_id = parseInt(empId, 10);
  if (!emp_id) return null;
  const bill = employeeOpeningBillNo(emp_id);
  const rows = await db.$queryRawUnsafe(`
    SELECT debit_amount, credit_amount FROM employee_ledger
    WHERE emp_id = ${emp_id} AND bill_no = '${bill}' LIMIT 1
  `);
  const row = rows?.[0];
  if (!row) return null;
  return parseFloat(row.debit_amount || 0) - parseFloat(row.credit_amount || 0);
}

/** Keep employees.opening_balance and the OPENING ledger row aligned; recalc running balances. */
export async function setEmployeeOpeningBalance(db, {
  branchId,
  empId,
  empName,
  openingBalance,
  joinDate = null,
}) {
  const opening = Math.round(parseFloat(openingBalance || 0) * 100) / 100;
  const billNo = employeeOpeningBillNo(empId);
  const emp_id = parseInt(empId, 10);
  const bid = parseInt(branchId, 10);

  await db.$executeRawUnsafe(`
    UPDATE employees SET opening_balance = ${opening} WHERE emp_id = ${emp_id}
  `);

  const existing = await db.$queryRawUnsafe(`
    SELECT el_id, created_at FROM employee_ledger
    WHERE emp_id = ${emp_id} AND bill_no = '${billNo}' LIMIT 1
  `);

  if (Math.abs(opening) < 0.009) {
    if (existing?.[0]) {
      await db.$executeRawUnsafe(`
        DELETE FROM employee_ledger WHERE emp_id = ${emp_id} AND bill_no = '${billNo}'
      `);
    }
    return recalculateEmployeeLedger(db, emp_id);
  }

  const debit = opening > 0 ? opening : 0;
  const credit = opening < 0 ? Math.abs(opening) : 0;
  const detSql = `'${employeeOpeningDetailsLabel(opening, empName).replace(/'/g, "''")}'`;

  if (existing?.[0]) {
    await db.$executeRawUnsafe(`
      UPDATE employee_ledger
      SET trnx_type = 'OPENING',
        details = ${detSql},
        debit_amount = ${debit},
        credit_amount = ${credit}
      WHERE el_id = ${parseInt(existing[0].el_id, 10)}
    `);
  } else {
    const ts = joinDate
      ? `'${joinDate instanceof Date ? joinDate.toISOString().slice(0, 19).replace('T', ' ') : String(joinDate).slice(0, 19)}'`
      : 'NOW()';
    await db.$executeRawUnsafe(`
      INSERT INTO employee_ledger (
        branch_id, emp_id, created_at, trnx_type, bill_no, details,
        debit_amount, credit_amount, opening_balance, closing_balance
      ) VALUES (
        ${bid}, ${emp_id}, ${ts}, 'OPENING', '${billNo}', ${detSql},
        ${debit}, ${credit}, 0, 0
      )
    `);
  }

  return recalculateEmployeeLedger(db, emp_id);
}

/** If master opening_balance and OPENING row drifted, master wins and ledger is corrected. */
export async function ensureEmployeeStartingBalanceSynced(db, empId, branchId, empName) {
  const emp_id = parseInt(empId, 10);
  const empRows = await db.$queryRawUnsafe(`
    SELECT opening_balance, join_date FROM employees WHERE emp_id = ${emp_id} LIMIT 1
  `);
  const master = parseFloat(empRows?.[0]?.opening_balance ?? 0);
  const fromLedger = await readEmployeeStartingBalanceFromLedger(db, emp_id);
  const ledgerVal = fromLedger == null ? 0 : fromLedger;
  if (Math.abs(master - ledgerVal) > 0.02) {
    return setEmployeeOpeningBalance(db, {
      branchId,
      empId: emp_id,
      empName,
      openingBalance: master,
      joinDate: empRows?.[0]?.join_date,
    });
  }
  return getEmployeeLedgerClosing(db, emp_id);
}

export async function recordEmployeeAdvanceDebit(db, {
  branchId,
  empId,
  empName,
  advanceId,
  amount,
  reason,
  advanceDate,
  paymentMode = null,
}) {
  const amt = parseFloat(amount || 0);
  if (amt <= 0) return;
  const modeLabel = paymentMode
    ? (String(paymentMode).toUpperCase() === 'BANK' ? 'Bank' : 'Cash')
    : null;
  await appendEmployeeLedgerEntry(db, {
    branchId,
    empId,
    trnx_type: 'ADVANCE',
    bill_no: employeeAdvanceBillNo(advanceId),
    details: [
      modeLabel ? `${modeLabel} advance to ${empName || 'Employee'}` : `Salary advance — ${empName || 'Employee'}`,
      reason,
    ].filter(Boolean).join(' · '),
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

/** Salary clearance paid less than total due — company still owes (ledger credit). */
export async function recordEmployeePayrollUnderpaidCarry(db, {
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
  const bill = `${employeePayrollSalaryBillNo(payrollId)}-UNDERPAID`;
  const exists = await db.$queryRawUnsafe(`
    SELECT 1 AS ok FROM employee_ledger WHERE emp_id = ${parseInt(empId, 10)} AND bill_no = '${bill}' LIMIT 1
  `);
  if (exists?.[0]) return;
  await appendEmployeeLedgerEntry(db, {
    branchId,
    empId,
    trnx_type: 'SALARY_UNDERPAID',
    bill_no: bill,
    details: `Salary underpaid (carried) ${month}/${year} — ${empName || 'Employee'} · Rs ${amt.toFixed(2)}`,
    debit_amount: 0,
    credit_amount: amt,
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
    const salaryBill = employeePayrollSalaryBillNo(pid);
    const underpaidBill = `${salaryBill}-UNDERPAID`;
    await db.$executeRawUnsafe(`
      DELETE FROM employee_ledger WHERE emp_id = ${id} AND bill_no IN ('${recoveryBill}', '${payableBill}', '${salaryBill}', '${underpaidBill}')
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
  offset = 0,
} = {}) {
  const bid = parseInt(branchId, 10);
  let sql = `
    SELECT el.*, e.emp_name, e.designation, e.department,
      er.payment_mode AS receipt_payment_mode, er.reference AS receipt_reference,
      ea.payment_mode AS advance_payment_mode
    FROM employee_ledger el
    INNER JOIN employees e ON e.emp_id = el.emp_id
    LEFT JOIN employee_receipts er ON el.trnx_type = 'RECEIPT'
      AND er.receipt_id = CAST(REPLACE(el.bill_no, 'EMP-RCV-', '') AS UNSIGNED)
    LEFT JOIN employee_advances ea ON el.trnx_type = 'ADVANCE'
      AND ea.advance_id = CAST(REPLACE(el.bill_no, 'EMP-ADV-', '') AS UNSIGNED)
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
  const lim = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 2500);
  const off = Math.max(parseInt(offset, 10) || 0, 0);
  sql += ` ORDER BY el.created_at DESC, el.el_id DESC LIMIT ${off}, ${lim}`;

  const rows = await db.$queryRawUnsafe(sql);
  return (rows || []).map((r) => {
    let payment_channel = null;
    if (r.trnx_type === 'RECEIPT' && r.receipt_payment_mode) {
      payment_channel = String(r.receipt_payment_mode).toUpperCase() === 'BANK' ? 'Bank' : 'Cash';
    } else if (r.trnx_type === 'ADVANCE' && r.advance_payment_mode) {
      payment_channel = String(r.advance_payment_mode).toUpperCase() === 'BANK' ? 'Bank' : 'Cash';
    } else if (r.trnx_type === 'SALARY_PAYMENT' && r.details) {
      if (/Paid cash/i.test(r.details)) payment_channel = 'Cash';
      else if (/Paid bank/i.test(r.details)) payment_channel = 'Bank';
      else if (/Cash Rs/i.test(r.details) && /Bank Rs/i.test(r.details)) payment_channel = 'Cash + Bank';
    }
    return {
      el_id: r.el_id,
      emp_id: r.emp_id,
      emp_name: r.emp_name,
      designation: r.designation,
      department: r.department,
      created_at: r.created_at,
      trnx_type: r.trnx_type,
      bill_no: r.bill_no,
      details: r.details,
      payment_channel,
      debit_amount: parseFloat(r.debit_amount || 0),
      credit_amount: parseFloat(r.credit_amount || 0),
      opening_balance: parseFloat(r.opening_balance || 0),
      closing_balance: parseFloat(r.closing_balance || 0),
    };
  });
}

export async function fetchEmployeeLedgerEntries(db, empId, { branchId } = {}) {
  const id = parseInt(empId, 10);
  let q = `
    SELECT el.* FROM employee_ledger el
    INNER JOIN employees e ON e.emp_id = el.emp_id
    WHERE el.emp_id = ${id}
  `;
  if (branchId != null) q += ` AND e.branch_id = ${parseInt(branchId, 10)}`;
  q += ' ORDER BY el.created_at DESC, el.el_id DESC';
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
