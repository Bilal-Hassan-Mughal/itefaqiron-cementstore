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
  resolveLedgerBalanceAfterClearance, resolveMonthAttDedDisplay, resolveMonthGrossEarned,
  resolveMonthNetPay, resolveSalaryAdvanceApplied, resolveSignedLedgerBalance, resolveTotalPayable, toDateKey,
} from '@/lib/hr-payroll';
import { useHrRefresh, useHrRefreshVersion, HR_KEYS } from '../context/HrRefreshContext';

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

/** Plain-language employee ledger balance for salary clearance (no confusing +/- numbers). */
function describeEmployeeLedgerBalance(signed) {
  const n = parseFloat(signed || 0);
  if (n > 0.009) {
    return {
      headline: 'Employee owes company',
      sub: 'Advance / opening — taken back from salary',
      amount: n,
      amountText: fmtAmt(n),
      chip: 'Deduct from salary',
      bg: '#fef2f2',
      border: '#fecaca',
      color: '#b91c1c',
      deductLine: true,
      addLine: false,
    };
  }
  if (n < -0.009) {
    const amt = Math.abs(n);
    return {
      headline: 'Company owes employee',
      sub: 'You pay this amount with this salary',
      amount: amt,
      amountText: fmtAmt(amt),
      chip: 'Add to payment',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      color: '#15803d',
      deductLine: false,
      addLine: true,
    };
  }
  return {
    headline: 'Ledger settled',
    sub: 'No opening or advance balance to adjust',
    amount: 0,
    amountText: fmtAmt(0),
    chip: 'No adjustment',
    bg: '#f8fafc',
    border: '#e2e8f0',
    color: '#64748b',
    deductLine: false,
    addLine: false,
  };
}

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
      html: `${fmtDed(n)} <span class="acct-tag">کٹوتی</span>`,
      cls: 'ded-amt',
    };
  }
  return {
    html: `+ ${fmtAmt(Math.abs(n))} <span class="acct-tag">اضافہ</span>`,
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

function payslipPaymentMethodUr(method) {
  const m = String(method || '').toUpperCase();
  if (m === 'CASH') return 'نقد';
  if (m === 'BANK') return 'بینک';
  if (m === 'PARTIAL') return 'نقد + بینک';
  return method || '—';
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

function ClearanceSummaryRow({ label, hint, value, valueColor = '#0f172a', prefix = '' }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
      <Box>
        <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>{label}</Typography>
        {hint && (
          <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8', mt: 0.25 }}>{hint}</Typography>
        )}
      </Box>
      <Typography sx={{ fontWeight: 800, fontFamily: 'monospace', color: valueColor, whiteSpace: 'nowrap' }}>
        {prefix}{value}
      </Typography>
    </Stack>
  );
}

/** A5 portrait: 148 x 210 mm — salary clearance receipt */
const PAYSLIP_PAGE = { w: '148mm', h: '210mm', pad: '5mm 6mm 5mm 6mm' };

const PAYSLIP_URDU_FONT = "'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', 'Urdu Typesetting', 'Noto Sans Arabic', serif";

/** Bilingual payslip labels (English + Urdu) */
const PAYSLIP_I18N = {
  docTitleEn: 'Salary Invoice',
  docTitleUr: 'تنخواہ کی رسید',
  docSubEn: 'Employee Salary Payment Receipt',
  docSubUr: 'ملازم کی تنخواہ کی ادائیگی',
  receiptNo: ['Receipt No', 'رسید نمبر'],
  paymentDate: ['Payment Date', 'ادائیگی کی تاریخ'],
  salaryPeriod: ['Salary Month', 'تنخواہ کا مہینہ'],
  status: ['Status', 'حالت'],
  paid: ['PAID', 'ادا شدہ'],
  employeeDetails: ['Employee Details', 'ملازم کی تفصیل'],
  basic: ['Basic Salary', 'بنیادی تنخواہ'],
  dailyRate: ['Daily Rate', 'یومیہ شرح'],
  salaryBreakdown: ['Salary Breakdown', 'تنخواہ کی تفصیل'],
  salaryCalculation: ['Salary Calculation', 'تنخواہ کا حساب'],
  paymentDetails: ['Payment Details', 'ادائیگی کی تفصیل'],
  balancesSection: ['Previous Salary & Employee Account', 'پچھلی تنخواہ اور ملازم اکاؤنٹ'],
  description: ['Description', 'تفصیل'],
  amount: ['Amount (Rs)', 'رقم (روپے)'],
  attendance: ['Attendance Summary', 'حاضری کا خلاصہ'],
  cashPaid: ['Cash Paid', 'نقد ادائیگی'],
  bankPaid: ['Bank Paid', 'بینک ادائیگی'],
  paymentMethod: ['Payment Method', 'ادائیگی کا طریقہ'],
  reference: ['Reference', 'حوالہ'],
  amountPaid: ['Total Paid', 'کل ادائیگی'],
  empSign: ['Employee Signature', 'ملازم کے دستخط'],
  authSign: ['Authorized Signature & Stamp', 'مجاز دستخط و مہر'],
  present: ['Present', 'حاضر'],
  leave: ['Leave', 'رخصت'],
  absent: ['Absent', 'غیر حاضر'],
  half: ['Half', 'آدھا دن'],
  paidDays: ['Paid Days', 'ادا شدہ دن'],
  excess: ['Excess', 'اضافی'],
};

const PAYSLIP_ROW_UR = {
  attendanceSalary: 'حاضری تنخواہ',
  bonus: 'بونس / انعام',
  attDed: 'حاضری کٹوتی',
  extraDed: 'اضافی کٹوتی',
  advanceDed: 'ایڈوانس کی کٹوتی',
  netMonth: 'خالص تنخواہ (اس مہینے)',
  companyBal: 'کمپنی کا بقایا',
  prevBal: 'پچھلے مہینے کا بیلنس',
  prevBalUnpaid: 'پچھلے مہینے کی غیر ادا تنخواہ',
  empAcctBefore: 'ادائیگی سے پہلے ملازم اکاؤنٹ',
  empAcctAfter: 'ادائیگی کے بعد ملازم اکاؤنٹ',
  totalPaymentDue: 'کل ادائیگی واجب',
  advWithSal: 'تنخواہ کے ساتھ ایڈوانس',
  totalDue: 'کل واجب الادا',
  amountPaid: 'ادا شدہ رقم (نقد/بینک)',
};

const PAYSLIP_STYLES = `
  .salary-payslip-sheet {
    width: ${PAYSLIP_PAGE.w};
    max-width: ${PAYSLIP_PAGE.w};
    min-height: ${PAYSLIP_PAGE.h};
    margin: 0 auto;
    background: #fff;
    border: 1.5px solid #0f172a;
    box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .salary-payslip-root * { box-sizing: border-box; }
  .salary-payslip-root {
    direction: rtl;
    font-family: 'Segoe UI', system-ui, Arial, sans-serif;
    width: 100%;
    min-height: ${PAYSLIP_PAGE.h};
    padding: ${PAYSLIP_PAGE.pad};
    color: #0f172a;
    background: #fff;
    font-size: 8pt;
    line-height: 1.4;
    display: flex;
    flex-direction: column;
  }
  .salary-payslip-root .inv-main {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .salary-payslip-root .ur-label {
    font-family: ${PAYSLIP_URDU_FONT};
    direction: rtl;
    font-weight: 600;
    color: #1e293b;
    font-size: 8pt;
    line-height: 1.45;
  }
  .salary-payslip-root .ur-label.ur-bold {
    font-weight: 800;
    color: #0f172a;
  }
  .salary-payslip-root .inv-accent {
    height: 3px;
    background: linear-gradient(90deg, #1A55E3, #0f172a);
    margin-bottom: 6px;
    flex-shrink: 0;
  }
  .salary-payslip-root .co-head {
    text-align: center;
    padding-bottom: 5px;
    margin-bottom: 6px;
    border-bottom: 2px solid #0f172a;
    flex-shrink: 0;
  }
  .salary-payslip-root .co-head .urdu-name {
    font-family: ${PAYSLIP_URDU_FONT};
    font-size: 13pt;
    font-weight: 800;
    margin: 0;
    line-height: 1.35;
    color: #0f172a;
  }
  .salary-payslip-root .co-head .co-phone {
    font-size: 7.5pt;
    font-weight: 700;
    color: #475569;
    margin: 2px 0 0;
    direction: ltr;
    unicode-bidi: embed;
  }
  .salary-payslip-root .title-strip {
    text-align: center;
    background: #0f172a;
    padding: 6px 10px;
    margin-bottom: 0;
    flex-shrink: 0;
  }
  .salary-payslip-root .title-strip .en {
    font-size: 10pt;
    font-weight: 900;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #fff;
    font-family: system-ui, Arial, sans-serif;
    direction: ltr;
  }
  .salary-payslip-root .title-strip .ur-sub {
    font-family: ${PAYSLIP_URDU_FONT};
    font-size: 9pt;
    font-weight: 700;
    color: #e2e8f0;
    margin-top: 2px;
  }
  .salary-payslip-root .meta-table {
    width: 100%;
    border-collapse: collapse;
    margin: 0;
    border: 1px solid #64748b;
    table-layout: fixed;
  }
  .salary-payslip-root .meta-table td {
    padding: 5px 8px;
    border: 1px solid #cbd5e1;
    vertical-align: middle;
    font-size: 7.5pt;
    line-height: 1.35;
  }
  .salary-payslip-root .meta-table .mk {
    width: 26%;
    background: #e2e8f0;
    font-family: ${PAYSLIP_URDU_FONT};
    font-weight: 800;
    color: #1e293b;
    text-align: right;
    padding-right: 10px;
  }
  .salary-payslip-root .meta-table .mv {
    width: 24%;
    font-weight: 800;
    color: #0f172a;
    text-align: center;
    direction: ltr;
    unicode-bidi: embed;
    background: #fff;
  }
  .salary-payslip-root .meta-table tr.meta-emp td {
    padding-top: 6px;
    padding-bottom: 6px;
  }
  .salary-payslip-root .meta-table .emp-name {
    font-weight: 900;
    font-size: 8.5pt;
    text-align: center;
    direction: ltr;
    unicode-bidi: embed;
  }
  .salary-payslip-root .inv-table {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    border: 1px solid #64748b;
    margin: 0;
  }
  .salary-payslip-root .inv-table col.col-desc { width: 56%; }
  .salary-payslip-root .inv-table col.col-amt { width: 44%; }
  .salary-payslip-root .inv-table thead th {
    background: #1e3a5f;
    color: #fff !important;
    font-size: 8.5pt;
    font-weight: 900;
    padding: 6px 10px;
    border: 1px solid #1e3a5f;
    font-family: ${PAYSLIP_URDU_FONT};
    text-align: center;
  }
  .salary-payslip-root .inv-table thead th .ur-label {
    color: #fff !important;
    font-weight: 900;
  }
  .salary-payslip-root .inv-table tbody td {
    padding: 5px 10px;
    border-bottom: 1px solid #cbd5e1;
    vertical-align: middle;
    font-size: 8pt;
    min-height: 22px;
  }
  .salary-payslip-root .inv-table tbody tr.data-row:nth-child(even) td {
    background: #f8fafc;
  }
  .salary-payslip-root .inv-table td.desc {
    text-align: right;
    padding-right: 10px;
    border-left: 1px solid #e2e8f0;
  }
  .salary-payslip-root .inv-table td.amt,
  .salary-payslip-root .inv-table td.val {
    text-align: right;
    direction: ltr;
    unicode-bidi: embed;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    padding-left: 8px;
    padding-right: 10px;
    white-space: nowrap;
  }
  .salary-payslip-root .inv-table td.val {
    font-weight: 700;
    font-size: 7.5pt;
    color: #334155;
    line-height: 1.3;
    white-space: normal;
  }
  .salary-payslip-root .inv-table .earn-amt { color: #047857; }
  .salary-payslip-root .inv-table .ded-amt { color: #b91c1c; }
  .salary-payslip-root .inv-table td.amt .acct-tag {
    font-family: ${PAYSLIP_URDU_FONT};
    font-size: 7pt;
    font-weight: 800;
    margin-left: 6px;
    direction: rtl;
    unicode-bidi: embed;
    color: inherit;
    opacity: 0.95;
  }
  .salary-payslip-root .inv-table tr.sep td {
    background: #334155;
    color: #fff !important;
    padding: 5px 10px;
    font-size: 8.5pt;
    font-weight: 900;
    text-align: center;
    border: 1px solid #334155;
    font-family: ${PAYSLIP_URDU_FONT};
  }
  .salary-payslip-root .inv-table tr.sep td .ur-label {
    color: #fff !important;
    font-weight: 900;
  }
  .salary-payslip-root .inv-table tr.net-row td {
    background: #dbeafe;
    border-top: 2px solid #1A55E3;
    border-bottom: 2px solid #1A55E3;
  }
  .salary-payslip-root .inv-table tr.net-row td.desc .ur-label { font-weight: 900; }
  .salary-payslip-root .inv-table tr.net-row td.amt {
    color: #1A55E3;
    font-size: 9pt;
    font-weight: 900;
  }
  .salary-payslip-root .inv-table tr.total-row td {
    background: #d1fae5;
    border-top: 2px solid #059669;
  }
  .salary-payslip-root .inv-table tr.total-row td.desc .ur-label { font-weight: 900; }
  .salary-payslip-root .inv-table tr.total-row td.amt {
    color: #047857;
    font-size: 9.5pt;
    font-weight: 900;
  }
  .salary-payslip-root .inv-footer {
    margin-top: auto;
    padding-top: 10px;
    flex-shrink: 0;
  }
  .salary-payslip-root .sign {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
  }
  .salary-payslip-root .sign span {
    flex: 1;
    border-top: 1.5px solid #64748b;
    padding-top: 28px;
    text-align: center;
    font-weight: 800;
    font-size: 7.5pt;
    font-family: ${PAYSLIP_URDU_FONT};
    color: #475569;
  }
  .salary-payslip-root .foot {
    font-size: 6.5pt;
    color: #94a3b8;
    text-align: center;
    margin: 0;
    direction: ltr;
  }
`;

/** WhatsApp / PDF capture — full receipt, scaled to A5 in PDF step */
const PAYSLIP_WA_CAPTURE_STYLES = `
  .salary-payslip-sheet.salary-wa-capture {
    overflow: visible !important;
    box-shadow: none !important;
  }
`;

const PAYSLIP_PRINT_STYLES = `
  @page { size: 148mm 210mm; margin: 0; }
  @media print {
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: ${PAYSLIP_PAGE.w} !important;
      background: #fff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .salary-payslip-sheet {
      width: ${PAYSLIP_PAGE.w} !important;
      max-width: ${PAYSLIP_PAGE.w} !important;
      margin: 0 auto !important;
      box-shadow: none !important;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      border: 1.5px solid #0f172a !important;
    }
  }
`;

function getPayslipStylesheet() {
  return `${PAYSLIP_STYLES}${PAYSLIP_PRINT_STYLES}`;
}

function payslipUr(ur, bold = true) {
  return `<span class="ur-label${bold ? ' ur-bold' : ''}">${escapeHtml(ur)}</span>`;
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

function buildPayslipBody(payroll) {
  const emp = payroll.employee || {};
  const monthLabel = MONTHS[(payroll.month || 1) - 1] || '-';
  const period = `${monthLabel} ${payroll.year || ''}`.trim();
  const totalDaysInMonth = getDaysInMonth(payroll.month, payroll.year);
  const printed = new Date().toLocaleString('en-GB');
  const monthNet = resolveMonthNetPay(payroll);
  const prevBal = parseFloat(payroll.previous_balance ?? payroll.previous_balance_paid ?? 0);
  const advanceWithSalary = parseFloat(payroll.advance_with_salary || 0);
  const ledgerPayableCredit = parseFloat(
    payroll.ledger_payable_credit
    ?? payroll.clearance_snapshot?.ledger_payable_credit
    ?? 0
  );
  const cashPaid = parseFloat(payroll.cash_amount || 0);
  const bankPaid = parseFloat(payroll.bank_amount || 0);
  const totalDue = resolveTotalPayable(payroll);
  const amountPaidActual = parseFloat(
    payroll.amount_paid
    ?? payroll.clearance_snapshot?.amount_paid
    ?? (cashPaid + bankPaid)
  );
  const totalPaid = amountPaidActual > 0.009 ? amountPaidActual : totalDue;
  const payDate = payroll.payment_date || payroll.cleared_at;
  const receiptNo = payroll.payroll_id ? `SR-${String(payroll.payroll_id).padStart(5, '0')}` : '-';
  const paidDays = parseFloat(payroll.paid_days ?? payroll.days_present ?? 0);
  const legacyAttDed = parseFloat(payroll.total_deduction || 0);
  const attDedDisplay = resolveMonthAttDedDisplay(payroll, payroll.month, payroll.year);
  const otherDed = parseFloat(payroll.other_deduction || 0);
  const bonus = parseFloat(payroll.bonus || 0);
  const paymentMethod = payroll.payment_method || (cashPaid > 0 && bankPaid > 0 ? 'PARTIAL' : bankPaid > 0 ? 'BANK' : 'CASH');
  const phones = (COMPANY.phones || []).join(', ');
  const monthlySalaryAmount = resolveMonthGrossEarned(payroll);

  const deductedAdvances = Array.isArray(payroll.deducted_advances) ? payroll.deducted_advances : [];
  const advanceDedTotal = resolveReceiptAdvanceDeduction(
    payroll,
    monthlySalaryAmount,
    monthNet,
    legacyAttDed,
    otherDed,
    bonus,
    deductedAdvances
  );

  const snap = payroll.clearance_snapshot || {};
  const prevPeriod = resolvePayslipPrevPeriod(payroll);
  const ledgerBeforeRaw = payroll.employee_ledger_closing_before
    ?? snap.employee_ledger_closing_before
    ?? snap.employee_ledger_closing
    ?? payroll.employee_ledger_closing;
  const ledgerAfterRaw = payroll.employee_ledger_closing_after ?? snap.employee_ledger_closing_after;
  const ledgerBefore = ledgerBeforeRaw != null && ledgerBeforeRaw !== '' ? parseFloat(ledgerBeforeRaw) : NaN;
  const ledgerAfter = ledgerAfterRaw != null && ledgerAfterRaw !== '' ? parseFloat(ledgerAfterRaw) : NaN;

  const fv = (labelHtml, valueHtml, rowCls = '') =>
    `<tr class="data-row ${rowCls}"><td class="desc">${labelHtml}</td><td class="val">${valueHtml}</td></tr>`;
  const br = (labelHtml, amount, cls = '', rowCls = '') =>
    `<tr class="data-row ${rowCls}"><td class="desc">${labelHtml}</td><td class="amt ${cls}">${amount}</td></tr>`;

  const presentDays = fmtNum(payroll.days_present ?? payroll.present_days);
  const leaveDays = fmtNum(payroll.leaves_taken ?? payroll.leave_days);
  const absentDays = fmtNum(payroll.absent_days ?? payroll.absents_taken);
  const halfDays = parseFloat(payroll.half_days ?? 0);
  const attSummary = halfDays > 0
    ? `${presentDays} / ${leaveDays} / ${absentDays} / ${fmtNum(halfDays)} / ${fmtNum(paidDays)}`
    : `${presentDays} / ${leaveDays} / ${absentDays} / ${fmtNum(paidDays)}`;
  const attSummaryLbl = halfDays > 0
    ? 'حاضری / رخصت / غیر حاضری / آدھا دن / ادا شدہ'
    : 'حاضری / رخصت / غیر حاضری / ادا شدہ';

  let rows = '';
  rows += `<tr class="sep"><td colspan="2">${payslipUr(PAYSLIP_I18N.salaryCalculation[1])}</td></tr>`;
  rows += br(payslipUr(PAYSLIP_I18N.basic[1]), fmtAmt(payroll.basic_salary));
  rows += fv(payslipUr(attSummaryLbl, false), escapeHtml(attSummary));
  rows += br(payslipUr(PAYSLIP_ROW_UR.attendanceSalary), fmtAmt(monthlySalaryAmount), 'earn-amt');
  if (bonus > 0.009) rows += br(payslipUr(PAYSLIP_ROW_UR.bonus), fmtAdd(bonus), 'earn-amt');
  if (attDedDisplay > 0.009) rows += br(payslipUr(PAYSLIP_ROW_UR.attDed), fmtDed(attDedDisplay), 'ded-amt');
  if (otherDed > 0.009) {
    rows += br(payslipUr(PAYSLIP_ROW_UR.extraDed), fmtDed(otherDed), 'ded-amt');
  }
  if (advanceDedTotal > 0.009) {
    rows += br(payslipUr(PAYSLIP_ROW_UR.advanceDed), fmtDed(advanceDedTotal), 'ded-amt');
  }
  rows += br(payslipUr(PAYSLIP_ROW_UR.netMonth), fmtAmt(monthNet), '', 'net-row');

  const balanceLines = [];
  if (prevBal > 0.009) {
    const prevBalUr = prevPeriod
      ? `${PAYSLIP_ROW_UR.prevBalUnpaid} (${prevPeriod})`
      : PAYSLIP_ROW_UR.prevBalUnpaid;
    balanceLines.push(br(payslipUr(prevBalUr), fmtAmt(prevBal), 'earn-amt'));
  }
  if (!payslipAccountIsEmpty(ledgerBefore)) {
    const acctBefore = payslipEmployeeAccountDisplay(ledgerBefore);
    balanceLines.push(br(payslipUr(PAYSLIP_ROW_UR.empAcctBefore), acctBefore.html, acctBefore.cls));
  }
  if (ledgerPayableCredit > 0.009) {
    balanceLines.push(br(payslipUr(PAYSLIP_ROW_UR.companyBal), fmtAdd(ledgerPayableCredit), 'earn-amt'));
  }
  if (advanceWithSalary > 0.009) {
    balanceLines.push(br(payslipUr(PAYSLIP_ROW_UR.advWithSal), fmtAmt(advanceWithSalary), 'earn-amt'));
  }
  if (balanceLines.length > 0 || Math.abs(totalDue - monthNet) > 0.009) {
    rows += `<tr class="sep"><td colspan="2">${payslipUr(PAYSLIP_I18N.balancesSection[1])}</td></tr>`;
    rows += balanceLines.join('');
    rows += br(payslipUr(PAYSLIP_ROW_UR.totalPaymentDue), fmtAmt(totalDue), '', 'net-row');
  }
  if (!payslipAccountIsEmpty(ledgerAfter)) {
    const acctAfter = payslipEmployeeAccountDisplay(ledgerAfter);
    if (balanceLines.length === 0 && Math.abs(totalDue - monthNet) <= 0.009) {
      rows += `<tr class="sep"><td colspan="2">${payslipUr(PAYSLIP_I18N.balancesSection[1])}</td></tr>`;
    }
    rows += br(payslipUr(PAYSLIP_ROW_UR.empAcctAfter), acctAfter.html, acctAfter.cls);
  }

  rows += `<tr class="sep"><td colspan="2">${payslipUr('ادائیگی')}</td></tr>`;
  rows += br(payslipUr(PAYSLIP_I18N.cashPaid[1]), cashPaid > 0.009 ? fmtAmt(cashPaid) : '—');
  rows += br(payslipUr(PAYSLIP_I18N.bankPaid[1]), bankPaid > 0.009 ? fmtAmt(bankPaid) : '—');
  rows += br(payslipUr(PAYSLIP_I18N.paymentMethod[1]), escapeHtml(payslipPaymentMethodUr(paymentMethod)));
  if (payroll.payment_reference) {
    rows += fv(payslipUr(PAYSLIP_I18N.reference[1]), escapeHtml(payroll.payment_reference));
  }
  rows += br(payslipUr(PAYSLIP_ROW_UR.amountPaid), fmtAmt(totalPaid), 'earn-amt', 'total-row');

  const dash = '—';
  const companyUr = COMPANY.nameUr || 'اتفاق آئرن اینڈ سیمنٹ سٹور';
  const statusText = payroll.status === 'PAID' ? PAYSLIP_I18N.paid[1] : (payroll.status || PAYSLIP_I18N.paid[1]);

  const empPhone = emp.emp_phone ? escapeHtml(emp.emp_phone) : '';
  const empDesig = emp.designation ? escapeHtml(emp.designation) : '';

  return `<div class="salary-payslip-sheet"><div class="salary-payslip-root" id="salary-payslip-preview">
  <div class="inv-accent"></div>
  <div class="co-head">
    <p class="urdu-name">${companyUr}</p>
    ${phones ? `<p class="co-phone">${escapeHtml(phones)}</p>` : ''}
  </div>

  <div class="title-strip">
    <div class="en">${PAYSLIP_I18N.docTitleEn}</div>
    <div class="ur-sub">${PAYSLIP_I18N.docTitleUr}</div>
  </div>

  <div class="inv-main">
  <table class="meta-table">
    <tbody>
      <tr>
        <td class="mk">${payslipUr(PAYSLIP_I18N.salaryPeriod[1])}</td>
        <td class="mv">${escapeHtml(period)}</td>
        <td class="mk">${payslipUr(PAYSLIP_I18N.receiptNo[1])}</td>
        <td class="mv">${escapeHtml(receiptNo)}</td>
      </tr>
      <tr>
        <td class="mk">${payslipUr(PAYSLIP_I18N.paymentDate[1])}</td>
        <td class="mv">${escapeHtml(fmtDate(payDate))}</td>
        <td class="mk">${payslipUr(PAYSLIP_I18N.status[1])}</td>
        <td class="mv">${escapeHtml(statusText)}</td>
      </tr>
      <tr class="meta-emp">
        <td class="mk">${payslipUr('نام ملازم')}</td>
        <td class="mv emp-name" colspan="3">${escapeHtml(emp.emp_name || dash)}${empDesig ? ` · ${empDesig}` : ''}${empPhone ? ` · ${empPhone}` : ''}</td>
      </tr>
    </tbody>
  </table>

  <table class="inv-table">
    <colgroup>
      <col class="col-desc" />
      <col class="col-amt" />
    </colgroup>
    <thead>
      <tr>
        <th>${payslipUr('تفصیل')}</th>
        <th>${payslipUr('رقم (روپے)')}</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  </div>

  <div class="inv-footer">
    <div class="sign">
      <span>${payslipUr(PAYSLIP_I18N.empSign[1])}</span>
      <span>${payslipUr(PAYSLIP_I18N.authSign[1])}</span>
    </div>
    <p class="foot">${escapeHtml(receiptNo)} · ${printed}</p>
  </div>
</div></div>`;
}

function buildPayslipHtml(payroll) {
  const emp = payroll.employee || {};
  return `<!DOCTYPE html><html lang="ur"><head><meta charset="utf-8"><title>${PAYSLIP_I18N.docTitleEn} - ${emp.emp_name || ''}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Sans+Arabic:wght@400;700&display=swap" rel="stylesheet">
<style>${getPayslipStylesheet()}</style></head><body style="margin:0;padding:0">
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
            '& .salary-payslip-sheet': {
              height: 'auto',
              maxHeight: 'none',
              overflow: 'visible',
            },
            '& .salary-payslip-root': { height: 'auto' },
            '& .salary-payslip-sheet': { boxShadow: '0 4px 24px rgba(15,23,42,0.12)' },
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

  const [employees, setEmployees] = useState([]);
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
  const employeesVersion = useHrRefreshVersion(HR_KEYS.employees);
  const { invalidatePayrollFlow } = useHrRefresh();

  useEffect(() => {
    if (isReceiptView) return;
    const url = isClearanceView || useLiveCalc ? '/api/employees' : '/api/employees?lite=true';
    fetch(url)
      .then(async (r) => {
        const data = await r.json();
        setEmployees(Array.isArray(data) ? data : []);
      })
      .catch(() => setEmployees([]));
  }, [isReceiptView, isClearanceView, useLiveCalc, employeesVersion]);

  useEffect(() => {
    if (isReceiptView) return;
    fetchAdvances();
  }, [isReceiptView, advancesVersion]);

  useEffect(() => {
    if (isClearanceView) {
      fetch('/api/customers?dropdown=true')
        .then((r) => r.json())
        .then((data) => setPaymentAccounts(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [isClearanceView]);

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

  const clearancePreview = useMemo(() => {
    if (!clearConfirm) return null;
    const preview = previewClearancePayroll(clearConfirm, clearForm, month, year);
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
  }, [clearConfirm, clearForm, month, year]);

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

  async function handleClearance(payroll) {
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
      showSnack(`Cleared: ${payroll.employee?.emp_name} — ${fmtAmt(paidAmt)}. Use Print, WhatsApp, or PDF in receipt preview.`, 'success');
    } catch (err) {
      showSnack(err.message || 'Failed to clear salary', 'error');
    } finally {
      setClearingId(null);
    }
  }

  function openClearConfirm(payroll) {
    const defaultCash = paymentAccounts.find((acc) => {
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

  function fillClearancePaymentTotal() {
    if (!clearancePreview) return;
    const total = clearancePreview.grandTotal;
    if (clearForm.paymentMethod === 'BANK') {
      setClearForm((f) => ({ ...f, bank_amount: total > 0 ? String(total) : '', cash_amount: '' }));
    } else if (clearForm.paymentMethod === 'PARTIAL') {
      setClearForm((f) => ({ ...f, cash_amount: total > 0 ? String(total) : '', bank_amount: '' }));
    } else {
      setClearForm((f) => ({ ...f, cash_amount: total > 0 ? String(total) : '', bank_amount: '' }));
    }
  }

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
      html, body { margin: 0; padding: 0; background: #fff; }
      .salary-payslip-sheet { page-break-after: always; break-after: page; }
      .salary-payslip-sheet:last-child { page-break-after: auto; break-after: auto; }
    `;
    const pages = enriched.map((p) => buildPayslipBody(p)).join('');
    w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>${PAYSLIP_I18N.docTitleEn}</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400..700&family=Noto+Sans+Arabic:wght@400;700&display=swap" rel="stylesheet">
<style>${getPayslipStylesheet()}${printExtra}</style></head><body style="margin:0;padding:0">${pages}</body></html>`);
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
      {showInternalStats && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <StatMini
            label={isReceiptView ? 'Total Paid' : isClearanceView ? 'Total Payable' : 'This Month Net'}
            value={fmtAmt(isReceiptView ? sheetTotals.paid : isClearanceView ? sheetTotals.totalPayable : sheetTotals.net)}
            accent={isReceiptView ? '#059669' : AMBER}
            tint={isReceiptView ? '#dcfce7' : '#fef3c7'}
            icon={isReceiptView ? CheckCircle : Payments}
          />
          {!isReceiptView && (
            <>
              <StatMini label="Prev Month Balance" value={fmtAmt(sheetTotals.prevBalance)} accent="#7c3aed" tint="#ede9fe" icon={AccountBalanceWallet} />
              <StatMini
                label={isClearanceView ? 'Adv. Deducted' : 'Advances (This Month)'}
                value={fmtAmt(sheetTotals.advanceDeducted)}
                accent="#b45309"
                tint="#fef3c7"
                icon={AccountBalanceWallet}
              />
              {isClearanceView && (
                <StatMini
                  label="Adv. w/ Salary"
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

      {showPayrollTable && (
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
                  : 'Daily rate = basic / month days. Present + off days + allowed leave/absent are paid. Half day = half pay.'}
              </Typography>
            )}
            {isReceiptView && (
              <Typography sx={{ fontSize: '0.78rem', color: '#64748b', mt: 1.75, pt: 1.5, borderTop: '1px dashed #e8edf4' }}>
                Click <strong>View</strong> on any row to open the full salary receipt — then print or download as PDF.
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
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#92400e' }} title="Opening + ledger (+ employee owes, − company owes)">
                          Acct Bal
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
                              const lb = fmtHrLedgerBalanceCell(p);
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
                                    Clear
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
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Undo clearance confirmation */}
      <Dialog open={!!undoConfirm} onClose={() => setUndoConfirm(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 900, color: '#dc2626' }}>Undo Salary Clearance</DialogTitle>
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

      {/* Clearance confirmation */}
      <Dialog open={!!clearConfirm} onClose={() => setClearConfirm(null)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '16px' } }}>
        <DialogTitle sx={{ fontWeight: 900, color: NAVY }}>Salary Clearance</DialogTitle>
        <DialogContent dividers>
          {clearConfirm && clearancePreview && (
            <Stack spacing={2} sx={{ pt: 0.5 }}>
              <Alert severity="info" sx={{ borderRadius: '10px', py: 0.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
                  {MONTHS[(clearConfirm.month ?? month) - 1]} {clearConfirm.year ?? year} — monthly clearance only
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', mt: 0.25 }}>
                  Totals below are for this salary month. Enter the cash/bank amount you pay now (not auto-deducted from accounts).
                </Typography>
              </Alert>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>{clearConfirm.employee?.emp_name}</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {MONTHS[(clearConfirm.month ?? month) - 1]} {clearConfirm.year ?? year} · {clearConfirm.employee?.designation || 'Employee'}
                </Typography>
              </Box>

              {(() => {
                const ledger = describeEmployeeLedgerBalance(clearancePreview.signedClosing);
                const openingDiffers =
                  Math.abs(clearancePreview.openingBal) >= 0.01
                  && Math.abs(clearancePreview.openingBal - clearancePreview.signedClosing) >= 0.01;
                const recoveryAmt = clearancePreview.advanceAppliedThisMonth
                  ?? clearancePreview.recoveryDeduction
                  ?? clearancePreview.ledgerOwed;
                return (
                  <Stack spacing={2}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: '12px',
                        bgcolor: ledger.bg,
                        border: `1px solid ${ledger.border}`,
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box>
                          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Employee account (from ledger)
                          </Typography>
                          <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', color: ledger.color, mt: 0.5 }}>
                            {ledger.headline}
                          </Typography>
                          <Typography sx={{ fontSize: '0.78rem', color: '#475569', mt: 0.25 }}>{ledger.sub}</Typography>
                          {openingDiffers && (
                            <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8', mt: 1 }}>
                              Pre-system opening: {clearancePreview.openingBal > 0
                                ? `employee owed ${fmtAmt(clearancePreview.openingBal)}`
                                : clearancePreview.openingBal < 0
                                  ? `company owed ${fmtAmt(Math.abs(clearancePreview.openingBal))}`
                                  : fmtAmt(0)}
                              {' · '}After advances/receipts, net {ledger.amountText} ({ledger.headline.toLowerCase()})
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography sx={{ fontWeight: 900, fontSize: '1.35rem', fontFamily: 'monospace', color: ledger.color }}>
                            {ledger.amountText}
                          </Typography>
                          <Chip
                            size="small"
                            label={ledger.chip}
                            sx={{ mt: 0.75, fontWeight: 700, fontSize: '0.65rem', bgcolor: '#fff', color: ledger.color, border: `1px solid ${ledger.border}` }}
                          />
                        </Box>
                      </Stack>
                    </Box>

                    <Box sx={{ bgcolor: '#f8fafc', borderRadius: '12px', p: 2, border: '1px solid #e8edf4' }}>
                      <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', mb: 1.25 }}>
                        How much to pay
                      </Typography>
                      <Stack spacing={1.1}>
                        <ClearanceSummaryRow
                          label="Monthly basic salary"
                          hint="Contract rate for this month"
                          value={fmtAmt(clearConfirm.basic_salary)}
                          valueColor="#334155"
                        />
                        <ClearanceSummaryRow
                          label="Salary earned (paid days)"
                          hint="Paid days × (basic ÷ days in month)"
                          value={fmtAmt(clearancePreview.derived.gross_earned ?? resolveMonthGrossEarned(clearConfirm))}
                          valueColor="#059669"
                        />
                        {clearancePreview.absentDeduction?.amount > 0.009 && (
                          <ClearanceSummaryRow
                            label="Absent / unpaid days (vs basic)"
                            hint={`${clearancePreview.absentDeduction.detail || 'Why earned is below basic'} · already reflected in earned — not deducted twice`}
                            value={fmtAmt(clearancePreview.absentDeduction.amount)}
                            valueColor="#dc2626"
                            prefix="≈ "
                          />
                        )}
                        {parseFloat(clearForm.bonus || 0) > 0 && (
                          <ClearanceSummaryRow label="Bonus" value={fmtAmt(clearForm.bonus)} valueColor="#16a34a" prefix="+ " />
                        )}
                        {parseFloat(clearancePreview.derived.total_deduction || 0) > 0 && (
                          <ClearanceSummaryRow
                            label="Extra attendance penalty"
                            hint="Additional leave/absent penalty (if any)"
                            value={fmtAmt(clearancePreview.derived.total_deduction)}
                            valueColor="#dc2626"
                            prefix="− "
                          />
                        )}
                        {parseFloat(clearForm.extra_deduction || 0) > 0 && (
                          <ClearanceSummaryRow label="Extra deduction" value={fmtAmt(clearForm.extra_deduction)} valueColor="#be123c" prefix="− " />
                        )}
                        {recoveryAmt > 0 && (
                          <ClearanceSummaryRow
                            label="Less: recovered from salary (account)"
                            hint="Taken from earned pay this month (capped); reduces employee account balance"
                            value={fmtAmt(recoveryAmt)}
                            valueColor="#b45309"
                            prefix="− "
                          />
                        )}
                        <ClearanceSummaryRow
                          label="Net pay this month"
                          hint="Earned − absent/unpaid − extras − amount recovered from account"
                          value={fmtAmt(clearancePreview.derived.net_salary)}
                          valueColor="#0d9488"
                        />
                        {ledger.addLine && (
                          <ClearanceSummaryRow
                            label="Plus: pay company balance"
                            hint="Amount you already owed this employee"
                            value={fmtAmt(clearancePreview.ledgerPayableCredit)}
                            valueColor="#15803d"
                            prefix="+ "
                          />
                        )}
                        {clearancePreview.prevBal > 0 && (
                          <ClearanceSummaryRow
                            label="Plus: unpaid last month salary"
                            hint="Previous month net not yet paid"
                            value={fmtAmt(clearancePreview.prevBal)}
                            valueColor="#7c3aed"
                            prefix="+ "
                          />
                        )}
                        {clearancePreview.advanceWithSalary > 0 && (
                          <ClearanceSummaryRow
                            label="Plus: new advance with this payment"
                            hint="Extra cash now — recovered next payroll"
                            value={fmtAmt(clearancePreview.advanceWithSalary)}
                            valueColor="#ea580c"
                            prefix="+ "
                          />
                        )}
                        <Box sx={{ pt: 1.25, mt: 0.5, borderTop: '2px solid #cbd5e1' }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Box>
                              <Typography sx={{ fontWeight: 900, fontSize: '0.95rem' }}>Total pay (cash due now)</Typography>
                              <Typography sx={{ fontSize: '0.68rem', color: '#64748b' }}>
                                {ledger.addLine && recoveryAmt <= 0
                                  ? `Net pay ${fmtAmt(clearancePreview.derived.net_salary)} + company owes ${fmtAmt(clearancePreview.ledgerPayableCredit)}`
                                  : recoveryAmt > 0
                                    ? `Net pay after account recovery + prev month + advance with salary`
                                    : 'Net pay plus prev month / company owes / advance with salary'}
                              </Typography>
                            </Box>
                            <Typography sx={{ fontWeight: 900, color: '#0d9488', fontSize: '1.25rem', fontFamily: 'monospace' }}>
                              {fmtAmt(clearancePreview.grandTotal)}
                            </Typography>
                          </Stack>
                        </Box>
                        {(() => {
                          const afterSigned = clearancePreview.ledgerAfterClearance ?? clearancePreview.signedClosing;
                          const afterLedger = describeEmployeeLedgerBalance(afterSigned);
                          const changed = Math.abs(afterSigned - clearancePreview.signedClosing) >= 0.01;
                          return (
                            <Box
                              sx={{
                                mt: 1.5,
                                p: 1.75,
                                borderRadius: '10px',
                                bgcolor: afterLedger.bg,
                                border: `1px dashed ${afterLedger.border}`,
                              }}
                            >
                              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                Employee account after this clearance
                              </Typography>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.75 }}>
                                <Box>
                                  <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: afterLedger.color }}>
                                    {afterLedger.headline}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.72rem', color: '#475569', mt: 0.25 }}>
                                    {changed
                                      ? `Was ${ledger.amountText} before · after deducting ${recoveryAmt > 0 ? fmtAmt(recoveryAmt) : 'Rs 0'} from salary${clearancePreview.advanceWithSalary > 0 ? ` and +${fmtAmt(clearancePreview.advanceWithSalary)} advance with pay` : ''}`
                                      : afterLedger.sub}
                                  </Typography>
                                </Box>
                                <Typography sx={{ fontWeight: 900, fontSize: '1.1rem', fontFamily: 'monospace', color: afterLedger.color }}>
                                  {afterLedger.amountText}
                                </Typography>
                              </Stack>
                            </Box>
                          );
                        })()}
                      </Stack>
                    </Box>
                  </Stack>
                );
              })()}

              <Divider><Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>ADJUSTMENTS</Typography></Divider>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  fullWidth size="small" label="Bonus (Rs)" type="number"
                  value={clearForm.bonus}
                  onChange={(e) => setClearForm((f) => ({ ...f, bonus: e.target.value }))}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
                <TextField
                  fullWidth size="small" label="Extra Deduction (Rs)" type="number"
                  value={clearForm.extra_deduction}
                  onChange={(e) => setClearForm((f) => ({ ...f, extra_deduction: e.target.value }))}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Stack>
              <TextField
                fullWidth size="small" label="Deduction Reason"
                value={clearForm.deduction_reason}
                onChange={(e) => setClearForm((f) => ({ ...f, deduction_reason: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              />

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  fullWidth size="small" label="Advance with Salary (Rs)" type="number"
                  value={clearForm.advance_with_salary}
                  onChange={(e) => setClearForm((f) => ({ ...f, advance_with_salary: e.target.value }))}
                  helperText="Extra advance paid now — deducted next month"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
                <TextField
                  fullWidth size="small" label="Advance Reason"
                  value={clearForm.advance_reason}
                  onChange={(e) => setClearForm((f) => ({ ...f, advance_reason: e.target.value }))}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              </Stack>

              <Divider><Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 700 }}>PAYMENT</Typography></Divider>

              <ToggleButtonGroup
                exclusive size="small" fullWidth
                value={clearForm.paymentMethod}
                onChange={(_, val) => val && setClearForm((f) => ({
                  ...f,
                  paymentMethod: val,
                  paid_from_account_id: val === 'BANK' ? '' : f.paid_from_account_id,
                  bank_account_id: val === 'CASH' ? '' : f.bank_account_id,
                }))}
              >
                <ToggleButton value="CASH" sx={{ textTransform: 'none', fontWeight: 700 }}>Cash</ToggleButton>
                <ToggleButton value="BANK" sx={{ textTransform: 'none', fontWeight: 700 }}>Bank</ToggleButton>
                <ToggleButton value="PARTIAL" sx={{ textTransform: 'none', fontWeight: 700 }}>Cash + Bank</ToggleButton>
              </ToggleButtonGroup>

              {(clearForm.paymentMethod === 'CASH' || clearForm.paymentMethod === 'PARTIAL') && (
                <Autocomplete
                  size="small"
                  options={cashAccountsList}
                  getOptionLabel={(o) => `${o.cus_name} (${fmtAmt(o.cus_balance)})`}
                  value={cashAccountsList.find((a) => String(a.cus_id) === clearForm.paid_from_account_id) || null}
                  onChange={(_, val) => setClearForm((f) => ({ ...f, paid_from_account_id: val ? String(val.cus_id) : '' }))}
                  renderInput={(params) => <TextField {...params} label="Cash Account" />}
                />
              )}

              {(clearForm.paymentMethod === 'BANK' || clearForm.paymentMethod === 'PARTIAL') && (
                <Autocomplete
                  size="small"
                  options={bankAccountsList}
                  getOptionLabel={(o) => `${o.cus_name} (${fmtAmt(o.cus_balance)})`}
                  value={bankAccountsList.find((a) => String(a.cus_id) === clearForm.bank_account_id) || null}
                  onChange={(_, val) => setClearForm((f) => ({ ...f, bank_account_id: val ? String(val.cus_id) : '' }))}
                  renderInput={(params) => <TextField {...params} label="Bank Account" />}
                />
              )}

              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
                <Typography sx={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                  Salary due: {fmtAmt(clearancePreview.grandTotal)}
                </Typography>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={fillClearancePaymentTotal}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '8px' }}
                >
                  Fill full due amount
                </Button>
              </Stack>

              {clearForm.paymentMethod === 'CASH' && (
                <TextField
                  fullWidth
                  size="small"
                  label="Cash amount you pay (Rs)"
                  type="number"
                  required
                  value={clearForm.cash_amount}
                  onChange={(e) => setClearForm((f) => ({ ...f, cash_amount: e.target.value, bank_amount: '' }))}
                  helperText="Type the amount — only this much is deducted from the cash account"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              )}

              {clearForm.paymentMethod === 'BANK' && (
                <TextField
                  fullWidth
                  size="small"
                  label="Bank amount you pay (Rs)"
                  type="number"
                  required
                  value={clearForm.bank_amount}
                  onChange={(e) => setClearForm((f) => ({ ...f, bank_amount: e.target.value, cash_amount: '' }))}
                  helperText="Type the amount — only this much is deducted from the bank account"
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />
              )}

              {clearForm.paymentMethod === 'PARTIAL' && (
                <Stack direction="row" spacing={1.5}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Cash amount (Rs)"
                    type="number"
                    value={clearForm.cash_amount}
                    onChange={(e) => setClearForm((f) => ({ ...f, cash_amount: e.target.value }))}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                  />
                  <TextField
                    fullWidth
                    size="small"
                    label="Bank amount (Rs)"
                    type="number"
                    value={clearForm.bank_amount}
                    onChange={(e) => setClearForm((f) => ({ ...f, bank_amount: e.target.value }))}
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                  />
                </Stack>
              )}

              {(() => {
                const payingNow = Math.round(
                  (parseFloat(clearForm.cash_amount || 0) + parseFloat(clearForm.bank_amount || 0)) * 100
                ) / 100;
                const due = clearancePreview.grandTotal;
                if (payingNow <= 0.009) return null;
                const partial = due - payingNow > 0.01;
                return (
                  <Box sx={{ p: 1.5, borderRadius: '10px', bgcolor: partial ? '#fffbeb' : '#ecfdf5', border: `1px solid ${partial ? '#fcd34d' : '#6ee7b7'}` }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: partial ? '#b45309' : '#047857' }}>
                      Paying now: {fmtAmt(payingNow)}
                      {partial ? ` · Remaining due: ${fmtAmt(due - payingNow)}` : payingNow + 0.01 < due ? '' : ' (full amount)'}
                    </Typography>
                  </Box>
                );
              })()}

              <TextField
                fullWidth size="small" label="Payment Reference (optional)"
                value={clearForm.payment_reference}
                onChange={(e) => setClearForm((f) => ({ ...f, payment_reference: e.target.value }))}
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
              />
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setClearConfirm(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!!clearingId}
            onClick={() => clearConfirm && handleClearance(clearConfirm)}
            startIcon={clearingId ? <CircularProgress size={16} color="inherit" /> : <CheckCircle />}
            sx={{ bgcolor: '#059669', fontWeight: 700, textTransform: 'none', borderRadius: '10px', '&:hover': { bgcolor: '#047857' } }}
          >
            Confirm Clearance
          </Button>
        </DialogActions>
      </Dialog>

      {/* Salary receipt preview */}
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
                {PAYSLIP_I18N.docTitleEn} (A5) · {PAYSLIP_I18N.docTitleUr}
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
              '&:hover': { bgcolor: '#1da851' },
            }}
          >
            {isSendingWhatsApp ? 'Sending…' : '📲 WhatsApp'}
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
