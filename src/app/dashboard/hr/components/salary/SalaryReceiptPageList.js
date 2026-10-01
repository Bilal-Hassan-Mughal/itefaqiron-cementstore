'use client';

import {
  Box, Typography, Button, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Stack, CircularProgress, Chip,
} from '@mui/material';
import { ReceiptLong, Print } from '@mui/icons-material';
import { BRAND } from '@/lib/brand-theme';
import {
  resolveLedgerBalanceAfterClearance,
  resolveLedgerBalanceBeforeClearance,
  resolveMonthAttDedDisplay,
  resolveMonthGrossEarned,
  resolveMonthNetPay,
  resolveSalaryAdvanceApplied,
  resolveSignedLedgerBalance,
  resolveTotalPayable,
} from '@/lib/hr-payroll';

const NAVY = '#0f172a';
const PRIMARY = BRAND.primary.blue;

/** Same header style as SalaryTab salary sheet */
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

function fmtNum(v) {
  const n = parseFloat(v || 0);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 1 });
}

function fmtHrLedgerBalanceCell(row, signedOverride, fmtAmt, { afterClearance = false } = {}) {
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
        : 'Employee owes — recovered from salary up to earned amount',
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

function amountPaidCell(p, fmtAmt) {
  const snap = p.clearance_snapshot || {};
  const cash = parseFloat(p.cash_amount ?? snap.cash_amount ?? 0);
  const bank = parseFloat(p.bank_amount ?? snap.bank_amount ?? 0);
  const paid = parseFloat(p.amount_paid ?? snap.amount_paid ?? cash + bank);
  const due = resolveTotalPayable(p);
  const short = due - paid > 0.009;
  let method = '';
  if (cash > 0.009 && bank > 0.009) method = 'Cash + Bank';
  else if (bank > 0.009) method = 'Bank';
  else if (cash > 0.009) method = 'Cash';
  return { paid, due, short, method, text: paid > 0.009 ? fmtAmt(paid) : '—' };
}

export default function SalaryReceiptPageList({
  rows,
  month,
  year,
  fmtAmt,
  printingReceiptId,
  onOpenReceipt,
  onPrintOne,
  onWhatsApp,
  whatsAppBusyId,
}) {
  if (!rows?.length) return null;

  return (
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
            <TableCell sx={{ ...thSx, position: 'sticky', left: 0, zIndex: 4, minWidth: 168, boxShadow: '4px 0 10px rgba(0,0,0,0.1)' }}>
              Employee
            </TableCell>
            <TableCell align="right" sx={thSx}>Basic</TableCell>
            <TableCell align="center" sx={{ ...thSx, bgcolor: '#15803d' }}>Present</TableCell>
            <TableCell align="center" sx={{ ...thSx, bgcolor: '#ea580c' }}>Leave</TableCell>
            <TableCell align="center" sx={{ ...thSx, bgcolor: '#dc2626' }}>Absent</TableCell>
            <TableCell align="center" sx={{ ...thSx, bgcolor: '#ca8a04' }}>Half</TableCell>
            <TableCell align="right" sx={{ ...thSx, bgcolor: '#059669' }}>Earned</TableCell>
            <TableCell align="right" sx={{ ...thSx, bgcolor: '#dc2626' }}>Att Ded</TableCell>
            <TableCell align="right" sx={{ ...thSx, bgcolor: '#16a34a' }}>Bonus</TableCell>
            <TableCell align="right" sx={{ ...thSx, bgcolor: '#be123c' }}>Extra Ded</TableCell>
            <TableCell align="right" sx={{ ...thSx, bgcolor: '#7c3aed' }}>Prev Bal</TableCell>
            <TableCell align="right" sx={{ ...thSx, bgcolor: '#92400e' }}>Account balance</TableCell>
            <TableCell align="right" sx={{ ...thSx, bgcolor: '#b45309' }}>Adv Deducted</TableCell>
            <TableCell align="right" sx={{ ...thSx, bgcolor: '#ea580c' }}>Adv w/ Salary</TableCell>
            <TableCell align="right" sx={{ ...thSx, bgcolor: '#1e3a8a' }}>Net Pay</TableCell>
            <TableCell align="right" sx={{ ...thSx, bgcolor: '#0d9488' }}>Total Pay</TableCell>
            <TableCell align="right" sx={{ ...thSx, bgcolor: '#78350f' }}>Acct After</TableCell>
            <TableCell align="center" sx={{ ...thSx, minWidth: 88 }}>Paid On</TableCell>
            <TableCell align="right" sx={{ ...thSx, bgcolor: '#047857' }}>Amount Paid</TableCell>
            <TableCell align="center" sx={{ ...thSx, minWidth: 220 }}>Receipt</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((p, idx) => {
            const rowBg = idx % 2 === 0 ? '#fff' : '#f8fafc';
            const rowId = p.payroll_id ?? p.emp_id;
            const busy = printingReceiptId === rowId;
            const waBusy = whatsAppBusyId === rowId;
            const acctBefore = resolveLedgerBalanceBeforeClearance(p);
            const lbBefore = fmtHrLedgerBalanceCell(p, acctBefore, fmtAmt);
            const lbAfter = fmtHrLedgerBalanceCell(p, resolveLedgerBalanceAfterClearance(p), fmtAmt, { afterClearance: true });
            const att = resolveMonthAttDedDisplay(p, month, year);
            const paidCell = amountPaidCell(p, fmtAmt);
            const payDate = p.payment_date || p.clearance_snapshot?.cleared_at;

            return (
              <TableRow key={`rcpt-${rowId}`} hover sx={{ bgcolor: rowBg }}>
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
                  sx={{ borderBottom: '1px solid #eef2f6', fontWeight: 800, color: '#059669', fontSize: '0.875rem', bgcolor: 'rgba(5,150,105,0.05)' }}
                >
                  {fmtAmt(resolveMonthGrossEarned(p))}
                </TableCell>
                <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', color: '#dc2626', fontWeight: 600, fontSize: '0.8125rem' }}>
                  {att > 0.009 ? fmtAmt(att) : '—'}
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
                <TableCell
                  align="right"
                  title={lbBefore.title}
                  sx={{ borderBottom: '1px solid #eef2f6', color: lbBefore.color, fontWeight: 800, fontSize: '0.8125rem', fontFamily: 'monospace' }}
                >
                  {lbBefore.text}
                </TableCell>
                <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', color: '#b45309', fontWeight: 600, fontSize: '0.8125rem' }}>
                  {resolveSalaryAdvanceApplied(p) > 0.009 ? fmtAmt(resolveSalaryAdvanceApplied(p)) : '—'}
                </TableCell>
                <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', color: '#ea580c', fontWeight: 700, fontSize: '0.8125rem', bgcolor: 'rgba(234,88,12,0.05)' }}>
                  {parseFloat(p.advance_with_salary || 0) > 0 ? fmtAmt(p.advance_with_salary) : '—'}
                </TableCell>
                <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', fontWeight: 900, color: PRIMARY, fontSize: '0.875rem', bgcolor: 'rgba(26,85,227,0.06)' }}>
                  {fmtAmt(resolveMonthNetPay(p))}
                </TableCell>
                <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', fontWeight: 900, color: '#0d9488', fontSize: '0.875rem', bgcolor: 'rgba(13,148,136,0.06)' }}>
                  {fmtAmt(resolveTotalPayable(p))}
                  {parseFloat(p.ledger_payable_credit ?? p.clearance_snapshot?.ledger_payable_credit ?? 0) > 0.009 && (
                    <Typography component="span" sx={{ display: 'block', fontSize: '0.62rem', color: '#15803d', fontWeight: 700 }}>
                      incl. co. {fmtAmt(p.ledger_payable_credit ?? p.clearance_snapshot?.ledger_payable_credit)}
                    </Typography>
                  )}
                </TableCell>
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
                <TableCell align="center" sx={{ borderBottom: '1px solid #eef2f6', fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                  {payDate ? new Date(payDate).toLocaleDateString('en-GB') : '—'}
                </TableCell>
                <TableCell align="right" sx={{ borderBottom: '1px solid #eef2f6', bgcolor: 'rgba(4,120,87,0.06)' }}>
                  <Typography sx={{ fontWeight: 900, color: '#047857', fontSize: '0.8125rem' }}>{paidCell.text}</Typography>
                  {paidCell.method && (
                    <Typography sx={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 700 }}>{paidCell.method}</Typography>
                  )}
                  {paidCell.short && (
                    <Chip
                      size="small"
                      label={`Short ${fmtAmt(paidCell.due - paidCell.paid)}`}
                      sx={{ mt: 0.35, height: 20, fontSize: '0.6rem', fontWeight: 800, bgcolor: '#fef2f2', color: '#b91c1c' }}
                    />
                  )}
                </TableCell>
                <TableCell align="center" sx={{ borderBottom: '1px solid #eef2f6' }}>
                  <Stack direction="row" spacing={0.5} justifyContent="center" flexWrap="wrap" useFlexGap>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={busy}
                      onClick={() => onOpenReceipt(p)}
                      startIcon={busy ? <CircularProgress size={14} color="inherit" /> : <ReceiptLong sx={{ fontSize: 15 }} />}
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
                      View
                    </Button>
                    {onPrintOne && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => onPrintOne(p)}
                        startIcon={<Print sx={{ fontSize: 15 }} />}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          borderRadius: '8px',
                          fontSize: '0.68rem',
                          px: 1,
                          minWidth: 0,
                          borderColor: '#e2e8f0',
                          color: '#475569',
                        }}
                      >
                        Print
                      </Button>
                    )}
                    {onWhatsApp && (
                      <Button
                        size="small"
                        variant="outlined"
                        disabled={waBusy}
                        onClick={() => onWhatsApp(p)}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 700,
                          borderRadius: '8px',
                          fontSize: '0.68rem',
                          px: 1,
                          minWidth: 0,
                          borderColor: '#86efac',
                          color: '#15803d',
                          bgcolor: '#f0fdf4',
                        }}
                      >
                        {waBusy ? '…' : 'WA'}
                      </Button>
                    )}
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
