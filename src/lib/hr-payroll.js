/**
 * Shared HR payroll & attendance aggregation logic.
 */

/** Parse any date input to { year, month, day } without timezone drift */
export function parseDateOnly(dateInput) {
  if (!dateInput) return null;
  if (typeof dateInput === 'string') {
    const m = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return { year: +m[1], month: +m[2], day: +m[3] };
  }
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

export function toDateKey(dateInput) {
  const p = parseDateOnly(dateInput);
  if (!p) return null;
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

export function compareDateParts(a, b) {
  const pa = parseDateOnly(a);
  const pb = parseDateOnly(b);
  if (!pa || !pb) return 0;
  if (pa.year !== pb.year) return pa.year - pb.year;
  if (pa.month !== pb.month) return pa.month - pb.month;
  return pa.day - pb.day;
}

export function toLocalDate(dateInput) {
  const p = parseDateOnly(dateInput);
  if (!p) return null;
  return new Date(p.year, p.month - 1, p.day);
}

/** Local midnight bounds for finding attendance on a calendar day (fixes timezone upsert mismatches) */
export function attendanceDayBounds(dateInput) {
  const p = parseDateOnly(dateInput);
  if (!p) return null;
  const start = new Date(p.year, p.month - 1, p.day, 0, 0, 0, 0);
  const end = new Date(p.year, p.month - 1, p.day + 1, 0, 0, 0, 0);
  const storageDate = new Date(p.year, p.month - 1, p.day, 12, 0, 0, 0);
  return { start, end, storageDate };
}

export function getDaysInMonth(month, year) {
  return new Date(year, month, 0).getDate();
}

/** Last day in a month/year that counts for payroll (today for current month, month-end for past months) */
export function getPayrollPeriodEndDay(month, year, asOfDate = new Date()) {
  const daysInMonth = getDaysInMonth(month, year);
  const asOf = new Date(asOfDate);
  asOf.setHours(0, 0, 0, 0);

  const monthIndex = month - 1;
  if (asOf.getFullYear() < year || (asOf.getFullYear() === year && asOf.getMonth() < monthIndex)) {
    return 0;
  }
  if (asOf.getFullYear() > year || (asOf.getFullYear() === year && asOf.getMonth() > monthIndex)) {
    return daysInMonth;
  }
  return Math.min(asOf.getDate(), daysInMonth);
}

export function employeeJoinedAfterMonth(empJoinDate, month, year) {
  if (!empJoinDate) return false;
  const join = parseDateOnly(empJoinDate);
  if (!join) return false;
  if (join.year > year) return true;
  if (join.year === year && join.month > month) return true;
  return false;
}

export function buildEmployeeAttendanceMap(records = []) {
  const map = {};
  for (const row of records) {
    const key = toDateKey(row.att_date);
    if (!key) continue;
    if (!map[row.emp_id]) map[row.emp_id] = {};
    map[row.emp_id][key] = row;
  }
  return map;
}

/** Branch-wide off days: every eligible employee has HOLIDAY saved for that date */
export function detectBranchOffDays(employees, attendanceRecords, month, year, asOfDate = new Date()) {
  const lastDay = getPayrollPeriodEndDay(month, year, asOfDate);
  const attMap = buildEmployeeAttendanceMap(attendanceRecords);
  const offDays = [];

  for (let day = 1; day <= lastDay; day++) {
    const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const eligible = employees.filter((emp) => {
      const join = parseDateOnly(emp.join_date);
      if (!join) return true;
      if (join.year > year || (join.year === year && join.month > month)) return false;
      if (join.year === year && join.month === month && join.day > day) return false;
      return true;
    });
    if (
      eligible.length > 0 &&
      eligible.every((emp) => attMap[emp.emp_id]?.[dateKey]?.status === 'HOLIDAY')
    ) {
      offDays.push(day);
    }
  }
  return offDays;
}

/**
 * Aggregate one employee's month for payroll.
 * - PRESENT / HOLIDAY (off day) = full paid day, no deduction
 * - LEAVE = leave unit (allowed leaves applied in calcPayroll)
 * - ABSENT = absent unit (allowed absents applied in calcPayroll)
 * - Unmarked (no record) = present — full month pay unless explicitly absent/leave
 * - HALF_DAY = 0.5 paid present (shown in Half column; not counted as absent)
 * - offDays: branch off-day headers — unmarked cells treated as HOLIDAY (paid)
 */
export function aggregateAttendanceForPayroll({
  month,
  year,
  attendanceRecords = [],
  joinDate = null,
  asOfDate = new Date(),
  offDays = [],
}) {
  const daysInMonth = getDaysInMonth(month, year);
  const lastDay = getPayrollPeriodEndDay(month, year, asOfDate);
  const byDate = {};
  for (const r of attendanceRecords) {
    const key = toDateKey(r.att_date);
    if (key) byDate[key] = r.status;
  }

  let totalDays = 0;
  let presentUnits = 0;
  let leaveUnits = 0;
  let absentUnits = 0;
  let presentDays = 0;
  let leaveDays = 0;
  let absentDays = 0;
  let halfDays = 0;
  let holidayDays = 0;

  const join = parseDateOnly(joinDate);
  const offDaySet = new Set(offDays);

  if (join && (join.year > year || (join.year === year && join.month > month))) {
    return {
      total_days: 0,
      days_present: 0,
      leaves_taken: 0,
      absents_taken: 0,
      present_days: 0,
      leave_days: 0,
      absent_days: 0,
      half_days: 0,
      holiday_days: 0,
    };
  }

  let periodStart = 1;
  if (join && join.year === year && join.month === month) {
    periodStart = join.day;
  }

  for (const key of Object.keys(byDate)) {
    const parts = parseDateOnly(key);
    if (parts && parts.year === year && parts.month === month && parts.day <= lastDay) {
      periodStart = Math.min(periodStart, parts.day);
    }
  }

  for (let day = periodStart; day <= lastDay; day++) {
    totalDays += 1;
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    let status = byDate[key];
    if (!status && offDaySet.has(day)) {
      status = 'HOLIDAY';
    }

    switch (status) {
      case 'PRESENT':
        presentUnits += 1;
        presentDays += 1;
        break;
      case 'HOLIDAY':
        presentUnits += 1;
        presentDays += 1;
        holidayDays += 1;
        break;
      case 'LEAVE':
        leaveUnits += 1;
        leaveDays += 1;
        break;
      case 'HALF_DAY':
        presentUnits += 0.5;
        halfDays += 1;
        break;
      case 'ABSENT':
        absentUnits += 1;
        absentDays += 1;
        break;
      default:
        presentUnits += 1;
        presentDays += 1;
        break;
    }
  }

  if (totalDays === 0) {
    return {
      total_days: 0,
      days_present: 0,
      leaves_taken: 0,
      absents_taken: 0,
      present_days: 0,
      leave_days: 0,
      absent_days: 0,
      half_days: 0,
      holiday_days: 0,
    };
  }

  return {
    total_days: totalDays,
    days_present: Math.round(presentUnits * 10) / 10,
    leaves_taken: Math.round(leaveUnits * 10) / 10,
    absents_taken: Math.round(absentUnits * 10) / 10,
    present_days: presentDays,
    leave_days: leaveDays,
    absent_days: absentDays,
    half_days: halfDays,
    holiday_days: holidayDays,
  };
}

export function getPrevMonth(month, year) {
  if (month <= 1) return { month: 12, year: year - 1 };
  return { month: month - 1, year };
}

/** Split pending advances into this month vs carried from earlier months */
export function splitPendingAdvances(advances = [], month, year) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  let advanceThisMonth = 0;
  let advancePrevious = 0;

  for (const a of advances) {
    const amt = parseFloat(a.amount || 0);
    if (!amt) continue;
    const d = new Date(a.advance_date);
    if (Number.isNaN(d.getTime())) {
      advancePrevious += amt;
      continue;
    }
    d.setHours(0, 0, 0, 0);
    if (d >= monthStart && d < monthEnd) advanceThisMonth += amt;
    else if (d < monthStart) advancePrevious += amt;
    else advanceThisMonth += amt;
  }

  return {
    advance_this_month: Math.round(advanceThisMonth * 100) / 100,
    advance_previous: Math.round(advancePrevious * 100) / 100,
    advance_total: Math.round((advanceThisMonth + advancePrevious) * 100) / 100,
  };
}

/** Prefer ledger closing; if unset/zero, use employees.opening_balance (pre-system). */
export function resolveEmployeeReceivableBalance(ledgerClosing, openingBalance) {
  const ledger = parseFloat(ledgerClosing ?? 0);
  const opening = parseFloat(openingBalance ?? 0);
  if (Math.abs(ledger) >= 0.01) return ledger;
  return opening;
}

/**
 * Amount to recover from salary this month (+ = employee owes on ledger).
 * Pending advances are already on the ledger when synced — do not double-count with max(pending).
 */
export function resolvePayrollAdvanceDeduction(ledgerClosing, openingBalance, pendingAdvanceSum = 0) {
  const signed = resolveEmployeeReceivableBalance(ledgerClosing, openingBalance);
  const fromLedger = Math.max(0, signed);
  const pending = Math.max(0, parseFloat(pendingAdvanceSum || 0));
  if (fromLedger > 0.009) return fromLedger;
  return pending;
}

/** + = employee owes (deduct from pay). − = company owes (add to cash payable). */
export function splitEmployeeLedgerForPayroll(signedBalance) {
  const signed = parseFloat(signedBalance ?? 0);
  return {
    signed,
    recoverFromSalary: Math.max(0, signed),
    addToPayable: Math.max(0, -signed),
  };
}

/**
 * Salary clearance preview — same month attendance + account balance rules as POST /api/payroll clearance.
 */
export function previewClearancePayroll(row, form = {}, tabMonth, tabYear) {
  if (!row) return null;
  const m = parseInt(row.month ?? tabMonth, 10);
  const y = parseInt(row.year ?? tabYear, 10);
  const openingBal = parseFloat(row.employee_opening_balance ?? row.employee?.opening_balance ?? 0);
  const ledgerLoaded = row.employee_ledger_closing != null
    && !Number.isNaN(parseFloat(row.employee_ledger_closing));
  const signedClosing = ledgerLoaded
    ? resolveEmployeeReceivableBalance(row.employee_ledger_closing, openingBal)
    : resolveEmployeeReceivableBalance(0, openingBal);
  const pendingSum = parseFloat(row.advance_previous || 0) + parseFloat(row.advance_this_month || 0);
  const accountRecovery = ledgerLoaded
    ? resolvePayrollAdvanceDeduction(row.employee_ledger_closing, openingBal, pendingSum)
    : parseFloat(row.advance_deduction ?? 0)
      || resolvePayrollAdvanceDeduction(0, openingBal, pendingSum);
  const { addToPayable: ledgerPayableCredit } = splitEmployeeLedgerForPayroll(signedClosing);

  const attendanceInput = {
    basic_salary: row.basic_salary,
    total_days: row.total_days,
    days_present: row.days_present,
    leaves_taken: row.leaves_taken,
    absents_taken: row.absents_taken,
    absent_days: row.absent_days ?? row.absents_taken,
    allowed_leaves: row.allowed_leaves,
    allowed_absents: row.allowed_absents ?? 0,
    bonus: parseFloat(form.bonus || 0),
    other_deduction: parseFloat(form.extra_deduction || 0),
  };

  const derived = calcPayroll(buildPayrollCalcInput({
    ...attendanceInput,
    advance_deduction: accountRecovery,
  }, m, y));
  const monthNetAttendance = Math.max(
    0,
    Math.round((derived.gross_earned - derived.total_deduction) * 100) / 100
  );

  const prevBal = parseFloat(row.previous_balance || 0);
  const advanceWithSalary = parseFloat(form.advance_with_salary || 0);
  const grandTotal = calcTotalPayable({
    monthNet: derived.net_salary,
    previousBalance: prevBal,
    advanceWithSalary,
    ledgerPayableCredit,
  });

  return {
    month: m,
    year: y,
    derived,
    monthNetAttendance,
    accountRecovery: derived.advance_deduction,
    ledgerPayableCredit,
    signedClosing,
    openingBal,
    prevBal,
    advanceWithSalary,
    grandTotal,
    ledgerOwed: Math.max(0, signedClosing),
  };
}

export function calcTotalPayable({
  monthNet = 0,
  previousBalance = 0,
  advanceWithSalary = 0,
  ledgerPayableCredit = 0,
} = {}) {
  const total =
    parseFloat(monthNet || 0)
    + parseFloat(previousBalance || 0)
    + parseFloat(advanceWithSalary || 0)
    + parseFloat(ledgerPayableCredit || 0);
  return Math.max(0, Math.round(total * 100) / 100);
}

/** Gross earned this month before advance deduction (attendance + bonus − other). */
export function resolveMonthGrossEarned(row = {}) {
  if (row.month_gross_earned != null && !Number.isNaN(parseFloat(row.month_gross_earned))) {
    return parseFloat(row.month_gross_earned);
  }
  if (row.gross_earned != null && !Number.isNaN(parseFloat(row.gross_earned))) {
    return parseFloat(row.gross_earned);
  }
  const net = parseFloat(row.month_net ?? row.net_salary ?? 0);
  const advance = parseFloat(row.advance_deduction ?? row.advance_this_month ?? 0);
  return Math.max(0, Math.round((net + advance) * 100) / 100);
}

/** This month's salary from attendance (after excess leave/absent ded, before employee account/advance). */
export function resolveMonthAttendanceNet(row = {}) {
  if (row.month_net_attendance != null && !Number.isNaN(parseFloat(row.month_net_attendance))) {
    return parseFloat(row.month_net_attendance);
  }
  const gross = resolveMonthGrossEarned(row);
  const attDed = parseFloat(row.total_deduction ?? 0);
  return Math.max(0, Math.round((gross - attDed) * 100) / 100);
}

/** Net pay for this month after attendance, advance/ledger recovery, bonus, and other deductions. */
export function resolveMonthNetPay(row = {}) {
  const snap = row.clearance_snapshot;
  if (snap?.month_net != null && !Number.isNaN(parseFloat(snap.month_net))) {
    return parseFloat(snap.month_net);
  }
  if (row.month_net != null && !Number.isNaN(parseFloat(row.month_net))) {
    return parseFloat(row.month_net);
  }
  if (row.net_salary != null && !Number.isNaN(parseFloat(row.net_salary))) {
    return parseFloat(row.net_salary);
  }
  const gross = resolveMonthGrossEarned(row);
  const attDed = parseFloat(row.total_deduction ?? 0);
  const advance = parseFloat(row.advance_deduction ?? row.advance_this_month ?? snap?.advance_this_month ?? 0);
  const bonus = parseFloat(row.bonus ?? 0);
  const other = parseFloat(row.other_deduction ?? 0);
  return Math.max(0, Math.round((gross - attDed - advance + bonus - other) * 100) / 100);
}

export function parseClearancePayment(body = {}, totalDue = 0) {
  const paymentMethod = body.paymentMethod || body.payment_method || 'CASH';
  const due = Math.max(0, parseFloat(totalDue || 0));
  let cashAmt = 0;
  let bankAmt = 0;

  if (paymentMethod === 'CASH') {
    cashAmt = parseFloat(body.cash_amount ?? body.cashAmt ?? 0);
    if (due > 0.009 && cashAmt <= 0.009) {
      return { error: 'Enter the cash amount you are paying (do not auto-deduct — type the amount)' };
    }
  } else if (paymentMethod === 'BANK') {
    bankAmt = parseFloat(body.bank_amount ?? body.bankAmt ?? 0);
    if (due > 0.009 && bankAmt <= 0.009) {
      return { error: 'Enter the bank amount you are paying (do not auto-deduct — type the amount)' };
    }
  } else if (paymentMethod === 'PARTIAL') {
    cashAmt = parseFloat(body.cash_amount || 0);
    bankAmt = parseFloat(body.bank_amount || 0);
    if (due > 0.009 && cashAmt + bankAmt <= 0.009) {
      return { error: 'Enter cash and/or bank amounts to pay' };
    }
  } else {
    return { error: 'Invalid payment method' };
  }

  const paidTotal = Math.round((cashAmt + bankAmt) * 100) / 100;
  if (due > 0.009 && paidTotal > due + 0.01) {
    return { error: `Payment (${paidTotal}) cannot exceed total payable (${due})` };
  }

  if (cashAmt > 0.009 && !body.paid_from_account_id) {
    return { error: 'Cash account is required when paying from cash' };
  }
  if (bankAmt > 0.009 && !body.bank_account_id) {
    return { error: 'Bank account is required when paying from bank' };
  }

  return {
    paymentMethod,
    cashAmt,
    bankAmt,
    paidTotal,
    totalDue: due,
    paid_from_account_id: body.paid_from_account_id ? parseInt(body.paid_from_account_id, 10) : null,
    bank_account_id: body.bank_account_id ? parseInt(body.bank_account_id, 10) : null,
    payment_reference: body.payment_reference || null,
  };
}

/** Stored in payroll.notes at clearance — preserves receipt totals after prev month is marked PAID */
export const CLEARANCE_SNAPSHOT_PREFIX = '__HR_CLR__';
/** Prefix on employee_advances.reason for advances paid at salary clearance (removed on undo) */
export const CLEARANCE_ADVANCE_REASON_PREFIX = '__CLR_ADV__';

export function toLocalDateKey(value) {
  if (!value) return null;
  const dt = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function payrollLedgerBillNo(payrollId) {
  return `PAYROLL-${payrollId}`;
}

export function payrollLedgerReversalBillNo(payrollId) {
  return `${payrollLedgerBillNo(payrollId)}-REV`;
}

export function encodeClearanceSnapshot(snapshot) {
  return `${CLEARANCE_SNAPSHOT_PREFIX}${JSON.stringify(snapshot)}`;
}

/** Recover key fields when notes were truncated (legacy VARCHAR(191) limit). */
export function parseLooseClearanceFields(jsonFragment) {
  if (!jsonFragment || typeof jsonFragment !== 'string') return null;
  const out = {};
  const pickNum = (key) => {
    const m = jsonFragment.match(new RegExp(`"${key}"\\s*:\\s*(-?[\\d.]+)`));
    return m ? parseFloat(m[1]) : undefined;
  };
  const pickStr = (key) => {
    const m = jsonFragment.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`));
    return m ? m[1] : undefined;
  };
  for (const key of [
    'total_payable', 'advance_with_salary', 'previous_balance', 'month_net',
    'month_gross_earned', 'bonus', 'other_deduction', 'advance_this_month',
  ]) {
    const v = pickNum(key);
    if (v !== undefined) out[key] = v;
  }
  for (const key of [
    'advance_with_salary_date', 'cleared_at', 'payment_method', 'ledger_bill_no',
  ]) {
    const v = pickStr(key);
    if (v !== undefined) out[key] = v;
  }
  const prevMonth = pickNum('prev_month');
  if (prevMonth !== undefined) out.prev_month = prevMonth;
  const prevYear = pickNum('prev_year');
  if (prevYear !== undefined) out.prev_year = prevYear;
  const clrAdvId = pickNum('clearance_advance_id');
  if (clrAdvId !== undefined) out.clearance_advance_id = clrAdvId;
  return Object.keys(out).length > 0 ? out : null;
}

export function parseClearanceSnapshot(notes) {
  if (!notes || typeof notes !== 'string' || !notes.startsWith(CLEARANCE_SNAPSHOT_PREFIX)) {
    return null;
  }
  const json = notes.slice(CLEARANCE_SNAPSHOT_PREFIX.length);
  try {
    return JSON.parse(json);
  } catch {
    return parseLooseClearanceFields(json);
  }
}

export function enrichPayrollWithSnapshot(row, snapshot = null) {
  if (!snapshot) return row;
  const monthNet = parseFloat(snapshot.month_net ?? row.net_salary ?? 0);
  const previousBalance = parseFloat(snapshot.previous_balance ?? 0);
  const daysPresent = snapshot.days_present ?? snapshot.present_days ?? row.days_present;
  const absentsTaken = snapshot.absent_days ?? snapshot.absents_taken ?? row.absent_days ?? row.absents_taken;
  return {
    ...row,
    days_present: parseFloat(daysPresent ?? 0),
    leaves_taken: parseFloat(snapshot.leaves_taken ?? snapshot.leave_days ?? row.leaves_taken ?? 0),
    absents_taken: parseFloat(absentsTaken ?? 0),
    half_days: snapshot.half_days ?? row.half_days ?? 0,
    present_days: snapshot.present_days ?? daysPresent,
    leave_days: snapshot.leave_days ?? row.leave_days,
    absent_days: snapshot.absent_days ?? absentsTaken,
    paid_days: snapshot.paid_days,
    daily_rate: snapshot.daily_rate,
    previous_balance: previousBalance,
    previous_balance_paid: previousBalance,
    month_net: monthNet,
    month_gross_earned: snapshot.month_gross_earned != null
      ? parseFloat(snapshot.month_gross_earned)
      : undefined,
    total_payable: parseFloat(snapshot.total_payable ?? calcTotalPayable({
      monthNet,
      previousBalance,
      advanceWithSalary: snapshot.advance_with_salary ?? 0,
    })),
    advance_this_month: parseFloat(snapshot.advance_this_month ?? row.advance_this_month ?? 0),
    advance_with_salary: snapshot.advance_with_salary != null
      ? parseFloat(snapshot.advance_with_salary)
      : row.advance_with_salary,
    clearance_advance_id: snapshot.clearance_advance_id ?? null,
    payment_method: snapshot.payment_method,
    cash_amount: snapshot.cash_amount,
    bank_amount: snapshot.bank_amount,
    cash_account_id: snapshot.cash_account_id,
    bank_account_id: snapshot.bank_account_id,
    deduction_reason: snapshot.deduction_reason,
    advance_reason: snapshot.advance_reason,
    advance_with_salary_date: snapshot.advance_with_salary_date ?? snapshot.cleared_at ?? null,
    deducted_advances: Array.isArray(snapshot.deducted_advances) ? snapshot.deducted_advances : [],
    payment_reference: snapshot.payment_reference,
    cleared_at: snapshot.cleared_at ?? row.payment_date,
    prev_month: snapshot.prev_month ?? row.prev_month ?? null,
    prev_year: snapshot.prev_year ?? row.prev_year ?? null,
    bonus: parseFloat(snapshot.bonus ?? row.bonus ?? 0),
    other_deduction: parseFloat(snapshot.other_deduction ?? row.other_deduction ?? 0),
  };
}

export function payrollAsOfDate(month, year) {
  const now = new Date();
  if (now.getFullYear() === year && now.getMonth() + 1 === month) {
    return now;
  }
  return new Date(year, month, 0);
}

export function buildPayrollCalcInput(body, month, year) {
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  return {
    basic_salary: body.basic_salary,
    total_days: body.total_days,
    salary_divisor_days: getDaysInMonth(m, y),
    days_present: body.days_present,
    leaves_taken: body.leaves_taken,
    absents_taken: body.absents_taken,
    absent_days: body.absent_days,
    allowed_leaves: body.allowed_leaves,
    allowed_absents: body.allowed_absents,
    advance_deduction: body.advance_deduction,
    bonus: body.bonus,
    other_deduction: body.other_deduction,
  };
}

export function getMonthDayMeta(month, year) {
  const daysInMonth = getDaysInMonth(month, year);
  const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const days = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const weekday = d.getDay();
    days.push({
      day,
      weekday,
      weekdayLabel: weekdayLabels[weekday],
      isSunday: weekday === 0,
      isSaturday: weekday === 6,
      dateKey: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    });
  }

  return { daysInMonth, days };
}

/** Summarize attendance counts for UI (monthly sheet / summary) */
export function summarizeAttendanceMonth(records = [], daysInMonth, month, year, joinDate = null, asOfDate = new Date()) {
  const byDate = {};
  for (const r of records) {
    const key = toDateKey(r.att_date);
    if (key) byDate[key] = r.status;
  }

  const counts = {
    present: 0,
    absent: 0,
    half_day: 0,
    leave: 0,
    holiday: 0,
    unmarked: 0,
    working_days: 0,
    saved: records.length,
  };

  const join = joinDate ? new Date(joinDate) : null;
  if (join) join.setHours(0, 0, 0, 0);
  const lastDay = getPayrollPeriodEndDay(month, year, asOfDate);

  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(year, month - 1, day);
    d.setHours(0, 0, 0, 0);
    if (join && d < join) continue;

    counts.working_days += 1;
    const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const status = byDate[key];

    switch (status) {
      case 'PRESENT': counts.present += 1; break;
      case 'ABSENT': counts.absent += 1; break;
      case 'HALF_DAY': counts.half_day += 1; break;
      case 'LEAVE': counts.leave += 1; break;
      case 'HOLIDAY': counts.holiday += 1; break;
      default: counts.unmarked += 1; break;
    }
  }

  return counts;
}

/** Client-side summary from grid cells (includes pending edits) */
export function summarizeGridMonth({ daysInMonth, month, year, joinDate, getStatusForDay, asOfDate = new Date() }) {
  const counts = {
    present: 0,
    absent: 0,
    half_day: 0,
    leave: 0,
    holiday: 0,
    unmarked: 0,
    working_days: 0,
  };

  const join = joinDate ? new Date(joinDate) : null;
  if (join) join.setHours(0, 0, 0, 0);
  const lastDay = getPayrollPeriodEndDay(month, year, asOfDate);

  for (let day = 1; day <= lastDay; day++) {
    const d = new Date(year, month - 1, day);
    d.setHours(0, 0, 0, 0);
    if (join && d < join) continue;

    counts.working_days += 1;
    const status = getStatusForDay(day);

    switch (status) {
      case 'PRESENT': counts.present += 1; break;
      case 'ABSENT': counts.absent += 1; break;
      case 'HALF_DAY': counts.half_day += 1; break;
      case 'LEAVE': counts.leave += 1; break;
      case 'HOLIDAY': counts.holiday += 1; break;
      default: counts.unmarked += 1; break;
    }
  }

  return counts;
}

/**
 * Day-based salary calculation.
 * Daily rate = basic_salary / days in calendar month.
 * Paid days = present (incl. 0.5 per half-day) + allowed leaves + allowed full absents.
 * Net = (paid days × daily rate) − excess attendance deduction − advances + bonus − other deductions.
 */
export function calcPayroll({
  basic_salary,
  total_days,
  salary_divisor_days,
  days_present,
  leaves_taken,
  absents_taken,
  absent_days,
  allowed_leaves,
  allowed_absents = 0,
  advance_deduction = 0,
  bonus = 0,
  other_deduction = 0,
}) {
  const salary = parseFloat(basic_salary) || 0;
  const periodDays = Math.max(0, parseInt(total_days, 10) || 0);
  const divisor = Math.max(1, parseInt(salary_divisor_days, 10) || periodDays || 30);
  const allowedLeave = parseFloat(allowed_leaves) || 0;
  const allowedAbsent = parseFloat(allowed_absents) || 0;

  const advDeduction = parseFloat(advance_deduction) || 0;
  const bonusAmt = parseFloat(bonus) || 0;
  const othDeduction = parseFloat(other_deduction) || 0;

  if (periodDays === 0) {
    return {
      days_present: 0,
      leaves_taken: 0,
      absents_taken: 0,
      excess_leaves: 0,
      excess_absents: 0,
      deduction_per_day: 0,
      total_deduction: 0,
      paid_days: 0,
      advance_deduction: advDeduction,
      bonus: bonusAmt,
      other_deduction: othDeduction,
      gross_earned: 0,
      net_salary: Math.max(0, Math.round((bonusAmt - advDeduction - othDeduction) * 100) / 100),
    };
  }

  let present = 0;
  let leaves = 0;
  let absents = 0;

  const hasPresent = days_present !== undefined && days_present !== null && !Number.isNaN(parseFloat(days_present));
  const hasLeaves = leaves_taken !== undefined && leaves_taken !== null && !Number.isNaN(parseFloat(leaves_taken));
  const hasAbsents = absents_taken !== undefined && absents_taken !== null && !Number.isNaN(parseFloat(absents_taken));

  if (hasPresent) present = Math.min(periodDays, Math.max(0, parseFloat(days_present)));
  if (hasLeaves) leaves = Math.min(periodDays, Math.max(0, parseFloat(leaves_taken)));
  if (hasAbsents) absents = Math.min(periodDays, Math.max(0, parseFloat(absents_taken)));

  const fullAbsentDays = absent_days !== undefined && absent_days !== null && !Number.isNaN(parseFloat(absent_days))
    ? Math.max(0, parseFloat(absent_days))
    : absents;

  const paidLeaveDays = Math.min(leaves, allowedLeave);
  const paidAbsentDays = Math.min(fullAbsentDays, allowedAbsent);
  const paidDays = Math.min(
    periodDays,
    Math.round((present + paidLeaveDays + paidAbsentDays) * 100) / 100
  );

  const excessLeaves = Math.max(0, Math.round((leaves - allowedLeave) * 10) / 10);
  const excessAbsents = Math.max(0, Math.round((fullAbsentDays - allowedAbsent) * 10) / 10);

  const perDay = salary / divisor;
  const earned = paidDays * perDay;
  const totalDeduction = (excessLeaves + excessAbsents) * perDay;
  const grossEarned = Math.round((earned + bonusAmt - othDeduction) * 100) / 100;
  const net = Math.max(0, Math.round((grossEarned - totalDeduction - advDeduction) * 100) / 100);

  return {
    days_present: present,
    leaves_taken: leaves,
    absents_taken: absents,
    excess_leaves: excessLeaves,
    excess_absents: excessAbsents,
    deduction_per_day: Math.round(perDay * 100) / 100,
    total_deduction: Math.round(totalDeduction * 100) / 100,
    paid_days: paidDays,
    advance_deduction: advDeduction,
    bonus: bonusAmt,
    other_deduction: othDeduction,
    gross_earned: grossEarned,
    net_salary: net,
  };
}

export function previewPayrollFromAttendance({
  basic_salary,
  month,
  year,
  attendanceRecords,
  joinDate,
  allowed_leaves,
  allowed_absents = 0,
  advance_deduction = 0,
  bonus = 0,
  other_deduction = 0,
}) {
  const agg = aggregateAttendanceForPayroll({
    month,
    year,
    attendanceRecords,
    joinDate,
  });

  const calendarDays = getDaysInMonth(month, year);

  return {
    ...agg,
    ...calcPayroll({
      basic_salary,
      total_days: agg.total_days,
      salary_divisor_days: calendarDays,
      days_present: agg.days_present,
      leaves_taken: agg.leaves_taken,
      absents_taken: agg.absents_taken,
      absent_days: agg.absent_days,
      allowed_leaves,
      allowed_absents,
      advance_deduction,
      bonus,
      other_deduction,
    }),
  };
}
