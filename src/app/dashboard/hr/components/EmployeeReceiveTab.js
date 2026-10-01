'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, TextField, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, MenuItem, FormControl, InputLabel, Select,
  Chip, CircularProgress, InputAdornment, Grid, Dialog, DialogTitle, DialogContent,
  DialogActions, Autocomplete, Stack, Alert, IconButton,
} from '@mui/material';
import {
  Search, Payments, Print, PictureAsPdf, Close, AccountBalanceWallet, FilterList,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { BRAND, COMPANY } from '@/lib/brand-theme';
import { buildEmployeeReceiptPrintHtml, downloadEmployeeReceiptPdf } from '@/lib/employee-receipt-pdf';
import { useHrRefresh, useHrRefreshVersion, HR_KEYS } from '../context/HrRefreshContext';
import { useHrEmployeeOptions } from '../hooks/useHrEmployeeOptions';
import HrStatCard from './shared/HrStatCard';
import HrFormSectionCard from './shared/HrFormSectionCard';
import EmployeeBalanceChip from './shared/EmployeeBalanceChip';
import { HR_FIELD_SX } from './shared/hrUiShared';

const CARD_SX = {
  borderRadius: '12px',
  border: '1px solid #dce3ed',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
  bgcolor: '#ffffff',
};

const FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    fontSize: '0.875rem',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&.Mui-focused fieldset': { borderColor: BRAND.supporting.periwinkle },
  },
};

const fmtAmt = (v) =>
  parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function EmployeeReceiveTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmpId = searchParams.get('emp_id') || '';
  const receiptsVersion = useHrRefreshVersion(HR_KEYS.receipts);
  const { invalidateMoneyFromEmployee } = useHrRefresh();
  const { activeEmployees, loading: employeesLoading } = useHrEmployeeOptions();
  const [accounts, setAccounts] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [form, setForm] = useState({
    emp_id: '',
    amount: '',
    receipt_date: todayStr(),
    payment_mode: 'CASH',
    account_id: '',
    reference: '',
    notes: '',
  });

  const [filters, setFilters] = useState({
    emp_id: '',
    from: '',
    to: '',
    payment_mode: '',
    q: '',
  });

  const cashAccounts = useMemo(
    () => accounts.filter((a) => {
      const t = (a.customer_type?.cus_type_title || '').toLowerCase();
      const c = (a.customer_category?.cus_cat_title || '').toLowerCase();
      return t.includes('cash') && c.includes('cash');
    }),
    [accounts]
  );

  const bankAccounts = useMemo(
    () => accounts.filter((a) => {
      const t = (a.customer_type?.cus_type_title || '').toLowerCase();
      const c = (a.customer_category?.cus_cat_title || '').toLowerCase();
      return t.includes('bank') && c.includes('bank');
    }),
    [accounts]
  );

  const accountOptions = form.payment_mode === 'BANK_TRANSFER' ? bankAccounts : cashAccounts;

  const selectedEmployee = useMemo(
    () => activeEmployees.find((e) => String(e.emp_id) === String(form.emp_id)) || null,
    [activeEmployees, form.emp_id]
  );

  const loadReceipts = useCallback(async () => {
    const params = new URLSearchParams();
    if (filters.emp_id) params.set('emp_id', filters.emp_id);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.payment_mode) params.set('payment_mode', filters.payment_mode);
    if (filters.q.trim()) params.set('q', filters.q.trim());
    const res = await fetch(`/api/employee-receipts?${params.toString()}`);
    if (res.ok) setReceipts(await res.json());
  }, [filters]);

  useEffect(() => {
    if (prefillEmpId) {
      setForm((f) => ({ ...f, emp_id: String(prefillEmpId) }));
      setFilters((f) => ({ ...f, emp_id: String(prefillEmpId) }));
    }
  }, [prefillEmpId]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const accRes = await fetch('/api/customers?dropdown=true');
        if (accRes.ok) {
          const data = await accRes.json();
          setAccounts(Array.isArray(data) ? data : []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => { loadReceipts(); }, 300);
    return () => clearTimeout(t);
  }, [loadReceipts, receiptsVersion]);

  useEffect(() => {
    if (form.payment_mode === 'CASH' && cashAccounts[0] && !form.account_id) {
      setForm((f) => ({ ...f, account_id: String(cashAccounts[0].cus_id) }));
    }
  }, [cashAccounts, form.payment_mode, form.account_id]);

  const stats = useMemo(() => {
    const total = receipts.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const today = receipts.filter((r) => String(r.receipt_date).slice(0, 10) === todayStr());
    const todayTotal = today.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    return { count: receipts.length, total, todayCount: today.length, todayTotal };
  }, [receipts]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.emp_id) return;
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return;
    if (!form.account_id) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/employee-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_id: form.emp_id,
          amount,
          receipt_date: form.receipt_date,
          payment_mode: form.payment_mode,
          account_id: form.account_id,
          reference: form.reference || null,
          notes: form.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Save failed');
      setLastReceipt(json);
      setReceiptOpen(true);
      setForm((f) => ({ ...f, amount: '', reference: '', notes: '' }));
      invalidateMoneyFromEmployee();
    } catch (err) {
      alert(err.message || 'Failed to save receipt');
    } finally {
      setSubmitting(false);
    }
  }

  function handlePrint(receipt) {
    const html = buildEmployeeReceiptPrintHtml(receipt);
    const win = window.open('', '_blank', 'width=480,height=720');
    win.document.write(html);
    win.document.close();
  }

  async function handlePdf(receipt) {
    setPdfLoading(true);
    try {
      await downloadEmployeeReceiptPdf(receipt);
    } finally {
      setPdfLoading(false);
    }
  }

  const fieldSx = { ...HR_FIELD_SX, width: '100%' };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        <HrStatCard label="Receipts (filtered)" value={String(stats.count)} color="#1A55E3" loading={loading} icon={Payments} />
        <HrStatCard label="Total received" value={fmtAmt(stats.total)} color="#0d9488" loading={loading} />
        <HrStatCard label="Today count" value={String(stats.todayCount)} color="#7c3aed" loading={loading} />
        <HrStatCard label="Today amount" value={fmtAmt(stats.todayTotal)} color="#f59e0b" loading={loading} />
      </Box>

      <Grid container spacing={2}>
        <Grid item xs={12} lg={5}>
          <HrFormSectionCard
            title="Receive from employee"
            subtitle="Cash/bank in · Credits employee ledger · Printable receipt"
            accent="#0d9488"
            maxWidth={9999}
          >
              <Box component="form" onSubmit={handleSubmit}>
                <Stack spacing={2}>
                  <Autocomplete
                    options={activeEmployees}
                    loading={employeesLoading}
                    getOptionLabel={(o) => `${o.emp_name}${o.designation ? ` (${o.designation})` : ''}`}
                    value={selectedEmployee}
                    onChange={(_, v) => setForm((f) => ({ ...f, emp_id: v ? String(v.emp_id) : '' }))}
                    renderInput={(params) => (
                      <TextField {...params} label="Employee *" sx={fieldSx} />
                    )}
                  />
                  {selectedEmployee && (
                    <Stack spacing={1}>
                      <EmployeeBalanceChip balance={selectedEmployee.ledger_balance ?? 0} />
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => router.push(`/dashboard/hr?module=employee-ledger&emp_id=${selectedEmployee.emp_id}`)}
                        sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', alignSelf: 'flex-start' }}
                      >
                        View employee ledger
                      </Button>
                    </Stack>
                  )}
                  <TextField
                    required
                    label="Amount (Rs) *"
                    type="number"
                    inputProps={{ step: '0.01', min: 0 }}
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    sx={fieldSx}
                  />
                  <TextField
                    label="Date"
                    type="date"
                    value={form.receipt_date}
                    onChange={(e) => setForm((f) => ({ ...f, receipt_date: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    sx={fieldSx}
                  />
                  <FormControl sx={fieldSx}>
                    <InputLabel>Payment mode</InputLabel>
                    <Select
                      label="Payment mode"
                      value={form.payment_mode}
                      onChange={(e) => setForm((f) => ({ ...f, payment_mode: e.target.value, account_id: '' }))}
                    >
                      <MenuItem value="CASH">Cash</MenuItem>
                      <MenuItem value="BANK_TRANSFER">Bank transfer</MenuItem>
                    </Select>
                  </FormControl>
                  <FormControl sx={fieldSx} required>
                    <InputLabel>Receive into account *</InputLabel>
                    <Select
                      label="Receive into account *"
                      value={form.account_id}
                      onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
                    >
                      {accountOptions.map((a) => (
                        <MenuItem key={a.cus_id} value={String(a.cus_id)}>
                          {a.cus_name} ({fmtAmt(a.cus_balance)})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Reference"
                    value={form.reference}
                    onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
                    sx={fieldSx}
                  />
                  <TextField
                    label="Notes"
                    multiline
                    minRows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    sx={fieldSx}
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={submitting}
                    sx={{ bgcolor: '#0d9488', fontWeight: 700, textTransform: 'none', py: 1.2, borderRadius: '12px' }}
                  >
                    {submitting ? 'Saving…' : 'Save & print receipt'}
                  </Button>
                </Stack>
              </Box>
          </HrFormSectionCard>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={CARD_SX}>
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <FilterList sx={{ color: '#64748b' }} />
                <Typography sx={{ fontWeight: 800 }}>Receipt history</Typography>
              </Stack>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
                <TextField
                  size="small"
                  placeholder="Search name, ref, notes…"
                  value={filters.q}
                  onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                  sx={{ minWidth: 180, ...FIELD_SX }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ fontSize: 18 }} />
                      </InputAdornment>
                    ),
                  }}
                />
                <FormControl size="small" sx={{ minWidth: 160, ...FIELD_SX }}>
                  <InputLabel>Employee</InputLabel>
                  <Select
                    label="Employee"
                    value={filters.emp_id}
                    onChange={(e) => setFilters((f) => ({ ...f, emp_id: e.target.value }))}
                  >
                    <MenuItem value="">All</MenuItem>
                    {activeEmployees.map((e) => (
                      <MenuItem key={e.emp_id} value={String(e.emp_id)}>{e.emp_name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }}
                  value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} sx={FIELD_SX} />
                <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }}
                  value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} sx={FIELD_SX} />
                <FormControl size="small" sx={{ minWidth: 120, ...FIELD_SX }}>
                  <InputLabel>Mode</InputLabel>
                  <Select label="Mode" value={filters.payment_mode}
                    onChange={(e) => setFilters((f) => ({ ...f, payment_mode: e.target.value }))}>
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="CASH">Cash</MenuItem>
                    <MenuItem value="BANK_TRANSFER">Bank</MenuItem>
                  </Select>
                </FormControl>
                <Button size="small" onClick={() => setFilters({ emp_id: '', from: '', to: '', payment_mode: '', q: '' })}
                  sx={{ textTransform: 'none' }}>
                  Clear filters
                </Button>
              </Box>

              {loading ? (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <CircularProgress size={28} sx={{ color: BRAND.primary.blue }} />
                </Box>
              ) : (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #cbd5e1', maxHeight: 420 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#e8effd' }}>
                        {['Date', 'Receipt #', 'Employee', 'Amount', 'Mode', 'Account', 'Actions'].map((h) => (
                          <TableCell key={h} sx={{ fontWeight: 700, fontSize: '0.72rem', color: '#1347c4' }}>{h}</TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {receipts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} align="center" sx={{ py: 4, color: '#94a3b8' }}>No receipts</TableCell>
                        </TableRow>
                      ) : receipts.map((r) => (
                        <TableRow key={r.receipt_id} hover>
                          <TableCell>{new Date(r.receipt_date).toLocaleDateString('en-GB')}</TableCell>
                          <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>{r.ledger_bill_no}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>{r.employee?.emp_name}</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#0d9488', fontFamily: 'monospace' }}>{fmtAmt(r.amount)}</TableCell>
                          <TableCell>
                            <Chip size="small" label={r.payment_mode === 'BANK_TRANSFER' ? 'Bank' : 'Cash'} sx={{ height: 20, fontSize: '0.65rem' }} />
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.78rem' }}>{r.account?.cus_name}</TableCell>
                          <TableCell>
                            <IconButton size="small" onClick={() => { setLastReceipt(r); setReceiptOpen(true); }} title="View">
                              <AccountBalanceWallet sx={{ fontSize: 18 }} />
                            </IconButton>
                            <IconButton size="small" onClick={() => handlePrint(r)} title="Print">
                              <Print sx={{ fontSize: 18 }} />
                            </IconButton>
                            <IconButton size="small" onClick={() => handlePdf(r)} title="PDF">
                              <PictureAsPdf sx={{ fontSize: 18 }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={receiptOpen && !!lastReceipt} onClose={() => setReceiptOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ bgcolor: '#0d9488', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Payment received</span>
          <IconButton onClick={() => setReceiptOpen(false)} sx={{ color: '#fff' }} size="small"><Close /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          {lastReceipt && (
            <Stack spacing={1}>
              <Typography sx={{ textAlign: 'center', fontWeight: 800, fontSize: '0.85rem' }}>{COMPANY.name}</Typography>
              <Typography sx={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>{lastReceipt.ledger_bill_no}</Typography>
              <Typography sx={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 900, color: '#0d9488', my: 1 }}>
                Rs {fmtAmt(lastReceipt.amount)}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem' }}><strong>Employee:</strong> {lastReceipt.employee?.emp_name}</Typography>
              <Typography sx={{ fontSize: '0.8125rem' }}><strong>Balance:</strong> {fmtAmt(lastReceipt.balance_before)} → {fmtAmt(lastReceipt.balance_after)}</Typography>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReceiptOpen(false)}>Close</Button>
          <Button startIcon={<Print />} onClick={() => lastReceipt && handlePrint(lastReceipt)}>Print</Button>
          <Button startIcon={pdfLoading ? <CircularProgress size={16} /> : <PictureAsPdf />}
            disabled={pdfLoading} variant="contained" onClick={() => lastReceipt && handlePdf(lastReceipt)}>
            PDF
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
