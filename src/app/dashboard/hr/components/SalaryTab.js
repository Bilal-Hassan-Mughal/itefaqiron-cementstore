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
  Visibility, Download, ReceiptLong, Close,
} from '@mui/icons-material';
import { BRAND, COMPANY } from '@/lib/brand-theme';
import { calcPayroll, calcTotalPayable, getDaysInMonth, getMonthDayMeta, resolveMonthGrossEarned, toDateKey } from '@/lib/hr-payroll';

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

/** A4 portrait: 210 x 297 mm, same layout for preview, print and PDF */
const PAYSLIP_PAGE = { w: '210mm', h: '297mm', pad: '10mm 12mm 16mm 12mm' };

const PAYSLIP_STYLES = `
  .salary-payslip-sheet {
    width: ${PAYSLIP_PAGE.w};
    height: ${PAYSLIP_PAGE.h};
    max-height: ${PAYSLIP_PAGE.h};
    margin: 0 auto;
    background: #fff;
    overflow: hidden;
    box-shadow: 0 2px 16px rgba(15, 23, 42, 0.08);
    page-break-after: avoid;
    page-break-inside: avoid;
  }
  .salary-payslip-root * { box-sizing: border-box; }
  .salary-payslip-root {
    font-family: 'Segoe UI', system-ui, Arial, sans-serif;
    width: 100%;
    height: 100%;
    padding: ${PAYSLIP_PAGE.pad};
    color: #1e293b;
    background: #fff;
    font-size: 9pt;
    line-height: 1.45;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .salary-payslip-root .inv-accent {
    height: 4px;
    background: linear-gradient(90deg, #1A55E3 0%, #3b82f6 100%);
    border-radius: 2px;
    flex-shrink: 0;
  }
  .salary-payslip-root .inv-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 14px;
    padding-bottom: 10px;
    border-bottom: 1px solid #e2e8f0;
    flex-shrink: 0;
  }
  .salary-payslip-root .inv-top h1 {
    font-size: 15pt; margin: 0 0 4px; font-weight: 800; line-height: 1.2; color: #0f172a;
  }
  .salary-payslip-root .inv-top .co-sub {
    color: #64748b; font-size: 8pt; line-height: 1.4; max-width: 98mm;
  }
  .salary-payslip-root .inv-top .co-phone {
    color: #475569; font-size: 8pt; margin-top: 3px; font-weight: 600;
  }
  .salary-payslip-root .inv-title-box {
    text-align: right; flex-shrink: 0;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 8px 12px;
    min-width: 52mm;
  }
  .salary-payslip-root .inv-title-box .doc-title {
    font-size: 10pt; font-weight: 800; letter-spacing: 0.04em; color: #1A55E3;
    text-transform: uppercase; margin-bottom: 6px;
  }
  .salary-payslip-root .inv-title-box .doc-meta {
    font-size: 8pt; color: #64748b; line-height: 1.55;
  }
  .salary-payslip-root .inv-title-box .doc-meta strong { color: #0f172a; font-weight: 700; }
  .salary-payslip-root .badge-paid {
    display: inline-block; background: #dcfce7; color: #166534;
    font-size: 7pt; font-weight: 700; padding: 2px 8px; border-radius: 999px;
    margin-top: 4px; letter-spacing: 0.03em;
  }
  .salary-payslip-root .emp-bar {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    flex-shrink: 0;
  }
  .salary-payslip-root .emp-bar .lbl {
    font-size: 7pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: #94a3b8; margin-bottom: 2px;
  }
  .salary-payslip-root .emp-bar .name { font-size: 11pt; font-weight: 800; color: #0f172a; }
  .salary-payslip-root .emp-bar .sub { font-size: 8pt; color: #64748b; font-weight: 500; margin-top: 2px; }
  .salary-payslip-root .emp-meta {
    display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end;
  }
  .salary-payslip-root .emp-meta span {
    font-size: 7.5pt; font-weight: 600; padding: 4px 8px; border-radius: 6px;
    background: #fff; color: #334155; border: 1px solid #e2e8f0; white-space: nowrap;
  }
  .salary-payslip-root .inv-body {
    display: grid; grid-template-columns: 1.05fr 0.95fr; gap: 10px;
    flex: 1; min-height: 0; align-items: stretch;
  }
  .salary-payslip-root .inv-left, .salary-payslip-root .inv-right {
    display: flex; flex-direction: column; gap: 8px; min-height: 0;
  }
  .salary-payslip-root .inv-panel {
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
  }
  .salary-payslip-root .panel-head {
    font-size: 8pt; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase;
    color: #334155; padding: 6px 10px; background: #f1f5f9;
    border-bottom: 1px solid #e2e8f0;
  }
  .salary-payslip-root .inv-table {
    width: 100%; border-collapse: collapse;
  }
  .salary-payslip-root .inv-table th {
    background: #fafbfd; color: #64748b; font-size: 7pt; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.04em; padding: 6px 10px;
    border-bottom: 1px solid #e2e8f0; text-align: left;
  }
  .salary-payslip-root .inv-table th.amt { text-align: right; width: 78px; }
  .salary-payslip-root .inv-table td {
    padding: 5px 10px; border-bottom: 1px solid #f1f5f9; font-size: 8.5pt; vertical-align: top;
  }
  .salary-payslip-root .inv-table tr:nth-child(even) td { background: #fafbfd; }
  .salary-payslip-root .inv-table td .detail {
    color: #64748b; font-size: 7pt; line-height: 1.4; font-weight: 400; margin-top: 1px;
  }
  .salary-payslip-root .inv-table td.amt {
    text-align: right; font-weight: 700; white-space: nowrap; font-size: 8.5pt; color: #0f172a;
  }
  .salary-payslip-root .inv-table tr:last-child td { border-bottom: none; }
  .salary-payslip-root .inv-table .earn-amt { color: #059669; }
  .salary-payslip-root .inv-table .ded-amt { color: #dc2626; }
  .salary-payslip-root .inv-table tr.net-row td {
    background: #eff6ff; font-weight: 800; font-size: 9pt;
    border-top: 2px solid #bfdbfe; border-bottom: none;
  }
  .salary-payslip-root .inv-table tr.net-row td.amt { color: #1A55E3; }
  .salary-payslip-root .inv-table tr.total-row td {
    background: #ecfdf5; font-weight: 800; font-size: 9pt;
    border-top: 2px solid #86efac;
  }
  .salary-payslip-root .inv-table tr.total-row td.amt { color: #059669; font-size: 10pt; }
  .salary-payslip-root .inv-table tr.prev-row td.amt { color: #7c3aed; }
  .salary-payslip-root .inv-table tr.advws-row td.amt { color: #ea580c; }
  .salary-payslip-root .pay-strip {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; padding: 8px;
  }
  .salary-payslip-root .pay-box {
    border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 8px; background: #fafbfd;
  }
  .salary-payslip-root .pay-box .pl {
    font-size: 7pt; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em;
  }
  .salary-payslip-root .pay-box .pv {
    font-size: 9pt; font-weight: 700; color: #0f172a; margin-top: 3px;
  }
  .salary-payslip-root .pay-total-bar {
    display: flex; justify-content: space-between; align-items: center;
    margin: 0 8px 8px; padding: 10px 12px;
    background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
    border: 1px solid #86efac; border-radius: 8px;
    flex-shrink: 0;
  }
  .salary-payslip-root .pay-total-bar .pl {
    font-size: 8pt; font-weight: 800; color: #065f46; text-transform: uppercase; letter-spacing: 0.03em;
  }
  .salary-payslip-root .pay-total-bar .pv { font-size: 13pt; font-weight: 800; color: #059669; }
  .salary-payslip-root .pay-total-bar .sub {
    font-size: 7pt; color: #047857; font-weight: 500; margin-top: 2px;
  }
  .salary-payslip-root .att-meta-line {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
    font-size: 7pt; color: #64748b; padding: 6px 8px; background: #fafbfd;
    border-bottom: 1px solid #e2e8f0;
  }
  .salary-payslip-root .att-meta-line span { font-weight: 500; }
  .salary-payslip-root .att-meta-line strong { color: #0f172a; font-weight: 700; }
  .salary-payslip-root .att-strip {
    display: grid; grid-template-columns: repeat(6, 1fr);
    border-bottom: 1px solid #e2e8f0;
  }
  .salary-payslip-root .att-cell {
    padding: 6px 2px; text-align: center; background: #fff; border-right: 1px solid #f1f5f9;
  }
  .salary-payslip-root .att-cell:last-child { border-right: none; }
  .salary-payslip-root .att-cell .n { font-size: 10pt; font-weight: 800; line-height: 1; color: #0f172a; }
  .salary-payslip-root .att-cell .l {
    font-size: 6pt; font-weight: 600; color: #94a3b8; text-transform: uppercase;
    margin-top: 3px; letter-spacing: 0.02em;
  }
  .salary-payslip-root .att-cell.green .n { color: #15803d; }
  .salary-payslip-root .att-cell.orange .n { color: #ea580c; }
  .salary-payslip-root .att-cell.red .n { color: #dc2626; }
  .salary-payslip-root .att-cell.amber .n { color: #ca8a04; }
  .salary-payslip-root .att-month-cal {
    border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;
    flex: 1; display: flex; flex-direction: column; min-height: 0; background: #fff;
  }
  .salary-payslip-root .att-cal-legend {
    display: flex; flex-wrap: wrap; gap: 4px 10px; padding: 4px 8px;
    background: #fafbfd; border-bottom: 1px solid #e2e8f0;
    font-size: 6.5pt; font-weight: 600; color: #64748b;
  }
  .salary-payslip-root .att-cal-legend span { display: inline-flex; align-items: center; gap: 4px; }
  .salary-payslip-root .att-cal-legend .dot {
    width: 8px; height: 8px; border-radius: 2px; display: inline-block; flex-shrink: 0;
  }
  .salary-payslip-root .att-cal-weekdays {
    display: grid; grid-template-columns: repeat(7, 1fr); background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }
  .salary-payslip-root .att-cal-weekdays div {
    text-align: center; font-size: 6.5pt; font-weight: 700; color: #94a3b8;
    padding: 3px 0; text-transform: uppercase;
  }
  .salary-payslip-root .att-cal-grid {
    display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px;
    background: #f1f5f9; flex: 1;
  }
  .salary-payslip-root .att-cal-pad { background: #fafafa; min-height: 17px; }
  .salary-payslip-root .att-cal-day {
    background: #fff; min-height: 17px; padding: 2px 1px; text-align: center;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  .salary-payslip-root .att-cal-day .d { font-size: 5.5pt; font-weight: 600; color: #cbd5e1; line-height: 1; }
  .salary-payslip-root .att-cal-day .s {
    font-size: 6pt; font-weight: 700; line-height: 1; padding: 1px 3px; border-radius: 2px; min-width: 11px;
  }
  .salary-payslip-root .att-cal-day.muted { background: #fafafa; }
  .salary-payslip-root .att-cal-day.muted .d { color: #e2e8f0; }
  .salary-payslip-root .att-cal-day.st-PRESENT .s { color: #15803d; background: #dcfce7; }
  .salary-payslip-root .att-cal-day.st-ABSENT .s { color: #dc2626; background: #fee2e2; }
  .salary-payslip-root .att-cal-day.st-LEAVE .s { color: #ea580c; background: #ffedd5; }
  .salary-payslip-root .att-cal-day.st-HALF_DAY .s { color: #ca8a04; background: #fef9c3; }
  .salary-payslip-root .att-cal-day.st-HOLIDAY .s { color: #475569; background: #e2e8f0; font-size: 5pt; }
  .salary-payslip-root .att-cal-day.st-UNMARKED .s { color: #94a3b8; background: #f8fafc; font-weight: 600; }
  .salary-payslip-root .dot.st-PRESENT { background: #86efac; }
  .salary-payslip-root .dot.st-ABSENT { background: #fca5a5; }
  .salary-payslip-root .dot.st-LEAVE { background: #fdba74; }
  .salary-payslip-root .dot.st-HALF_DAY { background: #fde047; }
  .salary-payslip-root .dot.st-HOLIDAY { background: #cbd5e1; }
  .salary-payslip-root .dot.st-UNMARKED { background: #e2e8f0; }
  .salary-payslip-root .inv-footer {
    flex-shrink: 0; margin-top: auto; padding-top: 8px;
  }
  .salary-payslip-root .sign {
    display: flex; justify-content: space-between; gap: 20px;
    font-size: 8pt; color: #64748b; margin-bottom: 6px;
  }
  .salary-payslip-root .sign span {
    flex: 1; border-top: 1px solid #cbd5e1; padding-top: 6px;
    text-align: center; font-weight: 600;
  }
  .salary-payslip-root .foot {
    font-size: 7pt; color: #94a3b8; text-align: center; margin: 0; padding-top: 2px;
  }
`;

const PAYSLIP_PRINT_STYLES = `
  @page { size: A4 portrait; margin: 0; }
  @media print {
    html, body {
      margin: 0 !important; padding: 0 !important; width: ${PAYSLIP_PAGE.w} !important;
      height: ${PAYSLIP_PAGE.h} !important; background: #fff !important;
      -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
    }
    .salary-payslip-sheet {
      width: ${PAYSLIP_PAGE.w} !important; height: ${PAYSLIP_PAGE.h} !important;
      max-height: ${PAYSLIP_PAGE.h} !important; margin: 0 !important;
      box-shadow: none !important; page-break-after: avoid !important; page-break-inside: avoid !important;
    }
  }
`;

function getPayslipStylesheet() {
  return `${PAYSLIP_STYLES}${PAYSLIP_PRINT_STYLES}`;
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
  const monthNet = parseFloat(payroll.month_net ?? payroll.net_salary ?? 0);
  const prevBal = parseFloat(payroll.previous_balance ?? payroll.previous_balance_paid ?? 0);
  const advanceWithSalary = parseFloat(payroll.advance_with_salary || 0);
  const totalPaid = parseFloat(payroll.total_payable ?? monthNet + prevBal + advanceWithSalary);
  const payDate = payroll.payment_date || payroll.cleared_at;
  const receiptNo = payroll.payroll_id ? `SR-${String(payroll.payroll_id).padStart(5, '0')}` : '-';
  const dailyRate = parseFloat(payroll.daily_rate ?? payroll.deduction_per_day ?? 0);
  const paidDays = parseFloat(payroll.paid_days ?? payroll.days_present ?? 0);
  const attDed = parseFloat(payroll.total_deduction || 0);
  const otherDed = parseFloat(payroll.other_deduction || 0);
  const bonus = parseFloat(payroll.bonus || 0);
  const cashPaid = parseFloat(payroll.cash_amount || 0);
  const bankPaid = parseFloat(payroll.bank_amount || 0);
  const paymentMethod = payroll.payment_method || (cashPaid > 0 && bankPaid > 0 ? 'PARTIAL' : bankPaid > 0 ? 'BANK' : 'CASH');
  const phones = (COMPANY.phones || []).join(', ');
  const attendancePay = Math.round(paidDays * dailyRate * 100) / 100;
  const grossEarned = resolveMonthGrossEarned(payroll);

  const deductedAdvances = Array.isArray(payroll.deducted_advances) ? payroll.deducted_advances : [];
  const advanceDedTotal = deductedAdvances.length > 0
    ? deductedAdvances.reduce((s, a) => s + parseFloat(a.amount || 0), 0)
    : parseFloat(payroll.advance_deduction || payroll.advance_this_month || 0);

  const excessLeave = parseFloat(payroll.excess_leaves || 0);
  const excessAbsent = parseFloat(payroll.excess_absents || 0);
  const advanceWithSalaryDate = payroll.advance_with_salary_date || payDate;

  const prevPeriod = payroll.prev_month && payroll.prev_year
    ? `${MONTHS[parseInt(payroll.prev_month, 10) - 1] || '-'} ${payroll.prev_year}`
    : null;

  const br = (label, detail, amount, cls = '', rowCls = '') =>
    `<tr class="${rowCls}">
      <td><strong>${label}</strong>${detail ? `<br><span class="detail">${detail}</span>` : ''}</td>
      <td class="amt ${cls}">${amount}</td>
    </tr>`;

  let breakdownRows = '';
  breakdownRows += br(
    'Attendance Salary',
    `${escapeHtml(period)}. ${fmtNum(paidDays)} days paid at ${fmtAmt(dailyRate)}/day. Basic ${fmtAmt(payroll.basic_salary)}`,
    fmtAmt(attendancePay),
    'earn-amt'
  );
  if (bonus > 0) {
    breakdownRows += br('Bonus / Incentive', 'Added at salary clearance', fmtAdd(bonus), 'earn-amt');
  }
  if (attDed > 0) {
    const attParts = [];
    if (excessLeave > 0) attParts.push(`${fmtNum(excessLeave)} excess leave`);
    if (excessAbsent > 0) attParts.push(`${fmtNum(excessAbsent)} excess absent`);
    breakdownRows += br(
      'Attendance Deduction',
      `${attParts.join(', ') || 'Unpaid days'} at ${fmtAmt(dailyRate)}/day`,
      fmtDed(attDed),
      'ded-amt'
    );
  }
  if (otherDed > 0) {
    breakdownRows += br(
      'Extra Deduction',
      payroll.deduction_reason ? escapeHtml(payroll.deduction_reason) : 'Deduction at clearance',
      fmtDed(otherDed),
      'ded-amt'
    );
  }
  if (deductedAdvances.length > 0) {
    deductedAdvances.forEach((a) => {
      breakdownRows += br(
        'Advance Deducted',
        `Taken ${fmtDate(a.advance_date)}${a.reason ? `. ${escapeHtml(a.reason)}` : ''}`,
        fmtDed(a.amount),
        'ded-amt'
      );
    });
  } else if (advanceDedTotal > 0) {
    breakdownRows += br(
      'Advance Deducted',
      'Pending advance recovered from this month salary',
      fmtDed(advanceDedTotal),
      'ded-amt'
    );
  }

  breakdownRows += br(
    'Net Pay (This Month)',
    `Earned ${fmtAmt(attendancePay)}${bonus > 0 ? `, Bonus ${fmtAmt(bonus)}` : ''}${attDed > 0 ? `, Att Ded ${fmtAmt(attDed)}` : ''}${otherDed > 0 ? `, Extra Ded ${fmtAmt(otherDed)}` : ''}${advanceDedTotal > 0 ? `, Adv Ded ${fmtAmt(advanceDedTotal)}` : ''}`,
    fmtAmt(monthNet),
    '',
    'net-row'
  );

  if (prevBal > 0) {
    breakdownRows += br(
      'Previous Month Balance',
      prevPeriod
        ? `Unpaid salary from ${escapeHtml(prevPeriod)}, paid with this clearance`
        : 'Unpaid salary from previous month, paid with this clearance',
      fmtAmt(prevBal),
      'prev-row',
      'prev-row'
    );
  }

  if (advanceWithSalary > 0) {
    breakdownRows += br(
      'Advance Paid With Salary',
      `Given ${fmtDate(advanceWithSalaryDate)}${payroll.advance_reason ? `. ${escapeHtml(payroll.advance_reason)}` : ''}. Recovered next month`,
      fmtAmt(advanceWithSalary),
      'advws-row',
      'advws-row'
    );
  }

  breakdownRows += br(
    'Total Paid to Employee',
    `Net pay${prevBal > 0 ? ', previous balance' : ''}${advanceWithSalary > 0 ? ', advance with salary' : ''}. Cash/bank at clearance`,
    fmtAmt(totalPaid),
    '',
    'total-row'
  );

  const attSidebar = `
    <div class="att-month-cal">
      <div class="panel-head">Attendance - ${escapeHtml(period)}</div>
      <div class="att-meta-line">
        <span>Days: <strong>${totalDaysInMonth}</strong></span>
        <span>Work: <strong>${payroll.total_days ?? '-'}</strong></span>
        <span>Rate: <strong>${fmtAmt(dailyRate)}</strong></span>
        <span>Paid: <strong>${fmtNum(paidDays)}</strong></span>
        <span>Allow L/A: <strong>${payroll.allowed_leaves ?? 0}/${payroll.allowed_absents ?? 0}</strong></span>
        <span>Gross: <strong>${fmtAmt(grossEarned)}</strong></span>
      </div>
      <div class="att-strip">
        <div class="att-cell green"><div class="n">${fmtNum(payroll.days_present ?? payroll.present_days)}</div><div class="l">Present</div></div>
        <div class="att-cell orange"><div class="n">${fmtNum(payroll.leaves_taken ?? payroll.leave_days)}</div><div class="l">Leave</div></div>
        <div class="att-cell red"><div class="n">${fmtNum(payroll.absent_days ?? payroll.absents_taken)}</div><div class="l">Absent</div></div>
        <div class="att-cell amber"><div class="n">${payroll.half_days ?? 0}</div><div class="l">Half</div></div>
        <div class="att-cell"><div class="n">${fmtNum(paidDays)}</div><div class="l">Paid</div></div>
        <div class="att-cell"><div class="n">${fmtNum(excessLeave + excessAbsent)}</div><div class="l">Excess</div></div>
      </div>
      ${buildMonthAttendanceGridHtml(
        payroll.month,
        payroll.year,
        payroll.attendance_by_day || {},
        payroll.employee_join_date || payroll.employee?.join_date,
        true
      )}
    </div>`;

  const dash = '-';
  const empDept = emp.department ? `, ${escapeHtml(emp.department)}` : '';

  return `<div class="salary-payslip-sheet"><div class="salary-payslip-root" id="salary-payslip-preview">
  <div class="inv-accent"></div>
  <div class="inv-top">
    <div>
      <h1>${escapeHtml(COMPANY.name || 'Itefaq Iron & Cement Store')}</h1>
      <div class="co-sub">${escapeHtml(COMPANY.address || '')}</div>
      ${phones ? `<div class="co-phone">Phone: ${escapeHtml(phones)}</div>` : ''}
    </div>
    <div class="inv-title-box">
      <div class="doc-title">Salary Receipt</div>
      <div class="doc-meta">
        Receipt No: <strong>${receiptNo}</strong><br>
        Payment Date: <strong>${fmtDate(payDate)}</strong><br>
        Salary Period: <strong>${escapeHtml(period)}</strong><br>
        Status: <span class="badge-paid">${payroll.status || 'PAID'}</span>
      </div>
    </div>
  </div>

  <div class="emp-bar">
    <div>
      <div class="lbl">Employee Details</div>
      <div class="name">${escapeHtml(emp.emp_name || dash)}</div>
      <div class="sub">${escapeHtml(emp.designation || dash)}${empDept}</div>
    </div>
    <div class="emp-meta">
      <span>Basic ${fmtAmt(payroll.basic_salary)}</span>
      <span>Daily Rate ${fmtAmt(dailyRate)}</span>
    </div>
  </div>

  <div class="inv-body">
    <div class="inv-left">
      <div class="inv-panel">
        <div class="panel-head">Salary Breakdown</div>
        <table class="inv-table">
          <thead><tr><th>Description</th><th class="amt">Amount (Rs)</th></tr></thead>
          <tbody>${breakdownRows}</tbody>
        </table>
      </div>
      <div class="inv-panel">
        <div class="panel-head">Payment Details</div>
        <div class="pay-strip">
          <div class="pay-box"><div class="pl">Cash Paid</div><div class="pv">${cashPaid > 0 ? fmtAmt(cashPaid) : dash}</div></div>
          <div class="pay-box"><div class="pl">Bank Paid</div><div class="pv">${bankPaid > 0 ? fmtAmt(bankPaid) : dash}</div></div>
          <div class="pay-box"><div class="pl">Payment Method</div><div class="pv">${paymentMethod}</div></div>
          <div class="pay-box"><div class="pl">Reference</div><div class="pv">${payroll.payment_reference ? escapeHtml(payroll.payment_reference) : dash}</div></div>
        </div>
        <div class="pay-total-bar">
          <div>
            <div class="pl">Total Paid to Employee</div>
            <div class="sub">Net ${fmtAmt(monthNet)}${prevBal > 0 ? `, Prev ${fmtAmt(prevBal)}` : ''}${advanceWithSalary > 0 ? `, Adv ${fmtAmt(advanceWithSalary)}` : ''}</div>
          </div>
          <div class="pv">${fmtAmt(totalPaid)}</div>
        </div>
      </div>
    </div>
    <div class="inv-right">${attSidebar}</div>
  </div>

  <div class="inv-footer">
    <div class="sign">
      <span>Employee Signature</span>
      <span>Authorized Signature and Stamp</span>
    </div>
    <p class="foot">${escapeHtml(COMPANY.nameShort || 'Itefaq Iron Store')} | Salary Receipt | ${escapeHtml(period)} | Generated ${printed}</p>
  </div>
</div></div>`;
}

function buildPayslipHtml(payroll) {
  const emp = payroll.employee || {};
  return `<!DOCTYPE html><html><head><title>Salary Receipt - ${emp.emp_name || ''}</title>
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

async function downloadPayslipPdf(payroll) {
  const printable = document.getElementById('printable-salary-payslip');
  if (!printable) throw new Error('Print container not found');

  printable.innerHTML = `<style>${getPayslipStylesheet()}</style>${buildPayslipBody(payroll)}`;
  printable.style.display = 'block';
  printable.style.position = 'fixed';
  printable.style.left = '-10000px';
  printable.style.top = '0';
  printable.style.width = '210mm';
  printable.style.height = '297mm';
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

    const html2canvas = (await import('html2canvas')).default;
    const jsPDF = (await import('jspdf')).default;

    const canvas = await html2canvas(sheet, {
      scale: 2,
      backgroundColor: '#ffffff',
      logging: false,
      useCORS: true,
      scrollX: 0,
      scrollY: 0,
      width: sheet.scrollWidth,
      height: sheet.scrollHeight,
      windowWidth: sheet.scrollWidth,
      windowHeight: sheet.scrollHeight,
      foreignObjectRendering: false,
    });

    const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const pageW = 210;
    const pageH = 297;
    const imgData = canvas.toDataURL('image/png');
    let renderW = pageW;
    let renderH = (canvas.height * renderW) / canvas.width;
    if (renderH > pageH) {
      renderH = pageH;
      renderW = (canvas.width * renderH) / canvas.height;
    }
    const x = (pageW - renderW) / 2;
    const y = 0;
    doc.addImage(imgData, 'PNG', x, y, renderW, renderH);
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
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Salary Receipt</title>
<style>${getPayslipStylesheet()}</style></head>
<body style="margin:0;padding:0;background:#fff">${buildPayslipBody(payroll)}</body></html>`);
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
  return enrichPayrollWithAttendance(payroll).then((enriched) => openPayslipPrintWindow(enriched));
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
      <td class="ded">${fmtAmt(p.total_deduction)}</td>
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
    enrichPayrollWithAttendance(initialPayroll).then((data) => {
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
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          py: 2,
          px: 1,
          bgcolor: '#e2e8f0',
          borderRadius: '8px',
        }}
        dangerouslySetInnerHTML={{ __html: buildPayslipBody(payroll) }}
      />
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

  useEffect(() => {
    if (!isReceiptView) {
      fetch('/api/employees').then((r) => r.json()).then(setEmployees).catch(() => {});
      fetchAdvances();
    }
    if (isClearanceView) {
      fetch('/api/customers?dropdown=true')
        .then((r) => r.json())
        .then((data) => setPaymentAccounts(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
  }, [isReceiptView, isClearanceView]);

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

  const clearancePreview = useMemo(() => {
    if (!clearConfirm) return null;
    const derived = calcPayroll({
      basic_salary: clearConfirm.basic_salary,
      total_days: clearConfirm.total_days,
      salary_divisor_days: getDaysInMonth(month, year),
      days_present: clearConfirm.days_present,
      leaves_taken: clearConfirm.leaves_taken,
      absents_taken: clearConfirm.absents_taken,
      absent_days: clearConfirm.absent_days,
      allowed_leaves: clearConfirm.allowed_leaves,
      allowed_absents: clearConfirm.allowed_absents,
      advance_deduction: clearConfirm.advance_deduction,
      bonus: parseFloat(clearForm.bonus || 0),
      other_deduction: parseFloat(clearForm.extra_deduction || 0),
    });
    const prevBal = parseFloat(clearConfirm.previous_balance || 0);
    const advanceWithSalary = parseFloat(clearForm.advance_with_salary || 0);
    const salaryPayable = calcTotalPayable({ monthNet: derived.net_salary, previousBalance: prevBal });
    const grandTotal = calcTotalPayable({
      monthNet: derived.net_salary,
      previousBalance: prevBal,
      advanceWithSalary,
    });
    return { derived, prevBal, salaryPayable, advanceWithSalary, grandTotal };
  }, [clearConfirm, clearForm, month, year]);

  useEffect(() => {
    if (!clearConfirm || !clearancePreview) return;
    const total = clearancePreview.grandTotal;
    if (clearForm.paymentMethod === 'CASH') {
      setClearForm((f) => ({ ...f, cash_amount: total > 0 ? String(total) : '', bank_amount: '' }));
    } else if (clearForm.paymentMethod === 'BANK') {
      setClearForm((f) => ({ ...f, bank_amount: total > 0 ? String(total) : '', cash_amount: '' }));
    }
  }, [clearConfirm, clearancePreview?.grandTotal, clearForm.paymentMethod]);

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
  }, [fetchPayrolls]);

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
      const paidAmt = data.total_payable ?? payroll.total_payable ?? payroll.net_salary;
      showSnack(`Salary cleared: ${payroll.employee?.emp_name} — ${fmtAmt(paidAmt)}`);
      setClearConfirm(null);
      fetchPayrolls();
      fetchAdvances();
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
    setClearConfirm(payroll);
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
      fetchPayrolls();
      fetchAdvances();
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

  async function handlePrintPayslip() {
    if (!payslipPreview) return;
    const opened = await printPayslipFromPreview(payslipPreview);
    if (opened === false) showSnack('Allow pop-ups to print receipt', 'warning');
  }

  async function handleDownloadPayslipPdf() {
    if (!payslipPreview) return;
    setDownloadingPayslipPdf(true);
    try {
      const enriched = await enrichPayrollWithAttendance(payslipPreview);
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
    const enriched = await Promise.all(displayPayrolls.map((p) => enrichPayrollWithAttendance(p)));
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    const printExtra = `
      @page { size: A4 portrait; margin: 0; }
      html, body { margin: 0; padding: 0; background: #fff; }
      .salary-payslip-sheet { page-break-after: always; break-after: page; }
      .salary-payslip-sheet:last-child { page-break-after: auto; break-after: auto; }
    `;
    const pages = enriched.map((p) => buildPayslipBody(p)).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Salary Receipts</title>
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
    net: pendingPayrolls.reduce((s, p) => s + parseFloat(p.month_net ?? p.net_salary ?? 0), 0),
    basic: pendingPayrolls.reduce((s, p) => s + parseFloat(p.basic_salary || 0), 0),
    pending: pendingPayrolls.filter((p) => p.status === 'PENDING').reduce((s, p) => s + parseFloat(p.total_payable ?? p.net_salary ?? 0), 0),
    paid: displayPayrolls.filter((p) => p.status === 'PAID').reduce((s, p) => s + parseFloat(p.total_payable ?? p.net_salary ?? 0), 0),
    prevBalance: pendingPayrolls.reduce((s, p) => s + parseFloat(p.previous_balance || 0), 0),
    advanceDeducted: pendingPayrolls.reduce((s, p) => s + parseFloat(p.advance_this_month || p.advance_deduction || 0), 0),
    advanceWithSalary: displayPayrolls.reduce((s, p) => s + parseFloat(p.advance_with_salary || 0), 0),
    advanceThisMonth: pendingPayrolls.reduce((s, p) => s + parseFloat(p.advance_this_month || p.advance_deduction || 0), 0),
    bonusTotal: displayPayrolls.reduce((s, p) => s + parseFloat(p.bonus || 0), 0),
    extraDedTotal: displayPayrolls.reduce((s, p) => s + parseFloat(p.other_deduction || 0), 0),
    attDedTotal: displayPayrolls.reduce((s, p) => s + parseFloat(p.total_deduction || 0), 0),
    totalPayable: pendingPayrolls.reduce((s, p) => s + parseFloat(p.total_payable ?? p.net_salary ?? 0), 0),
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
                  ? 'Earned = attendance pay · Bonus / extra deduction set at Clear · Net Pay = earned + bonus − deductions − adv deducted · Total Pay = net + prev balance + adv with salary.'
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
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#dc2626' }} title="Attendance deduction (excess leave/absent)">
                          Att Ded
                        </TableCell>
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#16a34a' }} title="Bonus added at salary clearance">
                          Bonus
                        </TableCell>
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#be123c' }} title="Extra deduction at salary clearance">
                          Extra Ded
                        </TableCell>
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#7c3aed' }}>Prev Bal</TableCell>
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#b45309' }} title="Advance deducted from salary (taken earlier)">
                          Adv Deducted
                        </TableCell>
                        {(isClearanceView || isReceiptView) && (
                          <TableCell align="right" sx={{ ...thSx, bgcolor: '#ea580c' }} title="Extra advance paid with salary at clearance">
                            Adv w/ Salary
                          </TableCell>
                        )}
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#1e3a8a' }}>Net Pay</TableCell>
                        <TableCell align="right" sx={{ ...thSx, bgcolor: '#0d9488' }}>Total Pay</TableCell>
                        <TableCell align="center" sx={thSx}>Status</TableCell>
                        {isClearanceView && (
                          <TableCell align="center" sx={{ ...thSx, minWidth: 120 }}>Action</TableCell>
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
                            <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', fontWeight: 800, color: '#059669', fontSize: '0.875rem', bgcolor: 'rgba(5,150,105,0.05)' }}>
                              {fmtAmt(resolveMonthGrossEarned(p))}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', color: '#dc2626', fontWeight: 600, fontSize: '0.8125rem' }}>
                              {parseFloat(p.total_deduction || 0) > 0 ? fmtAmt(p.total_deduction) : '—'}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', color: '#16a34a', fontWeight: 700, fontSize: '0.8125rem', bgcolor: 'rgba(22,163,74,0.05)' }}>
                              {parseFloat(p.bonus || 0) > 0 ? fmtAmt(p.bonus) : '—'}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', color: '#be123c', fontWeight: 700, fontSize: '0.8125rem', bgcolor: 'rgba(190,18,60,0.05)' }}>
                              {parseFloat(p.other_deduction || 0) > 0 ? fmtAmt(p.other_deduction) : '—'}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', color: '#7c3aed', fontWeight: 700, fontSize: '0.8125rem' }}>
                              {parseFloat(p.previous_balance) > 0 ? fmtAmt(p.previous_balance) : '—'}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', color: '#b45309', fontWeight: 600, fontSize: '0.8125rem' }}>
                              {parseFloat(p.advance_this_month || p.advance_deduction) > 0 ? fmtAmt(p.advance_this_month || p.advance_deduction) : '—'}
                            </TableCell>
                            {(isClearanceView || isReceiptView) && (
                              <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', color: '#ea580c', fontWeight: 700, fontSize: '0.8125rem', bgcolor: 'rgba(234,88,12,0.05)' }}>
                                {parseFloat(p.advance_with_salary || 0) > 0 ? fmtAmt(p.advance_with_salary) : '—'}
                              </TableCell>
                            )}
                            <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', fontWeight: 900, color: PRIMARY, fontSize: '0.875rem', bgcolor: 'rgba(26,85,227,0.06)' }}>
                              {fmtAmt(p.month_net ?? p.net_salary)}
                            </TableCell>
                            <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', fontWeight: 900, color: '#0d9488', fontSize: '0.875rem', bgcolor: 'rgba(13,148,136,0.06)' }}>
                              {fmtAmt(p.total_payable ?? p.net_salary)}
                            </TableCell>
                            <TableCell align="center" sx={{ borderBottom: '1px solid #eef2f6' }}>
                              <StatusChip status={p.status} />
                            </TableCell>
                            {!isReceiptView && isClearanceView && (
                              <TableCell align="center" sx={{ borderBottom: '1px solid #eef2f6' }}>
                                {p.status === 'PAID' ? (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    disabled={undoingId === p.payroll_id}
                                    onClick={() => openUndoConfirm(p)}
                                    startIcon={undoingId === p.payroll_id ? <CircularProgress size={14} color="inherit" /> : <Undo sx={{ fontSize: 16 }} />}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 700,
                                      borderRadius: '8px',
                                      borderColor: '#fca5a5',
                                      color: '#dc2626',
                                      fontSize: '0.72rem',
                                      px: 1.5,
                                      '&:hover': { borderColor: '#dc2626', bgcolor: '#fef2f2' },
                                    }}
                                  >
                                    Undo
                                  </Button>
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
                                  variant="outlined"
                                  startIcon={<Visibility sx={{ fontSize: 16 }} />}
                                  onClick={() => openPayslipPreview(p)}
                                  sx={{
                                    textTransform: 'none',
                                    fontWeight: 700,
                                    borderRadius: '8px',
                                    fontSize: '0.72rem',
                                    borderColor: PRIMARY,
                                    color: PRIMARY,
                                    px: 1.25,
                                    '&:hover': { bgcolor: 'rgba(26,85,227,0.06)' },
                                  }}
                                >
                                  View
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
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>{clearConfirm.employee?.emp_name}</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {MONTHS[month - 1]} {year} · {clearConfirm.employee?.designation || 'Employee'}
                </Typography>
              </Box>

              <Box sx={{ bgcolor: '#f8fafc', borderRadius: '12px', p: 2, border: '1px solid #e8edf4' }}>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>Earned This Month</Typography>
                    <Typography sx={{ fontWeight: 800, color: '#059669' }}>
                      {fmtAmt(clearancePreview.derived.gross_earned ?? resolveMonthGrossEarned(clearConfirm))}
                    </Typography>
                  </Stack>
                  {parseFloat(clearForm.bonus || 0) > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>Bonus</Typography>
                      <Typography sx={{ fontWeight: 700, color: '#16a34a' }}>+ {fmtAmt(clearForm.bonus)}</Typography>
                    </Stack>
                  )}
                  {parseFloat(clearancePreview.derived.total_deduction || 0) > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>Attendance Deduction</Typography>
                      <Typography sx={{ fontWeight: 700, color: '#dc2626' }}>
                        − {fmtAmt(clearancePreview.derived.total_deduction)}
                      </Typography>
                    </Stack>
                  )}
                  {parseFloat(clearForm.extra_deduction || 0) > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>Extra Deduction</Typography>
                      <Typography sx={{ fontWeight: 700, color: '#be123c' }}>
                        − {fmtAmt(clearForm.extra_deduction)}
                      </Typography>
                    </Stack>
                  )}
                  {parseFloat(clearConfirm.advance_this_month || clearConfirm.advance_deduction || 0) > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>Advance Deducted</Typography>
                      <Typography sx={{ fontWeight: 700, color: '#b45309' }}>
                        − {fmtAmt(clearConfirm.advance_this_month || clearConfirm.advance_deduction)}
                      </Typography>
                    </Stack>
                  )}
                  <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.5, borderTop: '1px dashed #e2e8f0' }}>
                    <Typography sx={{ fontSize: '0.8125rem', fontWeight: 800, color: '#64748b' }}>Net Pay (This Month)</Typography>
                    <Typography sx={{ fontWeight: 900, color: PRIMARY }}>{fmtAmt(clearancePreview.derived.net_salary)}</Typography>
                  </Stack>
                  {clearancePreview.prevBal > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>Previous Balance</Typography>
                      <Typography sx={{ fontWeight: 800, color: '#7c3aed' }}>{fmtAmt(clearancePreview.prevBal)}</Typography>
                    </Stack>
                  )}
                  {clearancePreview.advanceWithSalary > 0 && (
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>Advance with salary</Typography>
                      <Typography sx={{ fontWeight: 700, color: '#ea580c' }}>{fmtAmt(clearancePreview.advanceWithSalary)}</Typography>
                    </Stack>
                  )}
                  <Stack direction="row" justifyContent="space-between" sx={{ pt: 1, borderTop: '1px dashed #e2e8f0' }}>
                    <Typography sx={{ fontWeight: 900 }}>Total Payable</Typography>
                    <Typography sx={{ fontWeight: 900, color: '#0d9488', fontSize: '1.1rem' }}>
                      {fmtAmt(clearancePreview.grandTotal)}
                    </Typography>
                  </Stack>
                </Stack>
              </Box>

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

              {clearForm.paymentMethod === 'PARTIAL' && (
                <Stack direction="row" spacing={1.5}>
                  <TextField
                    fullWidth size="small" label="Cash Amount" type="number"
                    value={clearForm.cash_amount}
                    onChange={(e) => setClearForm((f) => ({ ...f, cash_amount: e.target.value }))}
                  />
                  <TextField
                    fullWidth size="small" label="Bank Amount" type="number"
                    value={clearForm.bank_amount}
                    onChange={(e) => setClearForm((f) => ({ ...f, bank_amount: e.target.value }))}
                  />
                </Stack>
              )}

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
                Salary Payment Invoice
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
            Print
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
