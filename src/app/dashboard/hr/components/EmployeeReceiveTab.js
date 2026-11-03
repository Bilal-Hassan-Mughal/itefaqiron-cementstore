'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Box, Typography, Button, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, CircularProgress, InputAdornment,
  Autocomplete, Stack, Alert, IconButton, Tooltip, Snackbar, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import {
  Search, Payments, Print, AccountBalanceWallet, FilterList,
  Refresh, ArrowBack, Person, CalendarToday, ReceiptLong,
} from '@mui/icons-material';
import { BRAND } from '@/lib/brand-theme';
import { printEmployeeReceiveReceipt } from '@/lib/employee-receipt-pdf';
import EmployeeReceiveReceiptDialog from './EmployeeReceiveReceiptDialog';
import { useHrRefresh, useHrRefreshVersion, HR_KEYS } from '../context/HrRefreshContext';
import { useHrEmployeeOptions } from '../hooks/useHrEmployeeOptions';
import { HR_FIELD_SX, HR_TABLE_HEAD_SX } from './shared/hrUiShared';

const NAVY = '#0f172a';
const RECEIVE = '#0d9488';
const RECEIVE_DEEP = '#0f766e';
const RECEIVE_TINT = '#ecfdf5';
const RECEIVE_SOFT = '#ccfbf1';
const BORDER = '#e2e8f0';
const PRIMARY = BRAND.primary.blue;

const fmtAmt = (v) => `Rs ${parseFloat(v || 0).toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

const PAGE_CANVAS = `
  radial-gradient(ellipse 90% 55% at 10% 0%, rgba(20, 184, 166, 0.12), transparent 52%),
  radial-gradient(ellipse 75% 50% at 95% 100%, rgba(26, 85, 227, 0.08), transparent 50%),
  linear-gradient(180deg, #f0fdfa 0%, #f8fafc 48%, #ffffff 100%)
`;

function glassPanel(extra = {}) {
  return {
    bgcolor: 'rgba(255, 255, 255, 0.82)',
    backdropFilter: 'blur(16px) saturate(1.35)',
    WebkitBackdropFilter: 'blur(16px) saturate(1.35)',
    border: '1px solid rgba(255, 255, 255, 0.95)',
    boxShadow: '0 10px 36px rgba(13, 148, 136, 0.06), 0 4px 16px rgba(15, 23, 42, 0.04)',
    borderRadius: '14px',
    ...extra,
  };
}

const PAY_PANEL_SURFACE = `linear-gradient(180deg, #ecfdf5 0%, #f8fafc 42%, #ffffff 100%)`;

const payFormShellSx = {
  borderRadius: '16px',
  overflow: 'hidden',
  background: PAY_PANEL_SURFACE,
  border: '1px solid rgba(13, 148, 136, 0.18)',
  boxShadow: '0 16px 48px rgba(13, 148, 136, 0.1)',
  color: NAVY,
};

const payHeaderStrip = 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(236, 253, 245, 0.65) 100%)';
const payFooterStrip = 'linear-gradient(180deg, rgba(236, 253, 245, 0.35) 0%, rgba(238, 244, 255, 0.75) 100%)';
const paySectionDivider = '1px solid rgba(226, 232, 240, 0.9)';

const fieldSxPay = {
  ...HR_FIELD_SX,
  width: '100%',
  '& .MuiInputLabel-root': { color: '#64748b', fontWeight: 600 },
  '& .MuiInputLabel-root.Mui-focused': { color: RECEIVE },
  '& .MuiOutlinedInput-root': {
    ...HR_FIELD_SX['& .MuiOutlinedInput-root'],
    minHeight: 42,
    borderRadius: '11px',
    bgcolor: '#ffffff',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&:hover fieldset': { borderColor: '#94a3b8' },
    '&.Mui-focused fieldset': { borderColor: RECEIVE, borderWidth: 2 },
    '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(13, 148, 136, 0.14)' },
  },
  '& .MuiFormHelperText-root': { fontSize: '0.68rem', mt: 0.5, fontWeight: 600, color: '#64748b' },
};

const fieldSxAmount = {
  ...fieldSxPay,
  '& .MuiOutlinedInput-root': {
    ...fieldSxPay['& .MuiOutlinedInput-root'],
    bgcolor: '#f0fdfa',
    '& fieldset': { borderColor: '#5eead4' },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: RECEIVE_DEEP },
};

const togglePaySx = {
  borderRadius: '12px',
  p: 0.45,
  gap: 0.35,
  bgcolor: 'rgba(255, 255, 255, 0.8)',
  border: '1px solid rgba(13, 148, 136, 0.2)',
  '& .MuiToggleButton-root': {
    textTransform: 'none',
    fontWeight: 700,
    fontSize: '0.72rem',
    py: 0.85,
    borderRadius: '9px !important',
    border: 'none !important',
    flex: 1,
    color: '#64748b',
    '&.Mui-selected[value="CASH"]': {
      bgcolor: `${RECEIVE_TINT} !important`,
      color: `${RECEIVE_DEEP} !important`,
    },
    '&.Mui-selected[value="BANK_TRANSFER"]': {
      bgcolor: `${BRAND.tint.blue} !important`,
      color: `${PRIMARY} !important`,
    },
  },
};

const TABLE_LINE = 'rgba(226, 232, 240, 0.85)';

const RECEIPT_COLS = [
  { id: 'employee', label: 'Employee', width: '26%' },
  { id: 'amount', label: 'Amount', width: '14%', align: 'right' },
  { id: 'mode', label: 'Mode', width: '10%', align: 'center' },
  { id: 'account', label: 'Account', width: '22%' },
  { id: 'notes', label: 'Notes', width: '20%' },
  { id: 'actions', label: 'Actions', width: '12%', align: 'center' },
];

function receiptCellSx(isLast, isHead, col) {
  return {
    borderBottom: `1px solid ${TABLE_LINE}`,
    borderRight: isLast ? 'none' : `1px solid ${TABLE_LINE}`,
    px: 0.65,
    py: isHead ? 0.85 : 0.6,
    width: col.width,
    maxWidth: col.width,
    overflow: 'hidden',
    verticalAlign: 'middle',
  };
}

function fmtDateCell(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function EmployeeReceiveTab({ onBackToHub }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const prefillEmpId = searchParams.get('emp_id') || '';
  const goBack = () => {
    if (typeof onBackToHub === 'function') onBackToHub();
    else router.push('/dashboard/hr');
  };

  const receiptsVersion = useHrRefreshVersion(HR_KEYS.receipts);
  const { invalidateMoneyFromEmployee } = useHrRefresh();
  const { activeEmployees, loading: employeesLoading } = useHrEmployeeOptions();

  const [accounts, setAccounts] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  const [form, setForm] = useState({
    emp_id: '',
    amount: '',
    receipt_date: todayStr(),
    payment_mode: 'CASH',
    account_id: '',
    reference: '',
    notes: '',
  });

  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('ALL');

  const showSnack = (msg, severity = 'success') => setSnack({ open: true, msg, severity });

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
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('q', search.trim());
      if (modeFilter !== 'ALL') params.set('payment_mode', modeFilter);
      const res = await fetch(`/api/employee-receipts?${params.toString()}`);
      if (res.ok) setReceipts(await res.json());
    } catch {
      showSnack('Failed to load receipts', 'error');
    } finally {
      setLoading(false);
    }
  }, [search, modeFilter]);

  useEffect(() => {
    if (prefillEmpId) setForm((f) => ({ ...f, emp_id: String(prefillEmpId) }));
  }, [prefillEmpId]);

  useEffect(() => {
    (async () => {
      const accRes = await fetch('/api/customers?dropdown=true');
      if (accRes.ok) {
        const data = await accRes.json();
        setAccounts(Array.isArray(data) ? data : []);
      }
    })();
  }, []);

  useEffect(() => {
    const t = setTimeout(loadReceipts, 280);
    return () => clearTimeout(t);
  }, [loadReceipts, receiptsVersion]);

  useEffect(() => {
    if (form.payment_mode === 'CASH' && cashAccounts[0] && !form.account_id) {
      setForm((f) => ({ ...f, account_id: String(cashAccounts[0].cus_id) }));
    }
  }, [cashAccounts, form.payment_mode, form.account_id]);

  useEffect(() => {
    const scrollHost = document.querySelector('.dashboard-main-scroll');
    if (!scrollHost) return undefined;
    const prevOverflow = scrollHost.style.overflowY;
    const prevPadding = scrollHost.style.padding;
    const prevBg = scrollHost.style.backgroundColor;
    const prevDisplay = scrollHost.style.display;
    const prevFlexDirection = scrollHost.style.flexDirection;
    scrollHost.style.overflowY = 'hidden';
    scrollHost.style.padding = '0';
    scrollHost.style.backgroundColor = '#f0fdfa';
    scrollHost.style.display = 'flex';
    scrollHost.style.flexDirection = 'column';
    return () => {
      scrollHost.style.overflowY = prevOverflow;
      scrollHost.style.padding = prevPadding;
      scrollHost.style.backgroundColor = prevBg;
      scrollHost.style.display = prevDisplay;
      scrollHost.style.flexDirection = prevFlexDirection;
    };
  }, []);

  const stats = useMemo(() => {
    const total = receipts.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    const today = receipts.filter((r) => String(r.receipt_date).slice(0, 10) === todayStr());
    const todayTotal = today.reduce((s, r) => s + parseFloat(r.amount || 0), 0);
    return { count: receipts.length, total, todayCount: today.length, todayTotal };
  }, [receipts]);

  const receiveAmount = parseFloat(form.amount || 0) || 0;
  const canSubmit = Boolean(form.emp_id && form.account_id && receiveAmount > 0) && !submitting;

  const statTiles = [
    { title: 'Receipts', val: loading ? '…' : String(stats.count), color: PRIMARY, icon: ReceiptLong },
    { title: 'Total received', val: loading ? '…' : fmtAmt(stats.total), color: RECEIVE, icon: Payments },
    { title: 'Today count', val: loading ? '…' : String(stats.todayCount), color: '#7c3aed', icon: FilterList },
    { title: 'Today amount', val: loading ? '…' : fmtAmt(stats.todayTotal), color: '#d97706', icon: AccountBalanceWallet },
  ];

  async function handleSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/employee-receipts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emp_id: form.emp_id,
          amount: receiveAmount,
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
      showSnack('Payment received — open receipt to print or PDF');
      loadReceipts();
    } catch (err) {
      showSnack(err.message || 'Failed to save receipt', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickPrint(receipt) {
    try {
      const opened = await printEmployeeReceiveReceipt(receipt);
      if (opened === false) showSnack('Allow pop-ups to print A5 receipt', 'warning');
    } catch (err) {
      showSnack(err.message || 'Print failed', 'error');
    }
  }

  const thSx = {
    ...HR_TABLE_HEAD_SX,
    bgcolor: 'rgba(236, 253, 245, 0.9)',
    color: RECEIVE_DEEP,
    fontSize: '0.64rem',
    borderColor: TABLE_LINE,
  };

  return (
    <Box
      sx={{
        flex: 1,
        minHeight: 0,
        height: '100%',
        display: 'flex',
        flexDirection: { xs: 'column', lg: 'row' },
        overflow: 'hidden',
        background: PAGE_CANVAS,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', p: { xs: 1, md: 1.25 }, gap: 1, order: { xs: 2, lg: 1 } }}>
        <Box sx={{ ...glassPanel(), flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 0.95, borderLeft: `4px solid ${RECEIVE}` }}>
          <Button startIcon={<ArrowBack />} onClick={goBack} size="small" sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', border: `1px solid ${BORDER}`, color: NAVY }}>
            Back
          </Button>
          <Box sx={{ width: 38, height: 38, borderRadius: '11px', background: `linear-gradient(135deg, ${RECEIVE} 0%, #14b8a6 100%)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(13, 148, 136, 0.28)' }}>
            <Payments sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.98rem', color: NAVY }}>Receive payment</Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#64748b', display: { xs: 'none', sm: 'block' } }}>Cash/bank from employee · printable receipt</Typography>
          </Box>
        </Box>

        <Box sx={{ flexShrink: 0, display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 0.85 }}>
          {statTiles.map((s) => {
            const Icon = s.icon;
            return (
              <Box key={s.title} sx={{ ...glassPanel({ px: 1.15, py: 0.95, borderLeft: `3px solid ${s.color}` }), display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: '10px', bgcolor: `${s.color}14`, color: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon sx={{ fontSize: 17 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.56rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>{s.title}</Typography>
                  <Typography sx={{ fontSize: '0.92rem', fontWeight: 900, color: s.color, fontFamily: 'ui-monospace, monospace' }} noWrap>{s.val}</Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        <Box sx={{ ...glassPanel(), flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ px: 1.35, py: 0.85, flexShrink: 0, borderBottom: paySectionDivider }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} alignItems={{ lg: 'center' }} justifyContent="space-between">
              <Stack direction="row" alignItems="center" spacing={1}>
                <FilterList sx={{ color: RECEIVE, fontSize: 18 }} />
                <Typography sx={{ fontWeight: 800, fontSize: '0.875rem' }}>Receipt history</Typography>
                {!loading && (
                  <Chip size="small" label={`${stats.count} records`} sx={{ height: 22, fontWeight: 700, bgcolor: RECEIVE_TINT, color: RECEIVE_DEEP }} />
                )}
              </Stack>
              <Stack direction="row" sx={{ bgcolor: '#fff', border: `1px solid ${BORDER}`, borderRadius: '11px', overflow: 'hidden', flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 17, color: '#94a3b8' }} /></InputAdornment> }}
                  sx={{ minWidth: 160, '& .MuiOutlinedInput-root': { borderRadius: 0, height: 38, '& fieldset': { border: 'none' } } }}
                />
                <Stack direction="row" spacing={0.35} sx={{ px: 0.75, py: 0.45, alignItems: 'center' }}>
                  {['ALL', 'CASH', 'BANK_TRANSFER'].map((m) => (
                    <Button
                      key={m}
                      size="small"
                      onClick={() => setModeFilter(m)}
                      sx={{
                        textTransform: 'none',
                        fontWeight: 700,
                        fontSize: '0.72rem',
                        borderRadius: '7px',
                        px: 1,
                        color: modeFilter === m ? '#fff' : '#64748b',
                        bgcolor: modeFilter === m ? (m === 'ALL' ? RECEIVE : m === 'CASH' ? RECEIVE_DEEP : PRIMARY) : 'transparent',
                      }}
                    >
                      {m === 'ALL' ? 'All' : m === 'CASH' ? 'Cash' : 'Bank'}
                    </Button>
                  ))}
                </Stack>
                <IconButton onClick={loadReceipts} sx={{ borderRadius: 0, width: 42, height: 38, color: RECEIVE }}><Refresh /></IconButton>
              </Stack>
            </Stack>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, p: 1, overflow: 'hidden' }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress sx={{ color: RECEIVE }} /></Box>
            ) : receipts.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6, color: '#94a3b8' }}>No receipts yet — receive payment on the right</Box>
            ) : (
              <TableContainer sx={{ height: '100%', overflow: 'auto', bgcolor: '#fff', borderRadius: '12px', border: `1px solid ${TABLE_LINE}` }}>
                <Table stickyHeader size="small" sx={{ tableLayout: 'fixed', width: '100%' }}>
                  <TableHead>
                    <TableRow>
                      {RECEIPT_COLS.map((col, i) => (
                        <TableCell key={col.id} align={col.align || 'left'} sx={{ ...thSx, ...receiptCellSx(i === RECEIPT_COLS.length - 1, true, col) }}>
                          {col.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {receipts.map((r, idx) => {
                      const last = RECEIPT_COLS.length - 1;
                      const cell = (i) => receiptCellSx(i === last, false, RECEIPT_COLS[i]);
                      const rowBg = idx % 2 === 0 ? '#fff' : '#fafbfc';
                      const note = [r.reference, r.notes].filter(Boolean).join(' · ') || '—';
                      return (
                        <TableRow key={r.receipt_id} hover sx={{ '&:hover td': { bgcolor: `${RECEIVE_TINT} !important` } }}>
                          <TableCell sx={{ ...cell(0), bgcolor: rowBg }}>
                            <Typography sx={{ fontWeight: 800, fontSize: '0.78rem', color: NAVY }} noWrap>{r.employee?.emp_name}</Typography>
                            <Typography sx={{ fontSize: '0.62rem', color: '#94a3b8' }} noWrap>
                              {fmtDateCell(r.receipt_date)} · {r.ledger_bill_no || `RCV-${r.receipt_id}`}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ ...cell(1), bgcolor: rowBg }}>
                            <Typography sx={{ fontWeight: 800, color: RECEIVE, fontSize: '0.78rem', fontFamily: 'ui-monospace, monospace' }}>{fmtAmt(r.amount)}</Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ ...cell(2), bgcolor: rowBg }}>
                            <Chip
                              size="small"
                              label={r.payment_mode === 'BANK_TRANSFER' ? 'Bank' : 'Cash'}
                              sx={{
                                height: 22,
                                fontWeight: 800,
                                fontSize: '0.6rem',
                                bgcolor: r.payment_mode === 'BANK_TRANSFER' ? BRAND.tint.blue : RECEIVE_TINT,
                                color: r.payment_mode === 'BANK_TRANSFER' ? PRIMARY : RECEIVE_DEEP,
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ ...cell(3), bgcolor: rowBg }}>
                            <Typography sx={{ fontSize: '0.72rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.account?.cus_name}>
                              {r.account?.cus_name || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ ...cell(4), bgcolor: rowBg }}>
                            <Typography sx={{ fontSize: '0.72rem', color: note === '—' ? '#cbd5e1' : '#475569', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.35 }}>{note}</Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ ...cell(5), bgcolor: rowBg }}>
                            <Stack direction="row" spacing={0.65} justifyContent="center">
                              <Tooltip title="View receipt">
                                <IconButton size="small" onClick={() => { setLastReceipt(r); setReceiptOpen(true); }} sx={{ width: 34, height: 34, border: `1px solid ${RECEIVE_SOFT}`, borderRadius: '9px', color: RECEIVE }}>
                                  <ReceiptLong sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Print">
                                <IconButton size="small" onClick={() => handleQuickPrint(r)} sx={{ width: 34, height: 34, border: `1px solid ${BORDER}`, borderRadius: '9px', color: '#475569' }}>
                                  <Print sx={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </Box>
      </Box>

      <Box sx={{ order: { xs: 1, lg: 2 }, width: { xs: '100%', lg: 356 }, flex: { lg: '0 0 356px' }, height: '100%', p: { xs: 1, md: 1.25 }, pl: { lg: 0 }, display: 'flex' }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', ...payFormShellSx, borderTop: `3px solid ${RECEIVE}` }}>
          <Box sx={{ flexShrink: 0, px: 1.35, py: 1.1, borderBottom: paySectionDivider, background: payHeaderStrip }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.9 }}>
              <Stack direction="row" spacing={0.85} alignItems="center">
                <Box sx={{ width: 34, height: 34, borderRadius: '10px', background: `linear-gradient(135deg, ${RECEIVE} 0%, #14b8a6 100%)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Payments sx={{ fontSize: 18 }} />
                </Box>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569' }}>Receive payment</Typography>
              </Stack>
              <Box sx={{ textAlign: 'right', px: 1.1, py: 0.45, borderRadius: '11px', bgcolor: receiveAmount > 0 ? RECEIVE_TINT : BRAND.tint.blue, border: `1px solid ${receiveAmount > 0 ? RECEIVE_SOFT : `${PRIMARY}22`}` }}>
                <Typography sx={{ fontSize: '0.58rem', fontWeight: 800, color: receiveAmount > 0 ? RECEIVE : PRIMARY, textTransform: 'uppercase' }}>Receiving</Typography>
                <Typography sx={{ fontSize: '1.05rem', fontWeight: 900, color: receiveAmount > 0 ? RECEIVE_DEEP : NAVY, fontFamily: 'ui-monospace, monospace' }}>{fmtAmt(receiveAmount)}</Typography>
              </Box>
            </Stack>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', mb: 0.45 }}>Receipt date</Typography>
            <TextField
              fullWidth
              size="small"
              type="date"
              value={form.receipt_date}
              onChange={(e) => setForm((f) => ({ ...f, receipt_date: e.target.value }))}
              InputLabelProps={{ shrink: true }}
              sx={fieldSxPay}
              InputProps={{ startAdornment: <InputAdornment position="start"><CalendarToday sx={{ fontSize: 16, color: RECEIVE }} /></InputAdornment> }}
            />
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 1.35, py: 1.1 }}>
            <Stack spacing={0.95}>
              <ToggleButtonGroup
                exclusive
                fullWidth
                size="small"
                value={form.payment_mode}
                onChange={(_, v) => v && setForm((f) => ({ ...f, payment_mode: v, account_id: '' }))}
                sx={togglePaySx}
              >
                <ToggleButton value="CASH">Cash</ToggleButton>
                <ToggleButton value="BANK_TRANSFER">Bank</ToggleButton>
              </ToggleButtonGroup>

              <Autocomplete
                options={activeEmployees}
                loading={employeesLoading}
                getOptionLabel={(o) => `${o.emp_name}${o.designation ? ` · ${o.designation}` : ''}`}
                value={selectedEmployee}
                onChange={(_, v) => setForm((f) => ({ ...f, emp_id: v ? String(v.emp_id) : '' }))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Employee *"
                    sx={fieldSxPay}
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
              />

              <TextField
                required
                label="Amount *"
                type="number"
                inputProps={{ step: '0.01', min: 0 }}
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                sx={fieldSxAmount}
                InputProps={{ startAdornment: <InputAdornment position="start"><Typography sx={{ fontWeight: 800, color: RECEIVE }}>Rs</Typography></InputAdornment> }}
              />

              <Autocomplete
                options={accountOptions}
                getOptionLabel={(o) => o.cus_name || ''}
                value={accountOptions.find((a) => String(a.cus_id) === form.account_id) || null}
                onChange={(_, v) => setForm((f) => ({ ...f, account_id: v ? String(v.cus_id) : '' }))}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Receive into account *"
                    sx={fieldSxPay}
                    helperText={
                      form.account_id
                        ? `Balance ${fmtAmt(accountOptions.find((a) => String(a.cus_id) === form.account_id)?.cus_balance)}`
                        : undefined
                    }
                  />
                )}
              />

              <TextField label="Reference (optional)" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} sx={fieldSxPay} />
              <TextField label="Notes (optional)" multiline minRows={2} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} sx={fieldSxPay} />
            </Stack>
          </Box>

          <Box sx={{ flexShrink: 0, px: 1.35, py: 1.15, borderTop: paySectionDivider, background: payFooterStrip }}>
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={!canSubmit}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <ReceiptLong />}
              sx={{
                py: 1.25,
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: '11px',
                background: canSubmit ? `linear-gradient(135deg, ${RECEIVE} 0%, #14b8a6 55%, ${PRIMARY} 100%)` : undefined,
                bgcolor: canSubmit ? undefined : '#e2e8f0',
                boxShadow: canSubmit ? '0 6px 18px rgba(13, 148, 136, 0.28)' : 'none',
                '&.Mui-disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
              }}
            >
              {submitting ? 'Saving…' : 'Save & open receipt'}
            </Button>
            <Button type="button" fullWidth onClick={() => setForm({ emp_id: '', amount: '', receipt_date: todayStr(), payment_mode: 'CASH', account_id: '', reference: '', notes: '' })} sx={{ mt: 0.55, textTransform: 'none', fontWeight: 700, color: '#64748b' }}>
              Clear form
            </Button>
          </Box>
        </Box>
      </Box>

      <EmployeeReceiveReceiptDialog
        open={receiptOpen && !!lastReceipt}
        onClose={() => setReceiptOpen(false)}
        receipt={lastReceipt}
        employeeOptions={activeEmployees}
        onNotify={showSnack}
      />

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} sx={{ borderRadius: '12px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
