'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box, Typography, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Chip, Snackbar, Alert, IconButton, Tooltip, CircularProgress, Stack,
  Autocomplete, ToggleButton, ToggleButtonGroup, InputAdornment, Grid,
} from '@mui/material';
import {
  AccountBalanceWallet, Payments, Person, DeleteOutline, Refresh,
  TrendingUp, FilterList, Search, ReceiptLong, CalendarToday, ArrowBack,
} from '@mui/icons-material';
import SalaryAdvanceVoucherDialog from './SalaryAdvanceVoucherDialog';
import { useRouter } from 'next/navigation';
import { BRAND } from '@/lib/brand-theme';
import { useHrRefresh, useHrRefreshVersion, HR_KEYS } from '../context/HrRefreshContext';
import { useHrEmployeeOptions } from '../hooks/useHrEmployeeOptions';
import { HR_FIELD_SX, HR_TABLE_HEAD_SX } from './shared/hrUiShared';

const NAVY = '#0f172a';
const PRIMARY = BRAND.primary.blue;
const ADVANCE = '#ea580c';
const ADVANCE_DEEP = '#c2410c';
const ADVANCE_TINT = '#fff7ed';
const ADVANCE_SOFT = '#ffedd5';
const BORDER = '#e2e8f0';

/** Salary Advance module — warm “giving” + brand blue */
const PAGE_CANVAS = `
  radial-gradient(ellipse 90% 55% at 10% 0%, rgba(251, 146, 60, 0.14), transparent 52%),
  radial-gradient(ellipse 75% 50% at 95% 100%, rgba(26, 85, 227, 0.11), transparent 50%),
  linear-gradient(180deg, #fffbf7 0%, #f5f7fc 48%, #f8fafc 100%)
`;

function glassPanel(extra = {}) {
  return {
    bgcolor: 'rgba(255, 252, 248, 0.78)',
    backdropFilter: 'blur(16px) saturate(1.35)',
    WebkitBackdropFilter: 'blur(16px) saturate(1.35)',
    border: '1px solid rgba(255, 255, 255, 0.95)',
    boxShadow: '0 10px 36px rgba(234, 88, 12, 0.06), 0 4px 16px rgba(26, 85, 227, 0.05), inset 0 1px 0 rgba(255, 255, 255, 1)',
    borderRadius: '14px',
    ...extra,
  };
}

const glassInset = {
  bgcolor: 'rgba(255, 255, 255, 0.42)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.75)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.8)',
};

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

const PAY_CASH = '#059669';
const PAY_CASH_TINT = '#ecfdf5';
const PAY_BANK_TINT = '#eff6ff';

const PAY_METHOD_THEME = {
  CASH: {
    accent: PAY_CASH,
    tint: PAY_CASH_TINT,
    body: `linear-gradient(165deg, ${PAY_CASH_TINT} 0%, #f8fafc 55%, #ffffff 100%)`,
    track: 'rgba(236, 253, 245, 0.95)',
  },
  BANK: {
    accent: PRIMARY,
    tint: PAY_BANK_TINT,
    body: `linear-gradient(165deg, ${PAY_BANK_TINT} 0%, #f8fafc 55%, #ffffff 100%)`,
    track: 'rgba(239, 246, 255, 0.95)',
  },
  PARTIAL: {
    accent: ADVANCE,
    tint: ADVANCE_TINT,
    body: `linear-gradient(165deg, ${ADVANCE_TINT} 0%, ${PAY_BANK_TINT} 50%, #ffffff 100%)`,
    track: 'rgba(255, 247, 237, 0.92)',
  },
};

/** Light payment panel — soft blue + warm white */
const PAY_PANEL_SURFACE = `linear-gradient(180deg, #eef4ff 0%, #f8fafc 42%, #fffbf7 100%)`;

const payFormShellSx = {
  borderRadius: '16px',
  overflow: 'hidden',
  background: PAY_PANEL_SURFACE,
  border: '1px solid rgba(26, 85, 227, 0.12)',
  boxShadow: '0 16px 48px rgba(26, 85, 227, 0.08), 0 4px 12px rgba(15, 23, 42, 0.04)',
  color: NAVY,
};

const payHeaderStrip = 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(238, 244, 255, 0.5) 100%)';

const payFooterStrip = 'linear-gradient(180deg, rgba(255, 251, 247, 0.4) 0%, rgba(238, 244, 255, 0.85) 100%)';

const paySectionDivider = '1px solid rgba(226, 232, 240, 0.9)';

function payPanelAccentSx(method) {
  const t = PAY_METHOD_THEME[method] || PAY_METHOD_THEME.BANK;
  return { borderTop: `3px solid ${t.accent}` };
}

const fieldSxPay = {
  ...HR_FIELD_SX,
  width: '100%',
  display: 'block',
  mb: 0.25,
  '& .MuiInputLabel-root': {
    color: '#64748b',
    fontWeight: 600,
    fontSize: '0.8125rem',
    lineHeight: 1.2,
    '&.MuiInputLabel-shrink': {
      transform: 'translate(14px, -9px) scale(0.78)',
      bgcolor: '#ffffff',
      px: 0.6,
    },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: PRIMARY },
  '& .MuiOutlinedInput-root': {
    ...HR_FIELD_SX['& .MuiOutlinedInput-root'],
    minHeight: 44,
    borderRadius: '11px',
    bgcolor: '#ffffff',
    color: NAVY,
    transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
    '& .MuiOutlinedInput-input, & .MuiAutocomplete-input': {
      py: 1.15,
      color: NAVY,
    },
    '& fieldset': { borderColor: '#cbd5e1' },
    '&:hover fieldset': { borderColor: '#94a3b8' },
    '&.Mui-focused fieldset': { borderColor: PRIMARY, borderWidth: 2 },
    '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(26, 85, 227, 0.12)' },
  },
  '& .MuiFormHelperText-root': { fontSize: '0.68rem', mt: 0.35, mb: 0, fontWeight: 600, color: '#64748b' },
};

const fieldSxPayAmount = {
  ...fieldSxPay,
  '& .MuiOutlinedInput-root': {
    ...fieldSxPay['& .MuiOutlinedInput-root'],
    bgcolor: '#fffbf7',
    '& fieldset': { borderColor: '#fcd34d' },
    '&:hover fieldset': { borderColor: '#fbbf24' },
    '&.Mui-focused fieldset': { borderColor: '#f59e0b', borderWidth: 2 },
    '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(245, 158, 11, 0.15)' },
  },
  '& .MuiInputLabel-root': {
    color: '#b45309',
    fontWeight: 700,
    '&.MuiInputLabel-shrink': {
      bgcolor: '#fffbf7',
    },
  },
  '& .MuiInputLabel-root.Mui-focused': { color: '#d97706' },
};

const togglePaySxLight = {
  borderRadius: '12px',
  p: 0.45,
  gap: 0.35,
  bgcolor: 'rgba(255, 255, 255, 0.75)',
  border: '1px solid rgba(26, 85, 227, 0.14)',
  boxShadow: 'inset 0 1px 2px rgba(15, 23, 42, 0.03)',
  '& .MuiToggleButton-root': {
    textTransform: 'none',
    fontWeight: 700,
    fontSize: '0.72rem',
    py: 0.85,
    borderRadius: '9px !important',
    border: 'none !important',
    flex: 1,
    color: '#64748b',
    transition: 'background-color 0.2s ease, color 0.2s ease, box-shadow 0.2s ease',
    '&.Mui-selected[value="CASH"]': {
      bgcolor: `${PAY_CASH_TINT} !important`,
      color: `${PAY_CASH} !important`,
      boxShadow: '0 1px 4px rgba(5, 150, 105, 0.1)',
    },
    '&.Mui-selected[value="BANK"]': {
      bgcolor: `${PAY_BANK_TINT} !important`,
      color: `${PRIMARY} !important`,
      boxShadow: '0 1px 4px rgba(26, 85, 227, 0.1)',
    },
    '&.Mui-selected[value="PARTIAL"]': {
      bgcolor: `${ADVANCE_TINT} !important`,
      color: `${ADVANCE} !important`,
      boxShadow: '0 1px 4px rgba(234, 88, 12, 0.1)',
    },
    '&:hover': { bgcolor: 'rgba(248, 250, 252, 0.9)' },
  },
};

function advancePaymentLabel(a) {
  if (a.payment_split) return 'Split';
  return a.payment_mode === 'BANK_TRANSFER' ? 'Bank' : 'Cash';
}

function advancePayChipSx(a) {
  if (a.payment_split) {
    return { bgcolor: ADVANCE_TINT, color: ADVANCE, border: '1px solid #fed7aa' };
  }
  if (a.payment_mode === 'BANK_TRANSFER') {
    return { bgcolor: BRAND.tint.blue, color: PRIMARY, border: `1px solid ${PRIMARY}28` };
  }
  return { bgcolor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' };
}

const TABLE_LINE = 'rgba(226, 232, 240, 0.85)';
const TABLE_LINE_HEAD = 'rgba(203, 213, 225, 0.75)';

const ADVANCE_TABLE_COLS = [
  { id: 'employee', label: 'Employee', align: 'left', width: '26%' },
  { id: 'amount', label: 'Amount', align: 'right', width: '13%' },
  { id: 'pay', label: 'Pay', align: 'center', width: '10%' },
  { id: 'reason', label: 'Reason', align: 'left', width: '21%' },
  { id: 'status', label: 'Status', align: 'center', width: '10%' },
  { id: 'actions', label: 'Actions', align: 'center', width: '12%' },
];

function advanceTableCellSx(isLastCol, isHead, col) {
  return {
    borderBottom: `1px solid ${isHead ? TABLE_LINE_HEAD : TABLE_LINE}`,
    borderRight: isLastCol ? 'none' : `1px solid ${TABLE_LINE}`,
    verticalAlign: 'middle',
    px: 0.65,
    py: isHead ? 0.85 : 0.55,
    width: col?.width,
    maxWidth: col?.width,
    overflow: 'hidden',
  };
}

function fmtDateCell(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export default function SalaryAdvanceTab({ onBackToHub }) {
  const router = useRouter();
  const goBack = () => {
    if (typeof onBackToHub === 'function') onBackToHub();
    else router.push('/dashboard/hr');
  };
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
  const [voucherAdvance, setVoucherAdvance] = useState(null);

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
    const scrollHost = document.querySelector('.dashboard-main-scroll');
    if (!scrollHost) return undefined;
    const prevOverflow = scrollHost.style.overflowY;
    const prevPadding = scrollHost.style.padding;
    scrollHost.style.overflowY = 'hidden';
    scrollHost.style.padding = '0';
    const prevBg = scrollHost.style.backgroundColor;
    const prevDisplay = scrollHost.style.display;
    const prevFlexDirection = scrollHost.style.flexDirection;
    scrollHost.style.backgroundColor = '#fffbf7';
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

  useEffect(() => {
    if (form.paymentMethod !== 'BANK' || form.bank_account_id || bankAccountsList.length === 0) return;
    const defaultBank = bankAccountsList[0];
    if (defaultBank) {
      setForm((f) => ({ ...f, bank_account_id: String(defaultBank.cus_id) }));
    }
  }, [bankAccountsList, form.paymentMethod, form.bank_account_id]);

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
      const balBefore = parseFloat(
        selectedEmployee?.ledger_balance ?? selectedEmployee?.account_balance ?? 0
      );
      setVoucherAdvance({
        ...data,
        payment_reference: payload.payment_reference ?? data.payment_reference ?? null,
        balance_before: balBefore,
        balance_after: Number((balBefore + amount).toFixed(2)),
        employee: {
          ...selectedEmployee,
          ...data.employee,
        },
      });
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
    ...HR_TABLE_HEAD_SX,
    borderColor: 'rgba(253, 186, 116, 0.35)',
    bgcolor: 'rgba(255, 247, 237, 0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    color: ADVANCE_DEEP,
    fontSize: '0.64rem',
    letterSpacing: '0.09em',
  };

  const splitCash = parseFloat(form.cash_amount) || 0;
  const splitBank = parseFloat(form.bank_amount) || 0;
  const splitTotal = splitCash + splitBank;
  const payAmount =
    form.paymentMethod === 'PARTIAL' && splitTotal > 0 ? splitTotal : parseFloat(form.amount || 0) || 0;

  const canSubmit = Boolean(form.emp_id) && !submitting;
  const statTiles = [
    { title: 'Pending balance', val: loading ? '…' : fmtAmt(stats.pendingTotal), color: ADVANCE, icon: AccountBalanceWallet },
    { title: 'Given this month', val: loading ? '…' : fmtAmt(stats.thisMonth), color: PRIMARY, icon: TrendingUp },
    { title: 'Deducted (settled)', val: loading ? '…' : fmtAmt(stats.deductedTotal), color: '#15803d', icon: Payments },
    { title: 'Total records', val: loading ? '…' : String(stats.recordCount), color: '#7c3aed', icon: FilterList },
  ];

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
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          order: { xs: 2, lg: 1 },
          overflow: 'hidden',
          p: { xs: 1, md: 1.25 },
          gap: 1,
        }}
      >
        <Box
          sx={{
            ...glassPanel(),
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: { xs: 1, md: 1.25 },
            px: { xs: 1.25, md: 1.5 },
            py: 0.95,
            borderLeft: `4px solid ${ADVANCE}`,
          }}
        >
          <Button
            type="button"
            variant="text"
            size="small"
            startIcon={<ArrowBack sx={{ fontSize: 18 }} />}
            onClick={goBack}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              borderRadius: '10px',
              color: NAVY,
              flexShrink: 0,
              px: 1.25,
              bgcolor: 'rgba(255,255,255,0.65)',
              border: `1px solid ${BORDER}`,
              '&:hover': { bgcolor: '#fff', borderColor: ADVANCE_SOFT },
            }}
          >
            Back
          </Button>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '11px',
              flexShrink: 0,
              background: `linear-gradient(135deg, ${ADVANCE} 0%, #f97316 100%)`,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(234, 88, 12, 0.28)',
            }}
          >
            <AccountBalanceWallet sx={{ fontSize: 20 }} />
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.98rem', color: NAVY, lineHeight: 1.25 }}>
              Salary Advance
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#78716c', display: { xs: 'none', sm: 'block' } }} noWrap>
              Give advance · track settlement
            </Typography>
          </Box>
        </Box>

          <Box
            sx={{
              flexShrink: 0,
              display: 'grid',
              gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
              gap: 0.85,
            }}
          >
            {statTiles.map((s) => {
              const Icon = s.icon;
              return (
                <Box
                  key={s.title}
                  sx={{
                    ...glassPanel({ px: 1.15, py: 0.95, borderLeft: `3px solid ${s.color}` }),
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '10px',
                      bgcolor: `${s.color}18`,
                      color: s.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: `inset 0 0 0 1px ${s.color}22`,
                    }}
                  >
                    <Icon sx={{ fontSize: 17 }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.56rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase', lineHeight: 1.2 }}>
                      {s.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.92rem', fontWeight: 900, color: s.color, fontFamily: 'ui-monospace, monospace', lineHeight: 1.15 }} noWrap>
                      {s.val}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>

          <Box
            sx={{
              ...glassPanel(),
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
          <Box
            sx={{
              px: { xs: 1.15, md: 1.35 },
              py: 0.85,
              flexShrink: 0,
              borderBottom: '1px solid rgba(226, 232, 240, 0.65)',
            }}
          >
            <Stack
              direction={{ xs: 'column', lg: 'row' }}
              spacing={1.25}
              alignItems={{ lg: 'center' }}
              justifyContent="space-between"
            >
              <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '10px',
                    ...glassInset,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: PRIMARY,
                  }}
                >
                  <FilterList sx={{ fontSize: 17 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800, color: NAVY, fontSize: '0.875rem', lineHeight: 1.2 }}>
                    Advance records
                  </Typography>
                  {!loading && (
                    <Typography sx={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
                      Showing {filteredAdvances.length} of {stats.recordCount}
                    </Typography>
                  )}
                </Box>
              </Stack>

              <Stack
                direction="row"
                spacing={0}
                alignItems="stretch"
                flexWrap="wrap"
                useFlexGap
                sx={{
                  width: { xs: '100%', lg: 'auto' },
                  ...glassInset,
                  borderRadius: '11px',
                  overflow: 'hidden',
                }}
              >
                <TextField
                  size="small"
                  placeholder="Search employee or reason…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ fontSize: 17, color: '#94a3b8' }} />
                      </InputAdornment>
                    ),
                  }}
                  sx={{
                    flex: { xs: '1 1 100%', sm: '1 1 auto' },
                    minWidth: { sm: 160, md: 180 },
                    maxWidth: { lg: 200 },
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 0,
                      height: 38,
                      border: 'none',
                      '& fieldset': { border: 'none' },
                    },
                  }}
                />
                <Box sx={{ width: '1px', bgcolor: BORDER, alignSelf: 'stretch', display: { xs: 'none', sm: 'block' } }} />
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.35}
                  sx={{ px: 0.75, py: 0.45, flexShrink: 0 }}
                >
                  {['ALL', 'PENDING', 'DEDUCTED'].map((s) => {
                    const active = statusFilter === s;
                    const meta = s === 'ALL' ? null : STATUS_META[s];
                    return (
                      <Button
                        key={s}
                        size="small"
                        onClick={() => setStatusFilter(s)}
                        sx={{
                          minWidth: 0,
                          px: 1.15,
                          py: 0.45,
                          borderRadius: '7px',
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          lineHeight: 1.2,
                          color: active ? (s === 'ALL' ? '#fff' : meta?.color) : '#64748b',
                          bgcolor: active ? (s === 'ALL' ? PRIMARY : meta?.bg) : 'transparent',
                          border: active ? '1px solid transparent' : `1px solid ${BORDER}`,
                          boxShadow: active ? '0 1px 4px rgba(15, 23, 42, 0.08)' : 'none',
                          transition: 'background-color 0.15s ease, color 0.15s ease',
                          '&:hover': {
                            bgcolor: active ? undefined : '#f8fafc',
                          },
                        }}
                      >
                        {s === 'ALL' ? 'All' : meta?.label || s}
                      </Button>
                    );
                  })}
                </Stack>
                <Box sx={{ width: '1px', bgcolor: BORDER, alignSelf: 'stretch' }} />
                <Tooltip title="Refresh list">
                  <span>
                    <IconButton
                      onClick={fetchData}
                      disabled={loading}
                      sx={{
                        borderRadius: 0,
                        width: 42,
                        height: 38,
                        color: PRIMARY,
                        '&:hover': { bgcolor: BRAND.tint.blue },
                      }}
                    >
                      <Refresh sx={{ fontSize: 18 }} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
          </Box>

          <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', p: { xs: 0.85, md: 1 }, pt: 0.75 }}>
            {loading ? (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size={32} sx={{ color: PRIMARY }} />
              </Box>
            ) : filteredAdvances.length === 0 ? (
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', px: 3 }}>
                <AccountBalanceWallet sx={{ fontSize: 52, color: '#cbd5e1', mb: 1 }} />
                <Typography sx={{ fontWeight: 800, color: '#64748b' }}>No advance records</Typography>
                <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', mt: 0.5 }}>
                  Use the payment panel on the right to issue an advance
                </Typography>
              </Box>
            ) : (
              <TableContainer
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  ...glassInset,
                  borderRadius: '12px',
                }}
              >
                <Table
                  stickyHeader
                  size="small"
                  sx={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}
                >
                  <TableHead>
                    <TableRow>
                      {ADVANCE_TABLE_COLS.map((col, colIdx) => (
                        <TableCell
                          key={col.id}
                          align={col.align}
                          sx={{
                            ...thSx,
                            ...advanceTableCellSx(colIdx === ADVANCE_TABLE_COLS.length - 1, true, col),
                          }}
                        >
                          {col.label}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAdvances.map((a, idx) => {
                      const st = STATUS_META[a.status] || STATUS_META.CANCELLED;
                      const isClrAdv = (a.reason || '').startsWith('__CLR_ADV__');
                      const reasonText = isClrAdv ? 'With salary clearance' : (a.reason || '').trim();
                      const lastCol = ADVANCE_TABLE_COLS.length - 1;
                      const cellBase = (i) => advanceTableCellSx(i === lastCol, false, ADVANCE_TABLE_COLS[i]);
                      const rowBg = idx % 2 === 0 ? 'rgba(255,255,255,0.55)' : 'rgba(248, 250, 252, 0.65)';
                      const empName = a.employee?.emp_name || `#${a.emp_id}`;

                      return (
                        <TableRow
                          key={a.advance_id}
                          hover
                          sx={{
                            bgcolor: rowBg,
                            '&:hover td': { bgcolor: 'rgba(241, 245, 249, 0.95) !important' },
                          }}
                        >
                          <TableCell sx={{ ...cellBase(0), bgcolor: rowBg }}>
                            <Typography
                              sx={{ fontWeight: 800, fontSize: '0.78rem', color: NAVY, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                              title={empName}
                            >
                              {empName}
                            </Typography>
                            <Typography sx={{ fontSize: '0.62rem', color: '#94a3b8', lineHeight: 1.3 }} noWrap title={`ADV-${a.advance_id}`}>
                              {fmtDateCell(a.advance_date)}
                              <Box component="span" sx={{ mx: 0.5, opacity: 0.45 }}>·</Box>
                              <Box component="span" sx={{ fontFamily: 'ui-monospace, monospace' }}>ADV-{a.advance_id}</Box>
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ ...cellBase(1), bgcolor: rowBg }}>
                            <Typography
                              component="span"
                              sx={{
                                fontWeight: 800,
                                color: ADVANCE,
                                fontSize: '0.75rem',
                                fontFamily: 'ui-monospace, monospace',
                                fontVariantNumeric: 'tabular-nums',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {fmtAmt(a.amount)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ ...cellBase(2), bgcolor: rowBg, px: 0.35 }}>
                            <Chip
                              size="small"
                              label={advancePaymentLabel(a)}
                              sx={{
                                height: 22,
                                maxWidth: '100%',
                                fontWeight: 800,
                                fontSize: '0.6rem',
                                borderRadius: '6px',
                                '& .MuiChip-label': { px: 0.75 },
                                ...advancePayChipSx(a),
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ ...cellBase(3), bgcolor: rowBg, overflow: 'visible', verticalAlign: 'middle', py: 0.65 }}>
                            <Typography
                              sx={{
                                fontSize: '0.72rem',
                                color: reasonText ? '#475569' : '#cbd5e1',
                                fontWeight: reasonText ? 500 : 400,
                                lineHeight: 1.4,
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                              }}
                            >
                              {reasonText || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ ...cellBase(4), bgcolor: rowBg, px: 0.35 }}>
                            <Chip
                              size="small"
                              label={st.label}
                              sx={{
                                height: 22,
                                maxWidth: '100%',
                                fontWeight: 800,
                                fontSize: '0.6rem',
                                bgcolor: st.bg,
                                color: st.color,
                                border: `1px solid ${st.color}22`,
                                borderRadius: '6px',
                                '& .MuiChip-label': { px: 0.65 },
                              }}
                            />
                          </TableCell>
                          <TableCell align="center" sx={{ ...cellBase(5), bgcolor: rowBg, px: 0.35, verticalAlign: 'middle' }}>
                            <Box
                              sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 0.75,
                                minHeight: 34,
                              }}
                            >
                              <Box sx={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <Tooltip title="Receipt / voucher">
                                  <IconButton
                                    onClick={() => setVoucherAdvance(a)}
                                    sx={{
                                      width: 34,
                                      height: 34,
                                      color: ADVANCE,
                                      border: '1px solid #fdba74',
                                      borderRadius: '9px',
                                      bgcolor: 'rgba(255,255,255,0.85)',
                                      boxShadow: '0 1px 4px rgba(234, 88, 12, 0.12)',
                                      '&:hover': { bgcolor: ADVANCE_TINT, borderColor: ADVANCE },
                                    }}
                                  >
                                    <ReceiptLong sx={{ fontSize: 18 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                              <Box sx={{ width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {a.status === 'PENDING' && !isClrAdv ? (
                                  <Tooltip title="Cancel advance">
                                    <span>
                                      <IconButton
                                        disabled={deletingId === a.advance_id}
                                        onClick={() => handleCancelAdvance(a)}
                                        sx={{
                                          width: 34,
                                          height: 34,
                                          color: '#dc2626',
                                          border: '1px solid #fca5a5',
                                          borderRadius: '9px',
                                          bgcolor: 'rgba(255,255,255,0.85)',
                                          boxShadow: '0 1px 4px rgba(220, 38, 38, 0.1)',
                                          '&:hover': { bgcolor: '#fef2f2', borderColor: '#dc2626' },
                                        }}
                                      >
                                        {deletingId === a.advance_id ? <CircularProgress size={16} /> : <DeleteOutline sx={{ fontSize: 18 }} />}
                                      </IconButton>
                                    </span>
                                  </Tooltip>
                                ) : null}
                              </Box>
                            </Box>
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

      <Box
        sx={{
          order: { xs: 1, lg: 2 },
          flexShrink: 0,
          width: { xs: '100%', lg: 356 },
          flex: { lg: '0 0 356px' },
          minHeight: { xs: 'auto', lg: 0 },
          height: '100%',
          p: { xs: 1, md: 1.25 },
          pl: { lg: 0 },
          display: 'flex',
        }}
      >
      <Box
        component="form"
        noValidate
        onSubmit={handleSubmit}
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          ...payFormShellSx,
          ...payPanelAccentSx(form.paymentMethod),
        }}
      >
          <Box
            sx={{
              flexShrink: 0,
              px: 1.35,
              pt: 1.1,
              pb: 1.1,
              borderBottom: paySectionDivider,
              background: payHeaderStrip,
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 0.9 }}>
              <Stack direction="row" alignItems="center" spacing={0.85} sx={{ minWidth: 0 }}>
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '10px',
                    background: `linear-gradient(135deg, ${PRIMARY} 0%, ${BRAND.supporting.periwinkle} 100%)`,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 12px rgba(26, 85, 227, 0.22)',
                    flexShrink: 0,
                  }}
                >
                  <Payments sx={{ fontSize: 18 }} />
                </Box>
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#475569', lineHeight: 1.2 }}>
                  Payment settlement
                </Typography>
              </Stack>
              <Box
                sx={{
                  textAlign: 'right',
                  flexShrink: 0,
                  px: 1.1,
                  py: 0.45,
                  borderRadius: '11px',
                  bgcolor: payAmount > 0 ? '#fff7ed' : BRAND.tint.blue,
                  border: payAmount > 0 ? '1px solid #fed7aa' : `1px solid ${PRIMARY}22`,
                  boxShadow: '0 2px 10px rgba(26, 85, 227, 0.06)',
                }}
              >
                <Typography
                  sx={{
                    fontSize: '0.58rem',
                    fontWeight: 800,
                    color: payAmount > 0 ? ADVANCE : PRIMARY,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  Paying now
                </Typography>
                <Typography
                  sx={{
                    fontSize: '1.08rem',
                    fontWeight: 900,
                    color: payAmount > 0 ? ADVANCE_DEEP : NAVY,
                    fontFamily: 'ui-monospace, monospace',
                    lineHeight: 1.15,
                  }}
                >
                  {fmtAmt(payAmount)}
                </Typography>
              </Box>
            </Stack>
            <TextField
              fullWidth
              size="small"
              label="Advance date"
              type="date"
              value={form.advance_date}
              onChange={(e) => setForm((f) => ({ ...f, advance_date: e.target.value }))}
              inputProps={{ lang: 'en-GB' }}
              InputLabelProps={{ shrink: true }}
              sx={{ ...fieldSxPay, mb: 0.75 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <CalendarToday sx={{ fontSize: 16, color: PRIMARY }} />
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          <Box
            sx={{
              flex: 1,
              minHeight: 0,
              overflowX: 'hidden',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
              px: 1.35,
              py: 1.15,
              pb: 1.5,
              scrollbarGutter: 'stable',
            }}
          >
            <Stack spacing={1.15}>
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
                sx={togglePaySxLight}
              >
                <ToggleButton value="CASH">Cash</ToggleButton>
                <ToggleButton value="BANK">Bank</ToggleButton>
                <ToggleButton value="PARTIAL">Split</ToggleButton>
              </ToggleButtonGroup>

              <Stack spacing={1.25}>
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
                    placeholder="Search staff…"
                    margin="dense"
                    InputLabelProps={{ shrink: true }}
                    sx={fieldSxPay}
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <InputAdornment position="start">
                            <Person sx={{ fontSize: 18, color: '#94a3b8' }} />
                          </InputAdornment>
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
                        </Typography>
                      </Box>
                    </Box>
                  );
                }}
              />

              {form.paymentMethod === 'PARTIAL' ? (
                <>
                  <Grid container spacing={1.25}>
                    <Grid size={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Cash amount"
                        type="number"
                        margin="dense"
                        InputLabelProps={{ shrink: true }}
                        value={form.cash_amount}
                        onChange={(e) => setForm((f) => ({ ...f, cash_amount: e.target.value }))}
                        InputProps={{ startAdornment: <InputAdornment position="start">Rs</InputAdornment> }}
                        sx={{
                          ...fieldSxPay,
                          '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: ADVANCE },
                        }}
                      />
                    </Grid>
                    <Grid size={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Bank amount"
                        type="number"
                        margin="dense"
                        InputLabelProps={{ shrink: true }}
                        value={form.bank_amount}
                        onChange={(e) => setForm((f) => ({ ...f, bank_amount: e.target.value }))}
                        InputProps={{ startAdornment: <InputAdornment position="start">Rs</InputAdornment> }}
                        sx={{
                          ...fieldSxPay,
                          '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: PRIMARY },
                        }}
                      />
                    </Grid>
                  </Grid>
                </>
              ) : (
                <TextField
                  fullWidth
                  size="small"
                  label="Advance amount"
                  type="number"
                  margin="dense"
                  InputLabelProps={{ shrink: true }}
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Typography sx={{ fontWeight: 800, fontSize: '0.8125rem', color: '#d97706' }}>Rs</Typography>
                      </InputAdornment>
                    ),
                  }}
                  sx={fieldSxPayAmount}
                />
              )}

              {(form.paymentMethod === 'CASH' || form.paymentMethod === 'PARTIAL') && (
                <Autocomplete
                  options={cashAccountsList}
                  getOptionLabel={(o) => o.cus_name || ''}
                  isOptionEqualToValue={(a, b) => a?.cus_id === b?.cus_id}
                  value={cashAccountsList.find((a) => String(a.cus_id) === form.paid_from_account_id) || null}
                  onChange={(_, val) => setForm((f) => ({ ...f, paid_from_account_id: val ? String(val.cus_id) : '' }))}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Cash account"
                      margin="dense"
                      InputLabelProps={{ shrink: true }}
                      sx={fieldSxPay}
                      helperText={
                        form.paid_from_account_id
                          ? `Balance ${fmtAmt(cashAccountsList.find((a) => String(a.cus_id) === form.paid_from_account_id)?.cus_balance)}`
                          : undefined
                      }
                    />
                  )}
                  renderOption={(props, option) => {
                    const { key, ...optionProps } = props;
                    return (
                      <Box component="li" key={key} {...optionProps}>
                        <Stack direction="row" justifyContent="space-between" width="100%">
                          <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>{option.cus_name}</Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{fmtAmt(option.cus_balance)}</Typography>
                        </Stack>
                      </Box>
                    );
                  }}
                />
              )}

              {(form.paymentMethod === 'BANK' || form.paymentMethod === 'PARTIAL') && (
                <Autocomplete
                  options={bankAccountsList}
                  getOptionLabel={(o) => o.cus_name || ''}
                  isOptionEqualToValue={(a, b) => a?.cus_id === b?.cus_id}
                  value={bankAccountsList.find((a) => String(a.cus_id) === form.bank_account_id) || null}
                  onChange={(_, val) => setForm((f) => ({ ...f, bank_account_id: val ? String(val.cus_id) : '' }))}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Bank account"
                      margin="dense"
                      InputLabelProps={{ shrink: true }}
                      sx={fieldSxPay}
                      helperText={
                        form.bank_account_id
                          ? `Balance ${fmtAmt(bankAccountsList.find((a) => String(a.cus_id) === form.bank_account_id)?.cus_balance)}`
                          : undefined
                      }
                    />
                  )}
                  renderOption={(props, option) => {
                    const { key, ...optionProps } = props;
                    return (
                      <Box component="li" key={key} {...optionProps}>
                        <Stack direction="row" justifyContent="space-between" width="100%">
                          <Typography sx={{ fontWeight: 600, fontSize: '0.8125rem' }}>{option.cus_name}</Typography>
                          <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>{fmtAmt(option.cus_balance)}</Typography>
                        </Stack>
                      </Box>
                    );
                  }}
                />
              )}

              <TextField
                fullWidth
                size="small"
                label="Reason (optional)"
                placeholder="Emergency, medical…"
                margin="dense"
                InputLabelProps={{ shrink: true }}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                sx={fieldSxPay}
              />
              <TextField
                fullWidth
                size="small"
                label="Reference (optional)"
                placeholder="Cheque / slip no."
                margin="dense"
                InputLabelProps={{ shrink: true }}
                value={form.payment_reference}
                onChange={(e) => setForm((f) => ({ ...f, payment_reference: e.target.value }))}
                sx={fieldSxPay}
              />
              </Stack>
            </Stack>
          </Box>

          <Box
            sx={{
              flexShrink: 0,
              px: 1.35,
              py: 1.15,
              borderTop: paySectionDivider,
              background: payFooterStrip,
            }}
          >
            <Button
              type="submit"
              variant="contained"
              fullWidth
              disabled={!canSubmit}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <Payments />}
              sx={{
                py: 1.25,
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: '11px',
                fontSize: '0.9375rem',
                color: '#fff',
                background: canSubmit
                  ? `linear-gradient(135deg, ${PRIMARY} 0%, ${BRAND.supporting.periwinkle} 100%)`
                  : undefined,
                bgcolor: canSubmit ? undefined : '#e2e8f0',
                boxShadow: canSubmit ? '0 6px 18px rgba(26, 85, 227, 0.28)' : 'none',
                '&:hover': {
                  background: canSubmit ? `linear-gradient(135deg, #1347c4 0%, #4f5fd9 100%)` : undefined,
                  boxShadow: canSubmit ? '0 8px 22px rgba(26, 85, 227, 0.32)' : 'none',
                },
                '&.Mui-disabled': { bgcolor: '#e2e8f0', color: '#94a3b8', background: '#e2e8f0' },
              }}
            >
              {submitting ? 'Posting…' : 'Save & post advance'}
            </Button>
            <Button
              type="button"
              variant="text"
              fullWidth
              disabled={submitting}
              onClick={() => setForm(emptyForm())}
              sx={{ mt: 0.55, textTransform: 'none', fontWeight: 700, color: '#64748b', fontSize: '0.8125rem' }}
            >
              Clear form
            </Button>
          </Box>
      </Box>
      </Box>

      <SalaryAdvanceVoucherDialog
        open={!!voucherAdvance}
        onClose={() => setVoucherAdvance(null)}
        advance={voucherAdvance}
        paymentAccounts={paymentAccounts}
        employeeOptions={employeeOptions}
        onNotify={showSnack}
      />

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} sx={{ borderRadius: '12px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
