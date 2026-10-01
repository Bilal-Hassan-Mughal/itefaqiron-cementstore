'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Stack, IconButton, Button, Card, CircularProgress, Chip,
} from '@mui/material';
import {
  ChevronLeft, ChevronRight, Today as TodayIcon, CheckCircle, ReceiptLong, Undo, Payments,
} from '@mui/icons-material';
import HrStatCard from '../shared/HrStatCard';
import EmployeeSalaryMonthBreakdown from './EmployeeSalaryMonthBreakdown';

const NAVY = '#0f172a';
const PRIMARY = '#1A55E3';

function MonthToolbar({ monthLabel, onPrev, onNext, onThisMonth, pendingCount, paidCount }) {
  return (
    <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2, bgcolor: '#fff', borderRadius: '16px', border: '1px solid #e8edf4' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={2}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <IconButton
            size="small"
            onClick={onPrev}
            sx={{ border: '1px solid #e2e8f0', borderRadius: '12px', bgcolor: '#fafbfd', width: 40, height: 40 }}
          >
            <ChevronLeft fontSize="small" />
          </IconButton>
          <Typography sx={{ fontWeight: 900, fontSize: '1.125rem', color: NAVY, minWidth: 140, textAlign: 'center' }}>
            {monthLabel}
          </Typography>
          <IconButton
            size="small"
            onClick={onNext}
            sx={{ border: '1px solid #e2e8f0', borderRadius: '12px', bgcolor: '#fafbfd', width: 40, height: 40 }}
          >
            <ChevronRight fontSize="small" />
          </IconButton>
          <Button
            size="small"
            variant="text"
            startIcon={<TodayIcon sx={{ fontSize: 18 }} />}
            onClick={onThisMonth}
            sx={{ textTransform: 'none', fontWeight: 700, color: PRIMARY, borderRadius: '10px' }}
          >
            Today
          </Button>
        </Stack>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {pendingCount > 0 && (
            <Chip label={`${pendingCount} to pay`} size="small" sx={{ fontWeight: 700, bgcolor: '#fef3c7', color: '#b45309' }} />
          )}
          {paidCount > 0 && (
            <Chip label={`${paidCount} paid`} size="small" sx={{ fontWeight: 700, bgcolor: '#dcfce7', color: '#15803d' }} />
          )}
        </Stack>
      </Stack>
    </Box>
  );
}

function EmployeeListItem({ payroll, selected, amountDue, fmtAmt, onSelect }) {
  const paid = payroll.status === 'PAID';
  const name = payroll.employee?.emp_name || 'Employee';

  return (
    <Box
      component="button"
      type="button"
      onClick={() => onSelect(payroll.emp_id)}
      sx={{
        width: '100%',
        textAlign: 'left',
        cursor: 'pointer',
        border: selected ? '2px solid #059669' : '1px solid #e8edf4',
        borderRadius: '14px',
        p: 1.5,
        bgcolor: selected ? '#ecfdf5' : paid ? '#fafbfd' : '#fff',
        transition: 'all 0.15s ease',
        '&:hover': { borderColor: selected ? '#059669' : '#cbd5e1' },
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.9375rem', color: NAVY }} noWrap>
            {name}
          </Typography>
          {paid && (
            <Chip label="Paid" size="small" sx={{ height: 20, mt: 0.5, fontWeight: 700, fontSize: '0.6rem', bgcolor: '#dcfce7', color: '#15803d' }} />
          )}
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: '0.9375rem', color: '#0d9488', fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
          {fmtAmt(amountDue)}
        </Typography>
      </Stack>
    </Box>
  );
}

export default function SalaryClearancePanel({
  monthLabel,
  month,
  year,
  onPrevMonth,
  onNextMonth,
  onThisMonth,
  loading,
  pendingRows,
  paidRows,
  totalToPay,
  totalPaid,
  fmtAmt,
  getAmountDue,
  getPreview,
  onPay,
  onReceipt,
  onUndo,
  clearingEmpId,
  printingReceiptId,
  undoingPayrollId,
}) {
  const [selectedEmpId, setSelectedEmpId] = useState(null);

  const allRows = useMemo(() => [...pendingRows, ...paidRows], [pendingRows, paidRows]);

  useEffect(() => {
    if (!allRows.length) {
      setSelectedEmpId(null);
      return;
    }
    const stillThere = allRows.some((r) => r.emp_id === selectedEmpId);
    if (!stillThere) {
      setSelectedEmpId(pendingRows[0]?.emp_id ?? allRows[0]?.emp_id ?? null);
    }
  }, [allRows, pendingRows, selectedEmpId]);

  const selected = allRows.find((r) => r.emp_id === selectedEmpId) || null;
  const preview = selected ? getPreview(selected) : null;
  const pendingCount = pendingRows.length;
  const paidCount = paidRows.length;
  const empty = !loading && pendingCount === 0 && paidCount === 0;
  const paid = selected?.status === 'PAID';

  return (
    <Stack spacing={2} sx={{ pb: 2 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5}>
        <Box sx={{ flex: 1 }}>
          <HrStatCard label="To pay" value={fmtAmt(totalToPay)} color="#0d9488" icon={Payments} loading={loading} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <HrStatCard label="Paid this month" value={fmtAmt(totalPaid)} color="#059669" icon={CheckCircle} loading={loading} />
        </Box>
      </Stack>

      <MonthToolbar
        monthLabel={monthLabel}
        onPrev={onPrevMonth}
        onNext={onNextMonth}
        onThisMonth={onThisMonth}
        pendingCount={pendingCount}
        paidCount={paidCount}
      />

      {loading ? (
        <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
          <CircularProgress sx={{ color: PRIMARY }} />
        </Box>
      ) : empty ? (
        <Box sx={{ py: 8, textAlign: 'center', bgcolor: '#fff', borderRadius: '16px', border: '1px solid #e8edf4' }}>
          <Typography sx={{ fontWeight: 800, color: NAVY }}>No salaries for this month</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mt: 0.75 }}>Try another month or add employees.</Typography>
        </Box>
      ) : (
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems="stretch">
          <Box sx={{ width: { xs: '100%', lg: 280 }, flexShrink: 0 }}>
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', mb: 1, letterSpacing: '0.04em' }}>
              EMPLOYEES
            </Typography>
            <Stack spacing={1} sx={{ maxHeight: { lg: 520 }, overflowY: 'auto', pr: 0.5 }}>
              {pendingRows.map((p) => (
                <EmployeeListItem
                  key={`sel-${p.emp_id}`}
                  payroll={p}
                  selected={selectedEmpId === p.emp_id}
                  amountDue={getAmountDue(p)}
                  fmtAmt={fmtAmt}
                  onSelect={setSelectedEmpId}
                />
              ))}
              {paidCount > 0 && pendingCount > 0 && (
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#cbd5e1', pt: 1 }}>PAID</Typography>
              )}
              {paidRows.map((p) => (
                <EmployeeListItem
                  key={`sel-paid-${p.emp_id}`}
                  payroll={p}
                  selected={selectedEmpId === p.emp_id}
                  amountDue={getAmountDue(p)}
                  fmtAmt={fmtAmt}
                  onSelect={setSelectedEmpId}
                />
              ))}
            </Stack>
          </Box>

          <Card
            elevation={0}
            sx={{
              flex: 1,
              borderRadius: '20px',
              border: '1px solid #e8edf4',
              p: { xs: 2, md: 2.5 },
              minHeight: 320,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <EmployeeSalaryMonthBreakdown
              payroll={selected}
              preview={preview}
              clearForm={{}}
              month={month}
              year={year}
              fmtAmt={fmtAmt}
              periodLabel={monthLabel}
            />

            {selected && (
              <Stack direction="row" spacing={1.5} sx={{ mt: 'auto', pt: 3 }} flexWrap="wrap" useFlexGap>
                {paid ? (
                  <>
                    <Button
                      variant="contained"
                      disabled={printingReceiptId === (selected.payroll_id ?? selected.emp_id)}
                      onClick={() => onReceipt(selected)}
                      startIcon={
                        printingReceiptId === (selected.payroll_id ?? selected.emp_id)
                          ? <CircularProgress size={18} color="inherit" />
                          : <ReceiptLong />
                      }
                      sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '12px', bgcolor: PRIMARY }}
                    >
                      Receipt
                    </Button>
                    <Button
                      variant="outlined"
                      disabled={undoingPayrollId === selected.payroll_id}
                      onClick={() => onUndo(selected)}
                      startIcon={undoingPayrollId === selected.payroll_id ? <CircularProgress size={18} /> : <Undo />}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '12px', color: '#dc2626', borderColor: '#fecaca' }}
                    >
                      Undo
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="contained"
                    size="large"
                    disabled={clearingEmpId === selected.emp_id}
                    onClick={() => onPay(selected)}
                    startIcon={clearingEmpId === selected.emp_id ? <CircularProgress size={20} color="inherit" /> : <CheckCircle />}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 800,
                      borderRadius: '14px',
                      px: 4,
                      bgcolor: '#059669',
                      boxShadow: '0 4px 16px rgba(5,150,105,0.35)',
                      '&:hover': { bgcolor: '#047857' },
                    }}
                  >
                    Pay salary
                  </Button>
                )}
              </Stack>
            )}
          </Card>
        </Stack>
      )}
    </Stack>
  );
}
