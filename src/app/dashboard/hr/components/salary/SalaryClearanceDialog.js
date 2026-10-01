'use client';

import {
  Dialog, DialogContent, DialogActions, Button, Box, Typography, Stack, CircularProgress, IconButton,
} from '@mui/material';
import { Close, CheckCircle } from '@mui/icons-material';
import SalaryClearanceSummaryCard from './SalaryClearanceSummaryCard';
import SalaryClearanceAdjustments from './SalaryClearanceAdjustments';
import SalaryClearancePaymentSection from './SalaryClearancePaymentSection';

export default function SalaryClearanceDialog({
  open,
  onClose,
  payroll,
  periodLabel,
  tabMonth,
  tabYear,
  clearancePreview,
  clearForm,
  setClearForm,
  clearingId,
  onConfirm,
  fmtAmt,
  cashAccountsList,
  bankAccountsList,
  onFillFullAmount,
}) {
  const emp = payroll?.employee;

  return (
    <Dialog
      open={open}
      onClose={() => !clearingId && onClose()}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: '24px', overflow: 'hidden' } }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, pt: 1.5, pb: 0 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a' }}>Pay salary</Typography>
          {emp?.emp_name && (
            <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>{emp.emp_name}</Typography>
          )}
        </Box>
        <IconButton onClick={onClose} disabled={!!clearingId} size="small" aria-label="Close">
          <Close fontSize="small" />
        </IconButton>
      </Stack>

      <DialogContent sx={{ px: 2.5, py: 2 }}>
        {payroll && clearancePreview ? (
          <Stack spacing={2}>
            <SalaryClearanceSummaryCard
              clearancePreview={clearancePreview}
              clearForm={clearForm}
              fmtAmt={fmtAmt}
              employeeName={emp?.emp_name || 'Employee'}
              periodLabel={periodLabel}
              payroll={payroll}
              month={payroll.month ?? tabMonth}
              year={payroll.year ?? tabYear}
            />
            <SalaryClearanceAdjustments clearForm={clearForm} setClearForm={setClearForm} />
            <SalaryClearancePaymentSection
              clearForm={clearForm}
              setClearForm={setClearForm}
              grandTotal={clearancePreview.grandTotal}
              fmtAmt={fmtAmt}
              cashAccountsList={cashAccountsList}
              bankAccountsList={bankAccountsList}
              onFillFullAmount={onFillFullAmount}
            />
          </Stack>
        ) : (
          <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={28} />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2.5, pb: 2.5, pt: 0, flexDirection: 'column', gap: 1 }}>
        <Button
          variant="contained"
          fullWidth
          disabled={!!clearingId || !payroll}
          onClick={() => payroll && onConfirm(payroll)}
          startIcon={clearingId ? <CircularProgress size={18} color="inherit" /> : <CheckCircle />}
          sx={{
            py: 1.35,
            bgcolor: '#059669',
            fontWeight: 800,
            textTransform: 'none',
            borderRadius: '14px',
            fontSize: '1rem',
            boxShadow: '0 4px 16px rgba(5,150,105,0.3)',
            '&:hover': { bgcolor: '#047857' },
          }}
        >
          {clearingId ? 'Please wait…' : 'Pay now'}
        </Button>
        <Button onClick={onClose} disabled={!!clearingId} fullWidth sx={{ textTransform: 'none', color: '#94a3b8' }}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
