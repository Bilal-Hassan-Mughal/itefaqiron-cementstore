'use client';

import { memo, useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  TextField,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  InputAdornment,
  Stack,
  Alert,
  FormControl,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';
import { buildFinancePaymentDescription, fmtAmt, numberToUrduWords } from '../payment-form-utils';

const EMPTY_FORM = {
  cash_amount: '',
  discount: '',
  bank_account: '',
  bank_amount: '',
  description: '',
};

function PaymentFormDialog({
  open,
  onClose,
  mode = 'RECEIVE',
  customer,
  currentBalance = 0,
  cashAccounts = [],
  bankAccounts = [],
  defaultCashAccountId = '',
  onSubmit,
  loading = false,
  ledgerSerial = 1,
  initialValues = null,
  editPaymentId = null,
  authOpen = false,
}) {
  const isReceive = mode === 'RECEIVE';
  const isEditing = Boolean(editPaymentId);
  const [form, setForm] = useState(EMPTY_FORM);
  const [descriptionTouched, setDescriptionTouched] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDescriptionTouched(Boolean(initialValues?.description));
    if (initialValues) {
      setForm({
        ...EMPTY_FORM,
        cash_account: initialValues.cash_account || defaultCashAccountId || '',
        cash_amount: initialValues.cash_amount ?? '',
        bank_account: initialValues.bank_account ?? '',
        bank_amount: initialValues.bank_amount ?? '',
        discount: initialValues.discount ?? '',
        description: initialValues.description ?? '',
      });
      return;
    }
    setForm({
      ...EMPTY_FORM,
      cash_account: defaultCashAccountId || '',
      description: buildFinancePaymentDescription(
        mode,
        customer?.cus_name || '',
        '',
        '',
        '',
        bankAccounts,
        ''
      ),
    });
  }, [open, mode, customer?.cus_id, customer?.cus_name, defaultCashAccountId, initialValues, editPaymentId]);

  const totalPreview = useMemo(
    () =>
      parseFloat(form.cash_amount || 0) +
      parseFloat(form.bank_amount || 0) +
      parseFloat(form.discount || 0),
    [form.cash_amount, form.bank_amount, form.discount]
  );

  const balanceAfter = useMemo(
    () => (isReceive ? currentBalance - totalPreview : currentBalance + totalPreview),
    [isReceive, currentBalance, totalPreview]
  );

  const urduWords = useMemo(() => numberToUrduWords(totalPreview), [totalPreview]);

  useEffect(() => {
    if (!open || descriptionTouched) return;
    const timer = setTimeout(() => {
      setForm((prev) => ({
        ...prev,
        description: buildFinancePaymentDescription(
          mode,
          customer?.cus_name || '',
          prev.cash_amount,
          prev.bank_amount,
          prev.bank_account,
          bankAccounts,
          prev.discount
        ),
      }));
    }, 200);
    return () => clearTimeout(timer);
  }, [
    open,
    descriptionTouched,
    mode,
    customer?.cus_name,
    form.cash_amount,
    form.bank_amount,
    form.bank_account,
    form.discount,
    bankAccounts,
  ]);

  const setField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleDescriptionChange = useCallback((value) => {
    setDescriptionTouched(true);
    setField('description', value);
  }, [setField]);

  const theme = isReceive
    ? {
        headerBg: '#10b981',
        accountBg: '#f0fdf4',
        accountBorder: '#bbf7d0',
        label: '#166534',
        name: '#14532d',
        balance: '#16a34a',
        wordsBg: '#f0fdf4',
        wordsBorder: '#bbf7d0',
        wordsColor: '#16a34a',
        btnBg: '#10b981',
        btnHover: '#059669',
        title: isEditing ? 'Edit Receipt Transaction' : 'Receive Amount Form',
        confirm: isEditing ? 'Update Receipt' : 'Confirm Receipt',
        afterLabel: 'After Receive Amount',
        afterHint: 'Receive Amount credits the selected account (balance decreases by the entered amount).',
      }
    : {
        headerBg: '#ef4444',
        accountBg: '#fef2f2',
        accountBorder: '#fecaca',
        label: '#991b1b',
        name: '#7f1d1d',
        balance: '#dc2626',
        wordsBg: '#fef2f2',
        wordsBorder: '#fecaca',
        wordsColor: '#dc2626',
        btnBg: '#ef4444',
        btnHover: '#dc2626',
        title: isEditing ? 'Edit Payment Transaction' : 'Pay Amount Form',
        confirm: isEditing ? 'Update Payment' : 'Confirm Payment',
        afterLabel: 'After Pay Amount',
        afterHint: 'Pay Amount debits the selected account (balance increases by the entered amount).',
      };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      disableEnforceFocus={authOpen}
      disableAutoFocus={authOpen}
      hideBackdrop={false}
      sx={{
        '& .MuiDialog-container': {
          justifyContent: 'center',
          alignItems: 'center',
        },
      }}
      PaperProps={{
        sx: {
          borderRadius: 2,
          maxWidth: 600,
          m: { xs: 1, md: 2 },
          ...(authOpen
            ? {
                position: 'absolute',
                left: { xs: 12, md: 'calc(50% - 8px)' },
                top: '50%',
                transform: { xs: 'none', md: 'translate(-100%, -50%)' },
                m: 0,
              }
            : {}),
        },
      }}
    >
      <DialogTitle
        component="div"
        sx={{
          bgcolor: theme.headerBg,
          color: 'white',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 3,
          py: 2,
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {theme.title}
        </Typography>
          <Typography
          variant="subtitle1"
          sx={{ fontWeight: 600, bgcolor: 'rgba(255,255,255,0.2)', px: 1.5, py: 0.5, borderRadius: 1 }}
        >
          {isEditing ? `PAY-${editPaymentId}` : `Serial: #${ledgerSerial}`}
        </Typography>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Box sx={{ p: 2, bgcolor: theme.accountBg, borderRadius: 2, border: `1px solid ${theme.accountBorder}` }}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ color: theme.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Selected Account
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 700, color: theme.name }}>
                  {customer?.cus_name || 'Individual Account'}
                </Typography>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" sx={{ color: theme.label, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Current Balance
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, color: theme.balance }}>
                  PKR {fmtAmt(currentBalance)}
                </Typography>
              </Grid>
            </Grid>
          </Box>

          {totalPreview > 0 && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              <strong>{theme.afterLabel}:</strong> account balance → PKR {fmtAmt(balanceAfter)}{' '}
              <Typography component="span" variant="caption" display="block" color="text.secondary">
                {theme.afterHint}
              </Typography>
            </Alert>
          )}

          <Divider sx={{ my: 1 }} />

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
              Cash Amount
            </Typography>
            <TextField
              fullWidth
              type="number"
              value={form.cash_amount}
              onChange={(e) => setField('cash_amount', e.target.value)}
              placeholder="0.00"
              InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }}
            />
          </Box>

          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end' }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                Bank Account
              </Typography>
              <FormControl fullWidth>
                <Select
                  value={form.bank_account}
                  onChange={(e) => setField('bank_account', e.target.value)}
                  displayEmpty
                  sx={{ bgcolor: '#f8fafc' }}
                >
                  <MenuItem value="">Select Bank Account</MenuItem>
                  {bankAccounts.map((account) => (
                    <MenuItem key={account.cus_id} value={account.cus_id}>
                      {account.cus_name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ flex: 1, minHeight: '56px', display: 'flex', alignItems: 'stretch' }}>
              {totalPreview > 0 ? (
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: theme.wordsBg,
                    borderRadius: 2,
                    border: `1px solid ${theme.wordsBorder}`,
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="body1" sx={{ fontWeight: 800, color: theme.wordsColor, fontSize: '1rem', textAlign: 'center' }}>
                    {urduWords}
                  </Typography>
                </Box>
              ) : (
                <Box
                  sx={{
                    p: 1.5,
                    bgcolor: '#f8fafc',
                    borderRadius: 2,
                    border: '1px dashed #cbd5e1',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#94a3b8' }}>
                    Enter amount to see words
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                Bank Amount
              </Typography>
              <TextField
                fullWidth
                type="number"
                value={form.bank_amount}
                onChange={(e) => setField('bank_amount', e.target.value)}
                disabled={!form.bank_account}
                placeholder="0.00"
                InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }}
              />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
                Discount
              </Typography>
              <TextField
                fullWidth
                placeholder="0.00"
                type="number"
                value={form.discount}
                onChange={(e) => setField('discount', e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start">PKR</InputAdornment> }}
              />
            </Box>
          </Box>

          <Divider sx={{ borderStyle: 'dotted', my: 1 }} />

          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#334155', mb: 0.5 }}>
              Description
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              value={form.description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Auto-filled from amounts; you can edit."
              sx={{ bgcolor: '#f8fafc' }}
            />
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 3, borderTop: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
        <Button onClick={onClose} sx={{ color: '#64748b' }}>
          Cancel
        </Button>
        <Button
          onClick={() => onSubmit({ ...form, cash_account: defaultCashAccountId || form.cash_account })}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : null}
          sx={{
            bgcolor: theme.btnBg,
            '&:hover': { bgcolor: theme.btnHover },
            px: 4,
            fontWeight: 700,
          }}
        >
          {loading ? 'Processing...' : theme.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default memo(PaymentFormDialog);
