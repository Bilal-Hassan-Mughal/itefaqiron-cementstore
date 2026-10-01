import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';
import { createLedgerEntry } from '@/lib/ledger-helper';
import { getNextId } from '@/lib/id-helper';
import {
  calcPayroll,
  aggregateAttendanceForPayroll,
  getPrevMonth,
  splitPendingAdvances,
  calcTotalPayable,
  employeeJoinedAfterMonth,
  getDaysInMonth,
  detectBranchOffDays,
  payrollAsOfDate,
  buildPayrollCalcInput,
  encodeClearanceSnapshot,
  parseClearanceSnapshot,
  enrichPayrollWithSnapshot,
  parseClearancePayment,
  CLEARANCE_ADVANCE_REASON_PREFIX,
  toLocalDateKey,
  payrollLedgerBillNo,
  payrollLedgerReversalBillNo,
  resolveMonthGrossEarned,
  calcPayrollWithCappedAdvance,
} from '@/lib/hr-payroll';
import {
  ensureEmployeeLedgerSchema,
  getEmployeeLedgerClosing,
  getEmployeeLedgerClosingsMap,
  resolvePayrollAdvanceDeduction,
  resolveEmployeeReceivableBalance,
  splitEmployeeLedgerForPayroll,
  recordEmployeeAdvanceDebit,
  recordEmployeeAdvanceSettledFromPayroll,
  recordEmployeePayrollBalanceRecovery,
  recordEmployeePayrollPayableSettlement,
  recordEmployeePayrollSalaryPayment,
  reverseEmployeePayrollLedgerCredits,
} from '@/lib/employee-ledger';

async function loadPendingAdvances(empId) {
  try {
    return await prisma.$queryRaw`SELECT * FROM employee_advances WHERE emp_id = ${empId} AND status = 'PENDING'`;
  } catch {
    return [];
  }
}

async function loadPendingAdvancesByEmpIds(empIds) {
  const ids = [...new Set((empIds || []).map((x) => parseInt(x, 10)).filter(Boolean))];
  const byEmp = {};
  if (ids.length === 0) return byEmp;
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT * FROM employee_advances
      WHERE status = 'PENDING' AND emp_id IN (${ids.join(',')})
    `);
    for (const row of rows || []) {
      const eid = Number(row.emp_id);
      if (!byEmp[eid]) byEmp[eid] = [];
      byEmp[eid].push(row);
    }
  } catch {
    /* optional */
  }
  return byEmp;
}

function groupAttendanceByEmp(records) {
  const byEmp = {};
  for (const row of records || []) {
    const eid = Number(row.emp_id);
    if (!byEmp[eid]) byEmp[eid] = [];
    byEmp[eid].push(row);
  }
  return byEmp;
}

/** Remove advances created when paying extra advance with salary clearance */
async function deleteClearanceAdvances({ payrollId, empId, snapshot, payDateKey }) {
  const clearanceAdvanceId = snapshot?.clearance_advance_id
    ? parseInt(snapshot.clearance_advance_id, 10)
    : null;
  const advanceWithSalary = parseFloat(snapshot?.advance_with_salary || 0);
  const reasonPrefix = CLEARANCE_ADVANCE_REASON_PREFIX.replace(/'/g, "''");

  if (clearanceAdvanceId) {
    await prisma.$executeRawUnsafe(`
      DELETE FROM employee_advances
      WHERE advance_id = ${clearanceAdvanceId} AND emp_id = ${empId}
    `);
  }

  await prisma.$executeRawUnsafe(`
    DELETE FROM employee_advances
    WHERE emp_id = ${empId} AND payroll_id = ${payrollId} AND status = 'PENDING'
  `);

  await prisma.$executeRawUnsafe(`
    DELETE FROM employee_advances
    WHERE emp_id = ${empId} AND status = 'PENDING'
      AND reason LIKE '${reasonPrefix}%'
      ${payDateKey ? `AND DATE(advance_date) = '${payDateKey}'` : ''}
  `);

  if (advanceWithSalary > 0) {
    await prisma.$executeRawUnsafe(`
      DELETE FROM employee_advances
      WHERE emp_id = ${empId} AND status = 'PENDING' AND amount = ${advanceWithSalary}
        ${payDateKey ? `AND DATE(advance_date) = '${payDateKey}'` : ''}
        AND (
          reason LIKE '${reasonPrefix}%'
          OR reason LIKE '%salary clearance%'
          OR reason LIKE '%Advance paid with salary%'
        )
    `);
  }
}

/** Pending payroll + pending advance linked by payroll_id = failed undo leftover */
async function cleanupOrphanClearanceAdvances(branchId, month, year) {
  const reasonPrefix = CLEARANCE_ADVANCE_REASON_PREFIX.replace(/'/g, "''");
  try {
    await prisma.$executeRawUnsafe(`
      DELETE ea FROM employee_advances ea
      INNER JOIN payrolls p ON ea.emp_id = p.emp_id
      INNER JOIN employees e ON p.emp_id = e.emp_id
      WHERE ea.status = 'PENDING' AND p.status = 'PENDING'
        AND e.branch_id = ${branchId} AND p.month = ${month} AND p.year = ${year}
        AND (
          ea.payroll_id = p.payroll_id
          OR (
            ea.payroll_id IS NULL
            AND (
              ea.reason LIKE '${reasonPrefix}%'
              OR ea.reason LIKE '%Advance paid with salary clearance%'
            )
          )
        )
    `);
  } catch (e) {
    console.error('Orphan clearance advance cleanup failed:', e);
  }
}

async function recordPayrollLedgerPayment({
  payrollId,
  empName,
  payment,
  paymentReference,
  month,
  year,
  monthNet = 0,
  previousBalance = 0,
  advanceWithSalary = 0,
  totalPayable = 0,
}) {
  if (payment.cashAmt <= 0 && payment.bankAmt <= 0) return payrollLedgerBillNo(payrollId);

  const billNo = payrollLedgerBillNo(payrollId);
  const period = `${month}/${year}`;

  const buildDetails = (channel) => {
    const parts = [`Salary clearance ${period} — ${empName}`];
    if (parseFloat(monthNet) > 0) parts.push(`Month net Rs ${parseFloat(monthNet).toFixed(2)}`);
    if (parseFloat(previousBalance) > 0) parts.push(`Prev balance Rs ${parseFloat(previousBalance).toFixed(2)}`);
    if (parseFloat(advanceWithSalary) > 0) parts.push(`Advance with salary Rs ${parseFloat(advanceWithSalary).toFixed(2)}`);
    if (parseFloat(totalPayable) > 0) parts.push(`Total paid Rs ${parseFloat(totalPayable).toFixed(2)}`);
    if (channel === 'cash' && payment.bankAmt > 0) parts.push('Cash portion');
    if (channel === 'bank' && payment.cashAmt > 0) parts.push('Bank portion');
    if (paymentReference) parts.push(`Ref: ${paymentReference}`);
    return parts.join(' · ');
  };

  const payrollLedgerTxOptions = { timeout: 30000, maxWait: 15000 };

  await prisma.$transaction(async (tx) => {
    if (payment.cashAmt > 0 && payment.paid_from_account_id) {
      const cashAccount = await tx.customer.findUnique({ where: { cus_id: payment.paid_from_account_id } });
      if (!cashAccount) throw new Error('Cash account not found');

      const currentBalance = parseFloat(cashAccount.cus_balance || 0);
      const ledgerEntryData = createLedgerEntry({
        cus_id: cashAccount.cus_id,
        opening_balance: currentBalance,
        debit_amount: 0,
        credit_amount: payment.cashAmt,
        bill_no: billNo,
        trnx_type: 'CASH_PAYMENT',
        ledger_type: 'Salary',
        details: buildDetails('cash'),
        payments: payment.cashAmt,
        cash_payment: payment.cashAmt,
        bank_payment: 0,
      });

      const l_id = await getNextId('ledger', 'l_id', tx);
      await tx.ledger.create({ data: { l_id, ...ledgerEntryData } });
      await tx.customer.update({
        where: { cus_id: cashAccount.cus_id },
        data: { cus_balance: ledgerEntryData.closing_balance },
      });
    }

    if (payment.bankAmt > 0 && payment.bank_account_id) {
      let bankAccount = await tx.customer.findUnique({ where: { cus_id: payment.bank_account_id } });
      if (!bankAccount) throw new Error('Bank account not found');

      if (payment.cashAmt > 0 && payment.paid_from_account_id === payment.bank_account_id) {
        bankAccount = await tx.customer.findUnique({ where: { cus_id: bankAccount.cus_id } });
      }

      const currentBalance = parseFloat(bankAccount.cus_balance || 0);
      const ledgerEntryData = createLedgerEntry({
        cus_id: bankAccount.cus_id,
        opening_balance: currentBalance,
        debit_amount: 0,
        credit_amount: payment.bankAmt,
        bill_no: billNo,
        trnx_type: 'BANK_PAYMENT',
        ledger_type: 'Salary',
        details: buildDetails('bank'),
        payments: payment.bankAmt,
        cash_payment: 0,
        bank_payment: payment.bankAmt,
      });

      const l_id = await getNextId('ledger', 'l_id', tx);
      await tx.ledger.create({ data: { l_id, ...ledgerEntryData } });
      await tx.customer.update({
        where: { cus_id: bankAccount.cus_id },
        data: { cus_balance: ledgerEntryData.closing_balance },
      });
    }
  }, payrollLedgerTxOptions);

  return billNo;
}

async function reversePayrollLedger(payrollId, snapshot = null, { empName = '', month, year } = {}) {
  const payrollBillNo = payrollLedgerBillNo(payrollId);
  const originalBillNo = snapshot?.ledger_bill_no || payrollBillNo;
  const reverseBillNo = payrollLedgerReversalBillNo(payrollId);
  const period = month && year ? `${month}/${year}` : '';
  const totalPaid = parseFloat(snapshot?.total_payable || 0);

  const billNos = [...new Set([payrollBillNo, originalBillNo].filter(Boolean))];
  const entries = [];
  const seenIds = new Set();
  for (const billNo of billNos) {
    const rows = await prisma.ledger.findMany({
      where: { bill_no: billNo },
      orderBy: { l_id: 'asc' },
    });
    for (const row of rows) {
      if (!seenIds.has(row.l_id)) {
        seenIds.add(row.l_id);
        entries.push(row);
      }
    }
  }

  if (entries.length === 0) {
    if (totalPaid > 0) {
      throw new Error(`Ledger entries not found for ${payrollBillNo}. Cannot undo safely.`);
    }
    return null;
  }

  const existingReversals = await prisma.ledger.findMany({
    where: { bill_no: reverseBillNo },
    orderBy: { l_id: 'asc' },
  });

  const hasModernReversalMarkers = existingReversals.some(
    (rev) => (rev.details || '').includes('orig_l_id:')
  );

  const isEntryAlreadyReversed = (entry) => {
    const origRef = `orig_l_id:${entry.l_id}`;
    const entryBill = entry.bill_no || payrollBillNo;
    const entryCredit = parseFloat(entry.credit_amount || 0);
    const entryDebit = parseFloat(entry.debit_amount || 0);
    return existingReversals.some((rev) => {
      const details = rev.details || '';
      if (details.includes(origRef)) return true;
      if (hasModernReversalMarkers) return false;
      if (rev.cus_id !== entry.cus_id) return false;
      const revDebit = parseFloat(rev.debit_amount || 0);
      const revCredit = parseFloat(rev.credit_amount || 0);
      return revDebit === entryCredit
        && revCredit === entryDebit
        && (details.includes(`(ref ${entryBill})`) || details.includes(`(ref ${payrollBillNo})`));
    });
  };

  const toReverse = entries.filter((entry) => !isEntryAlreadyReversed(entry));
  if (toReverse.length === 0) return reverseBillNo;

  await prisma.$transaction(async (tx) => {
    for (const entry of toReverse) {
      const acc = await tx.customer.findUnique({ where: { cus_id: entry.cus_id } });
      if (!acc) throw new Error(`Cash/bank account not found for ledger reversal (cus_id ${entry.cus_id})`);

      const originalCredit = parseFloat(entry.credit_amount || 0);
      const originalDebit = parseFloat(entry.debit_amount || 0);
      const originalCash = parseFloat(entry.cash_payment || 0);
      const originalBank = parseFloat(entry.bank_payment || 0);
      const reversalDebit = originalCredit;
      const reversalCredit = originalDebit;
      const payAmt = reversalDebit || reversalCredit;
      const isBank = entry.trnx_type === 'BANK_PAYMENT' || originalBank > 0;
      const origRef = `orig_l_id:${entry.l_id}`;

      const currentBalance = parseFloat(acc.cus_balance || 0);
      const ledgerEntryData = createLedgerEntry({
        cus_id: entry.cus_id,
        opening_balance: currentBalance,
        debit_amount: reversalDebit,
        credit_amount: reversalCredit,
        bill_no: reverseBillNo,
        trnx_type: isBank ? 'BANK_TRANSFER' : 'CASH',
        ledger_type: 'Receiving',
        details: [
          `Reversal — salary clearance undone${period ? ` ${period}` : ''}${empName ? ` — ${empName}` : ''}`,
          `(ref ${entry.bill_no || payrollBillNo})`,
          origRef,
          entry.details ? `Original: ${entry.details}` : null,
        ].filter(Boolean).join(' · '),
        payments: payAmt,
        cash_payment: originalCash > 0 ? originalCash : (isBank ? 0 : payAmt),
        bank_payment: originalBank > 0 ? originalBank : (isBank ? payAmt : 0),
      });

      const l_id = await getNextId('ledger', 'l_id', tx);
      await tx.ledger.create({ data: { l_id, ...ledgerEntryData } });
      await tx.customer.update({
        where: { cus_id: entry.cus_id },
        data: { cus_balance: ledgerEntryData.closing_balance },
      });
    }
  }, { timeout: 30000, maxWait: 15000 });

  return reverseBillNo;
}

async function computeEmployeeMonthPayroll(emp, month, year, {
  advanceDeduction = null,
  existing = null,
  offDays = [],
  attendanceRecords = null,
  pendingAdvances: pendingAdvancesIn = null,
  ledgerReceivable: ledgerReceivableIn = null,
} = {}) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  const att = attendanceRecords ?? await prisma.attendance.findMany({
    where: { emp_id: emp.emp_id, att_date: { gte: monthStart, lt: monthEnd } },
  });

  const pendingAdvances = pendingAdvancesIn ?? await loadPendingAdvances(emp.emp_id);
  const pendingAdvanceSum = pendingAdvances.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
  const openingBal = parseFloat(emp.opening_balance ?? 0);
  let ledgerClosing = ledgerReceivableIn;
  if (ledgerClosing == null) {
    await ensureEmployeeLedgerSchema(prisma);
    ledgerClosing = await getEmployeeLedgerClosing(prisma, emp.emp_id);
  } else {
    const parsed = parseFloat(ledgerClosing);
    ledgerClosing = Number.isFinite(parsed) ? parsed : 0;
  }
  const signedClosing = resolveEmployeeReceivableBalance(ledgerClosing, openingBal);
  const { recoverFromSalary, addToPayable } = splitEmployeeLedgerForPayroll(signedClosing);
  const ledgerReceivable = recoverFromSalary;
  const totalPendingAdvance = advanceDeduction != null
    ? advanceDeduction
    : resolvePayrollAdvanceDeduction(signedClosing, openingBal, pendingAdvanceSum);

  const agg = aggregateAttendanceForPayroll({
    month,
    year,
    attendanceRecords: att,
    joinDate: emp.join_date,
    asOfDate: payrollAsOfDate(month, year),
    offDays,
  });

  const allowedLeaves = Number.isFinite(emp.allowed_leaves_per_month) ? emp.allowed_leaves_per_month : 2;
  const allowedAbsents = Number.isFinite(emp.allowed_absents_per_month) ? emp.allowed_absents_per_month : 0;
  const preserveBonus = existing ? parseFloat(existing.bonus || 0) : 0;
  const preserveOther = existing ? parseFloat(existing.other_deduction || 0) : 0;

  const calendarDays = getDaysInMonth(month, year);

  const derived = calcPayrollWithCappedAdvance({
    basic_salary: emp.basic_salary,
    total_days: agg.total_days,
    salary_divisor_days: calendarDays,
    days_present: agg.days_present,
    leaves_taken: agg.leaves_taken,
    absents_taken: agg.absents_taken,
    absent_days: agg.absent_days,
    allowed_leaves: allowedLeaves,
    allowed_absents: allowedAbsents,
    bonus: preserveBonus,
    other_deduction: preserveOther,
  }, totalPendingAdvance);

  return {
    agg,
    derived,
    pendingAdvances,
    allowedLeaves,
    allowedAbsents,
    ledger_receivable: ledgerReceivable,
    ledger_closing_signed: signedClosing,
    ledger_payable_credit: addToPayable,
  };
}

/** Recalculate payroll from live attendance + pending advances after undo (clears clearance bonus/ded). */
async function rebuildPayrollAfterUndo({ emp, row, branchId }) {
  const payrollId = parseInt(row.payroll_id, 10);
  const m = parseInt(row.month, 10);
  const y = parseInt(row.year, 10);

  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 1);
  const branchEmployees = await prisma.employee.findMany({
    where: { status: 'ACTIVE', branch_id: branchId },
  });
  const allMonthAtt = await prisma.attendance.findMany({
    where: {
      emp_id: { in: branchEmployees.map((e) => e.emp_id) },
      att_date: { gte: monthStart, lt: monthEnd },
    },
  });
  const branchOffDays = detectBranchOffDays(
    branchEmployees,
    allMonthAtt,
    m,
    y,
    payrollAsOfDate(m, y)
  );

  const { agg, derived } = await computeEmployeeMonthPayroll(emp, m, y, {
    existing: { bonus: 0, other_deduction: 0 },
    offDays: branchOffDays,
  });

  const allowedLeaves = Number.isFinite(emp.allowed_leaves_per_month) ? emp.allowed_leaves_per_month : 2;
  const allowedAbsents = Number.isFinite(emp.allowed_absents_per_month) ? emp.allowed_absents_per_month : 0;

  await prisma.$executeRawUnsafe(`
    UPDATE payrolls SET
      status = 'PENDING',
      payment_date = NULL,
      notes = NULL,
      bonus = 0,
      other_deduction = 0,
      total_days = ${agg.total_days},
      days_present = ${Math.round(parseFloat(agg.days_present) * 10) / 10},
      leaves_taken = ${parseFloat(agg.leaves_taken)},
      absents_taken = ${parseFloat(agg.absents_taken)},
      allowed_leaves = ${allowedLeaves},
      allowed_absents = ${allowedAbsents},
      excess_leaves = ${derived.excess_leaves},
      excess_absents = ${derived.excess_absents},
      deduction_per_day = ${derived.deduction_per_day},
      total_deduction = ${derived.total_deduction},
      advance_deduction = ${derived.advance_deduction},
      net_salary = ${derived.net_salary},
      updated_at = NOW()
    WHERE payroll_id = ${payrollId}
  `);

  return { agg, derived };
}

async function resolvePreviousBalance(emp, month, year, prevByEmp) {
  const prev = getPrevMonth(month, year);

  if (employeeJoinedAfterMonth(emp.join_date, prev.month, prev.year)) {
    return {
      previous_balance: 0,
      prev_payroll_id: null,
      prev_month: prev.month,
      prev_year: prev.year,
    };
  }

  const prevRow = prevByEmp[emp.emp_id];

  if (prevRow?.status === 'PAID') {
    return {
      previous_balance: 0,
      prev_payroll_id: null,
      prev_month: prev.month,
      prev_year: prev.year,
    };
  }

  if (prevRow?.status === 'PENDING') {
    return {
      previous_balance: Math.max(0, parseFloat(prevRow.net_salary || 0)),
      prev_payroll_id: prevRow.payroll_id,
      prev_month: prev.month,
      prev_year: prev.year,
    };
  }

  const pendingAdvances = await loadPendingAdvances(emp.emp_id);
  const { advance_previous: advanceBeforeThisMonth } = splitPendingAdvances(pendingAdvances, month, year);
  const { derived } = await computeEmployeeMonthPayroll(emp, prev.month, prev.year, {
    advanceDeduction: advanceBeforeThisMonth,
  });

  return {
    previous_balance: Math.max(0, parseFloat(derived.net_salary || 0)),
    prev_payroll_id: null,
    prev_month: prev.month,
    prev_year: prev.year,
    prev_derived: derived,
  };
}

function attachBalanceFields(row, { previous_balance, prev_payroll_id, prev_month, prev_year, advanceSplit, monthNet, totalPayableOverride = null, snapshot = null }) {
  const enriched = snapshot ? enrichPayrollWithSnapshot(row, snapshot) : row;
  const prevBal = snapshot ? parseFloat(snapshot.previous_balance ?? 0) : previous_balance;
  const monthNetVal = snapshot ? parseFloat(snapshot.month_net ?? monthNet) : monthNet;
  const advanceDed = parseFloat(
    enriched.advance_deduction ?? enriched.advance_this_month ?? advanceSplit.advance_total ?? 0
  );
  const monthGrossVal = snapshot?.month_gross_earned != null
    ? parseFloat(snapshot.month_gross_earned)
    : parseFloat(enriched.month_gross_earned ?? enriched.gross_earned ?? resolveMonthGrossEarned({
      ...enriched,
      month_net: monthNetVal,
      advance_deduction: advanceDed,
    }));
  const advanceWithSalary = parseFloat(
    enriched.advance_with_salary ?? snapshot?.advance_with_salary ?? 0
  );
  const ledgerClosingSigned = parseFloat(
    row.employee_ledger_closing
    ?? snapshot?.employee_ledger_closing
    ?? row.ledger_closing_signed
    ?? 0
  );
  const ledgerPayableCredit = parseFloat(
    row.ledger_payable_credit
    ?? snapshot?.ledger_payable_credit
    ?? Math.max(0, -ledgerClosingSigned)
  );
  const ledgerRecover = Math.max(
    0,
    parseFloat(row.employee_ledger_balance ?? row.ledger_receivable ?? advanceDed ?? 0)
  );

  const totalPayable = totalPayableOverride != null
    ? totalPayableOverride
    : (snapshot?.total_payable != null
      ? parseFloat(snapshot.total_payable)
      : calcTotalPayable({
        monthNet: monthNetVal,
        previousBalance: prevBal,
        advanceWithSalary,
        ledgerPayableCredit,
      }));

  return {
    ...enriched,
    previous_balance: prevBal,
    previous_balance_paid: prevBal,
    prev_payroll_id,
    prev_month,
    prev_year,
    advance_this_month: snapshot?.advance_this_month ?? advanceSplit.advance_this_month,
    advance_previous: advanceSplit.advance_previous,
    employee_ledger_closing: ledgerClosingSigned,
    ledger_payable_credit: ledgerPayableCredit,
    employee_ledger_balance: ledgerRecover,
    ledger_receivable: ledgerRecover,
    month_gross_earned: monthGrossVal,
    month_net_attendance: Math.max(
      0,
      Math.round((monthGrossVal - parseFloat(enriched.total_deduction ?? row.total_deduction ?? 0)) * 100) / 100
    ),
    month_net: monthNetVal,
    total_payable: totalPayable,
  };
}

/** Fill total_payable / advance_with_salary when snapshot was truncated or missing fields. */
async function enrichPaidPayrollClearanceData(rows) {
  const paidIds = rows.filter((r) => r.status === 'PAID' && r.payroll_id).map((r) => r.payroll_id);
  if (paidIds.length === 0) return rows;

  const reasonPrefix = CLEARANCE_ADVANCE_REASON_PREFIX.replace(/'/g, "''");
  const clearanceAdvRows = await prisma.$queryRawUnsafe(`
    SELECT advance_id, payroll_id, amount, advance_date, reason
    FROM employee_advances
    WHERE payroll_id IN (${paidIds.join(',')}) AND status = 'PENDING'
      AND reason LIKE '${reasonPrefix}%'
  `);
  const clearanceAdvByPayroll = {};
  for (const a of clearanceAdvRows) {
    clearanceAdvByPayroll[a.payroll_id] = a;
  }

  return rows.map((r) => {
    if (r.status !== 'PAID') return r;
    const snapshot = parseClearanceSnapshot(r.notes);
    const clrAdv = clearanceAdvByPayroll[r.payroll_id];
    const dbAdvanceWithSalary = clrAdv?.amount != null ? parseFloat(clrAdv.amount) : null;
    const advanceWithSalary = dbAdvanceWithSalary
      ?? (snapshot?.advance_with_salary != null ? parseFloat(snapshot.advance_with_salary) : null)
      ?? parseFloat(r.advance_with_salary || 0);
    const monthNet = parseFloat(r.month_net ?? r.net_salary ?? snapshot?.month_net ?? 0);
    const prevBal = parseFloat(r.previous_balance ?? snapshot?.previous_balance ?? 0);
    let totalPayable = parseFloat(r.total_payable ?? 0);
    if (snapshot?.total_payable != null) {
      totalPayable = parseFloat(snapshot.total_payable);
    } else if (!totalPayable || Math.abs(totalPayable - monthNet) < 0.01) {
      totalPayable = calcTotalPayable({ monthNet, previousBalance: prevBal, advanceWithSalary });
    }
    const advDate = clrAdv?.advance_date;
    const cashAmount = snapshot?.cash_amount != null ? parseFloat(snapshot.cash_amount) : parseFloat(r.cash_amount || 0);
    const bankAmount = snapshot?.bank_amount != null ? parseFloat(snapshot.bank_amount) : parseFloat(r.bank_amount || 0);
    const amountPaid = snapshot?.amount_paid != null
      ? parseFloat(snapshot.amount_paid)
      : (cashAmount + bankAmount > 0.009 ? cashAmount + bankAmount : totalPayable);

    return {
      ...r,
      bonus: parseFloat(r.bonus ?? snapshot?.bonus ?? 0),
      other_deduction: parseFloat(r.other_deduction ?? snapshot?.other_deduction ?? 0),
      advance_with_salary: advanceWithSalary,
      total_payable: totalPayable,
      amount_paid: amountPaid,
      cash_amount: cashAmount,
      bank_amount: bankAmount,
      payment_method: r.payment_method ?? snapshot?.payment_method ?? null,
      previous_balance: prevBal,
      prev_month: snapshot?.prev_month ?? r.prev_month ?? null,
      prev_year: snapshot?.prev_year ?? r.prev_year ?? null,
      month_net: monthNet,
      ledger_payable_credit: parseFloat(r.ledger_payable_credit ?? snapshot?.ledger_payable_credit ?? 0),
      employee_ledger_closing_before: snapshot?.employee_ledger_closing_before ?? snapshot?.employee_ledger_closing ?? null,
      employee_ledger_closing_after: snapshot?.employee_ledger_closing_after ?? null,
      clearance_snapshot: snapshot ?? r.clearance_snapshot,
      advance_with_salary_date: r.advance_with_salary_date
        ?? snapshot?.advance_with_salary_date
        ?? snapshot?.cleared_at
        ?? (advDate instanceof Date ? toLocalDateKey(advDate) : (advDate ? String(advDate).slice(0, 10) : null)),
      clearance_advance_id: r.clearance_advance_id ?? snapshot?.clearance_advance_id ?? clrAdv?.advance_id ?? null,
    };
  });
}

export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id'), 10) : null;
    const emp_id = searchParams.get('emp_id') ? parseInt(searchParams.get('emp_id'), 10) : null;
    const month = searchParams.get('month') ? parseInt(searchParams.get('month'), 10) : null;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year'), 10) : null;
    const calculate = searchParams.get('calculate') === 'true';
    const statusFilter = searchParams.get('status');

    if (calculate) {
      if (!month || !year) {
        return NextResponse.json({ error: 'month and year required' }, { status: 400 });
      }

      const employees = await prisma.employee.findMany({
        where: { status: 'ACTIVE', branch_id: branchId },
        orderBy: { emp_name: 'asc' },
      });

      await cleanupOrphanClearanceAdvances(branchId, month, year);

      const existingRows = await prisma.$queryRawUnsafe(`
        SELECT p.* FROM payrolls p
        INNER JOIN employees e ON p.emp_id = e.emp_id
        WHERE e.branch_id = ${branchId} AND p.month = ${month} AND p.year = ${year}
      `);
      const existingByEmp = {};
      for (const r of existingRows) existingByEmp[r.emp_id] = r;

      const prev = getPrevMonth(month, year);
      const prevRows = await prisma.$queryRawUnsafe(`
        SELECT p.* FROM payrolls p
        INNER JOIN employees e ON p.emp_id = e.emp_id
        WHERE e.branch_id = ${branchId} AND p.month = ${prev.month} AND p.year = ${prev.year}
      `);
      const prevByEmp = {};
      for (const r of prevRows) prevByEmp[r.emp_id] = r;

      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 1);
      const allMonthAtt = await prisma.attendance.findMany({
        where: {
          emp_id: { in: employees.map((e) => e.emp_id) },
          att_date: { gte: monthStart, lt: monthEnd },
        },
      });
      const branchOffDays = detectBranchOffDays(
        employees,
        allMonthAtt,
        month,
        year,
        payrollAsOfDate(month, year)
      );

      await ensureEmployeeLedgerSchema(prisma);
      const empIds = employees.map((e) => e.emp_id);
      const ledgerMap = await getEmployeeLedgerClosingsMap(prisma, empIds);
      const pendingByEmp = await loadPendingAdvancesByEmpIds(empIds);
      const attByEmp = groupAttendanceByEmp(allMonthAtt);

      let result = [];
      for (const emp of employees) {
        const existing = existingByEmp[emp.emp_id];
        const prevInfo = await resolvePreviousBalance(emp, month, year, prevByEmp);
        const batchCtx = {
          offDays: branchOffDays,
          attendanceRecords: attByEmp[emp.emp_id] || [],
          pendingAdvances: pendingByEmp[emp.emp_id] || [],
          ledgerReceivable: ledgerMap.get(emp.emp_id) ?? 0,
        };

        if (existing?.status === 'PAID') {
          const snapshot = parseClearanceSnapshot(existing.notes);
          const pendingAdvances = batchCtx.pendingAdvances;
          const advanceSplit = splitPendingAdvances(pendingAdvances, month, year);
          const monthNet = parseFloat(existing.net_salary || 0);
          const { agg } = await computeEmployeeMonthPayroll(emp, month, year, { existing, ...batchCtx });

          const useSnapshotAtt = snapshot?.days_present != null;
          const attDaysPresent = useSnapshotAtt ? parseFloat(snapshot.days_present) : agg.days_present;
          const attLeaves = useSnapshotAtt ? parseFloat(snapshot.leaves_taken ?? agg.leaves_taken) : agg.leaves_taken;
          const attAbsents = useSnapshotAtt
            ? parseFloat(snapshot.absent_days ?? snapshot.absents_taken ?? agg.absent_days ?? agg.absents_taken)
            : (agg.absent_days ?? agg.absents_taken);

          result.push(attachBalanceFields({
            payroll_id: existing.payroll_id,
            emp_id: emp.emp_id,
            month,
            year,
            basic_salary: parseFloat(existing.basic_salary || 0),
            total_days: existing.total_days,
            days_present: attDaysPresent,
            leaves_taken: attLeaves,
            absents_taken: attAbsents,
            present_days: useSnapshotAtt ? (snapshot.present_days ?? attDaysPresent) : agg.present_days,
            leave_days: useSnapshotAtt ? (snapshot.leave_days ?? attLeaves) : agg.leave_days,
            absent_days: useSnapshotAtt ? (snapshot.absent_days ?? attAbsents) : agg.absent_days,
            half_days: useSnapshotAtt ? (snapshot.half_days ?? agg.half_days) : agg.half_days,
            allowed_leaves: existing.allowed_leaves,
            allowed_absents: existing.allowed_absents ?? 0,
            excess_leaves: parseFloat(existing.excess_leaves || 0),
            excess_absents: parseFloat(existing.excess_absents || 0),
            deduction_per_day: parseFloat(existing.deduction_per_day || 0),
            total_deduction: parseFloat(existing.total_deduction || 0),
            advance_deduction: parseFloat(existing.advance_deduction || 0),
            bonus: parseFloat(existing.bonus || 0),
            other_deduction: parseFloat(existing.other_deduction || 0),
            net_salary: monthNet,
            status: 'PAID',
            payment_date: existing.payment_date,
            notes: existing.notes,
            employee: {
              emp_id: emp.emp_id,
              emp_name: emp.emp_name,
              designation: emp.designation,
              department: emp.department,
              emp_phone: emp.emp_phone || null,
              basic_salary: parseFloat(emp.basic_salary || 0),
            },
          }, {
            ...(snapshot ? {
              previous_balance: parseFloat(snapshot.previous_balance ?? 0),
              prev_payroll_id: null,
              prev_month: snapshot.prev_month ?? prevInfo.prev_month,
              prev_year: snapshot.prev_year ?? prevInfo.prev_year,
            } : prevInfo),
            advanceSplit,
            monthNet,
            snapshot,
          }));
          continue;
        }

        const {
          agg, derived, pendingAdvances, allowedLeaves, allowedAbsents,
          ledger_receivable, ledger_closing_signed, ledger_payable_credit,
        } = await computeEmployeeMonthPayroll(emp, month, year, { existing, ...batchCtx });
        const advanceSplit = splitPendingAdvances(pendingAdvances, month, year);
        const monthNet = parseFloat(derived.net_salary || 0);

        result.push(attachBalanceFields({
          payroll_id: existing?.payroll_id ?? null,
          emp_id: emp.emp_id,
          month,
          year,
          basic_salary: parseFloat(emp.basic_salary || 0),
          total_days: agg.total_days,
          days_present: agg.days_present,
          leaves_taken: agg.leaves_taken,
          absents_taken: agg.absents_taken,
          present_days: agg.present_days,
          leave_days: agg.leave_days,
          absent_days: agg.absent_days,
          half_days: agg.half_days,
          holiday_days: agg.holiday_days,
          allowed_leaves: allowedLeaves,
          allowed_absents: allowedAbsents,
          excess_leaves: derived.excess_leaves,
          excess_absents: derived.excess_absents,
          deduction_per_day: derived.deduction_per_day,
          total_deduction: derived.total_deduction,
          advance_deduction: derived.advance_deduction,
          bonus: derived.bonus,
          other_deduction: derived.other_deduction,
          gross_earned: derived.gross_earned,
          net_salary: monthNet,
          status: existing?.status || 'PENDING',
          payment_date: existing?.payment_date ?? null,
          employee: {
            emp_id: emp.emp_id,
            emp_name: emp.emp_name,
            designation: emp.designation,
            department: emp.department,
            emp_phone: emp.emp_phone || null,
            basic_salary: parseFloat(emp.basic_salary || 0),
          },
          employee_ledger_closing: ledger_closing_signed,
          ledger_payable_credit: ledger_payable_credit,
          employee_ledger_balance: ledger_receivable ?? Math.max(0, derived.advance_deduction || 0),
          employee_opening_balance: parseFloat(emp.opening_balance ?? 0),
        }, {
          ...prevInfo,
          advanceSplit,
          monthNet,
        }));
      }

      result = await enrichPaidPayrollClearanceData(result);
      return NextResponse.json(result);
    }

    let query = `
      SELECT p.*, e.emp_name, e.designation, e.department, e.emp_phone, e.basic_salary as emp_basic_salary
      FROM payrolls p
      LEFT JOIN employees e ON p.emp_id = e.emp_id
      WHERE e.branch_id = ${branchId}
    `;
    if (id) query += ` AND p.payroll_id = ${id}`;
    if (emp_id) query += ` AND p.emp_id = ${emp_id}`;
    if (month) query += ` AND p.month = ${month}`;
    if (year) query += ` AND p.year = ${year}`;
    if (statusFilter === 'PAID' || statusFilter === 'PENDING') {
      query += ` AND p.status = '${statusFilter}'`;
    }
    query += ` ORDER BY p.year DESC, p.month DESC, e.emp_name ASC`;

    const rows = await prisma.$queryRawUnsafe(query);
    let result = rows.map((r) => {
      const base = {
        payroll_id: r.payroll_id,
        emp_id: r.emp_id,
        month: r.month,
        year: r.year,
        basic_salary: parseFloat(r.basic_salary || 0),
        total_days: r.total_days,
        days_present: parseFloat(r.days_present || 0),
        leaves_taken: parseFloat(r.leaves_taken || 0),
        absents_taken: parseFloat(r.absents_taken || 0),
        allowed_leaves: r.allowed_leaves,
        allowed_absents: r.allowed_absents ?? 0,
        excess_leaves: parseFloat(r.excess_leaves || 0),
        excess_absents: parseFloat(r.excess_absents || 0),
        deduction_per_day: parseFloat(r.deduction_per_day || 0),
        total_deduction: parseFloat(r.total_deduction || 0),
        advance_deduction: parseFloat(r.advance_deduction || 0),
        bonus: parseFloat(r.bonus || 0),
        other_deduction: parseFloat(r.other_deduction || 0),
        net_salary: parseFloat(r.net_salary || 0),
        status: r.status,
        payment_date: r.payment_date,
        notes: r.notes,
        created_at: r.created_at,
        updated_at: r.updated_at,
        employee: {
          emp_id: r.emp_id,
          emp_name: r.emp_name,
          designation: r.designation,
          department: r.department,
          emp_phone: r.emp_phone || null,
          basic_salary: parseFloat(r.emp_basic_salary || 0),
        },
      };
      const snapshot = parseClearanceSnapshot(r.notes);
      if (snapshot) {
        return enrichPayrollWithSnapshot(base, snapshot);
      }
      return {
        ...base,
        month_net: parseFloat(r.net_salary || 0),
        total_payable: parseFloat(r.net_salary || 0),
        previous_balance: 0,
      };
    });

    const paidIds = result.filter((r) => r.status === 'PAID' && r.payroll_id).map((r) => r.payroll_id);
    if (paidIds.length > 0) {
      const advRows = await prisma.$queryRawUnsafe(`
        SELECT advance_id, emp_id, payroll_id, amount, advance_date, reason, status
        FROM employee_advances
        WHERE payroll_id IN (${paidIds.join(',')}) AND status = 'DEDUCTED'
        ORDER BY advance_date ASC
      `);
      const byPayroll = {};
      for (const a of advRows) {
        const pid = a.payroll_id;
        if (!byPayroll[pid]) byPayroll[pid] = [];
        let reason = a.reason || null;
        if (reason && reason.startsWith(CLEARANCE_ADVANCE_REASON_PREFIX)) {
          reason = reason.slice(CLEARANCE_ADVANCE_REASON_PREFIX.length);
        }
        const d = a.advance_date;
        byPayroll[pid].push({
          advance_id: a.advance_id,
          amount: parseFloat(a.amount || 0),
          advance_date: d instanceof Date ? d.toISOString().split('T')[0] : (d ? String(d).slice(0, 10) : null),
          reason,
        });
      }
      result = result.map((r) => {
        const fromSnap = r.deducted_advances;
        const fromDb = byPayroll[r.payroll_id];
        if ((!fromSnap || fromSnap.length === 0) && fromDb?.length) {
          return { ...r, deducted_advances: fromDb };
        }
        return r;
      });
    }

    result = await enrichPaidPayrollClearanceData(result);

    if (id) return NextResponse.json(result[0] || null);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in GET /api/payroll:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    const body = await request.json();

    if (body.clearance) {
      const {
        emp_id, month, year, basic_salary, total_days, days_present,
        leaves_taken, absents_taken, allowed_leaves, allowed_absents,
        advance_deduction, bonus, other_deduction,
        prev_payroll_id, prev_month, prev_year, previous_balance,
      } = body;
      if (!emp_id || !month || !year) {
        return NextResponse.json({ error: 'emp_id, month, year required' }, { status: 400 });
      }

      const empId = parseInt(emp_id, 10);
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      const prevBal = parseFloat(previous_balance || 0);
      const advanceThisMonth = parseFloat(body.advance_this_month || 0);
      const advanceWithSalary = parseFloat(body.advance_with_salary || 0) || 0;
      const bonusAmt = parseFloat(body.bonus ?? 0) || 0;
      const otherDed = parseFloat(body.other_deduction ?? body.extra_deduction ?? 0) || 0;
      const deductionReason = (body.deduction_reason || '').trim();
      const advanceReason = (body.advance_reason || '').trim();

      const emp = await prisma.employee.findFirst({ where: { emp_id: empId, branch_id: branchId } });
      if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

      await ensureEmployeeLedgerSchema(prisma);
      const ledgerClosing = await getEmployeeLedgerClosing(prisma, empId);
      const openingBal = parseFloat(emp.opening_balance ?? 0);
      const pendingBefore = await loadPendingAdvances(empId);
      const pendingSum = pendingBefore.reduce((s, a) => s + parseFloat(a.amount || 0), 0);
      const signedClosing = resolveEmployeeReceivableBalance(ledgerClosing, openingBal);
      const { addToPayable: ledgerPayableCredit } = splitEmployeeLedgerForPayroll(signedClosing);
      const ledgerReceivable = resolvePayrollAdvanceDeduction(signedClosing, openingBal, pendingSum);

      const branchEmployees = await prisma.employee.findMany({
        where: { branch_id: branchId, status: 'ACTIVE' },
      });
      const monthStart = new Date(y, m - 1, 1);
      const monthEnd = new Date(y, m, 1);
      const allMonthAtt = await prisma.attendance.findMany({
        where: {
          emp_id: { in: branchEmployees.map((e) => e.emp_id) },
          att_date: { gte: monthStart, lt: monthEnd },
        },
      });
      const branchOffDays = detectBranchOffDays(
        branchEmployees,
        allMonthAtt,
        m,
        y,
        payrollAsOfDate(m, y)
      );
      const empMonthAtt = allMonthAtt.filter((a) => Number(a.emp_id) === empId);
      const { agg, derived } = await computeEmployeeMonthPayroll(emp, m, y, {
        offDays: branchOffDays,
        attendanceRecords: empMonthAtt,
        advanceDeduction: ledgerReceivable,
        existing: { bonus: bonusAmt, other_deduction: otherDed },
      });

      const attDaysPresent = parseFloat(agg.days_present ?? derived.days_present ?? 0);
      const attLeaves = parseFloat(agg.leaves_taken ?? derived.leaves_taken ?? 0);
      const attAbsents = parseFloat(agg.absent_days ?? agg.absents_taken ?? derived.absents_taken ?? 0);
      const attHalfDays = body.half_days != null ? parseInt(body.half_days, 10) || 0 : (agg.half_days ?? 0);
      const attPresentDays = body.present_days ?? agg.present_days ?? attDaysPresent;
      const attLeaveDays = body.leave_days ?? agg.leave_days ?? attLeaves;
      const attAbsentDays = body.absent_days ?? agg.absent_days ?? attAbsents;

      const totalPayable = calcTotalPayable({
        monthNet: derived.net_salary,
        previousBalance: prevBal,
        advanceWithSalary,
        ledgerPayableCredit,
      });

      const payment = parseClearancePayment(body, totalPayable);
      if (payment.error) {
        return NextResponse.json({ error: payment.error }, { status: 400 });
      }

      const payDate = new Date().toISOString().split('T')[0];

      const clearanceSnapshot = {
        v: 2,
        previous_balance: prevBal,
        prev_month: prev_month ? parseInt(prev_month, 10) : null,
        prev_year: prev_year ? parseInt(prev_year, 10) : null,
        prev_payroll_id: prev_payroll_id ? parseInt(prev_payroll_id, 10) : null,
        month_net: derived.net_salary,
        month_gross_earned: derived.gross_earned,
        total_payable: totalPayable,
        amount_paid: payment.paidTotal ?? (payment.cashAmt + payment.bankAmt),
        advance_this_month: advanceThisMonth,
        advance_with_salary: advanceWithSalary,
        advance_reason: advanceReason || null,
        bonus: bonusAmt,
        other_deduction: otherDed,
        deduction_reason: deductionReason || null,
        payment_method: payment.paymentMethod,
        cash_amount: payment.cashAmt,
        bank_amount: payment.bankAmt,
        cash_account_id: payment.paid_from_account_id,
        bank_account_id: payment.bank_account_id,
        payment_reference: payment.payment_reference,
        days_present: attDaysPresent,
        leaves_taken: attLeaves,
        absents_taken: attAbsents,
        half_days: attHalfDays,
        present_days: attPresentDays,
        leave_days: attLeaveDays,
        absent_days: attAbsentDays,
        paid_days: derived.paid_days,
        daily_rate: derived.deduction_per_day,
        cleared_at: payDate,
        employee_opening_balance: openingBal,
        employee_ledger_closing: signedClosing,
        ledger_payable_credit: ledgerPayableCredit,
      };
      const notesText = encodeClearanceSnapshot(clearanceSnapshot).replace(/'/g, "''");

      await prisma.$executeRawUnsafe(`
        INSERT INTO payrolls (
          emp_id, month, year, basic_salary, total_days, days_present, leaves_taken, absents_taken,
          allowed_leaves, allowed_absents, excess_leaves, excess_absents, deduction_per_day, total_deduction,
          advance_deduction, bonus, other_deduction, net_salary, status, payment_date, notes, created_at, updated_at
        ) VALUES (
          ${empId}, ${m}, ${y}, ${parseFloat(emp.basic_salary || basic_salary) || 0},
          ${parseInt(agg.total_days, 10) || parseInt(total_days, 10) || 30}, ${Math.round(attDaysPresent * 10) / 10}, ${attLeaves}, ${attAbsents},
          ${Number.isFinite(emp.allowed_leaves_per_month) ? emp.allowed_leaves_per_month : (parseInt(allowed_leaves, 10) || 0)},
          ${Number.isFinite(emp.allowed_absents_per_month) ? emp.allowed_absents_per_month : (parseInt(allowed_absents, 10) || 0)},
          ${derived.excess_leaves}, ${derived.excess_absents}, ${derived.deduction_per_day}, ${derived.total_deduction},
          ${derived.advance_deduction}, ${derived.bonus}, ${derived.other_deduction}, ${derived.net_salary},
          'PAID', '${payDate}', '${notesText}', NOW(), NOW()
        ) ON DUPLICATE KEY UPDATE
          basic_salary = VALUES(basic_salary),
          total_days = VALUES(total_days),
          days_present = VALUES(days_present),
          leaves_taken = VALUES(leaves_taken),
          absents_taken = VALUES(absents_taken),
          allowed_leaves = VALUES(allowed_leaves),
          allowed_absents = VALUES(allowed_absents),
          excess_leaves = VALUES(excess_leaves),
          excess_absents = VALUES(excess_absents),
          deduction_per_day = VALUES(deduction_per_day),
          total_deduction = VALUES(total_deduction),
          advance_deduction = VALUES(advance_deduction),
          bonus = VALUES(bonus),
          other_deduction = VALUES(other_deduction),
          net_salary = VALUES(net_salary),
          status = 'PAID',
          payment_date = VALUES(payment_date),
          notes = VALUES(notes),
          updated_at = NOW()
      `);

      const payrollRows = await prisma.$queryRawUnsafe(`
        SELECT payroll_id FROM payrolls WHERE emp_id = ${empId} AND month = ${m} AND year = ${y} LIMIT 1
      `);
      const currentPayrollId = payrollRows?.[0]?.payroll_id;
      let resolvedPrevPayrollId = prev_payroll_id ? parseInt(prev_payroll_id, 10) : null;

      if (prevBal > 0) {
        if (prev_payroll_id) {
          await prisma.$executeRawUnsafe(`
            UPDATE payrolls SET status = 'PAID', payment_date = '${payDate}', updated_at = NOW()
            WHERE payroll_id = ${parseInt(prev_payroll_id, 10)}
          `);
        } else if (prev_month && prev_year) {
          const pm = parseInt(prev_month, 10);
          const py = parseInt(prev_year, 10);
          const emp = await prisma.employee.findFirst({ where: { emp_id: empId, branch_id: branchId } });
          if (emp) {
            const { agg, derived: prevDerived } = await computeEmployeeMonthPayroll(emp, pm, py);
            await prisma.$executeRawUnsafe(`
              INSERT INTO payrolls (
                emp_id, month, year, basic_salary, total_days, days_present, leaves_taken, absents_taken,
                allowed_leaves, allowed_absents, excess_leaves, excess_absents, deduction_per_day, total_deduction,
                advance_deduction, bonus, other_deduction, net_salary, status, payment_date, created_at, updated_at
              ) VALUES (
                ${empId}, ${pm}, ${py}, ${parseFloat(emp.basic_salary || 0)},
                ${agg.total_days}, ${prevDerived.days_present}, ${prevDerived.leaves_taken}, ${prevDerived.absents_taken},
                ${Number.isFinite(emp.allowed_leaves_per_month) ? emp.allowed_leaves_per_month : 2},
                ${Number.isFinite(emp.allowed_absents_per_month) ? emp.allowed_absents_per_month : 0},
                ${prevDerived.excess_leaves}, ${prevDerived.excess_absents}, ${prevDerived.deduction_per_day}, ${prevDerived.total_deduction},
                ${prevDerived.advance_deduction}, ${prevDerived.bonus}, ${prevDerived.other_deduction}, ${prevDerived.net_salary},
                'PAID', '${payDate}', NOW(), NOW()
              ) ON DUPLICATE KEY UPDATE
                status = 'PAID',
                payment_date = '${payDate}',
                net_salary = VALUES(net_salary),
                updated_at = NOW()
            `);
            const prevRows = await prisma.$queryRawUnsafe(`
              SELECT payroll_id FROM payrolls WHERE emp_id = ${empId} AND month = ${pm} AND year = ${py} LIMIT 1
            `);
            resolvedPrevPayrollId = prevRows?.[0]?.payroll_id ?? null;
          }
        }
      }

      if (resolvedPrevPayrollId) {
        clearanceSnapshot.prev_payroll_id = resolvedPrevPayrollId;
      }

      if (currentPayrollId) {
        const pendingBeforeClear = await loadPendingAdvances(empId);
        clearanceSnapshot.deducted_advance_ids = pendingBeforeClear.map((a) => a.advance_id);
        clearanceSnapshot.deducted_advances = pendingBeforeClear.map((a) => {
          const d = a.advance_date;
          const dateStr = d instanceof Date ? d.toISOString().split('T')[0] : (d ? String(d).slice(0, 10) : null);
          let reason = a.reason || null;
          if (reason && reason.startsWith(CLEARANCE_ADVANCE_REASON_PREFIX)) {
            reason = reason.slice(CLEARANCE_ADVANCE_REASON_PREFIX.length);
          }
          return {
            advance_id: a.advance_id,
            amount: parseFloat(a.amount || 0),
            advance_date: dateStr,
            reason,
          };
        });

        try {
          await prisma.$executeRawUnsafe(`
            UPDATE employee_advances ea
            INNER JOIN employees e ON ea.emp_id = e.emp_id
            SET ea.status = 'DEDUCTED', ea.payroll_id = ${parseInt(currentPayrollId, 10)}, ea.updated_at = NOW()
            WHERE ea.emp_id = ${empId} AND ea.status = 'PENDING' AND e.branch_id = ${branchId}
          `);
          await ensureEmployeeLedgerSchema(prisma);
          let recoveryBudget = Math.min(
            parseFloat(derived.advance_deduction || 0),
            parseFloat(derived.gross_earned || 0)
          );
          recoveryBudget = Math.round(recoveryBudget * 100) / 100;
          let advanceSettledOnLedger = 0;
          for (const a of pendingBeforeClear) {
            const advAmt = parseFloat(a.amount || 0);
            const credit = Math.min(advAmt, recoveryBudget);
            if (credit <= 0.009) break;
            await recordEmployeeAdvanceSettledFromPayroll(prisma, {
              branchId,
              empId,
              empName: emp.emp_name,
              advanceId: a.advance_id,
              amount: credit,
              month: m,
              year: y,
            });
            advanceSettledOnLedger += credit;
            recoveryBudget = Math.round((recoveryBudget - credit) * 100) / 100;
          }
          if (recoveryBudget > 0.009) {
            await recordEmployeePayrollBalanceRecovery(prisma, {
              branchId,
              empId,
              empName: emp.emp_name,
              payrollId: currentPayrollId,
              amount: recoveryBudget,
              month: m,
              year: y,
            });
            clearanceSnapshot.opening_balance_recovered = recoveryBudget;
          }
          clearanceSnapshot.advance_settled_on_ledger = advanceSettledOnLedger;
          if (ledgerPayableCredit > 0.009) {
            await recordEmployeePayrollPayableSettlement(prisma, {
              branchId,
              empId,
              empName: emp.emp_name,
              payrollId: currentPayrollId,
              amount: ledgerPayableCredit,
              month: m,
              year: y,
            });
            clearanceSnapshot.ledger_payable_settled = ledgerPayableCredit;
          }
        } catch (e) {
          console.error('Failed to update advance statuses:', e);
        }
      }

      let clearanceAdvanceId = null;
      if (advanceWithSalary > 0 && currentPayrollId) {
        const advReasonText = advanceReason || `Advance paid with salary clearance ${m}/${y}`;
        const advReason = `${CLEARANCE_ADVANCE_REASON_PREFIX}${advReasonText}`.replace(/'/g, "''");
        await prisma.$executeRawUnsafe(`
          INSERT INTO employee_advances (emp_id, amount, advance_date, payment_mode, reason, status, payroll_id, created_at, updated_at)
          VALUES (${empId}, ${advanceWithSalary}, '${payDate}', 'CASH', '${advReason}', 'PENDING', ${parseInt(currentPayrollId, 10)}, NOW(), NOW())
        `);
        const advRows = await prisma.$queryRawUnsafe(`
          SELECT advance_id FROM employee_advances
          WHERE emp_id = ${empId} AND payroll_id = ${parseInt(currentPayrollId, 10)}
            AND amount = ${advanceWithSalary} AND status = 'PENDING'
          ORDER BY advance_id DESC LIMIT 1
        `);
        clearanceAdvanceId = advRows?.[0]?.advance_id ?? null;
        if (clearanceAdvanceId) {
          clearanceSnapshot.clearance_advance_id = clearanceAdvanceId;
          try {
            await ensureEmployeeLedgerSchema(prisma);
            await recordEmployeeAdvanceDebit(prisma, {
              branchId,
              empId,
              empName: emp.emp_name,
              advanceId: clearanceAdvanceId,
              amount: advanceWithSalary,
              reason: advReasonText,
              advanceDate: payDate,
            });
          } catch (e) {
            console.error('Employee ledger (clearance advance):', e);
          }
        }
        clearanceSnapshot.advance_with_salary_date = payDate;
      }

      if (currentPayrollId && totalPayable > 0) {
        try {
          const ledgerBillNo = await recordPayrollLedgerPayment({
            payrollId: currentPayrollId,
            empName: emp.emp_name,
            payment,
            paymentReference: payment.payment_reference,
            month: m,
            year: y,
            monthNet: derived.net_salary,
            previousBalance: prevBal,
            advanceWithSalary,
            totalPayable,
          });
          clearanceSnapshot.ledger_bill_no = ledgerBillNo;
        } catch (e) {
          console.error('Failed to record salary ledger payment:', e);
          return NextResponse.json({ error: `Clearance saved but ledger failed: ${e.message}` }, { status: 500 });
        }
      }

      if (currentPayrollId) {
        try {
          await ensureEmployeeLedgerSchema(prisma);
          const advanceRecoveredOnLedger =
            (clearanceSnapshot.advance_settled_on_ledger || 0)
            + (clearanceSnapshot.opening_balance_recovered || 0);
          await recordEmployeePayrollSalaryPayment(prisma, {
            branchId,
            empId,
            empName: emp.emp_name,
            payrollId: currentPayrollId,
            month: m,
            year: y,
            netSalary: derived.net_salary,
            totalPayable,
            cashAmount: payment.cashAmt,
            bankAmount: payment.bankAmt,
            advanceRecovered: advanceRecoveredOnLedger,
            advanceWithSalary,
            paymentReference: payment.payment_reference,
            paymentDate: payDate,
          });
        } catch (e) {
          console.error('Employee ledger salary memo:', e);
        }
      }

      if (currentPayrollId) {
        try {
          await ensureEmployeeLedgerSchema(prisma);
          const closingRaw = await getEmployeeLedgerClosing(prisma, empId);
          clearanceSnapshot.employee_ledger_closing_before = signedClosing;
          clearanceSnapshot.employee_ledger_closing_after = resolveEmployeeReceivableBalance(
            closingRaw,
            openingBal
          );
        } catch (e) {
          console.error('Employee ledger closing after clearance:', e);
        }
        const finalNotes = encodeClearanceSnapshot(clearanceSnapshot).replace(/'/g, "''");
        await prisma.$executeRawUnsafe(`
          UPDATE payrolls SET notes = '${finalNotes}', updated_at = NOW()
          WHERE payroll_id = ${parseInt(currentPayrollId, 10)}
        `);
      }

      const totalPayableResponse = totalPayable;

      return NextResponse.json({
        success: true,
        payroll_id: currentPayrollId ? parseInt(currentPayrollId, 10) : null,
        emp_id: empId,
        month: m,
        year: y,
        net_salary: derived.net_salary,
        month_net: derived.net_salary,
        total_payable: totalPayableResponse,
        amount_paid: payment.paidTotal ?? (payment.cashAmt + payment.bankAmt),
        previous_balance: prevBal,
        ledger_payable_credit: ledgerPayableCredit,
        clearance_snapshot: clearanceSnapshot,
      });
    }

    if (body.undo_clearance) {
      const payrollId = parseInt(body.payroll_id, 10);
      if (!payrollId) {
        return NextResponse.json({ error: 'payroll_id required' }, { status: 400 });
      }

      const rows = await prisma.$queryRawUnsafe(`
        SELECT p.*, e.emp_name FROM payrolls p
        INNER JOIN employees e ON p.emp_id = e.emp_id
        WHERE p.payroll_id = ${payrollId} AND e.branch_id = ${branchId} AND p.status = 'PAID'
        LIMIT 1
      `);
      const row = rows?.[0];
      if (!row) {
        return NextResponse.json({ error: 'Paid payroll not found or already pending' }, { status: 404 });
      }

      const snapshot = parseClearanceSnapshot(row.notes);
      const prevBal = parseFloat(snapshot?.previous_balance || 0);
      let prevPayrollId = snapshot?.prev_payroll_id ? parseInt(snapshot.prev_payroll_id, 10) : null;
      let advanceWithSalary = parseFloat(snapshot?.advance_with_salary || 0);
      const payDateKey = toLocalDateKey(row.payment_date);
      const empIdInt = parseInt(row.emp_id, 10);
      let clearanceAdvanceId = snapshot?.clearance_advance_id
        ? parseInt(snapshot.clearance_advance_id, 10)
        : null;

      if (!clearanceAdvanceId || !advanceWithSalary) {
        const reasonPrefix = CLEARANCE_ADVANCE_REASON_PREFIX.replace(/'/g, "''");
        const clrAdvRows = await prisma.$queryRawUnsafe(`
          SELECT advance_id, amount FROM employee_advances
          WHERE payroll_id = ${payrollId} AND status = 'PENDING'
            AND reason LIKE '${reasonPrefix}%'
          LIMIT 1
        `);
        if (clrAdvRows?.[0]) {
          clearanceAdvanceId = clearanceAdvanceId || parseInt(clrAdvRows[0].advance_id, 10);
          if (!advanceWithSalary) advanceWithSalary = parseFloat(clrAdvRows[0].amount || 0);
        }
      }

      const undoSnapshot = {
        ...(snapshot || {}),
        total_payable: parseFloat(
          snapshot?.total_payable
          ?? calcTotalPayable({
            monthNet: parseFloat(row.net_salary || snapshot?.month_net || 0),
            previousBalance: prevBal,
            advanceWithSalary,
          })
        ),
        advance_with_salary: advanceWithSalary,
        ledger_bill_no: snapshot?.ledger_bill_no || payrollLedgerBillNo(payrollId),
      };

      const emp = await prisma.employee.findFirst({
        where: { emp_id: empIdInt, branch_id: branchId },
      });
      if (!emp) {
        return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
      }

      if (!prevPayrollId && prevBal > 0 && snapshot?.prev_month && snapshot?.prev_year) {
        const pm = parseInt(snapshot.prev_month, 10);
        const py = parseInt(snapshot.prev_year, 10);
        const payDate = row.payment_date ? new Date(row.payment_date).toISOString().split('T')[0] : null;
        const prevLookup = await prisma.$queryRawUnsafe(`
          SELECT payroll_id FROM payrolls
          WHERE emp_id = ${empIdInt} AND month = ${pm} AND year = ${py}
            AND status = 'PAID'${payDate ? ` AND DATE(payment_date) = '${payDate}'` : ''}
          LIMIT 1
        `);
        prevPayrollId = prevLookup?.[0]?.payroll_id ?? null;
      }

      let ledgerReversalBillNo = null;
      try {
        ledgerReversalBillNo = await reversePayrollLedger(parseInt(payrollId, 10), undoSnapshot, {
          empName: row.emp_name || '',
          month: row.month,
          year: row.year,
        });
      } catch (e) {
        console.error('Failed to reverse payroll ledger:', e);
        return NextResponse.json(
          { error: `Undo failed — could not reverse ledger: ${e.message}` },
          { status: 500 }
        );
      }

      await deleteClearanceAdvances({
        payrollId,
        empId: empIdInt,
        snapshot: undoSnapshot,
        payDateKey,
      });

      const deductedIds = Array.isArray(undoSnapshot?.deducted_advance_ids)
        ? undoSnapshot.deducted_advance_ids
          .map((id) => parseInt(id, 10))
          .filter((id) => id && id !== clearanceAdvanceId)
        : [];

      if (deductedIds.length > 0) {
        await prisma.$executeRawUnsafe(`
          UPDATE employee_advances
          SET status = 'PENDING', payroll_id = NULL, updated_at = NOW()
          WHERE emp_id = ${empIdInt} AND advance_id IN (${deductedIds.join(',')})
        `);
      } else {
        await prisma.$executeRawUnsafe(`
          UPDATE employee_advances ea
          INNER JOIN employees e ON ea.emp_id = e.emp_id
          SET ea.status = 'PENDING', ea.payroll_id = NULL, ea.updated_at = NOW()
          WHERE ea.payroll_id = ${payrollId} AND ea.status = 'DEDUCTED' AND e.branch_id = ${branchId}
        `);
      }

      if (prevPayrollId && prevBal > 0) {
        await prisma.$executeRawUnsafe(`
          UPDATE payrolls SET status = 'PENDING', payment_date = NULL, updated_at = NOW()
          WHERE payroll_id = ${prevPayrollId} AND emp_id = ${empIdInt}
        `);
      }

      try {
        await ensureEmployeeLedgerSchema(prisma);
        await reverseEmployeePayrollLedgerCredits(prisma, empIdInt, {
          payrollId,
          advanceIds: deductedIds,
        });
      } catch (e) {
        console.error('Failed to reverse employee ledger credits on undo:', e);
      }

      const rebuilt = await rebuildPayrollAfterUndo({ emp, row, branchId });

      await cleanupOrphanClearanceAdvances(branchId, parseInt(row.month, 10), parseInt(row.year, 10));

      return NextResponse.json({
        success: true,
        payroll_id: payrollId,
        emp_id: row.emp_id,
        reverted_previous: !!(prevPayrollId && prevBal > 0),
        removed_clearance_advance: advanceWithSalary > 0,
        restored_bonus: parseFloat(undoSnapshot?.bonus || snapshot?.bonus || 0),
        restored_extra_deduction: parseFloat(undoSnapshot?.other_deduction || snapshot?.other_deduction || 0),
        net_salary: rebuilt.derived.net_salary,
        advance_deduction: rebuilt.derived.advance_deduction,
        ledger_reversal_bill_no: ledgerReversalBillNo,
      });
    }

    if (body.generate) {
      const { month, year } = body;

      const employees = await prisma.employee.findMany({
        where: { status: 'ACTIVE', branch_id: branchId },
      });

      const monthStart = new Date(year, month - 1, 1);
      const monthEnd = new Date(year, month, 1);

      const allMonthAtt = await prisma.attendance.findMany({
        where: {
          emp_id: { in: employees.map((e) => e.emp_id) },
          att_date: { gte: monthStart, lt: monthEnd },
        },
      });
      const branchOffDays = detectBranchOffDays(
        employees,
        allMonthAtt,
        parseInt(month, 10),
        parseInt(year, 10),
        payrollAsOfDate(parseInt(month, 10), parseInt(year, 10))
      );

      const results = [];
      for (const emp of employees) {
        const existingPayroll = await prisma.payroll.findFirst({
          where: { emp_id: emp.emp_id, month: parseInt(month, 10), year: parseInt(year, 10) },
        });

        if (existingPayroll?.status === 'PAID') {
          results.push({ emp_id: emp.emp_id, skipped: true, reason: 'Already paid' });
          continue;
        }

        const att = await prisma.attendance.findMany({
          where: {
            emp_id: emp.emp_id,
            att_date: { gte: monthStart, lt: monthEnd },
          },
        });

        let pendingAdvances = [];
        try {
          pendingAdvances = await prisma.$queryRaw`SELECT * FROM employee_advances WHERE emp_id = ${emp.emp_id} AND status = 'PENDING'`;
        } catch (e) {
          /* optional table path */
        }

        const totalPendingAdvance = pendingAdvances.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

        const agg = aggregateAttendanceForPayroll({
          month: parseInt(month, 10),
          year: parseInt(year, 10),
          attendanceRecords: att,
          joinDate: emp.join_date,
          asOfDate: payrollAsOfDate(parseInt(month, 10), parseInt(year, 10)),
          offDays: branchOffDays,
        });

        const preserveBonus = existingPayroll ? parseFloat(existingPayroll.bonus || 0) : 0;
        const preserveOther = existingPayroll ? parseFloat(existingPayroll.other_deduction || 0) : 0;

        const allowedLeaves = Number.isFinite(emp.allowed_leaves_per_month) ? emp.allowed_leaves_per_month : 2;
        const allowedAbsents = Number.isFinite(emp.allowed_absents_per_month) ? emp.allowed_absents_per_month : 0;

        const derived = calcPayroll({
          basic_salary: emp.basic_salary,
          total_days: agg.total_days,
          salary_divisor_days: getDaysInMonth(parseInt(month, 10), parseInt(year, 10)),
          days_present: agg.days_present,
          leaves_taken: agg.leaves_taken,
          absents_taken: agg.absents_taken,
          absent_days: agg.absent_days,
          allowed_leaves: allowedLeaves,
          allowed_absents: allowedAbsents,
          advance_deduction: totalPendingAdvance,
          bonus: preserveBonus,
          other_deduction: preserveOther,
        });

        await prisma.$executeRawUnsafe(`
          INSERT INTO payrolls (
            emp_id, month, year, basic_salary, total_days, days_present, leaves_taken, absents_taken,
            allowed_leaves, allowed_absents, excess_leaves, excess_absents, deduction_per_day, total_deduction, advance_deduction,
            bonus, other_deduction, net_salary, status, created_at, updated_at
          ) VALUES (
            ${emp.emp_id}, ${parseInt(month, 10)}, ${parseInt(year, 10)}, ${parseFloat(emp.basic_salary || 0)},
            ${agg.total_days}, ${derived.days_present}, ${derived.leaves_taken}, ${derived.absents_taken},
            ${allowedLeaves}, ${allowedAbsents},
            ${derived.excess_leaves}, ${derived.excess_absents}, ${derived.deduction_per_day}, ${derived.total_deduction}, ${derived.advance_deduction},
            ${preserveBonus}, ${preserveOther}, ${derived.net_salary}, 'PENDING', NOW(), NOW()
          ) ON DUPLICATE KEY UPDATE
            basic_salary = VALUES(basic_salary),
            total_days = VALUES(total_days),
            days_present = VALUES(days_present),
            leaves_taken = VALUES(leaves_taken),
            absents_taken = VALUES(absents_taken),
            allowed_leaves = VALUES(allowed_leaves),
            allowed_absents = VALUES(allowed_absents),
            excess_leaves = VALUES(excess_leaves),
            excess_absents = VALUES(excess_absents),
            deduction_per_day = VALUES(deduction_per_day),
            total_deduction = VALUES(total_deduction),
            advance_deduction = VALUES(advance_deduction),
            net_salary = VALUES(net_salary),
            updated_at = NOW()
        `);

        results.push({ emp_id: emp.emp_id, month, year, net_salary: derived.net_salary });
      }
      return NextResponse.json(results);
    }

    const {
      emp_id,
      month,
      year,
      basic_salary,
      total_days,
      days_present,
      leaves_taken,
      absents_taken,
      allowed_leaves,
      allowed_absents,
      advance_deduction,
      bonus,
      other_deduction,
      notes,
    } = body;
    if (!emp_id || !month || !year) {
      return NextResponse.json({ error: 'emp_id, month, year required' }, { status: 400 });
    }

    const derived = calcPayroll(buildPayrollCalcInput(body, month, year));
    const notesText = notes ? notes.replace(/'/g, "''") : '';

    await prisma.$executeRawUnsafe(`
      INSERT INTO payrolls (
        emp_id, month, year, basic_salary, total_days, days_present, leaves_taken, absents_taken,
        allowed_leaves, allowed_absents, excess_leaves, excess_absents, deduction_per_day, total_deduction, advance_deduction,
        bonus, other_deduction, net_salary, status, notes, created_at, updated_at
      ) VALUES (
        ${parseInt(emp_id, 10)}, ${parseInt(month, 10)}, ${parseInt(year, 10)}, ${parseFloat(basic_salary) || 0},
        ${parseInt(total_days, 10) || 30}, ${derived.days_present}, ${derived.leaves_taken}, ${derived.absents_taken},
        ${parseInt(allowed_leaves, 10) || 0}, ${parseInt(allowed_absents, 10) || 0},
        ${derived.excess_leaves}, ${derived.excess_absents}, ${derived.deduction_per_day}, ${derived.total_deduction}, ${derived.advance_deduction},
        ${derived.bonus}, ${derived.other_deduction}, ${derived.net_salary}, 'PENDING', '${notesText}', NOW(), NOW()
      )
    `);

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/payroll:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const {
      payroll_id,
      basic_salary,
      total_days,
      days_present,
      leaves_taken,
      absents_taken,
      allowed_leaves,
      allowed_absents,
      advance_deduction,
      bonus,
      other_deduction,
      status,
      payment_date,
      notes,
    } = body;
    if (!payroll_id) return NextResponse.json({ error: 'payroll_id required' }, { status: 400 });

    const payrollRow = await prisma.$queryRawUnsafe(`
      SELECT month, year FROM payrolls WHERE payroll_id = ${parseInt(payroll_id, 10)} LIMIT 1
    `);
    const row = payrollRow?.[0];
    if (!row) return NextResponse.json({ error: 'Payroll not found' }, { status: 404 });

    const derived = calcPayroll(buildPayrollCalcInput(body, row.month, row.year));
    const notesText = notes ? notes.replace(/'/g, "''") : '';
    const payDate = payment_date ? `'${payment_date}'` : 'NULL';

    await prisma.$executeRawUnsafe(`
      UPDATE payrolls
      SET basic_salary = ${parseFloat(basic_salary) || 0},
          total_days = ${parseInt(total_days, 10) || 30},
          days_present = ${derived.days_present},
          leaves_taken = ${derived.leaves_taken},
          absents_taken = ${derived.absents_taken},
          allowed_leaves = ${parseInt(allowed_leaves, 10) || 0},
          allowed_absents = ${parseInt(allowed_absents, 10) || 0},
          excess_leaves = ${derived.excess_leaves},
          excess_absents = ${derived.excess_absents},
          deduction_per_day = ${derived.deduction_per_day},
          total_deduction = ${derived.total_deduction},
          advance_deduction = ${derived.advance_deduction},
          bonus = ${derived.bonus},
          other_deduction = ${derived.other_deduction},
          net_salary = ${derived.net_salary},
          status = '${status || 'PENDING'}',
          payment_date = ${payDate},
          notes = '${notesText}',
          updated_at = NOW()
      WHERE payroll_id = ${parseInt(payroll_id, 10)}
    `);

    if (status === 'PAID') {
      try {
        const rows = await prisma.$queryRawUnsafe(`SELECT emp_id FROM payrolls WHERE payroll_id = ${parseInt(payroll_id, 10)}`);
        if (rows && rows.length > 0) {
          const emp_id = rows[0].emp_id;
          await prisma.$executeRawUnsafe(`
            UPDATE employee_advances
            SET status = 'DEDUCTED', payroll_id = ${parseInt(payroll_id, 10)}, updated_at = NOW()
            WHERE emp_id = ${emp_id} AND status = 'PENDING'
          `);
        }
      } catch (e) {
        console.error('Failed to update advance statuses to DEDUCTED:', e);
      }
    }

    return NextResponse.json({ success: true, payroll_id, ...derived });
  } catch (error) {
    console.error('Error in PUT /api/payroll:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id'), 10);
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    await prisma.$executeRawUnsafe(`
      DELETE p FROM payrolls p
      INNER JOIN employees e ON p.emp_id = e.emp_id
      WHERE p.payroll_id = ${id} AND e.branch_id = ${branchId}
    `);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
