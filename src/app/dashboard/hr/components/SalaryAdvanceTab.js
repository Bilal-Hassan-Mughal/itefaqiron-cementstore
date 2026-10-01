'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Snackbar, Alert, IconButton, Tooltip, CircularProgress, Stack,
  Autocomplete, ToggleButton, ToggleButtonGroup, Divider, InputAdornment, Grid,
} from '@mui/material';
import {
  AccountBalanceWallet, Payments, Person, DeleteOutline, Refresh,
  TrendingUp, FilterList, Search,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { BRAND } from '@/lib/brand-theme';
import { useHrRefresh, useHrRefreshVersion, HR_KEYS } from '../context/HrRefreshContext';
import { useHrEmployeeOptions } from '../hooks/useHrEmployeeOptions';
import HrStatCard from './shared/HrStatCard';
import HrFormSectionCard from './shared/HrFormSectionCard';
import EmployeeBalanceChip from './shared/EmployeeBalanceChip';
import { HR_FIELD_SX } from './shared/hrUiShared';

const NAVY = '#0f172a';
const PRIMARY = BRAND.primary.blue;
const ADVANCE = '#b45309';
const ADVANCE_TINT = '#fff7ed';

const fmtAmt = (v) => {
  const n = parseFloat(v || 0);
  return `Rs ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

const STATUS_META = {
  PENDING: { label: 'Pending', bg: '#fef3c7', color: '#b45309' },
  DEDUCTED: { label: 'Deducted', bg: '#dcfce7', color: '#15803d' },
  CANCELLED: { label: 'Cancelled', bg: '#f1f5f9', color: '#64748b' },
};

const emptyForm = () => ({
  emp_id: '',
  amount: '',
  advance_date: new Date().toISOString().split('T')[0],
  paymentMethod: 'CASH',
  paid_from_account_id: '',
  bank_account_id: '',
  cash_amount: '',
  bank_amount: '',
  reason: '',
  payment_reference: '',
});

const togglePaySx = {
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

function advancePaymentLabel(a) {
  if (a.payment_split) return 'Split';
  return a.payment_mode === 'BANK_TRANSFER' ? 'Bank' : 'Cash';
}

export default function SalaryAdvanceTab() {
  const router = useRouter();
  const {
    employees,
    activeEmployees,
    loading: employeesLoading,
    refresh: refreshEmployees,
  } = useHrEmployeeOptions();
  const [advances, setAdvances] = useState([]);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  const showSnack = (msg, severity = 'success') => setSnack({ open: true, msg, severity });
  const advancesVersion = useHrRefreshVersion(HR_KEYS.advances);
  const { invalidatePayrollFlow } = useHrRefresh();

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

  const pendingByEmp = useMemo(() => {
    const map = {};
    for (const a of advances) {
      if (a.status !== 'PENDING') continue;
      const id = a.emp_id;
      map[id] = (map[id] || 0) + parseFloat(a.amount || 0);
    }
    return map;
  }, [advances]);

  const stats = useMemo(() => {
    const now = new Date();
    const m = now.getMonth();
    const y = now.getFullYear();
    let pendingTotal = 0;
    let thisMonth = 0;
    let deductedTotal = 0;
    const empWithPending = new Set();

    for (const a of advances) {
      const amt = parseFloat(a.amount || 0);
      if (a.status === 'PENDING') {
        pendingTotal += amt;
        empWithPending.add(a.emp_id);
      }
      if (a.status === 'DEDUCTED') deductedTotal += amt;
      const d = a.advance_date ? new Date(a.advance_date) : null;
      if (d && !Number.isNaN(d.getTime()) && d.getMonth() === m && d.getFullYear() === y) {
        thisMonth += amt;
      }
    }

    return {
      pendingTotal,
      thisMonth,
      deductedTotal,
      employeesOwing: empWithPending.size,
      recordCount: advances.length,
    };
  }, [advances]);

  const filteredAdvances = useMemo(() => {
    let list = advances;
    if (statusFilter !== 'ALL') list = list.filter((a) => a.status === statusFilter);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((a) => {
        const name = (a.employee?.emp_name || '').toLowerCase();
        const reason = (a.reason || '').toLowerCase();
        return name.includes(q) || reason.includes(q);
      });
    }
    return list;
  }, [advances, statusFilter, search]);

  const employeeOptions = useMemo(() => {
    if (activeEmployees.length > 0) return activeEmployees;
    return employees;
  }, [activeEmployees, employees]);

  const selectedEmployee = useMemo(
    () => employeeOptions.find((e) => String(e.emp_id) === String(form.emp_id)) || null,
    [employeeOptions, form.emp_id]
  );

  const selectedEmpLedgerBal = selectedEmployee
    ? parseFloat(selectedEmployee.ledger_balance ?? pendingByEmp[selectedEmployee.emp_id] ?? 0)
    : 0;
  const selectedEmpPending = selectedEmployee ? (pendingByEmp[selectedEmployee.emp_id] || 0) : 0;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [advRes, accRes] = await Promise.all([
        fetch('/api/employee-advances'),
        fetch('/api/customers?dropdown=true'),
      ]);
      if (advRes.ok) setAdvances(await advRes.json());
      if (accRes.ok) {
        const data = await accRes.json();
        setPaymentAccounts(Array.isArray(data) ? data : []);
      }
    } catch {
      showSnack('Failed to load advance data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, advancesVersion]);

  useEffect(() => {
    if (employeesLoading || employeeOptions.length > 0) return;
    refreshEmployees().catch(() => {});
  }, [employeesLoading, employeeOptions.length, refreshEmployees]);

  useEffect(() => {
    if (form.paymentMethod !== 'CASH' || form.paid_from_account_id || cashAccountsList.length === 0) return;
    const defaultCash = cashAccountsList[0];
    if (defaultCash) {
      setForm((f) => ({ ...f, paid_from_account_id: String(defaultCash.cus_id) }));
    }
  }, [cashAccountsList, form.paymentMethod, form.paid_from_account_id]);

  async function handleSubmit(e) {
    e?.preventDefault?.();

    if (!form.emp_id) {
      showSnack('Select an employee', 'error');
      return;
    }

    const cashPart = parseFloat(form.cash_amount) || 0;
    const bankPart = parseFloat(form.bank_amount) || 0;
    let amount = parseFloat(form.amount) || 0;
    if (form.paymentMethod === 'PARTIAL' && cashPart + bankPart > 0) {
      amount = cashPart + bankPart;
    }
    if (!amount || amount <= 0) {
      showSnack('Enter a valid advance amount', 'error');
      return;
    }
    if (!form.advance_date) {
      showSnack('Select advance date', 'error');
      return;
    }

    const payload = {
      emp_id: parseInt(form.emp_id, 10),
      amount,
      advance_date: form.advance_date,
      reason: form.reason.trim() || null,
      payment_reference: form.payment_reference.trim() || null,
    };

    if (form.paymentMethod === 'PARTIAL') {
      const cash = cashPart;
      const bank = bankPart;
      if (!form.paid_from_account_id || !form.bank_account_id) {
        showSnack('Select cash and bank accounts', 'error');
        return;
      }
      if (cash <= 0 || bank <= 0) {
        showSnack('Enter cash and bank amounts for split payment', 'error');
        return;
      }
      Object.assign(payload, {
        payment_method: 'PARTIAL',
        amount,
        cash_amount: cash,
        bank_amount: bank,
        paid_from_account_id: form.paid_from_account_id,
        bank_account_id: form.bank_account_id,
      });
    } else if (form.paymentMethod === 'BANK') {
      if (!form.bank_account_id) {
        showSnack('Select a bank account', 'error');
        return;
      }
      Object.assign(payload, {
        payment_mode: 'BANK_TRANSFER',
        account_id: parseInt(form.bank_account_id, 10),
      });
    } else {
      if (!form.paid_from_account_id) {
        showSnack('Select a cash account', 'error');
        return;
      }
      Object.assign(payload, {
        payment_mode: 'CASH',
        account_id: parseInt(form.paid_from_account_id, 10),
      });
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/employee-advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to issue advance');
      }
      const data = await res.json();
      showSnack(`Advance issued: ${fmtAmt(amount)} to ${selectedEmployee?.emp_name || 'employee'}`);
      setForm(emptyForm());
      invalidatePayrollFlow();
      return data;
    } catch (err) {
      showSnack(err.message || 'Failed to issue advance', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancelAdvance(advance) {
    if (advance.status !== 'PENDING') {
      showSnack('Only pending advances can be cancelled', 'error');
      return;
    }
    if (!window.confirm(`Cancel advance ${fmtAmt(advance.amount)} for ${advance.employee?.emp_name || 'employee'}? Ledger will be reversed.`)) {
      return;
    }
    setDeletingId(advance.advance_id);
    try {
      const res = await fetch(`/api/employee-advances?id=${advance.advance_id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Cancel failed');
      }
      showSnack('Advance cancelled');
      invalidatePayrollFlow();
    } catch (err) {
      showSnack(err.message || 'Failed to cancel advance', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  const thSx = {
    bgcolor: NAVY,
    color: '#fff',
    fontWeight: 800,
    fontSize: '0.62rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    py: 1.25,
    borderBottom: 'none',
  };

  const fieldSx = { ...HR_FIELD_SX, width: '100%' };
  const splitCash = parseFloat(form.cash_amount) || 0;
  const splitBank = parseFloat(form.bank_amount) || 0;
  const splitTotal = splitCash + splitBank;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        <HrStatCard label="Pending balance" value={fmtAmt(stats.pendingTotal)} color={ADVANCE} loading={loading} icon={AccountBalanceWallet} />
        <HrStatCard label="Given this month" value={fmtAmt(stats.thisMonth)} color={PRIMARY} loading={loading} icon={TrendingUp} />
        <HrStatCard label="Deducted (settled)" value={fmtAmt(stats.deductedTotal)} color="#15803d" loading={loading} icon={Payments} />
        <HrStatCard label="Total records" value={String(stats.recordCount)} color="#7c3aed" loading={loading} icon={FilterList} />
      </Box>

      <HrFormSectionCard
        title="Give salary advance"
        subtitle="Paid from cash/bank · Posts to employee ledger · Recovered on salary clearance"
        accent={ADVANCE}
        maxWidth={960}
      >
        <Box component="form" noValidate onSubmit={handleSubmit}>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Stack spacing={2}>
                <Autocomplete
                  options={employeeOptions}
                  loading={employeesLoading}
                  isOptionEqualToValue={(a, b) => a?.emp_id === b?.emp_id}
                  getOptionLabel={(o) => `${o.emp_name || ''}${o.designation ? ` · ${o.designation}` : ''}`}
                  noOptionsText={employeesLoading ? 'Loading…' : 'No active employees'}
                  value={selectedEmployee}
                  onChange={(_, val) => setForm((f) => ({ ...f, emp_id: val ? String(val.emp_id) : '' }))}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Employee"
                      sx={fieldSx}
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <>
                            <InputAdornment position="start"><Person sx={{ fontSize: 18, color: '#94a3b8' }} /></InputAdornment>
                            {params.InputProps.startAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  renderOption={(props, option) => {
                    const { key, ...optionProps } = props;
                    return (
                      <Box component="li" key={key} {...optionProps}>
                        <Box>
                          <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>{option.emp_name}</Typography>
                          <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>
                            {option.designation || '—'} · Basic {fmtAmt(option.basic_salary)}
                            {parseFloat(option.ledger_balance ?? 0) !== 0 && (
                              <Box component="span" sx={{ color: ADVANCE, fontWeight: 700 }}>
                                {' '}· Bal {fmtAmt(option.ledger_balance)}
                              </Box>
                            )}
                          </Typography>
                        </Box>
                      </Box>
                    );
                  }}
                />

                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label={form.paymentMethod === 'PARTIAL' ? 'Advance total (auto from split)' : 'Advance amount'}
                      type="number"
                      value={
                        form.paymentMethod === 'PARTIAL' && splitTotal > 0
                          ? String(splitTotal)
                          : form.amount
                      }
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                      InputProps={{ readOnly: form.paymentMethod === 'PARTIAL', startAdornment: <InputAdornment position="start">Rs</InputAdornment> }}
                      helperText={form.paymentMethod === 'PARTIAL' ? 'Total is cash + bank below' : undefined}
                      sx={fieldSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label="Advance date"
                      type="date"
                      value={form.advance_date}
                      onChange={(e) => setForm((f) => ({ ...f, advance_date: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                      inputProps={{ lang: 'en-GB' }}
                      sx={fieldSx}
                    />
                  </Grid>
                </Grid>

                <TextField
                  fullWidth
                  label="Reason"
                  placeholder="e.g. Emergency, medical, festival…"
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  multiline
                  minRows={2}
                  sx={fieldSx}
                />
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Stack
                spacing={2}
                sx={{
                  p: 2,
                  height: '100%',
                  borderRadius: '14px',
                  bgcolor: ADVANCE_TINT,
                  border: '1px solid #fed7aa',
                }}
              >
                {selectedEmployee ? (
                  <Stack spacing={1.25}>
                    <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: ADVANCE, letterSpacing: '0.06em' }}>
                      EMPLOYEE SNAPSHOT
                    </Typography>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Basic salary</Typography>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700 }}>{fmtAmt(selectedEmployee.basic_salary)}</Typography>
                    </Stack>
                    <EmployeeBalanceChip balance={selectedEmpLedgerBal} />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Pending advances</Typography>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: selectedEmpPending > 0 ? ADVANCE : '#64748b' }}>
                        {selectedEmpPending > 0 ? fmtAmt(selectedEmpPending) : 'None'}
                      </Typography>
                    </Stack>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => router.push(`/dashboard/hr?module=employee-ledger&emp_id=${selectedEmployee.emp_id}`)}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', alignSelf: 'flex-start', borderColor: '#fdba74', color: ADVANCE }}
                    >
                      View ledger
                    </Button>
                  </Stack>
                ) : (
                  <Typography sx={{ fontSize: '0.8125rem', color: '#92400e', py: 2 }}>
                    Select an employee to see salary balance and pending advances.
                  </Typography>
                )}

                <Divider sx={{ borderColor: '#fed7aa' }} />

                <Typography sx={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.06em' }}>
                  PAYMENT FROM
                </Typography>

                <ToggleButtonGroup
                  exclusive
                  fullWidth
                  size="small"
                  value={form.paymentMethod}
                  onChange={(_, val) => {
                    if (!val) return;
                    setForm((f) => ({
                      ...f,
                      paymentMethod: val,
                      paid_from_account_id: val === 'BANK' ? '' : f.paid_from_account_id,
                      bank_account_id: val === 'CASH' ? '' : f.bank_account_id,
                      cash_amount: val === 'PARTIAL' ? f.cash_amount : '',
                      bank_amount: val === 'PARTIAL' ? f.bank_amount : '',
                    }));
                  }}
                  sx={togglePaySx}
                >
                  <ToggleButton value="CASH">Cash</ToggleButton>
                  <ToggleButton value="BANK">Bank</ToggleButton>
                  <ToggleButton value="PARTIAL">Split</ToggleButton>
                </ToggleButtonGroup>

                {(form.paymentMethod === 'CASH' || form.paymentMethod === 'PARTIAL') && (
                  <Autocomplete
                    options={cashAccountsList}
                    getOptionLabel={(o) => `${o.cus_name} (${fmtAmt(o.cus_balance)})`}
                    isOptionEqualToValue={(a, b) => a?.cus_id === b?.cus_id}
                    value={cashAccountsList.find((a) => String(a.cus_id) === form.paid_from_account_id) || null}
                    onChange={(_, val) => setForm((f) => ({ ...f, paid_from_account_id: val ? String(val.cus_id) : '' }))}
                    renderInput={(params) => (
                      <TextField {...params} label="Cash account" sx={fieldSx} />
                    )}
                  />
                )}

                {(form.paymentMethod === 'BANK' || form.paymentMethod === 'PARTIAL') && (
                  <Autocomplete
                    options={bankAccountsList}
                    getOptionLabel={(o) => `${o.cus_name} (${fmtAmt(o.cus_balance)})`}
                    isOptionEqualToValue={(a, b) => a?.cus_id === b?.cus_id}
                    value={bankAccountsList.find((a) => String(a.cus_id) === form.bank_account_id) || null}
                    onChange={(_, val) => setForm((f) => ({ ...f, bank_account_id: val ? String(val.cus_id) : '' }))}
                    renderInput={(params) => (
                      <TextField {...params} label="Bank account" sx={fieldSx} />
                    )}
                  />
                )}

                {form.paymentMethod === 'PARTIAL' && (
                  <Grid container spacing={1.5}>
                    <Grid size={6}>
                      <TextField
                        fullWidth
                        label="Cash amount"
                        type="number"
                        value={form.cash_amount}
                        onChange={(e) => setForm((f) => ({ ...f, cash_amount: e.target.value }))}
                        sx={fieldSx}
                      />
                    </Grid>
                    <Grid size={6}>
                      <TextField
                        fullWidth
                        label="Bank amount"
                        type="number"
                        value={form.bank_amount}
                        onChange={(e) => setForm((f) => ({ ...f, bank_amount: e.target.value }))}
                        sx={fieldSx}
                      />
                    </Grid>
                  </Grid>
                )}

                <TextField
                  fullWidth
                  label="Payment reference (optional)"
                  value={form.payment_reference}
                  onChange={(e) => setForm((f) => ({ ...f, payment_reference: e.target.value }))}
                  sx={fieldSx}
                />

                <Button
                  type="button"
                  variant="contained"
                  fullWidth
                  disabled={submitting}
                  onClick={handleSubmit}
                  startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Payments />}
                  sx={{
                    py: 1.35,
                    mt: 'auto',
                    bgcolor: ADVANCE,
                    fontWeight: 800,
                    textTransform: 'none',
                    borderRadius: '12px',
                    fontSize: '0.9375rem',
                    boxShadow: '0 4px 14px rgba(180,83,9,0.35)',
                    '&:hover': { bgcolor: '#92400e' },
                  }}
                >
                  {submitting ? 'Processing…' : 'Issue advance & post ledger'}
                </Button>
              </Stack>
            </Grid>
          </Grid>
        </Box>
      </HrFormSectionCard>

        <Card sx={{ width: '100%', borderRadius: '16px', border: '1px solid #e8edf4', boxShadow: '0 2px 12px rgba(15,23,42,0.04)' }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: '1px solid #eef2f6', display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontWeight: 900, color: NAVY, fontSize: '1rem' }}>Advance Records</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Track pending and settled advances</Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <IconButton size="small" onClick={fetchData} disabled={loading} sx={{ border: '1px solid #e2e8f0' }}>
                <Refresh sx={{ fontSize: 18 }} />
              </IconButton>
            </Stack>
          </Box>

          <Box sx={{ px: 2.5, py: 1.5, display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center', bgcolor: '#fafbfc', borderBottom: '1px solid #eef2f6' }}>
            <TextField
              size="small"
              placeholder="Search employee or reason…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fontSize: 18, color: '#94a3b8' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ minWidth: 220, '& .MuiOutlinedInput-root': { borderRadius: '10px', bgcolor: '#fff' } }}
            />
            <Stack direction="row" spacing={0.75} flexWrap="wrap">
              {['ALL', 'PENDING', 'DEDUCTED'].map((s) => (
                <Chip
                  key={s}
                  size="small"
                  label={s === 'ALL' ? 'All' : STATUS_META[s]?.label || s}
                  onClick={() => setStatusFilter(s)}
                  sx={{
                    fontWeight: 700,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    bgcolor: statusFilter === s ? (s === 'ALL' ? NAVY : STATUS_META[s]?.bg) : '#fff',
                    color: statusFilter === s ? (s === 'ALL' ? '#fff' : STATUS_META[s]?.color) : '#64748b',
                    border: '1px solid #e2e8f0',
                  }}
                />
              ))}
            </Stack>
          </Box>

          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {loading ? (
              <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={32} />
              </Box>
            ) : filteredAdvances.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center', px: 3 }}>
                <AccountBalanceWallet sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
                <Typography sx={{ fontWeight: 700, color: '#64748b' }}>No advance records</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', mt: 0.5 }}>
                  Issue an advance using the form above
                </Typography>
              </Box>
            ) : (
              <TableContainer sx={{ maxHeight: 560 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {['Employee', 'Amount', 'Date', 'Payment', 'Reason', 'Status', 'Action'].map((h) => (
                        <TableCell key={h} sx={thSx} align={h === 'Amount' ? 'right' : h === 'Action' ? 'center' : 'left'}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAdvances.map((a, idx) => {
                      const st = STATUS_META[a.status] || STATUS_META.CANCELLED;
                      const isClrAdv = (a.reason || '').startsWith('__CLR_ADV__');
                      return (
                        <TableRow key={a.advance_id} sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#f8fafc' }}>
                          <TableCell>
                            <Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: NAVY }}>
                              {a.employee?.emp_name || `#${a.emp_id}`}
                            </Typography>
                            <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                              {a.employee?.designation || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 900, color: ADVANCE, fontSize: '0.9rem' }}>
                            {fmtAmt(a.amount)}
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.8125rem' }}>
                            {a.advance_date ? new Date(a.advance_date).toLocaleDateString('en-GB') : '—'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={advancePaymentLabel(a)}
                              sx={{ height: 22, fontWeight: 700, fontSize: '0.65rem', bgcolor: '#f1f5f9', color: '#475569' }}
                            />
                          </TableCell>
                          <TableCell sx={{ maxWidth: 180, fontSize: '0.8125rem', color: '#475569' }}>
                            {isClrAdv ? 'With salary clearance' : (a.reason || '—')}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={st.label}
                              sx={{ height: 22, fontWeight: 800, fontSize: '0.65rem', bgcolor: st.bg, color: st.color }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {a.status === 'PENDING' && !isClrAdv ? (
                              <Tooltip title="Cancel advance & reverse ledger">
                                <span>
                                  <IconButton
                                    size="small"
                                    disabled={deletingId === a.advance_id}
                                    onClick={() => handleCancelAdvance(a)}
                                    sx={{ color: '#dc2626' }}
                                  >
                                    {deletingId === a.advance_id ? (
                                      <CircularProgress size={16} />
                                    ) : (
                                      <DeleteOutline fontSize="small" />
                                    )}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : (
                              <Typography sx={{ fontSize: '0.75rem', color: '#cbd5e1' }}>—</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} sx={{ borderRadius: '12px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
