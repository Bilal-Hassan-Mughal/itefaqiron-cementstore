'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Button, TextField, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Snackbar, Alert, IconButton, Tooltip, CircularProgress, Stack,
  Autocomplete, ToggleButton, ToggleButtonGroup, Divider, InputAdornment,
} from '@mui/material';
import {
  AccountBalanceWallet, Payments, Person, DeleteOutline, Refresh,
  TrendingUp, FilterList, Search,
} from '@mui/icons-material';
import { BRAND } from '@/lib/brand-theme';

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

function StatCard({ label, value, sub, accent, tint, icon: Icon }) {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 150,
        p: 2,
        borderRadius: '14px',
        border: '1px solid #e8edf4',
        bgcolor: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          top: 12,
          right: 12,
          width: 38,
          height: 38,
          borderRadius: '10px',
          bgcolor: tint,
          color: accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon sx={{ fontSize: 20 }} />
      </Box>
      <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.06em', color: '#94a3b8', textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '1.25rem', fontWeight: 900, color: NAVY, mt: 0.5, lineHeight: 1.2 }}>{value}</Typography>
      {sub && (
        <Typography sx={{ fontSize: '0.72rem', color: '#64748b', mt: 0.35 }}>{sub}</Typography>
      )}
    </Box>
  );
}

const emptyForm = () => ({
  emp_id: '',
  amount: '',
  advance_date: new Date().toISOString().split('T')[0],
  paymentMethod: 'CASH',
  paid_from_account_id: '',
  bank_account_id: '',
  reason: '',
  payment_reference: '',
});

export default function SalaryAdvanceTab() {
  const [employees, setEmployees] = useState([]);
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

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status === 'ACTIVE'),
    [employees]
  );

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

  const selectedEmployee = useMemo(
    () => activeEmployees.find((e) => String(e.emp_id) === String(form.emp_id)) || null,
    [activeEmployees, form.emp_id]
  );

  const selectedEmpPending = selectedEmployee ? (pendingByEmp[selectedEmployee.emp_id] || 0) : 0;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, advRes, accRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/employee-advances'),
        fetch('/api/customers?dropdown=true'),
      ]);
      if (empRes.ok) setEmployees(await empRes.json());
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
  }, [fetchData]);

  useEffect(() => {
    if (form.paymentMethod !== 'CASH' || form.paid_from_account_id || cashAccountsList.length === 0) return;
    const defaultCash = cashAccountsList[0];
    if (defaultCash) {
      setForm((f) => ({ ...f, paid_from_account_id: String(defaultCash.cus_id) }));
    }
  }, [cashAccountsList, form.paymentMethod, form.paid_from_account_id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.emp_id) {
      showSnack('Select an employee', 'error');
      return;
    }
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) {
      showSnack('Enter a valid advance amount', 'error');
      return;
    }
    if (form.paymentMethod === 'CASH' && !form.paid_from_account_id) {
      showSnack('Select a cash account', 'error');
      return;
    }
    if (form.paymentMethod === 'BANK' && !form.bank_account_id) {
      showSnack('Select a bank account', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const accountId = form.paymentMethod === 'BANK'
        ? parseInt(form.bank_account_id, 10)
        : parseInt(form.paid_from_account_id, 10);

      const res = await fetch('/api/employee-advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_id: parseInt(form.emp_id, 10),
          amount,
          advance_date: form.advance_date,
          payment_mode: form.paymentMethod === 'BANK' ? 'BANK_TRANSFER' : 'CASH',
          account_id: accountId,
          reason: form.reason.trim() || null,
          payment_reference: form.payment_reference.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to issue advance');
      }
      const data = await res.json();
      showSnack(`Advance issued: ${fmtAmt(amount)} to ${selectedEmployee?.emp_name || 'employee'}`);
      setForm(emptyForm());
      fetchData();
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
      fetchData();
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

  return (
    <Box sx={{ pb: 3 }}>
      {/* Stats */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ px: { xs: 2, md: 2.5 }, pt: 2, pb: 1 }}>
        <StatCard label="Pending Balance" value={fmtAmt(stats.pendingTotal)} sub={`${stats.employeesOwing} employee(s) owing`} accent={ADVANCE} tint={ADVANCE_TINT} icon={AccountBalanceWallet} />
        <StatCard label="Given This Month" value={fmtAmt(stats.thisMonth)} sub="All advance issues" accent={PRIMARY} tint="#e8effd" icon={TrendingUp} />
        <StatCard label="Deducted (Settled)" value={fmtAmt(stats.deductedTotal)} sub="Recovered via salary" accent="#15803d" tint="#dcfce7" icon={Payments} />
        <StatCard label="Total Records" value={String(stats.recordCount)} sub="Advance history" accent="#7c3aed" tint="#ede9fe" icon={FilterList} />
      </Stack>

      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={2}
        sx={{ px: { xs: 2, md: 2.5 }, pt: 1, alignItems: 'flex-start' }}
      >
        {/* Issue form */}
        <Card
          sx={{
            width: { xs: '100%', lg: 380 },
            flexShrink: 0,
            borderRadius: '16px',
            border: '1px solid #e8edf4',
            boxShadow: '0 4px 24px rgba(15,23,42,0.06)',
            position: { lg: 'sticky' },
            top: 16,
          }}
        >
          <Box
            sx={{
              px: 2.5,
              py: 2,
              background: `linear-gradient(135deg, ${ADVANCE} 0%, #ea580c 100%)`,
              borderRadius: '16px 16px 0 0',
            }}
          >
            <Typography sx={{ fontWeight: 900, color: '#fff', fontSize: '1.05rem' }}>Give Salary Advance</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.85)', mt: 0.35 }}>
              Paid from cash/bank · Deducted on next salary clearance
            </Typography>
          </Box>
          <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <Autocomplete
                  size="small"
                  options={activeEmployees}
                  getOptionLabel={(o) => o.emp_name || ''}
                  value={selectedEmployee}
                  onChange={(_, val) => setForm((f) => ({ ...f, emp_id: val ? String(val.emp_id) : '' }))}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Employee *"
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
                  renderOption={(props, option) => (
                    <Box component="li" {...props} key={option.emp_id}>
                      <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.875rem' }}>{option.emp_name}</Typography>
                        <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>
                          {option.designation || '—'} · Basic {fmtAmt(option.basic_salary)}
                          {(pendingByEmp[option.emp_id] || 0) > 0 && (
                            <Box component="span" sx={{ color: ADVANCE, fontWeight: 700 }}>
                              {' '}· Pending {fmtAmt(pendingByEmp[option.emp_id])}
                            </Box>
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                />

                {selectedEmployee && (
                  <Box sx={{ bgcolor: '#f8fafc', borderRadius: '12px', p: 1.5, border: '1px solid #e8edf4' }}>
                    <Stack spacing={0.5}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Basic salary</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700 }}>{fmtAmt(selectedEmployee.basic_salary)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>Current pending advance</Typography>
                        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 800, color: selectedEmpPending > 0 ? ADVANCE : '#15803d' }}>
                          {selectedEmpPending > 0 ? fmtAmt(selectedEmpPending) : 'None'}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Box>
                )}

                <TextField
                  fullWidth
                  required
                  size="small"
                  label="Advance Amount (Rs) *"
                  type="number"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start">Rs</InputAdornment>,
                  }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />

                <TextField
                  fullWidth
                  size="small"
                  label="Advance Date *"
                  type="date"
                  value={form.advance_date}
                  onChange={(e) => setForm((f) => ({ ...f, advance_date: e.target.value }))}
                  InputLabelProps={{ shrink: true }}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />

                <TextField
                  fullWidth
                  size="small"
                  label="Reason"
                  placeholder="e.g. Emergency, medical, festival…"
                  value={form.reason}
                  onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                  multiline
                  minRows={2}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />

                <Divider>
                  <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8', fontWeight: 800, letterSpacing: '0.08em' }}>
                    PAYMENT FROM
                  </Typography>
                </Divider>

                <ToggleButtonGroup
                  exclusive
                  size="small"
                  fullWidth
                  value={form.paymentMethod}
                  onChange={(_, val) => val && setForm((f) => ({
                    ...f,
                    paymentMethod: val,
                    paid_from_account_id: val === 'BANK' ? '' : f.paid_from_account_id,
                    bank_account_id: val === 'CASH' ? '' : f.bank_account_id,
                  }))}
                >
                  <ToggleButton value="CASH" sx={{ textTransform: 'none', fontWeight: 700, flex: 1 }}>Cash</ToggleButton>
                  <ToggleButton value="BANK" sx={{ textTransform: 'none', fontWeight: 700, flex: 1 }}>Bank</ToggleButton>
                </ToggleButtonGroup>

                {form.paymentMethod === 'CASH' && (
                  <Autocomplete
                    size="small"
                    options={cashAccountsList}
                    getOptionLabel={(o) => `${o.cus_name} (${fmtAmt(o.cus_balance)})`}
                    value={cashAccountsList.find((a) => String(a.cus_id) === form.paid_from_account_id) || null}
                    onChange={(_, val) => setForm((f) => ({ ...f, paid_from_account_id: val ? String(val.cus_id) : '' }))}
                    renderInput={(params) => <TextField {...params} label="Cash Account *" required />}
                  />
                )}

                {form.paymentMethod === 'BANK' && (
                  <Autocomplete
                    size="small"
                    options={bankAccountsList}
                    getOptionLabel={(o) => `${o.cus_name} (${fmtAmt(o.cus_balance)})`}
                    value={bankAccountsList.find((a) => String(a.cus_id) === form.bank_account_id) || null}
                    onChange={(_, val) => setForm((f) => ({ ...f, bank_account_id: val ? String(val.cus_id) : '' }))}
                    renderInput={(params) => <TextField {...params} label="Bank Account *" required />}
                  />
                )}

                <TextField
                  fullWidth
                  size="small"
                  label="Payment Reference (optional)"
                  value={form.payment_reference}
                  onChange={(e) => setForm((f) => ({ ...f, payment_reference: e.target.value }))}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: '10px' } }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={submitting}
                  startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Payments />}
                  sx={{
                    py: 1.25,
                    bgcolor: ADVANCE,
                    fontWeight: 800,
                    textTransform: 'none',
                    borderRadius: '12px',
                    fontSize: '0.9375rem',
                    boxShadow: '0 4px 14px rgba(180,83,9,0.35)',
                    '&:hover': { bgcolor: '#92400e' },
                  }}
                >
                  {submitting ? 'Processing…' : 'Issue Advance & Post Ledger'}
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>

        {/* Records */}
        <Card sx={{ flex: 1, minWidth: 0, borderRadius: '16px', border: '1px solid #e8edf4', boxShadow: '0 2px 12px rgba(15,23,42,0.04)' }}>
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
                  Issue an advance using the form on the left
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
                              label={a.payment_mode === 'BANK_TRANSFER' ? 'Bank' : 'Cash'}
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
      </Stack>

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} sx={{ borderRadius: '12px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
