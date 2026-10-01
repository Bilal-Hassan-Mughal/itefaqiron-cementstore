'use client';

import {
  Stack, ToggleButton, ToggleButtonGroup, TextField, Autocomplete, Typography, Button, Box,
} from '@mui/material';
import { HR_FIELD_SX } from '../shared/hrUiShared';

const fieldSx = { ...HR_FIELD_SX, width: '100%' };

const toggleSx = {
  '& .MuiToggleButton-root': {
    textTransform: 'none',
    fontWeight: 700,
    py: 1.1,
    borderRadius: '12px !important',
    border: '1px solid #e2e8f0 !important',
    mx: 0.25,
    flex: 1,
  },
};

export default function SalaryClearancePaymentSection({
  clearForm,
  setClearForm,
  grandTotal,
  fmtAmt,
  cashAccountsList,
  bankAccountsList,
  onFillFullAmount,
}) {
  const due = Math.max(0, parseFloat(grandTotal || 0));
  const cash = parseFloat(clearForm.cash_amount || 0) || 0;
  const bank = parseFloat(clearForm.bank_amount || 0) || 0;
  const paying = cash + bank;

  return (
    <Stack spacing={1.5}>
      <Box sx={{ p: 1.5, borderRadius: '12px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1}>
          <Box>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.06em' }}>
              TOTAL DUE NOW
            </Typography>
            <Typography sx={{ fontWeight: 900, fontSize: '1.25rem', color: '#047857' }}>{fmtAmt(due)}</Typography>
          </Box>
          {due > 0 && onFillFullAmount && (
            <Button
              size="small"
              variant="outlined"
              onClick={onFillFullAmount}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px' }}
            >
              Fill full due
            </Button>
          )}
        </Stack>
        <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 1 }}>
          Choose cash, bank, or split. Enter the amounts you pay — you can pay less than the full due if needed.
        </Typography>
      </Box>

      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={clearForm.paymentMethod}
        onChange={(_, val) => {
          if (!val) return;
          setClearForm((f) => ({
            ...f,
            paymentMethod: val,
            paid_from_account_id: val === 'BANK' ? '' : f.paid_from_account_id,
            bank_account_id: val === 'CASH' ? '' : f.bank_account_id,
            cash_amount: val === 'BANK' ? '' : f.cash_amount,
            bank_amount: val === 'CASH' ? '' : f.bank_amount,
          }));
        }}
        sx={toggleSx}
      >
        <ToggleButton value="CASH">Cash</ToggleButton>
        <ToggleButton value="BANK">Bank</ToggleButton>
        <ToggleButton value="PARTIAL">Split</ToggleButton>
      </ToggleButtonGroup>

      {(clearForm.paymentMethod === 'CASH' || clearForm.paymentMethod === 'PARTIAL') && (
        <Autocomplete
          options={cashAccountsList}
          getOptionLabel={(o) => o.cus_name || ''}
          isOptionEqualToValue={(a, b) => a?.cus_id === b?.cus_id}
          value={cashAccountsList.find((a) => String(a.cus_id) === clearForm.paid_from_account_id) || null}
          onChange={(_, val) => setClearForm((f) => ({ ...f, paid_from_account_id: val ? String(val.cus_id) : '' }))}
          renderInput={(params) => (
            <TextField {...params} label="Cash account" sx={fieldSx} />
          )}
        />
      )}

      {(clearForm.paymentMethod === 'BANK' || clearForm.paymentMethod === 'PARTIAL') && (
        <Autocomplete
          options={bankAccountsList}
          getOptionLabel={(o) => o.cus_name || ''}
          isOptionEqualToValue={(a, b) => a?.cus_id === b?.cus_id}
          value={bankAccountsList.find((a) => String(a.cus_id) === clearForm.bank_account_id) || null}
          onChange={(_, val) => setClearForm((f) => ({ ...f, bank_account_id: val ? String(val.cus_id) : '' }))}
          renderInput={(params) => (
            <TextField {...params} label="Bank account" sx={fieldSx} />
          )}
        />
      )}

      {clearForm.paymentMethod === 'CASH' && (
        <TextField
          fullWidth
          label="Cash amount (you pay)"
          type="number"
          placeholder={due > 0 ? String(due) : '0'}
          value={clearForm.cash_amount}
          onChange={(e) => setClearForm((f) => ({ ...f, cash_amount: e.target.value, bank_amount: '' }))}
          sx={fieldSx}
        />
      )}

      {clearForm.paymentMethod === 'BANK' && (
        <TextField
          fullWidth
          label="Bank amount (you pay)"
          type="number"
          placeholder={due > 0 ? String(due) : '0'}
          value={clearForm.bank_amount}
          onChange={(e) => setClearForm((f) => ({ ...f, bank_amount: e.target.value, cash_amount: '' }))}
          sx={fieldSx}
        />
      )}

      {clearForm.paymentMethod === 'PARTIAL' && (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1.5}>
            <TextField
              fullWidth
              label="Cash amount"
              type="number"
              value={clearForm.cash_amount}
              onChange={(e) => setClearForm((f) => ({ ...f, cash_amount: e.target.value }))}
              sx={fieldSx}
            />
            <TextField
              fullWidth
              label="Bank amount"
              type="number"
              value={clearForm.bank_amount}
              onChange={(e) => setClearForm((f) => ({ ...f, bank_amount: e.target.value }))}
              sx={fieldSx}
            />
          </Stack>
          {paying > 0 && (
            <Typography sx={{ fontSize: '0.75rem', color: paying > due + 0.01 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
              Paying now: {fmtAmt(paying)}
              {due > 0 && paying <= due + 0.01 ? ` · Remaining due: ${fmtAmt(Math.max(0, due - paying))}` : ''}
              {due > 0 && paying > due + 0.01 ? ` · Cannot exceed ${fmtAmt(due)}` : ''}
            </Typography>
          )}
        </Stack>
      )}

      {(clearForm.paymentMethod === 'CASH' || clearForm.paymentMethod === 'BANK') && paying > 0 && due > 0 && (
        <Typography sx={{ fontSize: '0.75rem', color: paying > due + 0.01 ? '#dc2626' : '#64748b', fontWeight: 600 }}>
          Paying now: {fmtAmt(paying)}
          {paying <= due + 0.01 ? ` · Remaining due: ${fmtAmt(Math.max(0, due - paying))}` : ` · Max ${fmtAmt(due)}`}
        </Typography>
      )}

      <TextField
        fullWidth
        label="Payment note (optional)"
        value={clearForm.payment_reference}
        onChange={(e) => setClearForm((f) => ({ ...f, payment_reference: e.target.value }))}
        sx={fieldSx}
      />
    </Stack>
  );
}
