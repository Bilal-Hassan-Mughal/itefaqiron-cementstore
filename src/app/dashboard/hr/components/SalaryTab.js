'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Snackbar,
  Dialog, DialogTitle, DialogContent, DialogActions, Alert,
  IconButton, Tooltip, CircularProgress, Stack, Autocomplete, ToggleButton, ToggleButtonGroup, Divider,
} from '@mui/material';
import {
  CheckCircle, Print, ChevronLeft, ChevronRight,
  Today as TodayIcon, Payments, AccountBalanceWallet, Undo,
  Download, ReceiptLong, Close,
} from '@mui/icons-material';
import { BRAND, COMPANY } from '@/lib/brand-theme';
import {
  calcTotalPayable, getDaysInMonth, getMonthDayMeta, previewClearancePayroll,
  resolveLedgerBalanceAfterClearance, resolveLedgerBalanceBeforeClearance, resolveMonthAttDedDisplay,
  resolveMonthGrossEarned, resolveMonthNetPay, resolveSalaryAdvanceApplied, resolveSignedLedgerBalance,
  resolveTotalPayable, toDateKey,
} from '@/lib/hr-payroll';
import { useHrRefresh, useHrRefreshVersion, HR_KEYS } from '../context/HrRefreshContext';
import { getSalaryReceiptA5Stylesheet, SALARY_RECEIPT_PAGE } from '../lib/salary-receipt-a5-styles';
import SalaryClearanceDialog from './salary/SalaryClearanceDialog';
import SalaryClearancePanel from './salary/SalaryClearancePanel';
import SalaryReceiptPageList from './salary/SalaryReceiptPageList';

const NAVY = '#0f172a';
const PRIMARY = BRAND.primary.blue;
const AMBER = '#f59e0b';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const fmtAmt = (v) => {
  const n = parseFloat(v || 0);
  return `Rs ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const fmtNum = (v) => {
  const n = parseFloat(v || 0);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
};

const fmtDate = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '-' : dt.toLocaleDateString('en-GB');
};

const fmtDed = (v) => `- ${fmtAmt(v)}`;
const fmtAdd = (v) => fmtAmt(v);

/**
 * Signed employee ledger for receipt amount column.
 * + balance = employee owes → shown as minus (کٹوتی from salary).
 * − balance = company owes employee → shown as plus (اضافہ to salary).
 */
function payslipAccountIsEmpty(signed) {
  const n = parseFloat(signed);
  return signed == null || Number.isNaN(n) || Math.abs(n) < 0.009;
}

function payslipEmployeeAccountDisplay(signed) {
  const n = parseFloat(signed);
  if (payslipAccountIsEmpty(signed)) {
    return { html: '—', cls: '' };
  }
  if (n > 0.009) {
    return {
      html: `${fmtDed(n)} <span class="acct-tag">Recover</span>`,
      cls: 'ded-amt',
    };
  }
  return {
    html: `+ ${fmtAmt(Math.abs(n))} <span class="acct-tag">Payable</span>`,
    cls: 'earn-amt',
  };
}

function resolveReceiptAdvanceDeduction(payroll, monthlySalaryAmount, monthNet, attDed, otherDed, bonus, deductedAdvances) {
  if (deductedAdvances.length > 0) {
    return deductedAdvances.reduce((s, a) => s + parseFloat(a.amount || 0), 0);
  }
  const snap = payroll.clearance_snapshot || {};
  const stored = parseFloat(payroll.advance_deduction ?? snap.advance_this_month ?? 0);
  const implied = Math.max(
    0,
    Math.round((monthlySalaryAmount - attDed - otherDed + bonus - monthNet) * 100) / 100
  );
  if (implied > 0.009 && (stored <= 0.009 || Math.abs(stored - implied) > 0.02)) return implied;
  return stored;
}

function fmtHrLedgerBalanceCell(row, signedOverride, { afterClearance = false } = {}) {
  const signed = signedOverride !== undefined && signedOverride !== null
    ? parseFloat(signedOverride)
    : resolveSignedLedgerBalance(row);
  if (Math.abs(signed) < 0.009) {
    return {
      text: '—',
      color: '#94a3b8',
      title: afterClearance ? 'Account settled after clearance' : 'No opening or ledger balance',
    };
  }
  if (signed > 0) {
    return {
      text: `− ${fmtAmt(signed)}`,
      color: '#b45309',
      title: afterClearance
        ? 'Employee will still owe after salary recovery this month'
        : 'Employee owes (opening/advances) — recovered from salary up to earned amount',
    };
  }
  return {
    text: `+ ${fmtAmt(Math.abs(signed))}`,
    color: '#15803d',
    title: afterClearance
      ? 'Company will still owe employee after clearance'
      : 'Company owes employee — added to Total Pay',
  };
}

function payslipPaymentMethodLabel(method) {
  const m = String(method || '').toUpperCase();
  if (m === 'CASH') return 'Cash';
  if (m === 'BANK' || m === 'BANK_TRANSFER') return 'Bank';
  if (m === 'PARTIAL') return 'Split (Cash + Bank)';
  return method || '—';
}

function getPayslipLogoUrl() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/logo-header.png`;
  }
  return '/logo-header.png';
}

function payslipLbl(text) {
  return escapeHtml(text);
}

function resolvePayslipPrevPeriod(payroll) {
  const snap = payroll.clearance_snapshot || {};
  const pm = payroll.prev_month ?? snap.prev_month;
  const py = payroll.prev_year ?? snap.prev_year;
  if (pm && py) {
    return `${MONTHS[parseInt(pm, 10) - 1] || '-'} ${py}`;
  }
  return null;
}

/** A5 portrait — see `hr/lib/salary-receipt-a5-spec.js` */
const PAYSLIP_PAGE = SALARY_RECEIPT_PAGE;

/** Salary receipt — plain English (matches salary sheet columns). */
const PAYSLIP_I18N = {
  docTitleEn: 'Salary Receipt',
  docSubEn: 'Payment record for this month',
  paymentDate: 'Paid on',
  salaryPeriod: 'Month',
  status: 'Status',
  paid: 'PAID',
  employee: 'Employee',
  attendance: 'Days this month',
  present: 'Present',
  leave: 'Leave',
  absent: 'Absent',
  half: 'Half day',
  paidDays: 'Paid days',
  salaryDetails: 'Salary (same as salary sheet)',
  item: 'Item',
  amount: 'Amount (Rs)',
  paymentTitle: 'How payment was made',
  cashPaid: 'Cash paid',
  bankPaid: 'Bank paid',
  paymentMethod: 'Method',
  reference: 'Reference',
  amountPaid: 'Total paid',
  empSign: 'Employee sign',
  authSign: 'Manager sign',
};

const PAYSLIP_ROW = {
  basic: 'Monthly basic salary',
  earned: 'Salary earned (days worked)',
  attDed: 'Cut for absent / unpaid days',
  bonus: 'Bonus',
  extraDed: 'Other deduction',
  prevBal: 'Unpaid salary from last month',
  accountBal: 'Old balance (before this pay)',
  advDeducted: 'Old advance / balance recovered',
  advWithSal: 'New advance paid with salary',
  netPay: 'Net pay this month',
  totalPay: 'Total to pay (cash + bank)',
  accountAfter: 'Balance after this pay',
  salaryShortPaid: 'Still owed this month (carried)',
  amountPaid: 'Paid now (cash + bank)',
};

/** WhatsApp / PDF capture — full receipt, scaled to A5 in PDF step */
const PAYSLIP_WA_CAPTURE_STYLES = `
  .salary-payslip-sheet.salary-wa-capture {
    overflow: visible !important;
    box-shadow: none !important;
    min-height: 0 !important;
  }
  .salary-payslip-sheet.salary-wa-capture .salary-payslip-root {
    min-height: 0 !important;
    max-height: none !important;
    overflow: visible !important;
  }
`;

function getPayslipStylesheet() {
  return getSalaryReceiptA5Stylesheet();
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const RECEIPT_ATT_STATUS = {
  PRESENT: { label: 'P', cls: 'st-PRESENT' },
  ABSENT: { label: 'A', cls: 'st-ABSENT' },
  LEAVE: { label: 'L', cls: 'st-LEAVE' },
  HALF_DAY: { label: 'H', cls: 'st-HALF_DAY' },
  HOLIDAY: { label: 'Off', cls: 'st-HOLIDAY' },
};

async function enrichPayrollWithAttendance(payroll) {
  if (!payroll?.emp_id || !payroll.month || !payroll.year) return payroll;
  if (payroll.attendance_by_day) return payroll;
  try {
    const res = await fetch(
      `/api/attendance?emp_id=${payroll.emp_id}&month=${payroll.month}&year=${payroll.year}`
    );
    if (!res.ok) return payroll;
    const records = await res.json();
    const attendanceByDay = {};
    if (Array.isArray(records)) {
      for (const r of records) {
        const key = toDateKey(r.att_date);
        if (key) attendanceByDay[key] = r.status;
      }
    }
    return {
      ...payroll,
      attendance_by_day: attendanceByDay,
      employee_join_date: payroll.employee?.join_date ?? null,
    };
  } catch {
    return payroll;
  }
}

/** Attendance + snapshot balance fields for receipt print / PDF / WhatsApp. */
async function enrichPayrollForReceipt(payroll) {
  let row = await enrichPayrollWithAttendance(payroll);
  const snap = row.clearance_snapshot || {};
  row = {
    ...row,
    previous_balance: row.previous_balance ?? snap.previous_balance,
    prev_month: row.prev_month ?? snap.prev_month ?? null,
    prev_year: row.prev_year ?? snap.prev_year ?? null,
    ledger_payable_credit: row.ledger_payable_credit ?? snap.ledger_payable_credit,
    employee_ledger_closing_before:
      row.employee_ledger_closing_before
      ?? snap.employee_ledger_closing_before
      ?? snap.employee_ledger_closing
      ?? row.employee_ledger_closing,
    employee_ledger_closing_after:
      row.employee_ledger_closing_after ?? snap.employee_ledger_closing_after,
  };
  return row;
}

function receiptStatusForDay(month, year, day, attendanceByDay, joinDate) {
  const d = new Date(year, month - 1, day);
  d.setHours(0, 0, 0, 0);
  const join = joinDate ? new Date(joinDate) : null;
  if (join) join.setHours(0, 0, 0, 0);
  if (join && d < join) return { label: '', cls: 'muted' };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const status = attendanceByDay[dateKey] || attendanceByDay[day] || null;

  if (!status) {
    if (d > today) return { label: '', cls: 'muted' };
    return { label: '-', cls: 'st-UNMARKED' };
  }
  const meta = RECEIPT_ATT_STATUS[status] || { label: '?', cls: 'st-UNMARKED' };
  return meta;
}

function buildMonthAttendanceGridHtml(month, year, attendanceByDay = {}, joinDate = null, embedded = false) {
  const monthLabel = MONTHS[(month || 1) - 1] || '-';
  const { daysInMonth, days: dayMeta } = getMonthDayMeta(month, year);
  const firstWeekday = dayMeta[0]?.weekday ?? 0;
  const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  let gridCells = '';
  for (let i = 0; i < firstWeekday; i += 1) {
    gridCells += '<div class="att-cal-pad"></div>';
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const st = receiptStatusForDay(month, year, day, attendanceByDay, joinDate);
    const statusHtml = st.label ? `<span class="s">${escapeHtml(st.label)}</span>` : '';
    gridCells += `<div class="att-cal-day ${st.cls}">
      <span class="d">${day}</span>
      ${statusHtml}
    </div>`;
  }

  const legendItems = [
    { cls: 'st-PRESENT', label: 'Present' },
    { cls: 'st-ABSENT', label: 'Absent' },
    { cls: 'st-LEAVE', label: 'Leave' },
    { cls: 'st-HALF_DAY', label: 'Half Day' },
    { cls: 'st-HOLIDAY', label: 'Off Day' },
    { cls: 'st-UNMARKED', label: 'Unmarked' },
  ];
  const legend = legendItems.map((v) =>
    `<span><span class="dot ${v.cls}"></span>${v.label}</span>`
  ).join('');

  const gridInner = `
    <div class="att-cal-legend">${legend}</div>
    <div class="att-cal-weekdays">${weekdayLabels.map((w) => `<div>${w}</div>`).join('')}</div>
    <div class="att-cal-grid">${gridCells}</div>`;
  if (embedded) return gridInner;
  return `<div class="att-month-cal">
    <div class="panel-head">Monthly Attendance - ${escapeHtml(monthLabel)} ${year}</div>
    ${gridInner}
  </div>`;
}

function payslipDashMoney(amount) {
  const n = parseFloat(amount);
  if (Number.isNaN(n) || Math.abs(n) < 0.009) return { text: '—', cls: 'muted' };
  return { text: fmtAmt(n), cls: '' };
}

function payslipDashDed(amount) {
  const n = parseFloat(amount);
  if (Number.isNaN(n) || Math.abs(n) < 0.009) return { text: '—', cls: 'muted' };
  return { text: fmtDed(n), cls: 'ded-amt' };
}

function payslipSheetBalance(signed) {
  const n = parseFloat(signed);
  if (Number.isNaN(n) || Math.abs(n) < 0.009) return { text: '—', cls: 'muted' };
  const cell = fmtHrLedgerBalanceCell({}, n);
  return { text: cell.text, cls: n > 0 ? 'ded-amt' : 'earn-amt' };
}

function buildPayslipBody(payroll) {
  const emp = payroll.employee || {};
  const monthLabel = MONTHS[(payroll.month || 1) - 1] || '-';
  const period = `${monthLabel} ${payroll.year || ''}`.trim();
  const printed = new Date().toLocaleString('en-GB');
  const snap = payroll.clearance_snapshot || {};
  const monthNet = resolveMonthNetPay(payroll);
  const earned = resolveMonthGrossEarned(payroll);
  const attDed = resolveMonthAttDedDisplay(payroll, payroll.month, payroll.year);
  const bonus = parseFloat(payroll.bonus || 0);
  const otherDed = parseFloat(payroll.other_deduction || 0);
  const prevBal = parseFloat(payroll.previous_balance ?? snap.previous_balance ?? 0);
  const advDeducted = resolveSalaryAdvanceApplied(payroll);
  const advanceWithSalary = parseFloat(payroll.advance_with_salary ?? snap.advance_with_salary ?? 0);
  const ledgerPayableCredit = parseFloat(payroll.ledger_payable_credit ?? snap.ledger_payable_credit ?? 0);
  const totalDue = resolveTotalPayable(payroll);
  const cashPaid = parseFloat(payroll.cash_amount ?? snap.cash_amount ?? 0);
  const bankPaid = parseFloat(payroll.bank_amount ?? snap.bank_amount ?? 0);
  const amountPaidActual = parseFloat(
    payroll.amount_paid ?? snap.amount_paid ?? (cashPaid + bankPaid)
  );
  const totalPaid = amountPaidActual > 0.009 ? amountPaidActual : totalDue;
  const salaryShortPaid = Math.max(0, Math.round((totalDue - amountPaidActual) * 100) / 100);
  const payDate = payroll.payment_date || payroll.cleared_at || snap.cleared_at;
  const paymentMethod = payroll.payment_method || snap.payment_method
    || (cashPaid > 0 && bankPaid > 0 ? 'PARTIAL' : bankPaid > 0 ? 'BANK' : 'CASH');

  const acctBefore = payroll.status === 'PAID'
    ? resolveLedgerBalanceBeforeClearance(payroll)
    : resolveSignedLedgerBalance(payroll);
  const acctAfter = payroll.status === 'PAID'
    ? resolveLedgerBalanceAfterClearance(payroll)
    : null;

  const br = (label, cell, rowCls = '') =>
    `<tr class="data-row ${rowCls}"><td class="desc">${payslipLbl(label)}</td><td class="amt ${cell.cls}">${cell.text}</td></tr>`;
  const brIf = (label, cell, rowCls = '') => {
    if (cell.text === '—') return '';
    return br(label, cell, rowCls);
  };

  const present = fmtNum(payroll.days_present ?? payroll.present_days);
  const leave = fmtNum(payroll.leaves_taken ?? payroll.leave_days);
  const absent = fmtNum(payroll.absent_days ?? payroll.absents_taken ?? 0);
  const half = fmtNum(payroll.half_days ?? 0);
  const paidDays = fmtNum(payroll.paid_days ?? payroll.days_present);

  let rows = '';
  rows += br(PAYSLIP_ROW.basic, payslipDashMoney(payroll.basic_salary));
  rows += br(PAYSLIP_ROW.earned, { text: fmtAmt(earned), cls: 'earn-amt' });
  rows += brIf(PAYSLIP_ROW.attDed, payslipDashDed(attDed));
  rows += brIf(PAYSLIP_ROW.bonus, bonus > 0.009 ? { text: fmtAdd(bonus), cls: 'earn-amt' } : payslipDashMoney(0));
  rows += brIf(PAYSLIP_ROW.extraDed, payslipDashDed(otherDed));
  rows += brIf(PAYSLIP_ROW.prevBal, payslipDashMoney(prevBal));
  rows += brIf(PAYSLIP_ROW.accountBal, payslipSheetBalance(acctBefore));
  rows += brIf(PAYSLIP_ROW.advDeducted, payslipDashDed(advDeducted));
  if (advanceWithSalary > 0.009) {
    rows += br(PAYSLIP_ROW.advWithSal, { text: fmtAmt(advanceWithSalary), cls: 'earn-amt' });
  }
  if (ledgerPayableCredit > 0.009) {
    rows += br('Extra from company (old balance)', { text: fmtAdd(ledgerPayableCredit), cls: 'earn-amt' });
  }
  rows += br(PAYSLIP_ROW.netPay, { text: fmtAmt(monthNet), cls: 'net-amt' }, 'net-row');
  rows += br(PAYSLIP_ROW.totalPay, { text: fmtAmt(totalDue), cls: 'net-amt' }, 'net-row');
  if (acctAfter != null) {
    rows += brIf(PAYSLIP_ROW.accountAfter, payslipSheetBalance(acctAfter));
  }

  const dash = '—';
  const logoUrl = getPayslipLogoUrl();
  const statusHtml = payroll.status === 'PAID'
    ? `<span class="status-paid">${PAYSLIP_I18N.paid}</span>`
    : escapeHtml(payroll.status || 'PENDING');
  const empDesig = emp.designation ? escapeHtml(emp.designation) : '';
  const phones = (COMPANY.phones || []).length ? `Tel: ${escapeHtml((COMPANY.phones || []).join(', '))}` : '';

  return `<div class="salary-payslip-sheet"><div class="salary-payslip-root sr-compact" id="salary-payslip-preview">
  <div class="receipt-header">
    <img class="co-logo" src="${escapeHtml(logoUrl)}" alt="" />
    <div class="co-info">
      <h1>${escapeHtml(COMPANY.name)}</h1>
      ${phones ? `<p class="phone">${phones}</p>` : ''}
    </div>
    <div class="title-badge">
      <div class="en">${PAYSLIP_I18N.docTitleEn}</div>
      <div class="sub">${escapeHtml(period)}</div>
    </div>
  </div>

  <div class="inv-main">
  <table class="meta-table meta-compact">
    <tr>
      <td class="mk">${payslipLbl(PAYSLIP_I18N.employee)}</td>
      <td class="mv emp-name" colspan="3">${escapeHtml(emp.emp_name || dash)}${empDesig ? ` · ${empDesig}` : ''}</td>
    </tr>
    <tr>
      <td class="mk">${payslipLbl(PAYSLIP_I18N.paymentDate)}</td>
      <td class="mv">${escapeHtml(fmtDate(payDate))}</td>
      <td class="mk">${payslipLbl(PAYSLIP_I18N.status)}</td>
      <td class="mv">${statusHtml}</td>
    </tr>
  </table>

  <p class="sec-label">${payslipLbl(PAYSLIP_I18N.attendance)}</p>
  <table class="att-strip">
    <tr>
      <th>${payslipLbl(PAYSLIP_I18N.present)}</th>
      <th>${payslipLbl(PAYSLIP_I18N.leave)}</th>
      <th>${payslipLbl(PAYSLIP_I18N.absent)}</th>
      <th>${payslipLbl(PAYSLIP_I18N.half)}</th>
      <th>${payslipLbl(PAYSLIP_I18N.paidDays)}</th>
    </tr>
    <tr>
      <td>${present}</td>
      <td>${leave}</td>
      <td>${absent}</td>
      <td>${half}</td>
      <td>${paidDays}</td>
    </tr>
  </table>

  <p class="sec-label">${payslipLbl(PAYSLIP_I18N.salaryDetails)}</p>
  <table class="inv-table inv-compact">
    <colgroup><col class="col-desc" /><col class="col-amt" /></colgroup>
    <thead><tr><th>${payslipLbl(PAYSLIP_I18N.item)}</th><th class="amt-h">${payslipLbl(PAYSLIP_I18N.amount)}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <p class="sec-label">${payslipLbl(PAYSLIP_I18N.paymentTitle)}</p>
  <table class="inv-table inv-compact pay-block">
    <tbody>
      ${brIf(PAYSLIP_I18N.cashPaid, cashPaid > 0.009 ? payslipDashMoney(cashPaid) : payslipDashMoney(0))}
      ${brIf(PAYSLIP_I18N.bankPaid, bankPaid > 0.009 ? payslipDashMoney(bankPaid) : payslipDashMoney(0))}
      <tr class="data-row"><td class="desc">${payslipLbl(PAYSLIP_I18N.paymentMethod)}</td><td class="amt">${escapeHtml(payslipPaymentMethodLabel(paymentMethod))}</td></tr>
      ${payroll.payment_reference ? `<tr class="data-row"><td class="desc">${payslipLbl(PAYSLIP_I18N.reference)}</td><td class="amt val-txt">${escapeHtml(payroll.payment_reference)}</td></tr>` : ''}
      ${salaryShortPaid > 0.009 ? br(PAYSLIP_ROW.salaryShortPaid, payslipDashMoney(salaryShortPaid)) : ''}
    </tbody>
  </table>

  <div class="paid-banner">
    <span class="lbl">${payslipLbl(PAYSLIP_I18N.amountPaid)}</span>
    <span class="val">${fmtAmt(totalPaid)}</span>
  </div>
  </div>

  <div class="inv-footer">
    <div class="sign">
      <span>${payslipLbl(PAYSLIP_I18N.empSign)}</span>
      <span>${payslipLbl(PAYSLIP_I18N.authSign)}</span>
    </div>
    <p class="foot">${escapeHtml(printed)}</p>
  </div>
</div></div>`;
}

function buildPayslipHtml(payroll) {
  const emp = payroll.employee || {};
  return `<!DOCTYPE html><html lang="en" class="salary-receipt-print-root"><head><meta charset="utf-8"><title>${PAYSLIP_I18N.docTitleEn} - ${escapeHtml(emp.emp_name || '')}</title>
<style>${getPayslipStylesheet()}</style></head><body style="margin:0;padding:0;background:#fff;width:148mm">
${buildPayslipBody(payroll)}
</body></html>`;
}

function payslipFileName(payroll) {
  const emp = payroll.employee || {};
  const receiptNo = payroll.payroll_id ? `SR-${String(payroll.payroll_id).padStart(5, '0')}` : 'receipt';
  const name = (emp.emp_name || 'employee').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-');
  return `Salary-Receipt-${receiptNo}-${name}.pdf`;
}

async function mountSalaryReceiptForCapture(payroll) {
  const enriched = await enrichPayrollForReceipt(payroll);
  const printable = document.getElementById('printable-salary-payslip');
  if (!printable) throw new Error('Print container not found');

  printable.innerHTML = `<style>${getPayslipStylesheet()}${PAYSLIP_WA_CAPTURE_STYLES}</style>${buildPayslipBody(enriched)}`;
  printable.style.display = 'block';
  printable.style.position = 'fixed';
  printable.style.left = '-12000px';
  printable.style.top = '0';
  printable.style.width = PAYSLIP_PAGE.w;
  printable.style.height = 'auto';
  printable.style.overflow = 'visible';
  printable.style.background = '#fff';
  printable.style.zIndex = '-1';
  printable.style.pointerEvents = 'none';

  const sheet = printable.querySelector('.salary-payslip-sheet');
  if (!sheet) throw new Error('Receipt layout not found');
  sheet.classList.add('salary-wa-capture');

  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  const logoEl = sheet.querySelector('.co-logo');
  if (logoEl && !logoEl.complete) {
    await new Promise((resolve) => {
      logoEl.onload = () => resolve();
      logoEl.onerror = () => resolve();
    });
  }
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* ignore */
    }
  }
  await new Promise((r) => setTimeout(r, 120));

  return { printable, sheet, enriched };
}

function unmountSalaryReceiptCapture(printable) {
  if (!printable) return;
  printable.innerHTML = '';
  printable.style.display = 'none';
  printable.style.position = '';
  printable.style.left = '';
  printable.style.top = '';
  printable.style.width = '';
  printable.style.height = '';
  printable.style.overflow = '';
  printable.style.background = '';
  printable.style.zIndex = '';
  printable.style.pointerEvents = '';
}

async function captureSalaryReceiptCanvas(payroll) {
  const { printable, sheet } = await mountSalaryReceiptForCapture(payroll);
  try {
    const html2canvas = (await import('html2canvas')).default;
    const w = Math.max(sheet.scrollWidth, sheet.offsetWidth, 559);
    const h = Math.max(sheet.scrollHeight, sheet.offsetHeight, 400);

    return await html2canvas(sheet, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      foreignObjectRendering: false,
      onclone: (doc) => {
        const clonedSheet = doc.querySelector('.salary-payslip-sheet');
        if (clonedSheet) {
          clonedSheet.style.height = 'auto';
          clonedSheet.style.maxHeight = 'none';
          clonedSheet.style.overflow = 'visible';
        }
        doc.querySelectorAll(
          '.urdu, .urdu-name, .urdu-addr, .ph-ur, .lbl-ur, .row-ur, .th-ur, .meta-lbl .ur, .doc-title-ur, .doc-sub .urdu'
        ).forEach((el) => {
          el.style.fontFamily = PAYSLIP_URDU_FONT;
          el.style.direction = 'rtl';
        });
      },
    });
  } finally {
    unmountSalaryReceiptCapture(printable);
  }
}

async function downloadPayslipPdf(payroll) {
  const printable = document.getElementById('printable-salary-payslip');
  if (!printable) throw new Error('Print container not found');

  printable.innerHTML = `<style>${getPayslipStylesheet()}${PAYSLIP_WA_CAPTURE_STYLES}</style>${buildPayslipBody(payroll)}`;
  printable.style.display = 'block';
  printable.style.position = 'fixed';
  printable.style.left = '-10000px';
  printable.style.top = '0';
  printable.style.width = PAYSLIP_PAGE.w;
  printable.style.height = PAYSLIP_PAGE.h;
  printable.style.overflow = 'visible';
  printable.style.background = '#fff';
  printable.style.zIndex = '-1';
  printable.style.pointerEvents = 'none';

  try {
    await new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

    const sheet = printable.querySelector('.salary-payslip-sheet');
    if (!sheet) throw new Error('Receipt layout not found');
    sheet.classList.add('salary-wa-capture');

    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;

    const w = Math.max(sheet.scrollWidth, sheet.offsetWidth, 559);
    const h = Math.max(sheet.scrollHeight, sheet.offsetHeight, 400);
    const canvas = await html2canvas(sheet, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      width: w,
      height: h,
      windowWidth: w,
      windowHeight: h,
      foreignObjectRendering: false,
    });

    const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
    const pageW = 148;
    const pageH = 210;
    const imgData = canvas.toDataURL('image/png');
    let renderW = pageW;
    let renderH = (canvas.height * renderW) / canvas.width;
    if (renderH > pageH) {
      renderH = pageH;
      renderW = (canvas.width * renderH) / canvas.height;
    }
    const x = (pageW - renderW) / 2;
    doc.addImage(imgData, 'PNG', x, 0, renderW, renderH);
    doc.save(payslipFileName(payroll));
  } finally {
    printable.innerHTML = '';
    printable.style.display = 'none';
    printable.style.position = '';
    printable.style.left = '';
    printable.style.top = '';
    printable.style.width = '';
    printable.style.height = '';
    printable.style.overflow = '';
    printable.style.background = '';
    printable.style.zIndex = '';
    printable.style.pointerEvents = '';
  }
}

function openPayslipPrintWindow(payroll) {
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return false;
  w.document.write(buildPayslipHtml(payroll));
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
    setTimeout(() => w.close(), 300);
  }, 350);
  return true;
}

function printPayslipFromPreview(payroll) {
  if (!payroll) return Promise.resolve(false);
  return enrichPayrollForReceipt(payroll).then((enriched) => openPayslipPrintWindow(enriched));
}

async function fetchPaidPayrollRow(empId, m, y) {
  const res = await fetch(`/api/payroll?month=${m}&year=${y}&emp_id=${empId}`);
  if (!res.ok) return null;
  const data = await res.json();
  const row = Array.isArray(data) ? data[0] : data;
  return row?.status === 'PAID' ? row : null;
}

function buildReceiptRowFromClearance(payroll, data, form) {
  const snap = data.clearance_snapshot || {};
  return {
    ...payroll,
    payroll_id: data.payroll_id ?? payroll.payroll_id,
    status: 'PAID',
    month: payroll.month,
    year: payroll.year,
    month_net: data.month_net ?? payroll.net_salary,
    net_salary: data.net_salary ?? payroll.net_salary,
    total_payable: data.total_payable,
    amount_paid: data.amount_paid ?? snap.amount_paid,
    previous_balance: data.previous_balance ?? payroll.previous_balance,
    prev_month: snap.prev_month ?? payroll.prev_month,
    prev_year: snap.prev_year ?? payroll.prev_year,
    ledger_payable_credit: data.ledger_payable_credit ?? snap.ledger_payable_credit,
    employee_ledger_closing_before: snap.employee_ledger_closing_before ?? snap.employee_ledger_closing,
    employee_ledger_closing_after: snap.employee_ledger_closing_after,
    clearance_snapshot: snap,
    bonus: parseFloat(form.bonus || payroll.bonus || 0),
    other_deduction: parseFloat(form.extra_deduction || payroll.other_deduction || 0),
    advance_with_salary: parseFloat(form.advance_with_salary || 0),
    cash_amount: snap.cash_amount ?? parseFloat(form.cash_amount || 0),
    bank_amount: snap.bank_amount ?? parseFloat(form.bank_amount || 0),
    payment_method: snap.payment_method,
    payment_reference: form.payment_reference,
    payment_date: snap.cleared_at || new Date().toISOString().slice(0, 10),
    advance_deduction: payroll.advance_deduction,
    deduction_reason: form.deduction_reason,
    advance_reason: form.advance_reason,
  };
}

function buildSalarySheetHtml(rows, month, year, totals) {
  const period = `${MONTHS[month - 1]} ${year}`;
  const head = ['Employee', 'Basic', 'Days', 'Present', 'Leaves', 'Excess', 'Leave Ded.', 'Advance', 'Bonus', 'Net', 'Status'];
  const headerRow = head.map((h) => `<th>${h}</th>`).join('');
  const bodyRows = rows.map((p) => {
    const emp = p.employee || {};
    return `<tr>
      <td class="name"><strong>${emp.emp_name || '—'}</strong><small>${emp.designation || ''}</small></td>
      <td>${fmtAmt(p.basic_salary)}</td>
      <td>${p.total_days}</td>
      <td>${p.days_present}</td>
      <td>${p.leaves_taken}</td>
      <td>${p.excess_leaves}</td>
      <td class="ded">${fmtAmt(resolveMonthAttDedDisplay(p, month, year))}</td>
      <td>${fmtAmt(p.advance_deduction)}</td>
      <td class="bonus">${fmtAmt(p.bonus)}</td>
      <td class="net">${fmtAmt(p.net_salary)}</td>
      <td>${p.status}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html><html><head><title>Salary Sheet — ${period}</title>
<style>
  @page { size: landscape; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 10px; color: #0f172a; }
  h1 { font-size: 16px; margin: 0 0 4px; }
  .sub { color: #64748b; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: ${NAVY}; color: #fff; padding: 8px 6px; font-size: 9px; text-transform: uppercase; }
  td { border-bottom: 1px solid #e2e8f0; padding: 7px 6px; text-align: center; }
  td.name { text-align: left; min-width: 120px; }
  td.name small { display: block; color: #64748b; font-size: 8px; margin-top: 2px; }
  td.ded { color: #dc2626; }
  td.bonus { color: #059669; }
  td.net { font-weight: 800; color: #1A55E3; }
  tr:nth-child(even) td { background: #f8fafc; }
  tfoot td { font-weight: 800; background: #fef3c7; border-top: 2px solid #f59e0b; }
</style></head><body>
  <h1>${COMPANY.nameShort || 'Itefaq Iron Store'} — Monthly Salary Sheet</h1>
  <div class="sub">${period} · ${rows.length} employee(s)</div>
  <table>
    <thead><tr>${headerRow}</tr></thead>
    <tbody>${bodyRows}</tbody>
    <tfoot><tr>
      <td colspan="9" style="text-align:right">Total Net Payable</td>
      <td class="net">${fmtAmt(totals.net)}</td>
      <td></td>
    </tr></tfoot>
  </table>
</body></html>`;
}

function PayslipPreviewContent({ payroll: initialPayroll }) {
  const [payroll, setPayroll] = useState(initialPayroll);
  const [loadingAtt, setLoadingAtt] = useState(!initialPayroll?.attendance_by_day);

  useEffect(() => {
    let cancelled = false;
    if (!initialPayroll) return undefined;
    if (initialPayroll.attendance_by_day) {
      setPayroll(initialPayroll);
      setLoadingAtt(false);
      return undefined;
    }
    setLoadingAtt(true);
    enrichPayrollForReceipt(initialPayroll).then((data) => {
      if (!cancelled) {
        setPayroll(data);
        setLoadingAtt(false);
      }
    });
    return () => { cancelled = true; };
  }, [initialPayroll]);

  if (!payroll) return null;
  if (loadingAtt) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 280, py: 6 }}>
        <CircularProgress size={32} />
      </Box>
    );
  }

  return (
    <>
      <style>{getPayslipStylesheet()}</style>
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 2, px: 1, bgcolor: '#e2e8f0', borderRadius: '8px', overflow: 'auto' }}>
        <Box
          id="salary-receipt-preview"
          sx={{
            width: PAYSLIP_PAGE.w,
            minWidth: PAYSLIP_PAGE.w,
            maxWidth: PAYSLIP_PAGE.w,
            flexShrink: 0,
            '& .salary-payslip-sheet': {
              width: '100%',
              maxWidth: '100%',
              minHeight: 0,
              height: 'auto',
              maxHeight: 'none',
              overflow: 'visible',
              boxShadow: '0 4px 24px rgba(15,23,42,0.12)',
            },
            '& .salary-payslip-root': {
              minHeight: 0,
              maxHeight: 'none',
              height: 'auto',
              overflow: 'visible',
            },
          }}
          dangerouslySetInnerHTML={{ __html: buildPayslipBody(payroll) }}
        />
      </Box>
    </>
  );
}

function StatMini({ label, value, accent, tint, icon: Icon }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 140,
        p: 2,
        borderRadius: '14px',
        border: '1px solid #e8edf4',
        bgcolor: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ position: 'absolute', top: 12, right: 12, width: 36, height: 36, borderRadius: '10px', bgcolor: tint, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon sx={{ fontSize: 20 }} />
      </Box>
      <Typography sx={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.06em', color: '#94a3b8', textTransform: 'uppercase' }}>{label}</Typography>
      <Typography sx={{ fontSize: '1.2rem', fontWeight: 900, color: NAVY, mt: 0.5, lineHeight: 1.2 }}>{value}</Typography>
    </Box>
  );
}

function StatusChip({ status }) {
  const isPaid = status === 'PAID';
  return (
    <Chip
      size="small"
      label={status}
      sx={{
        height: 24,
        fontWeight: 800,
        fontSize: '0.68rem',
        bgcolor: isPaid ? '#dcfce7' : '#fef3c7',
        color: isPaid ? '#15803d' : '#b45309',
        border: 'none',
      }}
    />
  );
}

export default function SalaryTab({ view = 'sheet' }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [fadeIn, setFadeIn] = useState(true);

  const isSheetView = view === 'sheet';
  const isClearanceView = view === 'clearance';
  const isReceiptView = view === 'receipt';
  const useLiveCalc = isSheetView || isClearanceView;

  const [payrolls, setPayrolls] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [loadingPayrolls, setLoadingPayrolls] = useState(false);
  const [clearingId, setClearingId] = useState(null);
  const [printingReceiptId, setPrintingReceiptId] = useState(null);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [whatsAppPayrollId, setWhatsAppPayrollId] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(null);
  const [clearForm, setClearForm] = useState({
    paymentMethod: 'CASH',
    paid_from_account_id: '',
    bank_account_id: '',
    cash_amount: '',
    bank_amount: '',
    bonus: '',
    extra_deduction: '',
    deduction_reason: '',
    advance_with_salary: '',
    advance_reason: '',
    payment_reference: '',
  });
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [undoConfirm, setUndoConfirm] = useState(null);
  const [undoingId, setUndoingId] = useState(null);
  const [payslipPreview, setPayslipPreview] = useState(null);
  const [downloadingPayslipPdf, setDownloadingPayslipPdf] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  const showSnack = (msg, severity = 'success') => setSnack({ open: true, msg, severity });
  const payrollVersion = useHrRefreshVersion(HR_KEYS.payroll);
  const advancesVersion = useHrRefreshVersion(HR_KEYS.advances);
  const { invalidatePayrollFlow } = useHrRefresh();

  useEffect(() => {
    if (!isSheetView) return;
    fetchAdvances();
  }, [isSheetView, advancesVersion]);

  const ensurePaymentAccounts = useCallback(async () => {
    if (paymentAccounts.length > 0) return paymentAccounts;
    try {
      const res = await fetch('/api/customers?dropdown=true');
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      setPaymentAccounts(list);
      return list;
    } catch {
      return paymentAccounts;
    }
  }, [paymentAccounts]);

  const cashAccountsList = useMemo(() => paymentAccounts.filter((account) => {
    const typeTitle = account.customer_type?.cus_type_title?.toLowerCase() || '';
    const catTitle = account.customer_category?.cus_cat_title?.toLowerCase() || '';
    return typeTitle.includes('cash') && catTitle.includes('cash');
  }), [paymentAccounts]);

  const bankAccountsList = useMemo(() => paymentAccounts.filter((account) => {
    const typeTitle = account.customer_type?.cus_type_title?.toLowerCase() || '';
    const catTitle = account.customer_category?.cus_cat_title?.toLowerCase() || '';
    return typeTitle.includes('bank') && catTitle.includes('bank');
  }), [paymentAccounts]);

  useEffect(() => {
    if (!clearConfirm?.emp_id) return undefined;
    const hasLedgerFromPayroll = clearConfirm.employee_ledger_closing != null
      && !Number.isNaN(parseFloat(clearConfirm.employee_ledger_closing));
    if (hasLedgerFromPayroll) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/employee-ledger?emp_id=${clearConfirm.emp_id}`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const signedClosing = parseFloat(data.closing_balance ?? data.ledger_balance ?? 0);
        const openingBal = parseFloat(data.employee?.opening_balance ?? 0);
        const recover = Math.max(0, signedClosing);
        const payableCredit = Math.max(0, -signedClosing);
        setClearConfirm((prev) => {
          if (!prev || prev.emp_id !== clearConfirm.emp_id) return prev;
          return {
            ...prev,
            employee_opening_balance: openingBal,
            employee_ledger_closing: signedClosing,
            ledger_payable_credit: payableCredit,
            employee_ledger_balance: recover,
            ledger_receivable: recover,
            advance_deduction: recover > 0.009 ? recover : prev.advance_deduction,
          };
        });
      } catch {
        /* keep payroll row values */
      }
    })();
    return () => { cancelled = true; };
  }, [clearConfirm?.emp_id, clearConfirm?.payroll_id, month, year]);

  const enrichClearancePreview = useCallback((preview) => {
    if (!preview) return null;
    return {
      ...preview,
      salaryPayable: calcTotalPayable({
        monthNet: preview.derived.net_salary,
        previousBalance: preview.prevBal,
        ledgerPayableCredit: preview.ledgerPayableCredit,
      }),
      recoveryDeduction: preview.accountRecovery,
    };
  }, []);

  const getPayrollPreview = useCallback(
    (payroll, form = {}) => enrichClearancePreview(previewClearancePayroll(payroll, form, month, year)),
    [month, year, enrichClearancePreview]
  );

  const clearancePreview = useMemo(() => {
    if (!clearConfirm) return null;
    return getPayrollPreview(clearConfirm, clearForm);
  }, [clearConfirm, clearForm, getPayrollPreview]);

  const fetchPayrolls = useCallback(async () => {
    setLoadingPayrolls(true);
    try {
      let url;
      if (useLiveCalc) {
        url = `/api/payroll?calculate=true&month=${month}&year=${year}`;
      } else if (isReceiptView) {
        url = `/api/payroll?month=${month}&year=${year}&status=PAID`;
      } else {
        url = `/api/payroll?month=${month}&year=${year}`;
      }
      const res = await fetch(url);
      if (res.ok) setPayrolls(await res.json());
    } catch {
      showSnack('Failed to load salary data', 'error');
    } finally {
      setLoadingPayrolls(false);
    }
  }, [month, year, useLiveCalc, isReceiptView]);

  useEffect(() => {
    fetchPayrolls();
  }, [fetchPayrolls, payrollVersion]);

  async function fetchAdvances() {
    try {
      const res = await fetch('/api/employee-advances');
      if (res.ok) setAdvances(await res.json());
    } catch { /* optional */ }
  }

  const shiftMonth = (delta) => {
    setFadeIn(false);
    setTimeout(() => {
      let newMonth = month + delta;
      let newYear = year;
      if (newMonth < 1) { newMonth = 12; newYear -= 1; }
      if (newMonth > 12) { newMonth = 1; newYear += 1; }
      setMonth(newMonth);
      setYear(newYear);
      setFadeIn(true);
    }, 120);
  };

  const goToCurrentMonth = () => {
    const n = new Date();
    setMonth(n.getMonth() + 1);
    setYear(n.getFullYear());
  };

  function validateClearancePayment() {
    const method = clearForm.paymentMethod || 'CASH';
    const due = clearancePreview?.grandTotal ?? 0;
    const cash = parseFloat(clearForm.cash_amount || 0) || 0;
    const bank = parseFloat(clearForm.bank_amount || 0) || 0;

    if (method === 'CASH') {
      if (due > 0.009 && cash <= 0.009) {
        return 'Enter the cash amount you are paying';
      }
      if (cash > 0.009 && !clearForm.paid_from_account_id) {
        return 'Select a cash account';
      }
    } else if (method === 'BANK') {
      if (due > 0.009 && bank <= 0.009) {
        return 'Enter the bank amount you are paying';
      }
      if (bank > 0.009 && !clearForm.bank_account_id) {
        return 'Select a bank account';
      }
    } else if (method === 'PARTIAL') {
      if (due > 0.009 && cash + bank <= 0.009) {
        return 'Enter cash and bank amounts for split payment';
      }
      if (cash > 0.009 && !clearForm.paid_from_account_id) {
        return 'Select a cash account';
      }
      if (bank > 0.009 && !clearForm.bank_account_id) {
        return 'Select a bank account';
      }
    } else {
      return 'Select a payment method';
    }

    const paid = cash + bank;
    if (due > 0.009 && paid > due + 0.01) {
      return `Payment (${fmtAmt(paid)}) cannot exceed total due (${fmtAmt(due)})`;
    }
    return null;
  }

  async function handleClearance(payroll) {
    const payErr = validateClearancePayment();
    if (payErr) {
      showSnack(payErr, 'error');
      return;
    }

    setClearingId(payroll.emp_id);
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clearance: true,
          ...payroll,
          month: payroll.month ?? month,
          year: payroll.year ?? year,
          bonus: parseFloat(clearForm.bonus || 0),
          other_deduction: parseFloat(clearForm.extra_deduction || 0),
          deduction_reason: clearForm.deduction_reason,
          advance_with_salary: parseFloat(clearForm.advance_with_salary || 0),
          advance_reason: clearForm.advance_reason,
          paymentMethod: clearForm.paymentMethod,
          paid_from_account_id: clearForm.paid_from_account_id || null,
          bank_account_id: clearForm.bank_account_id || null,
          cash_amount: parseFloat(clearForm.cash_amount || 0),
          bank_amount: parseFloat(clearForm.bank_amount || 0),
          payment_reference: clearForm.payment_reference,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Clearance failed');
      }
      const data = await res.json();
      const paidAmt = data.amount_paid ?? data.total_payable ?? payroll.total_payable ?? payroll.net_salary;
      setClearConfirm(null);
      invalidatePayrollFlow();
      let receiptRow = await fetchPaidPayrollRow(payroll.emp_id, month, year);
      if (!receiptRow) {
        receiptRow = buildReceiptRowFromClearance(payroll, data, clearForm);
      }
      openPayslipPreview(receiptRow);
      showSnack(`Paid ${payroll.employee?.emp_name} — ${fmtAmt(paidAmt)}. You can print the salary receipt next.`, 'success');
    } catch (err) {
      showSnack(err.message || 'Failed to clear salary', 'error');
    } finally {
      setClearingId(null);
    }
  }

  async function openClearConfirm(payroll) {
    const accounts = await ensurePaymentAccounts();
    const defaultCash = accounts.find((acc) => {
      const typeTitle = acc.customer_type?.cus_type_title?.toLowerCase() || '';
      const catTitle = acc.customer_category?.cus_cat_title?.toLowerCase() || '';
      return typeTitle.includes('cash') && catTitle.includes('cash');
    });
    setClearForm({
      paymentMethod: 'CASH',
      paid_from_account_id: defaultCash ? String(defaultCash.cus_id) : '',
      bank_account_id: '',
      cash_amount: '',
      bank_amount: '',
      bonus: payroll.bonus ? String(payroll.bonus) : '',
      extra_deduction: payroll.other_deduction ? String(payroll.other_deduction) : '',
      deduction_reason: '',
      advance_with_salary: '',
      advance_reason: '',
      payment_reference: '',
    });
    setClearConfirm({
      ...payroll,
      month: payroll.month ?? month,
      year: payroll.year ?? year,
    });
  }

  const fillClearancePaymentTotal = useCallback(() => {
    if (!clearancePreview) return;
    const total = Math.max(0, parseFloat(clearancePreview.grandTotal || 0));
    if (total <= 0) return;
    setClearForm((f) => {
      if (f.paymentMethod === 'BANK') {
        return { ...f, bank_amount: String(total), cash_amount: '' };
      }
      if (f.paymentMethod === 'PARTIAL') {
        const half = Math.round((total / 2) * 100) / 100;
        const rest = Math.round((total - half) * 100) / 100;
        return { ...f, cash_amount: String(half), bank_amount: String(rest) };
      }
      return { ...f, cash_amount: String(total), bank_amount: '' };
    });
  }, [clearancePreview]);

  async function handleUndoClearance(payroll) {
    if (!payroll.payroll_id) {
      showSnack('Cannot undo — payroll record missing', 'error');
      return;
    }
    setUndoingId(payroll.payroll_id);
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          undo_clearance: true,
          payroll_id: payroll.payroll_id,
          emp_id: payroll.emp_id,
          month: payroll.month,
          year: payroll.year,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Undo failed');
      }
      showSnack(`Clearance undone: ${payroll.employee?.emp_name}`);
      setUndoConfirm(null);
      invalidatePayrollFlow();
    } catch (err) {
      showSnack(err.message || 'Failed to undo clearance', 'error');
    } finally {
      setUndoingId(null);
    }
  }

  function openUndoConfirm(payroll) {
    setUndoConfirm(payroll);
  }

  function openPayslipPreview(payroll) {
    setPayslipPreview(payroll);
  }

  async function handlePrintOneReceipt(payroll) {
    if (!payroll?.emp_id && !payroll?.payroll_id) return;
    setPrintingReceiptId(payroll.payroll_id ?? payroll.emp_id);
    try {
      const opened = await printPayslipFromPreview(payroll);
      if (opened === false) showSnack('Allow pop-ups to print A5 receipt', 'warning');
    } catch (err) {
      showSnack(err.message || 'Print failed', 'error');
    } finally {
      setPrintingReceiptId(null);
    }
  }

  async function openReceiptPreview(payroll) {
    if (!payroll?.emp_id && !payroll?.payroll_id) return;
    setPrintingReceiptId(payroll.payroll_id ?? payroll.emp_id);
    try {
      let row = payroll;
      if (payroll.emp_id) {
        const fresh = await fetchPaidPayrollRow(
          payroll.emp_id,
          payroll.month ?? month,
          payroll.year ?? year
        );
        if (fresh) {
          row = {
            ...payroll,
            ...fresh,
            employee: { ...payroll.employee, ...fresh.employee },
          };
        }
      }
      openPayslipPreview(row);
    } catch (err) {
      showSnack(err.message || 'Could not open receipt', 'error');
    } finally {
      setPrintingReceiptId(null);
    }
  }

  async function handlePrintPayslip() {
    if (!payslipPreview) return;
    const opened = await printPayslipFromPreview(payslipPreview);
    if (opened === false) showSnack('Allow pop-ups to print A5 receipt', 'warning');
  }

  async function handleSendSalaryWhatsApp(payroll) {
    if (!payroll) return;
    setIsSendingWhatsApp(true);
    setWhatsAppPayrollId(payroll.payroll_id ?? payroll.emp_id);
    try {
      const {
        shareCanvasViaWhatsAppDesktop,
        whatsAppSuccessMessage,
        formatWhatsAppPhone,
        resolveEmployeeWhatsAppPhone,
      } = await import('@/lib/whatsapp-local');

      let phone = resolveEmployeeWhatsAppPhone(payroll.employee);
      if (!phone) {
        const manual = window.prompt(
          'Employee phone is missing or invalid.\nEnter WhatsApp number (e.g. 0300-1234567):',
          payroll.employee?.emp_phone || ''
        );
        if (!manual?.trim()) {
          showSnack('WhatsApp cancelled — phone number required', 'info');
          return;
        }
        phone = formatWhatsAppPhone(manual) || resolveEmployeeWhatsAppPhone({ emp_phone: manual });
        if (!phone) {
          showSnack('Invalid phone number. Use format 03XX-XXXXXXX', 'error');
          return;
        }
      }

      let row = payroll;
      if (payroll.status === 'PAID' && payroll.emp_id) {
        const fresh = await fetchPaidPayrollRow(
          payroll.emp_id,
          payroll.month ?? month,
          payroll.year ?? year
        );
        if (fresh) {
          row = {
            ...payroll,
            ...fresh,
            employee: { ...payroll.employee, ...fresh.employee },
          };
        }
      }

      showSnack('Preparing full salary invoice for WhatsApp…', 'info');
      const canvas = await captureSalaryReceiptCanvas(row);
      if (!canvas) throw new Error('Could not capture salary invoice');

      const period = `${MONTHS[(payroll.month || month) - 1]} ${payroll.year ?? year}`;
      const { opened } = await shareCanvasViaWhatsAppDesktop(canvas, phone);
      showSnack(`${whatsAppSuccessMessage(opened)} Paste (Ctrl+V) in chat — full ${period} invoice copied`, 'success');
    } catch (err) {
      showSnack(`WhatsApp error: ${err.message}`, 'error');
    } finally {
      setIsSendingWhatsApp(false);
      setWhatsAppPayrollId(null);
    }
  }


  async function handleDownloadPayslipPdf() {
    if (!payslipPreview) return;
    setDownloadingPayslipPdf(true);
    try {
      const enriched = await enrichPayrollForReceipt(payslipPreview);
      await downloadPayslipPdf(enriched);
      showSnack('PDF downloaded', 'success');
    } catch (err) {
      console.error(err);
      showSnack(err.message || 'PDF download failed', 'error');
    } finally {
      setDownloadingPayslipPdf(false);
    }
  }

  async function handlePrintAllReceipts() {
    if (displayPayrolls.length === 0) {
      showSnack('No paid receipts to print', 'info');
      return;
    }
    showSnack('Loading attendance for receipts…', 'info');
    const enriched = await Promise.all(displayPayrolls.map((p) => enrichPayrollForReceipt(p)));
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    const printExtra = `
      @page { size: A5 portrait; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; height: auto; min-height: 0; }
      .salary-payslip-sheet {
        page-break-inside: avoid;
        break-inside: avoid;
        page-break-after: always;
        break-after: page;
        min-height: 0 !important;
      }
      .salary-payslip-sheet:last-child { page-break-after: auto; break-after: auto; }
      .salary-payslip-root { min-height: 0 !important; max-height: none !important; }
    `;
    const pages = enriched.map((p) => buildPayslipBody(p)).join('');
    w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${PAYSLIP_I18N.docTitleEn}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Sans+Arabic:wght@400;700&display=swap" rel="stylesheet">
<style>${getPayslipStylesheet()}${printExtra}</style></head><body style="margin:0;padding:0;width:148mm">${pages}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  const displayPayrolls = useMemo(() => {
    const list = isClearanceView
      ? payrolls.filter((p) => p.status === 'PENDING' || p.status === 'PAID')
      : payrolls;
    const byEmp = new Map();
    for (const p of list) {
      const prev = byEmp.get(p.emp_id);
      if (!prev) {
        byEmp.set(p.emp_id, p);
        continue;
      }
      const keepNew =
        (p.status === 'PAID' && prev.status !== 'PAID') ||
        ((p.payroll_id ?? 0) > (prev.payroll_id ?? 0));
      if (keepNew) byEmp.set(p.emp_id, p);
    }
    return Array.from(byEmp.values());
  }, [payrolls, isClearanceView]);

  const pendingPayrolls = useMemo(
    () => (isClearanceView ? displayPayrolls.filter((p) => p.status === 'PENDING') : displayPayrolls),
    [displayPayrolls, isClearanceView]
  );

  const paidPayrolls = useMemo(
    () => (isClearanceView ? displayPayrolls.filter((p) => p.status === 'PAID') : []),
    [displayPayrolls, isClearanceView]
  );

  const clearedCount = useMemo(
    () => (isClearanceView ? displayPayrolls.filter((p) => p.status === 'PAID').length : 0),
    [displayPayrolls, isClearanceView]
  );

  const pendingCount = useMemo(() => payrolls.filter((p) => p.status === 'PENDING').length, [payrolls]);

  const sheetTotals = useMemo(() => ({
    grossEarned: pendingPayrolls.reduce((s, p) => s + resolveMonthGrossEarned(p), 0),
    net: pendingPayrolls.reduce((s, p) => s + resolveMonthNetPay(p), 0),
    basic: pendingPayrolls.reduce((s, p) => s + parseFloat(p.basic_salary || 0), 0),
    pending: pendingPayrolls.filter((p) => p.status === 'PENDING').reduce((s, p) => s + resolveTotalPayable(p), 0),
    paid: displayPayrolls.filter((p) => p.status === 'PAID').reduce((s, p) => s + resolveTotalPayable(p), 0),
    prevBalance: pendingPayrolls.reduce((s, p) => s + parseFloat(p.previous_balance || 0), 0),
    advanceDeducted: pendingPayrolls.reduce((s, p) => s + resolveSalaryAdvanceApplied(p), 0),
    advanceWithSalary: displayPayrolls.reduce((s, p) => s + parseFloat(p.advance_with_salary || 0), 0),
    advanceThisMonth: pendingPayrolls.reduce((s, p) => s + parseFloat(p.advance_this_month || p.advance_deduction || 0), 0),
    bonusTotal: displayPayrolls.reduce((s, p) => s + parseFloat(p.bonus || 0), 0),
    extraDedTotal: displayPayrolls.reduce((s, p) => s + parseFloat(p.other_deduction || 0), 0),
    attDedTotal: displayPayrolls.reduce((s, p) => s + resolveMonthAttDedDisplay(p, month, year), 0),
    totalPayable: pendingPayrolls.reduce((s, p) => s + resolveTotalPayable(p), 0),
  }), [displayPayrolls, pendingPayrolls]);

  const pendingAdvancesTotal = useMemo(
    () => advances.filter((a) => a.status === 'PENDING').reduce((s, a) => s + parseFloat(a.amount || 0), 0),
    [advances]
  );

  const showInternalStats = isSheetView || isClearanceView || isReceiptView;
  const showPayrollTable = true;

  const thSx = {
    bgcolor: NAVY,
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.62rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
    py: 1.75,
    borderBottom: 'none',
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {isClearanceView && (
        <SalaryClearancePanel
          monthLabel={`${MONTHS[month - 1]} ${year}`}
          month={month}
          year={year}
          onPrevMonth={() => shiftMonth(-1)}
          onNextMonth={() => shiftMonth(1)}
          onThisMonth={goToCurrentMonth}
          loading={loadingPayrolls}
          pendingRows={pendingPayrolls}
          paidRows={paidPayrolls}
          totalToPay={sheetTotals.totalPayable}
          totalPaid={sheetTotals.paid}
          fmtAmt={fmtAmt}
          getAmountDue={resolveTotalPayable}
          getPreview={(p) => getPayrollPreview(p, {})}
          onPay={openClearConfirm}
          onReceipt={openReceiptPreview}
          onUndo={openUndoConfirm}
          clearingEmpId={clearingId}
          printingReceiptId={printingReceiptId}
          undoingPayrollId={undoingId}
        />
      )}

      {showInternalStats && !isClearanceView && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <StatMini
            label={isReceiptView ? 'Total paid' : isClearanceView ? 'Ready to pay' : 'This month net'}
            value={fmtAmt(isReceiptView ? sheetTotals.paid : isClearanceView ? sheetTotals.totalPayable : sheetTotals.net)}
            accent={isReceiptView ? '#059669' : AMBER}
            tint={isReceiptView ? '#dcfce7' : '#fef3c7'}
            icon={isReceiptView ? CheckCircle : Payments}
          />
          {!isReceiptView && (
            <>
              <StatMini label="From last month" value={fmtAmt(sheetTotals.prevBalance)} accent="#7c3aed" tint="#ede9fe" icon={AccountBalanceWallet} />
              <StatMini
                label={isClearanceView ? 'Advance cut' : 'Advances this month'}
                value={fmtAmt(sheetTotals.advanceDeducted)}
                accent="#b45309"
                tint="#fef3c7"
                icon={AccountBalanceWallet}
              />
              {isClearanceView && sheetTotals.advanceWithSalary > 0.009 && (
                <StatMini
                  label="Extra advance"
                  value={fmtAmt(sheetTotals.advanceWithSalary)}
                  accent="#ea580c"
                  tint="#ffedd5"
                  icon={Payments}
                />
              )}
            </>
          )}
          <StatMini
            label={isReceiptView ? 'Receipts' : 'Paid This Month'}
            value={isReceiptView ? String(displayPayrolls.length) : fmtAmt(sheetTotals.paid)}
            accent="#059669"
            tint="#dcfce7"
            icon={CheckCircle}
          />
        </Stack>
      )}

      {showPayrollTable && !isClearanceView && (
        <Card elevation={0} sx={{ borderRadius: 0, border: 'none', boxShadow: 'none', bgcolor: 'transparent', overflow: 'hidden' }}>
          {/* Toolbar */}
          <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2, borderBottom: '1px solid #eef2f6', bgcolor: '#fafbfd' }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ lg: 'center' }} justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1}>
                <IconButton
                  size="small"
                  onClick={() => shiftMonth(-1)}
                  sx={{ border: '1px solid #e2e8f0', borderRadius: '10px', bgcolor: '#fff', width: 36, height: 36 }}
                >
                  <ChevronLeft fontSize="small" />
                </IconButton>
                <Box sx={{ minWidth: 150, textAlign: 'center' }}>
                  <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', color: NAVY }}>
                    {MONTHS[month - 1]} {year}
                  </Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', mt: 0.25 }}>
                    {displayPayrolls.length} employee(s)
                    {isSheetView && pendingCount > 0 ? ` · ${pendingCount} pending clearance` : ''}
                    {isClearanceView && clearedCount > 0 ? ` · ${clearedCount} cleared` : ''}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => shiftMonth(1)}
                  sx={{ border: '1px solid #e2e8f0', borderRadius: '10px', bgcolor: '#fff', width: 36, height: 36 }}
                >
                  <ChevronRight fontSize="small" />
                </IconButton>
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<TodayIcon sx={{ fontSize: 16 }} />}
                  onClick={goToCurrentMonth}
                  sx={{ ml: 0.5, textTransform: 'none', fontWeight: 700, borderRadius: '10px', borderColor: PRIMARY, color: PRIMARY, height: 36 }}
                >
                  This Month
                </Button>
              </Stack>

              {isReceiptView && (
                <Button
                  variant="outlined"
                  startIcon={<Print sx={{ fontSize: 17 }} />}
                  onClick={handlePrintAllReceipts}
                  disabled={displayPayrolls.length === 0}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '10px', height: 38, borderColor: '#e2e8f0', color: '#475569' }}
                >
                  Print All Receipts
                </Button>
              )}
            </Stack>

            {!isReceiptView && (
              <Typography sx={{ fontSize: '0.78rem', color: '#64748b', mt: 1.75, pt: 1.5, borderTop: '1px dashed #e8edf4' }}>
                {isClearanceView
                  ? 'Basic = monthly rate · Earned = paid days × (Basic ÷ days in month) · Att Ded = Basic − earned · Acct Bal = before clearance · Acct After = account after salary recovery · Net Pay = Earned − adv recovered · Total Pay = cash due now.'
                  : 'Daily rate = basic ÷ month days. Only marked days count (P / L / A / half / holiday). Unmarked = no pay and no absent cut.'}
              </Typography>
            )}
            {isReceiptView && (
              <Typography sx={{ fontSize: '0.78rem', color: '#64748b', mt: 1.75, pt: 1.5, borderTop: '1px dashed #e8edf4' }}>
                Same columns and figures as the salary sheet (paid only). <strong>View / Print / WA</strong> opens the A5 receipt.
              </Typography>
            )}
          </Box>

          {/* Table */}
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {loadingPayrolls ? (
              <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress sx={{ color: PRIMARY }} />
              </Box>
            ) : displayPayrolls.length === 0 ? (
              <Box sx={{ py: 8, px: 3, textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 800, color: NAVY, mb: 1 }}>
                  {isReceiptView ? 'No paid salaries' : isClearanceView ? 'All salaries cleared' : 'No active employees'}
                </Typography>
                <Typography sx={{ fontSize: '0.875rem', color: '#64748b', maxWidth: 420, mx: 'auto' }}>
                  {isSheetView
                    ? 'Add employees and mark attendance — salary calculates automatically.'
                    : 'Try another month.'}
                </Typography>
              </Box>
            ) : (
              <Box sx={{ opacity: fadeIn ? 1 : 0, transition: 'opacity 0.2s ease' }}>
                {isReceiptView ? (
                  <Box sx={{ p: 0 }}>
                    <SalaryReceiptPageList
                      rows={displayPayrolls}
                      month={month}
                      year={year}
                      fmtAmt={fmtAmt}
                      printingReceiptId={printingReceiptId}
                      onOpenReceipt={openReceiptPreview}
                      onPrintOne={handlePrintOneReceipt}
                      onWhatsApp={handleSendSalaryWhatsApp}
                      whatsAppBusyId={isSendingWhatsApp ? whatsAppPayrollId : null}
                    />
                  </Box>
                ) : (
                <>
                <TableContainer
                  sx={{
                    maxHeight: 520,
                    overflowX: 'auto',
                    overflowY: 'auto',
                    scrollBehavior: 'smooth',
                    '&::-webkit-scrollbar': { height: 10, width: 8 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: '#cbd5e1', borderRadius: 5 },
                  }}
                >
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ ...thSx, position: 'sticky', left: 0, zIndex: 4, minWidth: 200, boxShadow: '4px 0 10px rgba(0,0,0,0.1)' }}>
                          Employee
                        </TableCell>
                        <TableCell align="right" sx={thSx}>Basic</TableCell>
                        <TableCell align="center" sx={{ ...thSx, bgcolor: '#15803d' }}>Present</TableCell>
                        <TableCell align="center" sx={{ ...thSx, bgcolor: '#ea580c' }}>Leave</TableCell>
                        <TableCell align="center" sx={{ ...thSx, bgcolor: '#dc2626' }}>Absent</TableCell>
                        <TableCell align="center" sx={{ ...thSx, bgcolor: '#ca8a04' }}>Half</TableCell>
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#059669' }}>Earned</TableCell>
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#dc2626' }} title="Basic minus earned (absent/unpaid days); already reflected in Earned">
                          Att Ded
                        </TableCell>
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#16a34a' }} title="Bonus added at salary clearance">
                          Bonus
                        </TableCell>
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#be123c' }} title="Extra deduction at salary clearance">
                          Extra Ded
                        </TableCell>
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#7c3aed' }} title="Unpaid salary from previous month">
                          Prev Bal
                        </TableCell>
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#92400e' }} title="Account balance (+ employee owes, − company owes)">
                          Account balance
                        </TableCell>
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#b45309' }} title="Recovered from salary this month (capped at earned)">
                          Adv Deducted
                        </TableCell>
                        {(isClearanceView || isReceiptView) && (
                          <TableCell align="right" sx={{ ...thSx, bgcolor: '#ea580c' }} title="Extra advance paid with salary at clearance">
                            Adv w/ Salary
                          </TableCell>
                        )}
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#1e3a8a' }} title="This month after attendance and capped ledger recovery">
                          Net Pay
                        </TableCell>
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#0d9488' }} title="Net + prev month + company owes + adv with salary">
                          Total Pay
                        </TableCell>
                        {isClearanceView && (
                          <TableCell align="right" sx={{ ...thSx, bgcolor: '#78350f' }} title="Employee account after recovery from this clearance (before = Acct Bal)">
                            Acct After
                          </TableCell>
                        )}
                        <TableCell align="center" sx={thSx}>Status</TableCell>
                        {isClearanceView && (
                          <TableCell align="center" sx={{ ...thSx, minWidth: 248 }}>Action</TableCell>
                        )}
                        {isReceiptView && (
                          <TableCell align="center" sx={{ ...thSx, minWidth: 90 }}>Paid On</TableCell>
                        )}
                        {isReceiptView && (
                          <TableCell align="center" sx={{ ...thSx, minWidth: 90 }}>Receipt</TableCell>
                        )}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {displayPayrolls.map((p, idx) => {
                        const rowBg = idx % 2 === 0 ? '#fff' : '#f8fafc';
                        return (
                          <TableRow key={`emp-${p.emp_id}-pay-${p.payroll_id ?? 'calc'}`} hover sx={{ bgcolor: rowBg }}>
                            <TableCell
                              sx={{
                                position: 'sticky',
                                left: 0,
                                zIndex: 2,
                                bgcolor: rowBg,
                                borderBottom: '1px solid #eef2f6',
                                borderRight: '1px solid #e8edf4',
                                py: 1.25,
                                boxShadow: '3px 0 6px rgba(0,0,0,0.04)',
                              }}
                            >
                              <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: NAVY }}>{p.employee?.emp_name}</Typography>
                              <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', mt: 0.25 }}>
                                {p.employee?.designation || '—'} · Allow {p.allowed_leaves}L / {p.allowed_absents ?? 0}A
                              </Typography>
                            </TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600, fontSize: '0.8125rem', borderBottom: '1px solid #eef2f6' }}>
                              {fmtAmt(p.basic_salary)}
                            </TableCell>
                            <TableCell align="center" sx={{ borderBottom: '1px solid #eef2f6', color: '#15803d', fontWeight: 800, fontSize: '0.9rem' }}>
                              {fmtNum(p.days_present ?? p.present_days)}
                            </TableCell>
                            <TableCell align="center" sx={{ borderBottom: '1px solid #eef2f6', color: '#ea580c', fontWeight: 700 }}>
                              {p.leave_days ?? fmtNum(p.leaves_taken)}
                            </TableCell>
                            <TableCell align="center" sx={{ borderBottom: '1px solid #eef2f6', color: '#dc2626', fontWeight: 700 }}>
                              {fmtNum(p.absent_days ?? p.absents_taken ?? 0)}
                            </TableCell>
                            <TableCell align="center" sx={{ borderBottom: '1px solid #eef2f6', color: '#ca8a04', fontWeight: 700 }}>
                              {p.half_days ?? 0}
                            </TableCell>
                            <TableCell
                              align="right"
                              title={(() => {
                                const basic = parseFloat(p.basic_salary || 0);
                                const pd = parseFloat(p.paid_days ?? p.days_present ?? 0);
                                const td = Math.max(1, parseInt(p.total_days || 30, 10));
                                const rate = parseFloat(p.deduction_per_day || 0) || basic / td;
                                return `Earned from Basic: ${pd} paid days × ${fmtAmt(rate)}/day (not full ${fmtAmt(basic)} unless full month paid)`;
                              })()}
                              sx={{ borderBottom: '1px solid #eef2f6', fontWeight: 800, color: '#059669', fontSize: '0.875rem', bgcolor: 'rgba(5,150,105,0.05)' }}
                            >
                              {fmtAmt(resolveMonthGrossEarned(p))}
                            </TableCell>
                            <TableCell
                              align="right"
                              title={(() => {
                                const att = resolveMonthAttDedDisplay(p, month, year);
                                return att > 0.009 ? 'Unpaid absents/leaves vs basic (not deducted again from Net Pay)' : '';
                              })()}
                              sx={{ borderBottom: '1px solid #eef2f6', color: '#dc2626', fontWeight: 600, fontSize: '0.8125rem' }}
                            >
                              {(() => {
                                const att = resolveMonthAttDedDisplay(p, month, year);
                                return att > 0.009 ? fmtAmt(att) : '—';
                              })()}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', color: '#16a34a', fontWeight: 700, fontSize: '0.8125rem', bgcolor: 'rgba(22,163,74,0.05)' }}>
                              {parseFloat(p.bonus || 0) > 0 ? fmtAmt(p.bonus) : '—'}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', color: '#be123c', fontWeight: 700, fontSize: '0.8125rem', bgcolor: 'rgba(190,18,60,0.05)' }}>
                              {parseFloat(p.other_deduction || 0) > 0 ? fmtAmt(p.other_deduction) : '—'}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', color: '#7c3aed', fontWeight: 700, fontSize: '0.8125rem' }}>
                              {parseFloat(p.previous_balance) > 0.009 ? fmtAmt(p.previous_balance) : '—'}
                            </TableCell>
                            {(() => {
                              const acctSigned = p.status === 'PAID'
                                ? resolveLedgerBalanceBeforeClearance(p)
                                : undefined;
                              const lb = fmtHrLedgerBalanceCell(p, acctSigned);
                              return (
                                <TableCell
                                  align="right"
                                  title={lb.title}
                                  sx={{
                                    borderBottom: '1px solid #eef2f6',
                                    color: lb.color,
                                    fontWeight: 800,
                                    fontSize: '0.8125rem',
                                    fontFamily: 'monospace',
                                  }}
                                >
                                  {lb.text}
                                </TableCell>
                              );
                            })()}
                            <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', color: '#b45309', fontWeight: 600, fontSize: '0.8125rem' }}>
                              {resolveSalaryAdvanceApplied(p) > 0.009
                                ? fmtAmt(resolveSalaryAdvanceApplied(p))
                                : '—'}
                            </TableCell>
                            {(isClearanceView || isReceiptView) && (
                              <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', color: '#ea580c', fontWeight: 700, fontSize: '0.8125rem', bgcolor: 'rgba(234,88,12,0.05)' }}>
                                {parseFloat(p.advance_with_salary || 0) > 0 ? fmtAmt(p.advance_with_salary) : '—'}
                              </TableCell>
                            )}
                            <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', fontWeight: 900, color: PRIMARY, fontSize: '0.875rem', bgcolor: 'rgba(26,85,227,0.06)' }}>
                              {fmtAmt(resolveMonthNetPay(p))}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', fontWeight: 900, color: '#0d9488', fontSize: '0.875rem', bgcolor: 'rgba(13,148,136,0.06)' }}>
                              {fmtAmt(resolveTotalPayable(p))}
                              {parseFloat(p.ledger_payable_credit ?? 0) > 0.009 && (
                                <Typography component="span" sx={{ display: 'block', fontSize: '0.62rem', color: '#15803d', fontWeight: 700 }}>
                                  incl. co. {fmtAmt(p.ledger_payable_credit)}
                                </Typography>
                              )}
                            </TableCell>
                            {isClearanceView && (() => {
                              const afterSigned = resolveLedgerBalanceAfterClearance(p);
                              const lbAfter = fmtHrLedgerBalanceCell(p, afterSigned, { afterClearance: true });
                              return (
                                <TableCell
                                  align="right"
                                  title={lbAfter.title}
                                  sx={{
                                    borderBottom: '1px solid #eef2f6',
                                    color: lbAfter.color,
                                    fontWeight: 800,
                                    fontSize: '0.8125rem',
                                    fontFamily: 'monospace',
                                    bgcolor: 'rgba(120,53,15,0.06)',
                                  }}
                                >
                                  {lbAfter.text}
                                </TableCell>
                              );
                            })()}
                            <TableCell align="center" sx={{ borderBottom: '1px solid #eef2f6' }}>
                              <StatusChip status={p.status} />
                            </TableCell>
                            {!isReceiptView && isClearanceView && (
                              <TableCell align="center" sx={{ borderBottom: '1px solid #eef2f6' }}>
                                {p.status === 'PAID' ? (
                                  <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap" useFlexGap>
                                    <Button
                                      size="small"
                                      variant="contained"
                                      disabled={printingReceiptId === (p.payroll_id ?? p.emp_id)}
                                      onClick={() => openReceiptPreview(p)}
                                      startIcon={printingReceiptId === (p.payroll_id ?? p.emp_id) ? <CircularProgress size={14} color="inherit" /> : <ReceiptLong sx={{ fontSize: 15 }} />}
                                      sx={{
                                        textTransform: 'none',
                                        fontWeight: 700,
                                        borderRadius: '8px',
                                        bgcolor: PRIMARY,
                                        fontSize: '0.68rem',
                                        px: 1,
                                        minWidth: 0,
                                        '&:hover': { bgcolor: '#1547c4' },
                                      }}
                                    >
                                      Receipt
                                    </Button>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      disabled={undoingId === p.payroll_id}
                                      onClick={() => openUndoConfirm(p)}
                                      startIcon={undoingId === p.payroll_id ? <CircularProgress size={14} color="inherit" /> : <Undo sx={{ fontSize: 15 }} />}
                                      sx={{
                                        textTransform: 'none',
                                        fontWeight: 700,
                                        borderRadius: '8px',
                                        borderColor: '#fca5a5',
                                        color: '#dc2626',
                                        fontSize: '0.68rem',
                                        px: 1,
                                        minWidth: 0,
                                        '&:hover': { borderColor: '#dc2626', bgcolor: '#fef2f2' },
                                      }}
                                    >
                                      Undo
                                    </Button>
                                  </Stack>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="contained"
                                    disabled={clearingId === p.emp_id}
                                    onClick={() => openClearConfirm(p)}
                                    startIcon={clearingId === p.emp_id ? <CircularProgress size={14} color="inherit" /> : <CheckCircle sx={{ fontSize: 16 }} />}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 700,
                                      borderRadius: '8px',
                                      bgcolor: '#059669',
                                      fontSize: '0.72rem',
                                      px: 1.5,
                                      '&:hover': { bgcolor: '#047857' },
                                    }}
                                  >
                                    Pay
                                  </Button>
                                )}
                              </TableCell>
                            )}
                            {isReceiptView && (
                              <TableCell align="center" sx={{ borderBottom: '1px solid #eef2f6', fontSize: '0.75rem', color: '#64748b' }}>
                                {p.payment_date ? new Date(p.payment_date).toLocaleDateString('en-GB') : '—'}
                              </TableCell>
                            )}
                            {isReceiptView && (
                              <TableCell align="center" sx={{ borderBottom: '1px solid #eef2f6' }}>
                                <Button
                                  size="small"
                                  variant="contained"
                                  disabled={printingReceiptId === (p.payroll_id ?? p.emp_id)}
                                  onClick={() => openReceiptPreview(p)}
                                  startIcon={printingReceiptId === (p.payroll_id ?? p.emp_id) ? <CircularProgress size={14} color="inherit" /> : <ReceiptLong sx={{ fontSize: 16 }} />}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    borderRadius: '8px',
                                    fontSize: '0.72rem',
                                    bgcolor: PRIMARY,
                                    px: 1.25,
                                    '&:hover': { bgcolor: '#1547c4' },
                                  }}
                                >
                                  Receipt
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* Footer totals */}
                {!isReceiptView && (
                <Box
                  sx={{
                    px: 2.5,
                    py: 1.5,
                    borderTop: '2px solid #fef3c7',
                    bgcolor: '#fffbeb',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 3,
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                  }}
                >
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    Total earned: <Box component="span" sx={{ fontWeight: 800, color: '#059669' }}>{fmtAmt(sheetTotals.grossEarned)}</Box>
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    Att ded: <Box component="span" sx={{ fontWeight: 800, color: '#dc2626' }}>{fmtAmt(sheetTotals.attDedTotal)}</Box>
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    Bonus: <Box component="span" sx={{ fontWeight: 800, color: '#16a34a' }}>{fmtAmt(sheetTotals.bonusTotal)}</Box>
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    Extra ded: <Box component="span" sx={{ fontWeight: 800, color: '#be123c' }}>{fmtAmt(sheetTotals.extraDedTotal)}</Box>
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    Adv deducted: <Box component="span" sx={{ fontWeight: 800, color: '#b45309' }}>{fmtAmt(sheetTotals.advanceDeducted)}</Box>
                  </Typography>
                  {isClearanceView && (
                    <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                      Adv w/ salary: <Box component="span" sx={{ fontWeight: 800, color: '#ea580c' }}>{fmtAmt(sheetTotals.advanceWithSalary)}</Box>
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    Net pay: <Box component="span" sx={{ fontWeight: 800, color: PRIMARY }}>{fmtAmt(sheetTotals.net)}</Box>
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
                    Prev balance: <Box component="span" sx={{ fontWeight: 800, color: '#7c3aed' }}>{fmtAmt(sheetTotals.prevBalance)}</Box>
                  </Typography>
                  {!isReceiptView && (
                    <Typography sx={{ fontSize: '0.9375rem', fontWeight: 900, color: NAVY }}>
                      Total payable: <Box component="span" sx={{ color: '#0d9488' }}>{fmtAmt(sheetTotals.totalPayable)}</Box>
                    </Typography>
                  )}
                </Box>
                )}
                </>
                )}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Undo clearance confirmation */}
      <Dialog open={!!undoConfirm} onClose={() => setUndoConfirm(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#dc2626' }}>Undo salary payment</DialogTitle>
        <DialogContent>
          {undoConfirm && (
            <Stack spacing={1.5} sx={{ pt: 0.5 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>{undoConfirm.employee?.emp_name}</Typography>
              <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                {MONTHS[month - 1]} {year} · {undoConfirm.employee?.designation || 'Employee'}
              </Typography>
              <Alert severity="warning" sx={{ borderRadius: '12px' }}>
                This rolls back everything from clearance: payment, ledger, advances, bonus, and extra deductions. Salary returns to <strong>PENDING</strong>.
              </Alert>
              <Box sx={{ bgcolor: '#fef2f2', borderRadius: '12px', p: 2, border: '1px solid #fecaca' }}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>Amount that was paid</Typography>
                    <Typography sx={{ fontWeight: 800, color: '#dc2626' }}>
                      {fmtAmt(undoConfirm.total_payable ?? undoConfirm.net_salary)}
                    </Typography>
                  </Stack>
                  {parseFloat(undoConfirm.previous_balance || 0) > 0 && (
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Previous month balance will also be restored to pending.
                    </Typography>
                  )}
                  {parseFloat(undoConfirm.bonus || 0) > 0 && (
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Bonus ({fmtAmt(undoConfirm.bonus)}) will be removed and net pay recalculated.
                    </Typography>
                  )}
                  {(parseFloat(undoConfirm.other_deduction || 0) > 0) && (
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Extra deduction ({fmtAmt(undoConfirm.other_deduction)}) will be removed and net pay recalculated.
                    </Typography>
                  )}
                  {parseFloat(undoConfirm.advance_deduction || 0) > 0 && (
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Deducted advances will be restored to pending.
                    </Typography>
                  )}
                  {parseFloat(undoConfirm.advance_with_salary || 0) > 0 && (
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Advance paid with salary ({fmtAmt(undoConfirm.advance_with_salary)}) will be removed.
                    </Typography>
                  )}
                  {parseFloat(undoConfirm.total_payable ?? undoConfirm.net_salary ?? 0) > 0 && (
                    <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Cash/bank ledger will get a reversal entry and account balance will be restored.
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setUndoConfirm(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!!undoingId}
            onClick={() => undoConfirm && handleUndoClearance(undoConfirm)}
            startIcon={undoingId ? <CircularProgress size={16} color="inherit" /> : <Undo />}
            sx={{ bgcolor: '#dc2626', fontWeight: 700, textTransform: 'none', borderRadius: '10px', '&:hover': { bgcolor: '#b91c1c' } }}
          >
            Confirm Undo
          </Button>
        </DialogActions>
      </Dialog>

      <SalaryClearanceDialog
        open={!!clearConfirm}
        onClose={() => !clearingId && setClearConfirm(null)}
        payroll={clearConfirm}
        tabMonth={month}
        tabYear={year}
        periodLabel={
          clearConfirm
            ? `${MONTHS[(clearConfirm.month ?? month) - 1]} ${clearConfirm.year ?? year}`
            : ''
        }
        clearancePreview={clearancePreview}
        clearForm={clearForm}
        setClearForm={setClearForm}
        clearingId={clearingId}
        onConfirm={handleClearance}
        fmtAmt={fmtAmt}
        cashAccountsList={cashAccountsList}
        bankAccountsList={bankAccountsList}
        onFillFullAmount={fillClearancePaymentTotal}
      />

      {/* Salary receipt preview — A5 portrait; see hr/lib/salary-receipt-a5-spec.js */}
      <Dialog
        open={!!payslipPreview}
        onClose={() => setPayslipPreview(null)}
        maxWidth={false}
        PaperProps={{ sx: { borderRadius: '16px', overflow: 'hidden', width: 'auto', maxWidth: '96vw' } }}
      >
        <DialogTitle
          sx={{
            bgcolor: NAVY,
            color: '#fff',
            fontWeight: 900,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
            py: 2,
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <ReceiptLong />
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: '1rem', lineHeight: 1.2 }}>
                {PAYSLIP_I18N.docTitleEn} · A5 Portrait
              </Typography>
              {payslipPreview && (
                <Typography sx={{ fontSize: '0.75rem', opacity: 0.85, fontWeight: 600 }}>
                  {payslipPreview.employee?.emp_name} · {MONTHS[payslipPreview.month - 1]} {payslipPreview.year}
                </Typography>
              )}
            </Box>
          </Stack>
          <IconButton onClick={() => setPayslipPreview(null)} sx={{ color: '#fff' }} aria-label="Close">
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2, bgcolor: '#94a3b8', maxHeight: '82vh', overflow: 'auto' }}>
          {payslipPreview && <PayslipPreviewContent payroll={payslipPreview} />}
        </DialogContent>

        <DialogActions sx={{ px: 2.5, py: 2, bgcolor: '#fafbfd', borderTop: '1px solid #e8edf4', gap: 1 }}>
          <Button onClick={() => setPayslipPreview(null)} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Close
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button
            variant="outlined"
            startIcon={downloadingPayslipPdf ? <CircularProgress size={16} color="inherit" /> : <Download />}
            disabled={downloadingPayslipPdf || !payslipPreview}
            onClick={handleDownloadPayslipPdf}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px' }}
          >
            {downloadingPayslipPdf ? 'Downloading…' : 'Download PDF'}
          </Button>
          <Button
            variant="contained"
            disabled={!payslipPreview || isSendingWhatsApp}
            onClick={() => payslipPreview && handleSendSalaryWhatsApp(payslipPreview)}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '10px',
              bgcolor: '#25D366',
              color: '#fff',
              '&:hover': { bgcolor: '#1da851' },
            }}
          >
            {isSendingWhatsApp ? 'Preparing…' : 'Send on WhatsApp'}
          </Button>
          <Button
            variant="contained"
            startIcon={<Print />}
            disabled={!payslipPreview}
            onClick={handlePrintPayslip}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '10px',
              bgcolor: PRIMARY,
              '&:hover': { bgcolor: '#1547c4' },
            }}
          >
            Print A5
          </Button>
        </DialogActions>
      </Dialog>

      <Box id="printable-salary-payslip" sx={{ display: 'none' }} />

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} sx={{ borderRadius: '12px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
