'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box, Typography, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, MenuItem, Select, Chip, CircularProgress,
  InputAdornment, Button, Stack, IconButton, Tooltip, Snackbar, Alert,
} from '@mui/material';
import {
  Search, AccountBalance, Refresh, ClearAll, PictureAsPdf, PersonSearch, ArrowBack, CalendarToday,
  ReceiptLong, Print, OpenInNew, Groups, TrendingDown, TrendingUp, CheckCircle,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { downloadEmployeeLedgerPdf } from '@/lib/employee-ledger-pdf';
import { useHrRefreshVersion, HR_KEYS } from '../context/HrRefreshContext';
import { fetchHrLedgerSummaryPage, fetchHrLedgerSummaryStats } from '../lib/hr-fetch';
import { useHrEmployeeOptions } from '../hooks/useHrEmployeeOptions';
import {
  parseLedgerDocument,
  fetchEmployeeReceiveReceiptById,
  fetchEmployeeAdvanceById,
} from '../lib/ledger-entry-documents';
import { printEmployeeReceiveReceipt } from '@/lib/employee-receipt-pdf';
import { printAdvanceVoucher } from '../lib/advance-voucher-actions';
import EmployeeReceiveReceiptDialog from './EmployeeReceiveReceiptDialog';
import SalaryAdvanceVoucherDialog from './SalaryAdvanceVoucherDialog';
import HrLoadMoreTrigger from './shared/HrLoadMoreTrigger';
import { HR_TABLE_HEAD_SX } from './shared/hrUiShared';

/** Modern Soft UI — minimalist SaaS ledger (ice-blue canvas, teal anchor) */
const LEDGER_PRIMARY = '#2a9d8f';
const LEDGER_DEEP = '#1f7a6e';
const LEDGER_LIGHT = '#48c9b0';
const CYAN_CTA = '#22d3ee';
const CYAN_CTA_HOVER = '#06b6d4';
const LEDGER_TINT = '#ecfdf8';
const LEDGER_TINT2 = '#d1faf0';
const INK = '#1e293b';
const MUTED = '#64748b';
const MUTED_SOFT = '#94a3b8';
const BORDER = '#e8edf3';
const BORDER_STRONG = '#dce3ec';
const COL_LINE = '#eef2f6';
const ROW_LINE = '#f1f5f9';
const SURFACE = '#ffffff';
const DEBIT_COLOR = '#b91c1c';
const CREDIT_COLOR = '#15803d';
const MONEY_EMPTY = '#cbd5e1';
const PAGE_BG = '#f0f4f8';
const HERO_BG = 'linear-gradient(102deg, #1a6b66 0%, #2a9d8f 48%, #48c9b0 100%)';
const CARD_SHADOW = '0 4px 24px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04)';
const STAT_THEMES = {
  ledger: { border: '#99f6e4', iconBg: '#ecfdf8', value: LEDGER_DEEP },
  owes: { border: '#fecaca', iconBg: '#fef2f2', value: '#dc6b6b' },
  payable: { border: '#bbf7d0', iconBg: '#f0fdf4', value: '#16a34a' },
  settled: { border: '#cbd5e1', iconBg: '#f1f5f9', value: '#64748b' },
};

const actionIconSx = {
  width: 32,
  height: 32,
  borderRadius: '50%',
  bgcolor: '#f1f5f9',
  color: MUTED_SOFT,
  border: 'none',
  transition: 'background 0.15s ease, color 0.15s ease',
  '&:hover': { bgcolor: LEDGER_TINT, color: LEDGER_DEEP },
  '&.Mui-disabled': { bgcolor: '#f8fafc', color: '#cbd5e1' },
};

const FILTER_H = 42;

const filterAdornmentSx = {
  height: FILTER_H,
  maxHeight: FILTER_H,
  alignSelf: 'center',
  '& .MuiSvgIcon-root': { fontSize: 18, color: MUTED_SOFT },
};

const selectMenuProps = {
  PaperProps: {
    elevation: 0,
    sx: {
      mt: 0.5,
      maxHeight: 320,
      borderRadius: '10px',
      border: `1px solid ${BORDER}`,
      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
      '& .MuiMenuItem-root': { fontSize: '0.8125rem', py: 0.85, borderRadius: '6px', mx: 0.5, my: 0.15 },
      '& .MuiMenuItem-root.Mui-selected': { bgcolor: LEDGER_TINT2, color: LEDGER_DEEP, fontWeight: 600 },
      '& .MuiMenuItem-root.Mui-selected:hover': { bgcolor: LEDGER_TINT },
    },
  },
};

/** Uniform filter controls — fixed 42px height for Select, TextField, and date inputs */
const filterInputSx = {
  width: '100%',
  '& .MuiOutlinedInput-root': {
    height: FILTER_H,
    minHeight: FILTER_H,
    maxHeight: FILTER_H,
    borderRadius: '10px',
    bgcolor: SURFACE,
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: INK,
    transition: 'box-shadow 0.15s ease, border-color 0.15s ease',
    '& fieldset': { borderColor: '#e0e0e0' },
    '&:hover fieldset': { borderColor: BORDER_STRONG },
    '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(42, 157, 143, 0.12)' },
    '&.Mui-focused fieldset': { borderColor: LEDGER_PRIMARY, borderWidth: 1 },
    '& .MuiOutlinedInput-input': {
      py: 0,
      px: 1.25,
      height: `${FILTER_H}px`,
      minHeight: `${FILTER_H}px`,
      boxSizing: 'border-box',
      lineHeight: `${FILTER_H}px`,
      fontWeight: 700,
    },
    '& .MuiSelect-select': {
      display: 'flex',
      alignItems: 'center',
      minHeight: `${FILTER_H}px !important`,
      height: `${FILTER_H}px !important`,
      py: '0 !important',
      pl: '10px !important',
      pr: '32px !important',
      boxSizing: 'border-box',
      fontWeight: 700,
    },
    '& .MuiSelect-icon': { color: MUTED_SOFT, fontSize: '1.25rem', right: 10, top: 'calc(50% - 0.6em)' },
    '&.MuiInputBase-adornedStart': { pl: 1.1 },
    '&.MuiInputBase-adornedStart .MuiOutlinedInput-input': { pl: 0.35, fontWeight: 500 },
    '&.MuiInputBase-adornedEnd .MuiOutlinedInput-input': { pr: 0.5 },
    '& input::placeholder': { color: MUTED_SOFT, opacity: 1, fontWeight: 500 },
  },
};

function filterDateSx(hasValue) {
  return [
    filterInputSx,
    {
      '& .MuiOutlinedInput-root': { position: 'relative' },
      '& .MuiOutlinedInput-root input': {
        fontWeight: hasValue ? 700 : 500,
        color: hasValue ? INK : MUTED_SOFT,
      },
      '& input[type="date"]::-webkit-calendar-picker-indicator': {
        opacity: 0,
        position: 'absolute',
        right: 0,
        width: 40,
        height: FILTER_H,
        cursor: 'pointer',
      },
    },
  ];
}

const filterRowGridSx = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(6, minmax(0, 1fr))' },
  gap: { xs: 1.25, md: 1.75 },
  alignItems: 'end',
};

function FilterField({ label, children }) {
  return (
    <Box sx={{ minWidth: 0, width: '100%' }}>
      <Typography
        component="label"
        sx={{
          display: 'block',
          fontSize: '0.75rem',
          fontWeight: 500,
          color: MUTED,
          mb: 0.5,
          lineHeight: 1.2,
          minHeight: 18,
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          height: FILTER_H,
          display: 'flex',
          alignItems: 'stretch',
          '& .MuiFormControl-root': { flex: 1, minWidth: 0, height: FILTER_H },
          '& .MuiInputBase-root': { height: `${FILTER_H}px`, minHeight: `${FILTER_H}px` },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

function FilterSelectValue({ children, muted = false }) {
  return (
    <Box component="span" sx={{ fontWeight: muted ? 500 : 700, color: muted ? MUTED_SOFT : INK, fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
      {children}
    </Box>
  );
}

function SectionCard({ title, action, children, bodySx = {} }) {
  return (
    <Box
      sx={{
        bgcolor: SURFACE,
        borderRadius: '14px',
        border: `1px solid ${BORDER}`,
        boxShadow: CARD_SHADOW,
        overflow: 'hidden',
      }}
    >
      {title ? (
        <Box
          sx={{
            px: { xs: 2, md: 2.25 },
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1,
            borderBottom: `1px solid ${ROW_LINE}`,
            bgcolor: SURFACE,
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem', color: INK, letterSpacing: '-0.02em' }}>{title}</Typography>
          {action}
        </Box>
      ) : null}
      <Box sx={{ p: { xs: 2, md: 2.25 }, ...bodySx }}>{children}</Box>
    </Box>
  );
}

const tableSx = {
  borderCollapse: 'separate',
  borderSpacing: 0,
  tableLayout: 'fixed',
  width: '100%',
};

function thCell(isLast) {
  return {
    ...HR_TABLE_HEAD_SX,
    background: SURFACE,
    color: LEDGER_DEEP,
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    borderTop: `2px solid ${LEDGER_PRIMARY}`,
    borderBottom: `2px solid ${LEDGER_PRIMARY}`,
    borderRight: isLast ? 'none' : `1px solid ${COL_LINE}`,
    position: 'sticky',
    top: 0,
    zIndex: 2,
    py: 1.1,
    px: { xs: 0.75, md: 1 },
    whiteSpace: 'nowrap',
  };
}

function tdCell(isLast, extra = {}) {
  return {
    fontSize: '0.8125rem',
    lineHeight: 1.5,
    py: 1.1,
    px: { xs: 0.75, md: 1 },
    borderBottom: `1px solid ${ROW_LINE}`,
    borderRight: isLast ? 'none' : `1px solid ${COL_LINE}`,
    verticalAlign: 'middle',
    color: INK,
    overflow: 'hidden',
    ...extra,
  };
}

const moneyBaseSx = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: '-0.02em',
  whiteSpace: 'nowrap',
};

const debitCellSx = (active) => ({
  ...moneyBaseSx,
  fontSize: '0.9375rem',
  fontWeight: 700,
  color: active ? DEBIT_COLOR : MONEY_EMPTY,
});

const creditCellSx = (active) => ({
  ...moneyBaseSx,
  fontSize: '0.9375rem',
  fontWeight: 700,
  color: active ? CREDIT_COLOR : MONEY_EMPTY,
});

const balanceCellSx = {
  ...moneyBaseSx,
  fontSize: '0.8125rem',
  fontWeight: 800,
  color: INK,
};

const cellEllipsis = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 0,
};

/** Particulars — wrap inside cell width (do not use maxWidth:0; it breaks text vertically) */
function ParticularsText({ text }) {
  const label = text || '—';
  return (
    <Box
      title={text || ''}
      sx={{
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        whiteSpace: 'normal',
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
        lineHeight: 1.45,
        fontSize: '0.8125rem',
        color: INK,
      }}
    >
      {label}
    </Box>
  );
}

const ENTRY_TYPES = [
  { value: 'ALL', label: 'All types' },
  { value: 'OPENING', label: 'Starting balance' },
  { value: 'ADVANCE', label: 'Advance' },
  { value: 'ADVANCE_REV', label: 'Advance cancel' },
  { value: 'ADVANCE_SETTLED', label: 'Payroll recovery' },
  { value: 'RECEIPT', label: 'Payment received' },
  { value: 'SALARY_DED', label: 'Salary deduction' },
  { value: 'PAYROLL_RECOVERY', label: 'Salary recovery' },
  { value: 'PAYROLL_PAYABLE', label: 'Company balance paid' },
  { value: 'SALARY_PAYMENT', label: 'Salary paid (info)' },
  { value: 'SALARY_UNDERPAID', label: 'Salary underpaid (carry)' },
];

const fmtAmt = (v) => {
  const n = parseFloat(v || 0);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

function fmtDateTime(value) {
  if (!value) return '—';
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return '—';
  return dt.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Compact date for table cells — avoids ellipsis on narrow date column */
function fmtDateTableParts(value) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return {
    date: dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

function balanceTone(closing) {
  const n = parseFloat(closing || 0);
  if (n > 0.009) return '#0f172a';
  if (n < -0.009) return '#0f172a';
  return '#64748b';
}

/** Running balance — number only (no “owes you” labels). */
function fmtSignedBalance(closing) {
  const n = parseFloat(closing || 0);
  if (Math.abs(n) < 0.009) return '0';
  const body = fmtAmt(Math.abs(n));
  return n < 0 ? `-${body}` : body;
}

function ledgerColGroup(showEmployeeColumn) {
  if (showEmployeeColumn) {
    return (
      <colgroup>
        <col style={{ width: '8.5%' }} />
        <col style={{ width: '8.5%' }} />
        <col style={{ width: '4%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '26%' }} />
        <col style={{ width: '9.5%' }} />
        <col style={{ width: '9.5%' }} />
        <col style={{ width: '8.5%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '7.5%' }} />
      </colgroup>
    );
  }
  return (
    <colgroup>
      <col style={{ width: '9%' }} />
      <col style={{ width: '6%' }} />
      <col style={{ width: '8%' }} />
      <col style={{ width: '30%' }} />
      <col style={{ width: '10%' }} />
      <col style={{ width: '10%' }} />
      <col style={{ width: '10%' }} />
      <col style={{ width: '10%' }} />
      <col style={{ width: '7%' }} />
    </colgroup>
  );
}

function typeChipStyle(type) {
  const t = String(type || '').toUpperCase();
  const pill = (bgcolor, color, border) => ({ bgcolor, color, border: `1px solid ${border}` });
  if (t === 'ADVANCE') return pill('#fee2e2', '#b91c1c', '#fecaca');
  if (t === 'RECEIPT') return pill('#dcfce7', '#15803d', '#bbf7d0');
  if (t === 'ADVANCE_SETTLED' || t === 'PAYROLL_RECOVERY') return pill('#ecfdf5', '#047857', '#a7f3d0');
  if (t === 'ADVANCE_REV') return pill('#ffedd5', '#c2410c', '#fed7aa');
  if (t === 'OPENING') return pill(LEDGER_TINT, LEDGER_DEEP, '#99f6e4');
  if (t === 'SALARY_PAYMENT') return pill('#e0e7ff', '#4338ca', '#c7d2fe');
  if (t === 'PAYROLL_PAYABLE' || t === 'SALARY_UNDERPAID') return pill('#fef3c7', '#b45309', '#fde68a');
  return pill('#f1f5f9', '#475569', '#e2e8f0');
}

function typeLabel(type) {
  const found = ENTRY_TYPES.find((x) => x.value === type);
  return found?.label || type || '—';
}

/** Shorter chip text so columns do not truncate awkwardly */
function typeShortLabel(type) {
  const map = {
    RECEIPT: 'Received',
    ADVANCE: 'Advance',
    ADVANCE_REV: 'Cancelled',
    ADVANCE_SETTLED: 'Recovered',
    PAYROLL_RECOVERY: 'Recovery',
    OPENING: 'Opening',
    SALARY_PAYMENT: 'Salary',
    PAYROLL_PAYABLE: 'Payable',
    SALARY_DED: 'Deduction',
    SALARY_UNDERPAID: 'Underpaid',
  };
  return map[String(type || '').toUpperCase()] || typeLabel(type);
}

function buildTransactionsQuery({ empId, from, to, type, q, reconcile = false }) {
  const p = new URLSearchParams({ transactions: 'true' });
  if (empId) p.set('emp_id', empId);
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  if (type && type !== 'ALL') p.set('type', type);
  if (q && String(q).trim()) p.set('q', String(q).trim());
  if (reconcile) p.set('reconcile', 'true');
  return p.toString();
}

export default function EmployeeLedgerTab({ onBackToHub }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const scrollRef = useRef(null);
  const { activeEmployees } = useHrEmployeeOptions();

  const [summary, setSummary] = useState([]);
  const [summaryTotal, setSummaryTotal] = useState(0);
  const [summaryHasMore, setSummaryHasMore] = useState(false);
  const [summaryLoadingMore, setSummaryLoadingMore] = useState(false);
  const [portfolioStats, setPortfolioStats] = useState(null);
  const [selectedEmpId, setSelectedEmpId] = useState(() => searchParams.get('emp_id') || '');
  const [entries, setEntries] = useState([]);
  const [entriesHasMore, setEntriesHasMore] = useState(false);
  const [entriesLoadingMore, setEntriesLoadingMore] = useState(false);
  const [closingBalance, setClosingBalance] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [receiveReceipt, setReceiveReceipt] = useState(null);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [voucherAdvance, setVoucherAdvance] = useState(null);
  const [docLoadingKey, setDocLoadingKey] = useState(null);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  const [balanceFilter, setBalanceFilter] = useState('ALL');
  const [empPickerSearch, setEmpPickerSearch] = useState('');
  const [empPickerSearchDebounced, setEmpPickerSearchDebounced] = useState('');

  const [entryFrom, setEntryFrom] = useState('');
  const [entryTo, setEntryTo] = useState('');
  const [entryType, setEntryType] = useState('ALL');
  const [entrySearch, setEntrySearch] = useState('');
  const [entrySearchDebounced, setEntrySearchDebounced] = useState('');

  const ledgerVersion = useHrRefreshVersion(HR_KEYS.ledger);

  const showSnack = useCallback((msg, severity = 'success') => {
    setSnack({ open: true, msg, severity });
  }, []);

  useEffect(() => {
    fetch('/api/customers?dropdown=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setPaymentAccounts(Array.isArray(data) ? data : []))
      .catch(() => setPaymentAccounts([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setEntrySearchDebounced(entrySearch.trim()), 450);
    return () => clearTimeout(t);
  }, [entrySearch]);

  useEffect(() => {
    const t = setTimeout(() => setEmpPickerSearchDebounced(empPickerSearch.trim()), 350);
    return () => clearTimeout(t);
  }, [empPickerSearch]);

  const summaryByEmpId = useMemo(() => {
    const map = new Map();
    summary.forEach((e) => map.set(String(e.emp_id), e));
    return map;
  }, [summary]);

  const loadSummary = useCallback(async (withReconcile = false) => {
    setLoadingSummary(true);
    try {
      const [page, stats] = await Promise.all([
        fetchHrLedgerSummaryPage({ offset: 0, search: empPickerSearchDebounced }),
        fetchHrLedgerSummaryStats({ reconcile: withReconcile }),
      ]);
      setSummary(page.items);
      setSummaryTotal(page.total);
      setSummaryHasMore(page.hasMore);
      setPortfolioStats(stats);
    } finally {
      setLoadingSummary(false);
    }
  }, [empPickerSearchDebounced]);

  const loadMoreSummary = useCallback(async () => {
    if (!summaryHasMore || summaryLoadingMore || loadingSummary) return;
    setSummaryLoadingMore(true);
    try {
      const page = await fetchHrLedgerSummaryPage({
        offset: summary.length,
        search: empPickerSearchDebounced,
      });
      setSummary((prev) => [...prev, ...page.items]);
      setSummaryTotal(page.total);
      setSummaryHasMore(page.hasMore);
    } finally {
      setSummaryLoadingMore(false);
    }
  }, [summaryHasMore, summaryLoadingMore, loadingSummary, summary.length, empPickerSearchDebounced]);

  const loadTransactions = useCallback(async (withReconcile = false) => {
    setLoadingEntries(true);
    try {
      const qs = buildTransactionsQuery({
        empId: selectedEmpId || undefined,
        from: entryFrom || undefined,
        to: entryTo || undefined,
        type: entryType,
        q: entrySearchDebounced || undefined,
        reconcile: withReconcile,
      });
      const res = await fetch(`/api/employee-ledger?${qs}&limit=200&offset=0`);
      if (res.ok) {
        const data = await res.json();
        setEntries(Array.isArray(data.entries) ? data.entries : []);
        setEntriesHasMore(!!data.hasMore);
        setClosingBalance(data.closing_balance ?? null);
      }
    } finally {
      setLoadingEntries(false);
      requestAnimationFrame(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = 0;
      });
    }
  }, [selectedEmpId, entryFrom, entryTo, entryType, entrySearchDebounced]);

  useEffect(() => { loadSummary(); }, [loadSummary, ledgerVersion]);

  useEffect(() => {
    loadTransactions(!!selectedEmpId);
  }, [loadTransactions, ledgerVersion, selectedEmpId]);

  const loadMoreEntries = useCallback(async () => {
    if (!entriesHasMore || entriesLoadingMore || loadingEntries) return;
    setEntriesLoadingMore(true);
    try {
      const qs = buildTransactionsQuery({
        empId: selectedEmpId || undefined,
        from: entryFrom || undefined,
        to: entryTo || undefined,
        type: entryType,
        q: entrySearchDebounced || undefined,
      });
      const res = await fetch(`/api/employee-ledger?${qs}&limit=200&offset=${entries.length}`);
      if (res.ok) {
        const data = await res.json();
        const batch = Array.isArray(data.entries) ? data.entries : [];
        setEntries((prev) => [...prev, ...batch]);
        setEntriesHasMore(!!data.hasMore);
      }
    } finally {
      setEntriesLoadingMore(false);
    }
  }, [
    entriesHasMore,
    entriesLoadingMore,
    loadingEntries,
    entries.length,
    selectedEmpId,
    entryFrom,
    entryTo,
    entryType,
    entrySearchDebounced,
  ]);

  const portfolioDisplay = useMemo(() => {
    if (portfolioStats) {
      return {
        receivable: portfolioStats.receivable ?? 0,
        payable: portfolioStats.payable ?? 0,
        owesCount: portfolioStats.owesCount ?? 0,
        settledCount: portfolioStats.settledCount ?? 0,
        total: portfolioStats.total ?? summaryTotal,
      };
    }
    let receivable = 0;
    let payable = 0;
    let owesCount = 0;
    let settledCount = 0;
    summary.forEach((e) => {
      const b = parseFloat(e.closing_balance || 0);
      if (b > 0.009) {
        receivable += b;
        owesCount += 1;
      } else if (b < -0.009) {
        payable += Math.abs(b);
      } else {
        settledCount += 1;
      }
    });
    return { receivable, payable, owesCount, settledCount, total: summaryTotal || summary.length };
  }, [portfolioStats, summary, summaryTotal]);

  const filteredSummary = useMemo(() => {
    let list = summary;
    if (balanceFilter === 'OWES') list = list.filter((e) => parseFloat(e.closing_balance || 0) > 0.009);
    if (balanceFilter === 'WE_OWE') list = list.filter((e) => parseFloat(e.closing_balance || 0) < -0.009);
    if (balanceFilter === 'ZERO') list = list.filter((e) => Math.abs(parseFloat(e.closing_balance || 0)) < 0.01);
    return list;
  }, [summary, balanceFilter]);

  const employeesForSelect = useMemo(() => {
    if (!selectedEmpId) return filteredSummary;
    const sel = summaryByEmpId.get(String(selectedEmpId));
    if (!sel) return filteredSummary;
    if (filteredSummary.some((e) => String(e.emp_id) === String(selectedEmpId))) return filteredSummary;
    return [sel, ...filteredSummary];
  }, [filteredSummary, selectedEmpId, summaryByEmpId]);

  const allowedEmpIds = useMemo(() => {
    if (!selectedEmpId && (balanceFilter !== 'ALL' || empPickerSearch.trim())) {
      return new Set(filteredSummary.map((e) => String(e.emp_id)));
    }
    return null;
  }, [selectedEmpId, balanceFilter, empPickerSearch, filteredSummary]);

  const visibleEntries = useMemo(() => {
    if (!allowedEmpIds) return entries;
    return entries.filter((r) => allowedEmpIds.has(String(r.emp_id)));
  }, [entries, allowedEmpIds]);

  const selectedEmployee = selectedEmpId ? summaryByEmpId.get(String(selectedEmpId)) : null;
  const closingDisplay = selectedEmployee
    ? fmtSignedBalance(closingBalance ?? selectedEmployee.closing_balance)
    : null;

  const entryTotals = useMemo(() => (
    visibleEntries.reduce(
      (acc, r) => ({
        debit: acc.debit + parseFloat(r.debit_amount || 0),
        credit: acc.credit + parseFloat(r.credit_amount || 0),
      }),
      { debit: 0, credit: 0 }
    )
  ), [visibleEntries]);

  const activeFilterChips = useMemo(() => {
    const chips = [];
    if (selectedEmpId && selectedEmployee) {
      chips.push({ key: 'emp', label: selectedEmployee.emp_name, clear: () => setSelectedEmpId('') });
    }
    if (entryFrom) chips.push({ key: 'from', label: `From ${entryFrom}`, clear: () => setEntryFrom('') });
    if (entryTo) chips.push({ key: 'to', label: `To ${entryTo}`, clear: () => setEntryTo('') });
    if (entryType !== 'ALL') chips.push({ key: 'type', label: typeLabel(entryType), clear: () => setEntryType('ALL') });
    if (entrySearchDebounced) chips.push({ key: 'q', label: `Search: ${entrySearchDebounced}`, clear: () => setEntrySearch('') });
    if (!selectedEmpId && balanceFilter !== 'ALL') {
      const lbl = { OWES: 'Employee owes', WE_OWE: 'Company owes', ZERO: 'Settled' }[balanceFilter];
      chips.push({ key: 'bal', label: lbl, clear: () => setBalanceFilter('ALL') });
    }
    if (!selectedEmpId && empPickerSearch.trim()) {
      chips.push({ key: 'pick', label: `Staff: ${empPickerSearch.trim()}`, clear: () => setEmpPickerSearch('') });
    }
    return chips;
  }, [
    selectedEmpId, selectedEmployee, entryFrom, entryTo, entryType,
    entrySearchDebounced, balanceFilter, empPickerSearch,
  ]);

  const resetAllFilters = () => {
    setSelectedEmpId('');
    setEntryFrom('');
    setEntryTo('');
    setEntryType('ALL');
    setEntrySearch('');
    setBalanceFilter('ALL');
    setEmpPickerSearch('');
  };

  const handleRefresh = async () => {
    await loadSummary(true);
    await loadTransactions(true);
  };

  const filterSummaryForPdf = useMemo(() => {
    const parts = activeFilterChips.map((c) => c.label);
    return parts.join(' · ') || 'none';
  }, [activeFilterChips]);

  const openLedgerDocument = useCallback(async (row, mode = 'view') => {
    const doc = parseLedgerDocument(row);
    if (!doc) {
      showSnack('No printable receipt for this entry', 'info');
      return;
    }
    const key = `${row.el_id}-${mode}`;
    setDocLoadingKey(key);
    try {
      if (doc.kind === 'receive') {
        const receipt = await fetchEmployeeReceiveReceiptById(doc.id);
        if (mode === 'print') {
          const opened = await printEmployeeReceiveReceipt(receipt);
          if (opened === false) showSnack('Allow pop-ups to print receipt', 'warning');
        } else {
          setReceiveReceipt(receipt);
          setReceiveOpen(true);
        }
        return;
      }
      if (doc.kind === 'advance') {
        const advance = await fetchEmployeeAdvanceById(doc.id, doc.empId);
        if (mode === 'print') {
          const opened = await printAdvanceVoucher(advance, { paymentAccounts, employeeOptions: activeEmployees });
          if (opened === false) showSnack('Allow pop-ups to print voucher', 'warning');
        } else {
          setVoucherAdvance(advance);
        }
        return;
      }
      if (doc.kind === 'salary') {
        router.push(`/dashboard/hr?module=salary-receipt&payroll_id=${doc.id}`, { scroll: false });
        showSnack('Opening salary receipt module', 'info');
      }
    } catch (err) {
      showSnack(err.message || 'Could not open document', 'error');
    } finally {
      setDocLoadingKey(null);
    }
  }, [activeEmployees, paymentAccounts, router, showSnack]);

  const handleDownloadPdf = async () => {
    if (visibleEntries.length === 0) return;
    setPdfLoading(true);
    try {
      await downloadEmployeeLedgerPdf({
        entries: visibleEntries,
        employee: selectedEmployee,
        closingBalance,
        showEmployeeColumn: !selectedEmpId,
        filterSummary: filterSummaryForPdf,
        entryTypes: ENTRY_TYPES,
      });
    } catch (err) {
      console.error('Employee ledger PDF:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const showEmployeeColumn = !selectedEmpId;
  const colSpan = showEmployeeColumn ? 10 : 9;

  const ledgerViewTitle = selectedEmployee
    ? `${selectedEmployee.emp_name}${selectedEmployee.designation ? ` · ${selectedEmployee.designation}` : ''}`
    : 'All employees';

  const statTiles = useMemo(() => [
    { label: 'On ledger', value: portfolioDisplay.total, icon: Groups, theme: STAT_THEMES.ledger },
    { label: 'Employee owes', value: fmtAmt(portfolioDisplay.receivable), icon: TrendingDown, theme: STAT_THEMES.owes },
    { label: 'Company owes', value: fmtAmt(portfolioDisplay.payable), icon: TrendingUp, theme: STAT_THEMES.payable },
    { label: 'Settled', value: portfolioDisplay.settledCount, icon: CheckCircle, theme: STAT_THEMES.settled },
  ], [portfolioDisplay]);

  const tableHeaders = showEmployeeColumn
    ? ['Date', 'Employee', 'Mode', 'Bill #', 'Particulars', 'Debit', 'Credit', 'Balance', 'Type', 'Actions']
    : ['Date', 'Mode', 'Bill #', 'Particulars', 'Debit', 'Credit', 'Balance', 'Type', 'Actions'];

  const lastCol = tableHeaders.length - 1;

  return (
    <Box sx={{ width: '100%', minHeight: '100%', background: PAGE_BG, display: 'flex', flexDirection: 'column', pb: 3 }}>
      <Box
        sx={{
          px: { xs: 2, md: 3 },
          pt: { xs: 1.5, md: 2 },
          pb: { xs: 2.25, md: 2.75 },
          background: HERO_BG,
          boxShadow: '0 8px 32px rgba(26, 107, 102, 0.22)',
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 1.25 }}>
          {onBackToHub && (
            <Button
              onClick={onBackToHub}
              startIcon={<ArrowBack sx={{ fontSize: 18 }} />}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'rgba(255,255,255,0.92)',
                minWidth: 0,
                px: 0.5,
                mr: 0.5,
                '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              Go Back
            </Button>
          )}
          <Box
            sx={{
              width: 46,
              height: 46,
              borderRadius: '14px',
              bgcolor: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AccountBalance sx={{ fontSize: 26, color: '#fff' }} />
          </Box>
          <Box sx={{ flex: '1 1 200px', minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.15 }}>
              Employee account ledger
            </Typography>
            <Typography sx={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.88)', mt: 0.25 }}>{ledgerViewTitle}</Typography>
          </Box>
          {selectedEmployee && closingDisplay != null && (
            <Chip
              label={`Balance ${closingDisplay}`}
              size="small"
              sx={{
                fontWeight: 800,
                fontFamily: 'ui-monospace, monospace',
                bgcolor: 'rgba(255,255,255,0.95)',
                color: LEDGER_DEEP,
                border: 'none',
              }}
            />
          )}
          <Stack direction="row" spacing={0.75} sx={{ ml: { sm: 'auto' } }}>
            <Tooltip title="Refresh">
              <IconButton
                size="small"
                onClick={handleRefresh}
                disabled={loadingSummary || loadingEntries}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.15)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.28)',
                  borderRadius: '10px',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' },
                }}
              >
                <Refresh sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              variant="contained"
              disableElevation
              startIcon={pdfLoading ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdf />}
              onClick={handleDownloadPdf}
              disabled={pdfLoading || loadingEntries || visibleEntries.length === 0}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                color: '#0f172a',
                bgcolor: CYAN_CTA,
                px: 2.25,
                boxShadow: '0 4px 14px rgba(34, 211, 238, 0.35)',
                '&:hover': { bgcolor: CYAN_CTA_HOVER },
                '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.35)', color: 'rgba(255,255,255,0.7)' },
              }}
            >
              Export PDF
            </Button>
          </Stack>
        </Box>
      </Box>

      <Box sx={{ px: { xs: 2, md: 3 }, pt: 2, pb: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' }, gap: 1.5 }}>
          {statTiles.map((s) => {
            const Icon = s.icon;
            const th = s.theme;
            return (
              <Box
                key={s.label}
                sx={{
                  borderRadius: '12px',
                  border: `1px solid ${th.border}`,
                  bgcolor: SURFACE,
                  px: 1.5,
                  py: 1.35,
                  boxShadow: '0 2px 12px rgba(15, 23, 42, 0.04)',
                  background: `linear-gradient(145deg, ${SURFACE} 0%, ${th.iconBg} 120%)`,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={1.25}>
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: '11px',
                      bgcolor: th.iconBg,
                      border: `1px solid ${th.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon sx={{ fontSize: 21, color: th.value }} />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.6875rem', fontWeight: 600, color: MUTED }}>{s.label}</Typography>
                    <Typography sx={{ fontSize: '1.0625rem', fontWeight: 800, color: th.value, fontFamily: 'ui-monospace, monospace', lineHeight: 1.25, letterSpacing: '-0.02em' }}>
                      {s.value}
                    </Typography>
                  </Box>
                </Stack>
              </Box>
            );
          })}
        </Box>

        <SectionCard
          title="Filters"
          action={(
            <Button
              size="small"
              onClick={resetAllFilters}
              startIcon={<ClearAll sx={{ fontSize: 15 }} />}
              sx={{ textTransform: 'none', fontWeight: 600, color: MUTED, fontSize: '0.8125rem', '&:hover': { color: LEDGER_DEEP, bgcolor: LEDGER_TINT } }}
            >
              Reset all
            </Button>
          )}
          bodySx={{ pt: 0.25 }}
        >
        <Stack spacing={1.75}>
          <Box sx={filterRowGridSx}>
            <FilterField label="Employee">
              <Select
                fullWidth
                displayEmpty
                value={selectedEmpId}
                onChange={(e) => setSelectedEmpId(e.target.value)}
                MenuProps={selectMenuProps}
                sx={filterInputSx}
                renderValue={(val) => {
                  if (!val) return <FilterSelectValue>All employees</FilterSelectValue>;
                  const e = summaryByEmpId.get(String(val));
                  return (
                    <FilterSelectValue>
                      {e ? `${e.emp_name}${e.designation ? ` · ${e.designation}` : ''}` : 'Employee'}
                    </FilterSelectValue>
                  );
                }}
              >
                <MenuItem value="">All employees</MenuItem>
                {employeesForSelect.map((e) => (
                  <MenuItem key={e.emp_id} value={String(e.emp_id)}>
                    <Stack direction="row" justifyContent="space-between" width="100%" spacing={1}>
                      <Typography sx={{ fontSize: '0.8125rem', fontWeight: 500 }} noWrap>{e.emp_name}{e.designation ? ` · ${e.designation}` : ''}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: MUTED, fontWeight: 600, fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>{fmtSignedBalance(e.closing_balance)}</Typography>
                    </Stack>
                  </MenuItem>
                ))}
              </Select>
            </FilterField>

            <FilterField label="Transaction type">
              <Select
                fullWidth
                displayEmpty
                value={entryType}
                onChange={(e) => setEntryType(e.target.value)}
                MenuProps={selectMenuProps}
                sx={filterInputSx}
                renderValue={(val) => {
                  const found = ENTRY_TYPES.find((t) => t.value === val);
                  return <FilterSelectValue>{found?.label || 'All types'}</FilterSelectValue>;
                }}
              >
                {ENTRY_TYPES.map((t) => (<MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>))}
              </Select>
            </FilterField>

            <FilterField label="From">
              <TextField
                fullWidth
                type="date"
                value={entryFrom}
                onChange={(e) => setEntryFrom(e.target.value)}
                sx={filterDateSx(!!entryFrom)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" sx={filterAdornmentSx}>
                      <CalendarToday />
                    </InputAdornment>
                  ),
                }}
              />
            </FilterField>

            <FilterField label="To">
              <TextField
                fullWidth
                type="date"
                value={entryTo}
                onChange={(e) => setEntryTo(e.target.value)}
                sx={filterDateSx(!!entryTo)}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end" sx={filterAdornmentSx}>
                      <CalendarToday />
                    </InputAdornment>
                  ),
                }}
              />
            </FilterField>

            <Box sx={{ gridColumn: { xs: '1 / -1', sm: 'span 2', lg: selectedEmpId ? 'span 2' : 'span 1' } }}>
              <FilterField label="Search">
                <TextField
                  fullWidth
                  placeholder="Bill #, name, particulars…"
                  value={entrySearch}
                  onChange={(e) => setEntrySearch(e.target.value)}
                  sx={filterInputSx}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start" sx={filterAdornmentSx}>
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                />
              </FilterField>
            </Box>

            {!selectedEmpId && (
              <FilterField label="Balance">
                <Select
                  fullWidth
                  value={balanceFilter}
                  onChange={(e) => setBalanceFilter(e.target.value)}
                  MenuProps={selectMenuProps}
                  sx={filterInputSx}
                  renderValue={(val) => {
                    const labels = { ALL: 'All accounts', OWES: 'Employee owes', WE_OWE: 'Company owes', ZERO: 'Settled' };
                    return <FilterSelectValue>{labels[val] || 'All accounts'}</FilterSelectValue>;
                  }}
                >
                  <MenuItem value="ALL">All accounts</MenuItem>
                  <MenuItem value="OWES">Employee owes</MenuItem>
                  <MenuItem value="WE_OWE">Company owes</MenuItem>
                  <MenuItem value="ZERO">Settled</MenuItem>
                </Select>
              </FilterField>
            )}
          </Box>

          {!selectedEmpId && (
            <FilterField label="Employee list">
              <TextField
                fullWidth
                placeholder="Filter dropdown names…"
                value={empPickerSearch}
                onChange={(e) => setEmpPickerSearch(e.target.value)}
                sx={filterInputSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={filterAdornmentSx}>
                      <PersonSearch />
                    </InputAdornment>
                  ),
                }}
              />
            </FilterField>
          )}
        </Stack>

        {(summaryHasMore || activeFilterChips.length > 0) && (
          <Stack direction="row" flexWrap="wrap" gap={0.75} alignItems="center" sx={{ mt: 1, pt: 1, borderTop: `1px solid ${ROW_LINE}` }}>
            {summaryHasMore && (
              <Button size="small" variant="text" onClick={loadMoreSummary} disabled={summaryLoadingMore} sx={{ textTransform: 'none', fontWeight: 600, color: LEDGER_PRIMARY }}>
                {summaryLoadingMore ? 'Loading…' : `Load more accounts (${summary.length}/${summaryTotal})`}
              </Button>
            )}
            {activeFilterChips.map((c) => (
              <Chip key={c.key} size="small" label={c.label} onDelete={c.clear} sx={{ height: 26, fontSize: '0.75rem', bgcolor: '#fff', border: `1px solid ${BORDER}` }} />
            ))}
          </Stack>
        )}

        {selectedEmployee && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1, mt: 1.25 }}>
            {[
              { label: 'Opening', value: fmtAmt(selectedEmployee.opening_balance) },
              { label: 'Debit', value: fmtAmt(entryTotals.debit), color: '#dc2626' },
              { label: 'Credit', value: fmtAmt(entryTotals.credit), color: '#16a34a' },
              { label: 'Balance', value: fmtSignedBalance(closingBalance ?? selectedEmployee.closing_balance), color: INK },
            ].map((s) => (
              <Box key={s.label} sx={{ px: 1.25, py: 0.9, borderRadius: '10px', border: `1px solid ${BORDER}`, bgcolor: '#fafbfc' }}>
                <Typography sx={{ fontSize: '0.6875rem', fontWeight: 700, color: MUTED }}>{s.label}</Typography>
                <Typography sx={{ fontSize: '0.9375rem', fontWeight: 800, fontFamily: 'ui-monospace, monospace', color: s.color || INK }}>{s.value}</Typography>
              </Box>
            ))}
          </Box>
        )}
        </SectionCard>

        <SectionCard
          title="Transactions"
          action={(
            <Stack direction="row" alignItems="center" spacing={1}>
              <Box
                sx={{
                  minWidth: 28,
                  height: 28,
                  px: 0.75,
                  borderRadius: '999px',
                  bgcolor: LEDGER_DEEP,
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {visibleEntries.length}
              </Box>
              {(loadingSummary || loadingEntries) && <CircularProgress size={16} sx={{ color: LEDGER_PRIMARY }} />}
              <Typography sx={{ fontSize: '0.75rem', color: MUTED, display: { xs: 'none', sm: 'block' } }}>Newest first</Typography>
            </Stack>
          )}
          bodySx={{ p: { xs: 1.25, md: 1.5 }, pt: { xs: 1, md: 1.25 } }}
        >
        <TableContainer
          ref={scrollRef}
          sx={{
            overflowX: 'hidden',
            border: `1px solid ${BORDER}`,
            borderRadius: '12px',
            bgcolor: SURFACE,
            width: '100%',
          }}
        >
          <Table stickyHeader size="small" sx={tableSx}>
            {ledgerColGroup(showEmployeeColumn)}
            <TableHead>
              <TableRow>
                {tableHeaders.map((h, i) => (
                  <TableCell
                    key={h}
                    sx={thCell(i === lastCol)}
                    align={h === 'Debit' || h === 'Credit' || h === 'Balance' ? 'right' : h === 'Actions' ? 'center' : 'left'}
                  >
                    {h}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {loadingEntries && visibleEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} align="center" sx={{ py: 6, borderRight: 'none' }}>
                    <CircularProgress size={28} sx={{ color: LEDGER_PRIMARY }} />
                  </TableCell>
                </TableRow>
              ) : visibleEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colSpan} align="center" sx={{ py: 4, color: MUTED, borderRight: 'none' }}>
                    No transactions match your filters
                  </TableCell>
                </TableRow>
              ) : (
                visibleEntries.map((row, idx) => {
                  const chip = typeChipStyle(row.trnx_type);
                  const doc = parseLedgerDocument(row);
                  const actionKey = `${row.el_id}-view`;
                  const loadingAction = docLoadingKey === actionKey || docLoadingKey === `${row.el_id}-print`;
                  const dateParts = fmtDateTableParts(row.created_at);
                  const zebra = idx % 2 === 1 ? '#f8fafc' : SURFACE;
                  const td = (last, extra = {}) => tdCell(last, { bgcolor: zebra, ...extra });
                  return (
                    <TableRow key={row.el_id} hover sx={{ '&:hover td': { bgcolor: `${LEDGER_TINT} !important` } }}>
                      <TableCell
                        sx={td(false, {
                          color: MUTED,
                          fontSize: '0.75rem',
                          maxWidth: 'none',
                          overflow: 'visible',
                          whiteSpace: 'normal',
                          lineHeight: 1.35,
                        })}
                        title={fmtDateTime(row.created_at)}
                      >
                        {dateParts ? (
                          <>
                            <Box component="span" sx={{ display: 'block', fontWeight: 600, color: INK }}>{dateParts.date}</Box>
                            <Box component="span" sx={{ display: 'block', fontSize: '0.6875rem', color: MUTED_SOFT }}>{dateParts.time}</Box>
                          </>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      {showEmployeeColumn && (
                        <TableCell sx={td(false, cellEllipsis)}>
                          <Button
                            size="small"
                            onClick={() => setSelectedEmpId(String(row.emp_id))}
                            title={row.emp_name || ''}
                            sx={{
                              textTransform: 'none',
                              fontWeight: 600,
                              fontSize: '0.8125rem',
                              p: 0,
                              minWidth: 0,
                              maxWidth: '100%',
                              color: LEDGER_DEEP,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block',
                              textAlign: 'left',
                              '&:hover': { color: LEDGER_PRIMARY, bgcolor: 'transparent' },
                            }}
                          >
                            {row.emp_name || '—'}
                          </Button>
                        </TableCell>
                      )}
                      <TableCell sx={td(false, { ...cellEllipsis, fontSize: '0.75rem', color: MUTED })} title={row.payment_channel || ''}>
                        {row.payment_channel || (row.trnx_type === 'SALARY_PAYMENT' ? 'Salary' : '—')}
                      </TableCell>
                      <TableCell sx={td(false, { ...cellEllipsis, fontSize: '0.75rem', fontWeight: 600 })} title={row.bill_no || ''}>
                        {row.bill_no || '—'}
                      </TableCell>
                      <TableCell sx={td(false, { overflow: 'hidden', whiteSpace: 'normal' })}>
                        <ParticularsText text={row.details} />
                      </TableCell>
                      <TableCell align="right" sx={td(false, debitCellSx(row.debit_amount > 0))}>
                        {row.debit_amount > 0 ? fmtAmt(row.debit_amount) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={td(false, creditCellSx(row.credit_amount > 0))}>
                        {row.credit_amount > 0 ? fmtAmt(row.credit_amount) : '—'}
                      </TableCell>
                      <TableCell align="right" sx={td(false, { ...balanceCellSx, color: balanceTone(row.closing_balance) })}>
                        {fmtSignedBalance(row.closing_balance)}
                      </TableCell>
                      <TableCell align="center" sx={td(false, { overflow: 'visible', maxWidth: 'none' })}>
                        <Chip
                          label={typeShortLabel(row.trnx_type)}
                          title={typeLabel(row.trnx_type)}
                          size="small"
                          sx={{
                            height: 26,
                            maxWidth: '100%',
                            fontWeight: 700,
                            fontSize: '0.6875rem',
                            bgcolor: chip.bgcolor,
                            color: chip.color,
                            border: chip.border,
                            borderRadius: '999px',
                            '& .MuiChip-label': { px: 1, overflow: 'hidden', textOverflow: 'ellipsis' },
                          }}
                        />
                      </TableCell>
                      <TableCell align="center" sx={td(true, { overflow: 'visible', maxWidth: 'none', px: 0.5 })}>
                        {doc ? (
                          <Stack direction="row" spacing={0.35} justifyContent="center" flexWrap="nowrap">
                            <Tooltip title={doc.kind === 'salary' ? 'Salary receipt' : 'View receipt'}>
                              <span>
                                <IconButton size="small" disabled={loadingAction} onClick={() => openLedgerDocument(row, 'view')} sx={actionIconSx}>
                                  {loadingAction && docLoadingKey === actionKey ? <CircularProgress size={14} /> : doc.kind === 'salary' ? <OpenInNew sx={{ fontSize: 16 }} /> : <ReceiptLong sx={{ fontSize: 16 }} />}
                                </IconButton>
                              </span>
                            </Tooltip>
                            {doc.kind !== 'salary' && (
                              <Tooltip title="Print A5">
                                <span>
                                  <IconButton size="small" disabled={loadingAction} onClick={() => openLedgerDocument(row, 'print')} sx={actionIconSx}>
                                    {loadingAction && docLoadingKey === `${row.el_id}-print` ? <CircularProgress size={14} /> : <Print sx={{ fontSize: 16 }} />}
                                  </IconButton>
                                </span>
                              </Tooltip>
                            )}
                          </Stack>
                        ) : (
                          <Typography sx={{ fontSize: '0.65rem', color: '#cbd5e1' }}>—</Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          <HrLoadMoreTrigger rootRef={scrollRef} hasMore={entriesHasMore} loading={entriesLoadingMore} onLoadMore={loadMoreEntries} label="Load older transactions" />
        </TableContainer>
        </SectionCard>
      </Box>

      <EmployeeReceiveReceiptDialog
        open={receiveOpen && !!receiveReceipt}
        onClose={() => { setReceiveOpen(false); setReceiveReceipt(null); }}
        receipt={receiveReceipt}
        employeeOptions={activeEmployees}
        onNotify={showSnack}
      />

      <SalaryAdvanceVoucherDialog
        open={!!voucherAdvance}
        onClose={() => setVoucherAdvance(null)}
        advance={voucherAdvance}
        paymentAccounts={paymentAccounts}
        employeeOptions={activeEmployees}
        onNotify={showSnack}
      />

      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity} sx={{ borderRadius: '12px' }}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
