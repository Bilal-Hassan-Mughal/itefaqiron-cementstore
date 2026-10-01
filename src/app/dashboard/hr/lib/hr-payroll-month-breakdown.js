import { resolveMonthGrossEarned, employeeJoinedAfterMonth } from '@/lib/hr-payroll';
import { plainAccountHeadline } from './hr-clearance-plain-summary';

/**
 * Full month salary story for Pay Salary UI (list + pay dialog).
 * Unmarked attendance = no pay line, no "unpaid days" deduction.
 */
export function buildEmployeeMonthBreakdown(payroll, preview, clearForm = {}, tabMonth, tabYear) {
  if (!payroll || !preview) return null;

  const m = parseInt(payroll.month ?? tabMonth, 10);
  const y = parseInt(payroll.year ?? tabYear, 10);
  const derived = preview.derived || {};
  const basic = parseFloat(payroll.basic_salary || 0);
  const gross = parseFloat(derived.gross_earned ?? resolveMonthGrossEarned(payroll));
  const excessAbs = parseFloat(derived.excess_absents ?? payroll.excess_absents ?? 0);
  const excessLeave = parseFloat(derived.excess_leaves ?? payroll.excess_leaves ?? 0);
  const extraAttPenalty = parseFloat(derived.total_deduction || 0);
  const bonus = parseFloat(clearForm.bonus ?? payroll.bonus ?? 0);
  const extraDed = parseFloat(clearForm.extra_deduction ?? payroll.other_deduction ?? 0);
  const monthNet = parseFloat(derived.net_salary ?? 0);
  const recovery = parseFloat(
    preview.advanceAppliedThisMonth ?? preview.accountRecovery ?? preview.recoveryDeduction ?? 0
  );
  const prev = parseFloat(preview.prevBal ?? payroll.previous_balance ?? 0);
  const companyOwes = parseFloat(preview.ledgerPayableCredit ?? 0);
  const advWith = parseFloat(preview.advanceWithSalary ?? clearForm.advance_with_salary ?? 0);
  const total = parseFloat(preview.grandTotal ?? 0);
  const account = plainAccountHeadline(preview.signedClosing, String);

  const present = payroll.days_present ?? payroll.paid_days ?? payroll.present_days;
  const leave = payroll.leave_days ?? payroll.leaves_taken ?? 0;
  const absent = payroll.absent_days ?? payroll.absents_taken ?? 0;
  const half = payroll.half_days ?? 0;
  const unmarked = parseFloat(payroll.unmarked_days ?? preview.unmarked_days ?? 0);
  const monthDays = payroll.total_days ?? 30;
  const joinDate = payroll.employee?.join_date ?? payroll.join_date;
  const presentN = parseFloat(present ?? 0) || 0;
  let attendanceHint = '';
  if (employeeJoinedAfterMonth(joinDate, m, y)) {
    attendanceHint = 'Join date is after this month — payroll cannot count days. Set join date earlier or open the correct month.';
  } else if (monthDays <= 0 && presentN <= 0 && parseFloat(leave || 0) <= 0 && parseFloat(absent || 0) <= 0) {
    attendanceHint = `No attendance counted for ${m}/${y}. Mark days on the Attendance sheet for this same month & year, then refresh Pay Salary.`;
  }

  const moneyLines = [];

  moneyLines.push({ id: 'basic', label: 'Monthly basic (contract)', amount: basic, kind: 'info' });
  const earnedNotes = [];
  if (unmarked > 0.009) {
    earnedNotes.push(`${Math.round(unmarked)} day(s) not marked — no pay, no absent cut`);
  }
  if (excessAbs > 0.009 || excessLeave > 0.009) {
    const parts = [];
    if (excessAbs > 0.009) parts.push(`${excessAbs} absent over limit`);
    if (excessLeave > 0.009) parts.push(`${excessLeave} leave over limit`);
    earnedNotes.push(`${parts.join(', ')} — not paid (marked on sheet)`);
  }
  moneyLines.push({
    id: 'earned',
    label: 'Salary for marked days only',
    amount: gross,
    kind: 'base',
    note: earnedNotes.join(' · '),
  });

  if (extraAttPenalty > 0.009) {
    moneyLines.push({ id: 'penalty', label: 'Extra attendance cut', amount: extraAttPenalty, kind: 'sub' });
  }
  if (bonus > 0.009) {
    moneyLines.push({ id: 'bonus', label: 'Bonus', amount: bonus, kind: 'add' });
  }
  if (extraDed > 0.009) {
    moneyLines.push({ id: 'extra', label: 'Extra cut', amount: extraDed, kind: 'sub' });
  }
  if (recovery > 0.009) {
    moneyLines.push({ id: 'recovery', label: 'Old advance taken from salary', amount: recovery, kind: 'sub' });
  }
  moneyLines.push({ id: 'monthnet', label: 'This month (after above)', amount: monthNet, kind: 'subtotal' });

  const accountLines = [];
  if (account.tone !== 'clear') {
    accountLines.push({
      id: 'acct',
      label: account.title,
      amount: Math.abs(parseFloat(preview.signedClosing || 0)),
      kind: account.tone === 'owe' ? 'sub' : 'add',
    });
  }
  if (companyOwes > 0.009) {
    accountLines.push({ id: 'co', label: 'You already owed them', amount: companyOwes, kind: 'add' });
  }
  if (prev > 0.009) {
    accountLines.push({ id: 'prev', label: 'Last month still unpaid', amount: prev, kind: 'add' });
  }
  if (advWith > 0.009) {
    accountLines.push({ id: 'advw', label: 'Advance with this payment', amount: advWith, kind: 'add' });
  }

  return {
    attendance: {
      present: present ?? '—',
      leave,
      absent,
      half,
      unmarked: unmarked > 0.009 ? Math.round(unmarked) : '—',
      monthDays,
      hint: attendanceHint,
    },
    moneyLines,
    accountLines,
    total,
    monthNet,
    accountHeadline: account,
    afterPayment: preview.ledgerAfterClearance,
    beforePayment: preview.signedClosing,
  };
}
