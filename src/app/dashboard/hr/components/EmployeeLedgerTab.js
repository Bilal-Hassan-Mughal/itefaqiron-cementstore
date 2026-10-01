'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, MenuItem, FormControl, InputLabel,
  Select, Chip, CircularProgress, InputAdornment, Button, Stack, ToggleButton,
  ToggleButtonGroup, IconButton, Tooltip,
} from '@mui/material';
import {
  Search, AccountBalance, Refresh, FilterList, ClearAll, PictureAsPdf, PersonSearch, ArrowBack,
} from '@mui/icons-material';
import { BRAND } from '@/lib/brand-theme';
import { downloadEmployeeLedgerPdf } from '@/lib/employee-ledger-pdf';
import { useHrRefreshVersion, HR_KEYS } from '../context/HrRefreshContext';
import { fetchHrLedgerSummaryPage, fetchHrLedgerSummaryStats } from '../lib/hr-fetch';
import HrLoadMoreTrigger from './shared/HrLoadMoreTrigger';

const CARD_SX = {
  borderRadius: '12px',
  border: '1px solid #dce3ed',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
  bgcolor: '#ffffff',
};

const FILTER_PANEL_SX = {
  p: 2,
  borderRadius: '12px',
  bgcolor: '#f8fafc',
  border: '1px solid #e2e8f0',
};

const LEDGER_ACCENT = '#0d9488';
const LEDGER_TINT = '#ecfdf5';
const NAVY = '#0f172a';

const FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    fontSize: '0.8125rem',
    bgcolor: '#fff',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&.Mui-focused fieldset': { borderColor: LEDGER_ACCENT },
  },
  '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
  '& .MuiInputLabel-shrink': { maxWidth: '100%' },
};

const TABLE_HEAD_CELL_SX = {
  fontWeight: 800,
  fontSize: '0.7rem',
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: '#fff',
  py: 1.25,
  bgcolor: '#0f766e',
  borderBottom: '2px solid #115e59',
  position: 'sticky',
  top: 0,
  zIndex: 3,
};

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

const LEDGER_TABLE_SX = {
  tableLayout: 'fixed',
  width: '100%',
  borderCollapse: 'separate',
  borderSpacing: 0,
  '& .MuiTableCell-root': {
    borderRight: '1px solid #e2e8f0',
    borderBottom: '1px solid #e2e8f0',
    px: 1.25,
    py: 0.85,
    verticalAlign: 'middle',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  '& .MuiTableRow-root .MuiTableCell-root:first-of-type': {
    borderLeft: '1px solid #e2e8f0',
  },
  '& .MuiTableHead-root .MuiTableCell-root': {
    borderTop: '1px solid #115e59',
  },
};

function ledgerColGroup(showEmployeeColumn) {
  if (showEmployeeColumn) {
    return (
      <colgroup>
        <col style={{ width: '11%' }} />
        <col style={{ width: '11%' }} />
        <col style={{ width: '8%' }} />
        <col style={{ width: '9%' }} />
        <col style={{ width: '23%' }} />
        <col style={{ width: '9%' }} />
        <col style={{ width: '9%' }} />
        <col style={{ width: '10%' }} />
        <col style={{ width: '9%' }} />
      </colgroup>
    );
  }
  return (
    <colgroup>
      <col style={{ width: '11%' }} />
      <col style={{ width: '9%' }} />
      <col style={{ width: '10%' }} />
      <col style={{ width: '30%' }} />
      <col style={{ width: '10%' }} />
      <col style={{ width: '10%' }} />
      <col style={{ width: '11%' }} />
      <col style={{ width: '9%' }} />
    </colgroup>
  );
}

function typeChipStyle(type) {
  const t = String(type || '').toUpperCase();
  if (t === 'ADVANCE') return { bgcolor: '#fef2f2', color: '#b91c1c' };
  if (t === 'RECEIPT' || t === 'ADVANCE_SETTLED' || t === 'PAYROLL_RECOVERY') return { bgcolor: '#f0fdf4', color: '#15803d' };
  if (t === 'ADVANCE_REV') return { bgcolor: '#fff7ed', color: '#c2410c' };
  if (t === 'OPENING') return { bgcolor: '#eff6ff', color: '#1d4ed8' };
  if (t === 'SALARY_PAYMENT') return { bgcolor: '#eef2ff', color: '#4338ca' };
  if (t === 'PAYROLL_PAYABLE') return { bgcolor: '#fef3c7', color: '#b45309' };
  return { bgcolor: '#f1f5f9', color: '#475569' };
}

function typeLabel(type) {
  const found = ENTRY_TYPES.find((x) => x.value === type);
  return found?.label || type || '—';
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
  const scrollRef = useRef(null);

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

  const [balanceFilter, setBalanceFilter] = useState('ALL');
  const [empPickerSearch, setEmpPickerSearch] = useState('');
  const [empPickerSearchDebounced, setEmpPickerSearchDebounced] = useState('');

  const [entryFrom, setEntryFrom] = useState('');
  const [entryTo, setEntryTo] = useState('');
  const [entryType, setEntryType] = useState('ALL');
  const [entrySearch, setEntrySearch] = useState('');
  const [entrySearchDebounced, setEntrySearchDebounced] = useState('');

  const ledgerVersion = useHrRefreshVersion(HR_KEYS.ledger);

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
  const colSpan = showEmployeeColumn ? 9 : 8;

  const ledgerViewTitle = selectedEmployee
    ? `${selectedEmployee.emp_name}${selectedEmployee.designation ? ` · ${selectedEmployee.designation}` : ''}`
    : 'All employees';

  return (
    <Box sx={{ px: { xs: 1, md: 0 }, py: { xs: 0.5, md: 0 } }}>
      <Card sx={{ ...CARD_SX, overflow: 'hidden' }}>
        <Box
          sx={{
            px: { xs: 2, md: 2.5 },
            py: 1.75,
            borderBottom: '1px solid #e2e8f0',
            bgcolor: '#fff',
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
              {onBackToHub && (
                <Button
                  size="small"
                  startIcon={<ArrowBack sx={{ fontSize: 18 }} />}
                  onClick={onBackToHub}
                  sx={{ textTransform: 'none', fontWeight: 700, color: '#64748b', flexShrink: 0 }}
                >
                  HR modules
                </Button>
              )}
              <AccountBalance sx={{ color: LEDGER_ACCENT, fontSize: 28, flexShrink: 0, display: { xs: 'none', sm: 'block' } }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontWeight: 900, fontSize: '1.125rem', color: NAVY, lineHeight: 1.25 }}>
                  Employee Account Ledger
                </Typography>
                <Stack direction="row" flexWrap="wrap" gap={0.75} alignItems="center" sx={{ mt: 0.5 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                    {ledgerViewTitle}
                  </Typography>
                  {selectedEmployee && closingDisplay != null && (
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', fontFamily: 'ui-monospace, monospace' }}>
                      Balance: {closingDisplay}
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} flexShrink={0}>
              <Tooltip title="Refresh">
                <IconButton
                  size="small"
                  onClick={handleRefresh}
                  disabled={loadingSummary || loadingEntries}
                  sx={{ border: '1px solid #e2e8f0' }}
                >
                  <Refresh sx={{ fontSize: 20, color: LEDGER_ACCENT }} />
                </IconButton>
              </Tooltip>
              <Button
                size="small"
                variant="contained"
                startIcon={pdfLoading ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdf />}
                onClick={handleDownloadPdf}
                disabled={pdfLoading || loadingEntries || visibleEntries.length === 0}
                sx={{ textTransform: 'none', fontWeight: 800, bgcolor: LEDGER_ACCENT, '&:hover': { bgcolor: '#0f766e' } }}
              >
                Download PDF
              </Button>
            </Stack>
          </Stack>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' },
            gap: 0,
            borderBottom: '1px solid #e2e8f0',
            bgcolor: '#fafbfc',
          }}
        >
          {[
            { label: 'On ledger', value: portfolioDisplay.total, accent: '#1A55E3' },
            { label: 'Employee owes', value: fmtAmt(portfolioDisplay.receivable), accent: '#b91c1c' },
            { label: 'Company owes', value: fmtAmt(portfolioDisplay.payable), accent: '#15803d' },
            { label: 'Settled', value: portfolioDisplay.settledCount, accent: '#64748b' },
          ].map((s, i) => (
            <Box
              key={s.label}
              sx={{
                px: 2,
                py: 1.25,
                borderRight: { lg: i < 3 ? '1px solid #e2e8f0' : 'none' },
                borderBottom: { xs: i < 2 ? '1px solid #e2e8f0' : 'none', lg: 'none' },
              }}
            >
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {s.label}
              </Typography>
              <Typography sx={{ fontSize: '1.05rem', fontWeight: 900, color: s.accent, fontFamily: 'monospace', mt: 0.25 }}>
                {s.value}
              </Typography>
            </Box>
          ))}
        </Box>

        <CardContent sx={{ p: { xs: 1.5, md: 2.5 } }}>
          <Box sx={{ ...FILTER_PANEL_SX, boxShadow: 'inset 0 1px 0 #fff' }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ sm: 'center' }}
              justifyContent="space-between"
              spacing={1}
              sx={{ mb: 2 }}
            >
              <Stack direction="row" alignItems="center" spacing={1}>
                <FilterList sx={{ fontSize: 20, color: LEDGER_ACCENT }} />
                <Typography sx={{ fontWeight: 800, fontSize: '0.875rem', color: NAVY }}>Filters</Typography>
              </Stack>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ClearAll />}
                onClick={resetAllFilters}
                sx={{ textTransform: 'none', fontWeight: 700, borderColor: '#cbd5e1', color: '#475569', alignSelf: { xs: 'flex-start', sm: 'center' } }}
              >
                Reset all filters
              </Button>
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1.4fr 1fr', lg: '2fr 1.2fr 1fr' },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <Box>
                <FormControl fullWidth size="small" sx={{ ...FIELD_SX, minWidth: 200 }}>
                  <InputLabel id="ledger-emp-label" shrink>Employee account</InputLabel>
                  <Select
                    labelId="ledger-emp-label"
                    label="Employee account"
                    notched
                    displayEmpty
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    MenuProps={{ PaperProps: { sx: { maxHeight: 360 } } }}
                    renderValue={(val) => {
                      if (!val) return 'All employees — combined view';
                      const e = summaryByEmpId.get(String(val));
                      return e ? `${e.emp_name}${e.designation ? ` · ${e.designation}` : ''}` : 'Employee account';
                    }}
                  >
                    <MenuItem value="">
                      <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>All employees</Typography>
                    </MenuItem>
                    {employeesForSelect.map((e) => (
                        <MenuItem key={e.emp_id} value={String(e.emp_id)}>
                          <Stack direction="row" justifyContent="space-between" width="100%" spacing={1}>
                            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                              {e.emp_name}
                              {e.designation ? ` · ${e.designation}` : ''}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontWeight: 700, fontFamily: 'ui-monospace, monospace', flexShrink: 0 }}>
                              {fmtSignedBalance(e.closing_balance)}
                            </Typography>
                          </Stack>
                        </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              <Box>
                <TextField
                  fullWidth
                  size="small"
                  label="Narrow account list"
                  placeholder="Name, designation, department"
                  value={empPickerSearch}
                  onChange={(e) => setEmpPickerSearch(e.target.value)}
                  sx={FIELD_SX}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonSearch sx={{ fontSize: 20, color: '#94a3b8' }} />
                      </InputAdornment>
                    ),
                  }}
                />
                {summaryHasMore && (
                  <Button
                    size="small"
                    onClick={loadMoreSummary}
                    disabled={summaryLoadingMore}
                    sx={{ mt: 1, textTransform: 'none', fontWeight: 700 }}
                  >
                    {summaryLoadingMore ? 'Loading…' : `Load more accounts (${summary.length}/${summaryTotal})`}
                  </Button>
                )}
              </Box>
              <Box>
                <FormControl fullWidth size="small" sx={{ ...FIELD_SX, minWidth: 160 }}>
                  <InputLabel id="ledger-type-label" shrink>Transaction type</InputLabel>
                  <Select
                    labelId="ledger-type-label"
                    label="Transaction type"
                    notched
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value)}
                  >
                    {ENTRY_TYPES.map((t) => (
                      <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 1fr 1.2fr' },
                gap: 2,
                mt: 2,
                alignItems: 'start',
              }}
            >
              <TextField
                fullWidth
                size="small"
                type="date"
                label="From date"
                InputLabelProps={{ shrink: true }}
                value={entryFrom}
                onChange={(e) => setEntryFrom(e.target.value)}
                sx={FIELD_SX}
              />
              <TextField
                fullWidth
                size="small"
                type="date"
                label="To date"
                InputLabelProps={{ shrink: true }}
                value={entryTo}
                onChange={(e) => setEntryTo(e.target.value)}
                sx={FIELD_SX}
              />
              <TextField
                fullWidth
                size="small"
                label="Search in ledger"
                placeholder="Bill number or particulars"
                value={entrySearch}
                onChange={(e) => setEntrySearch(e.target.value)}
                sx={FIELD_SX}
                InputLabelProps={{ shrink: true }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ fontSize: 18, color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {!selectedEmpId && (
              <Box sx={{ mt: 2 }}>
                  <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', mb: 0.75, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Account balance (all-employees view)
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={balanceFilter}
                    onChange={(_, v) => v && setBalanceFilter(v)}
                    sx={{
                      flexWrap: 'wrap',
                      gap: 0.75,
                      '& .MuiToggleButtonGroup-grouped': { border: '1px solid #cbd5e1 !important', mx: 0 },
                      '& .MuiToggleButton-root': {
                        textTransform: 'none',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        px: 1.5,
                        py: 0.5,
                        borderRadius: '8px !important',
                      },
                    }}
                  >
                    <ToggleButton value="ALL">All</ToggleButton>
                    <ToggleButton value="OWES" sx={{ '&.Mui-selected': { bgcolor: '#fef2f2', color: '#b91c1c' } }}>Employee owes</ToggleButton>
                    <ToggleButton value="WE_OWE" sx={{ '&.Mui-selected': { bgcolor: '#f0fdf4', color: '#15803d' } }}>Company owes</ToggleButton>
                    <ToggleButton value="ZERO">Settled</ToggleButton>
                  </ToggleButtonGroup>
              </Box>
            )}

            {activeFilterChips.length > 0 && (
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed #cbd5e1' }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', alignSelf: 'center', mr: 0.5 }}>
                  Active:
                </Typography>
                {activeFilterChips.map((c) => (
                  <Chip
                    key={c.key}
                    size="small"
                    label={c.label}
                    onDelete={c.clear}
                    sx={{ fontWeight: 600, fontSize: '0.72rem', bgcolor: '#fff', border: '1px solid #e2e8f0' }}
                  />
                ))}
              </Stack>
            )}
          </Box>

          {selectedEmployee && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1, mt: 2 }}>
              {[
                { label: 'Starting balance', value: fmtAmt(selectedEmployee.opening_balance) },
                { label: 'Total debit (filtered)', value: fmtAmt(entryTotals.debit), color: '#b91c1c' },
                { label: 'Total credit (filtered)', value: fmtAmt(entryTotals.credit), color: '#15803d' },
                {
                  label: 'Account balance',
                  value: fmtSignedBalance(closingBalance ?? selectedEmployee.closing_balance),
                  color: '#0f172a',
                },
              ].map((s) => (
                <Box key={s.label} sx={{ p: 1.25, borderRadius: '10px', bgcolor: '#fff', border: '1px solid #e2e8f0' }}>
                  <Typography sx={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>{s.label}</Typography>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'ui-monospace, monospace', color: s.color || '#0f172a', mt: 0.25 }}>
                    {s.value}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          <Box sx={{ mt: 3, mb: 1.5, pl: 1.5, borderLeft: `4px solid ${LEDGER_ACCENT}` }}>
            <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
              <Typography sx={{ fontWeight: 900, fontSize: '1rem', color: NAVY }}>Ledger transactions</Typography>
              <Chip size="small" label={`${visibleEntries.length} rows`} sx={{ fontWeight: 800, bgcolor: LEDGER_TINT, color: '#0f766e' }} />
              {(loadingSummary || loadingEntries) && <CircularProgress size={18} sx={{ color: LEDGER_ACCENT }} />}
              <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Newest first · scroll down for older · date & time order
              </Typography>
            </Stack>
          </Box>

          <TableContainer
            ref={scrollRef}
            component={Paper}
            elevation={0}
            sx={{
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              maxHeight: { xs: 440, md: 560 },
              bgcolor: '#fff',
              overflow: 'auto',
            }}
          >
            <Table size="small" stickyHeader sx={{ ...LEDGER_TABLE_SX, minWidth: showEmployeeColumn ? 960 : 820 }}>
              {ledgerColGroup(showEmployeeColumn)}
              <TableHead>
                <TableRow>
                  {(showEmployeeColumn
                    ? ['Date & time', 'Employee', 'Cash/Bank', 'Bill #', 'Particulars', 'Debit (Rs)', 'Credit (Rs)', 'Balance (Rs)', 'Type']
                    : ['Date & time', 'Cash/Bank', 'Bill #', 'Particulars', 'Debit (Rs)', 'Credit (Rs)', 'Balance (Rs)', 'Type']
                  ).map((h) => (
                    <TableCell
                      key={h}
                      sx={TABLE_HEAD_CELL_SX}
                      align={h.includes('Debit') || h.includes('Credit') || h.includes('Balance') ? 'right' : 'left'}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {loadingEntries && visibleEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colSpan} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={28} sx={{ color: BRAND.primary.blue }} />
                    </TableCell>
                  </TableRow>
                ) : visibleEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={colSpan} align="center" sx={{ py: 4, color: '#94a3b8' }}>
                      No transactions match your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleEntries.map((row, idx) => {
                    const chip = typeChipStyle(row.trnx_type);
                    return (
                      <TableRow
                        key={row.el_id}
                        hover
                        sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#f8fafc', '&:last-child td': { borderBottom: 'none' } }}
                      >
                        <TableCell sx={{ fontSize: '0.72rem', whiteSpace: 'nowrap', lineHeight: 1.35 }}>
                          {fmtDateTime(row.created_at)}
                        </TableCell>
                        {showEmployeeColumn && (
                          <TableCell sx={{ fontSize: '0.8125rem', fontWeight: 600, maxWidth: 140 }}>
                            <Button
                              size="small"
                              onClick={() => setSelectedEmpId(String(row.emp_id))}
                              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.8125rem', p: 0, minWidth: 0, justifyContent: 'flex-start', color: '#1347c4' }}
                            >
                              {row.emp_name || '—'}
                            </Button>
                          </TableCell>
                        )}
                        <TableCell sx={{ fontSize: '0.72rem', fontWeight: 600, color: '#475569', whiteSpace: 'nowrap' }}>
                          {row.payment_channel || (row.trnx_type === 'SALARY_PAYMENT' ? 'Salary' : '—')}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.72rem', fontWeight: 600 }}>{row.bill_no || '—'}</TableCell>
                        <TableCell sx={{ maxWidth: 280, fontSize: '0.75rem' }}>{row.details || '—'}</TableCell>
                        <TableCell align="right" sx={{ color: row.debit_amount > 0 ? '#b91c1c' : '#cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {row.debit_amount > 0 ? fmtAmt(row.debit_amount) : (row.trnx_type === 'SALARY_PAYMENT' ? '—' : '—')}
                        </TableCell>
                        <TableCell align="right" sx={{ color: row.credit_amount > 0 ? '#15803d' : '#cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {row.credit_amount > 0 ? fmtAmt(row.credit_amount) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem', color: balanceTone(row.closing_balance) }}>
                          {fmtSignedBalance(row.closing_balance)}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.72rem', fontWeight: 700, color: chip.color }}>
                          {typeLabel(row.trnx_type)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            <HrLoadMoreTrigger
              rootRef={scrollRef}
              hasMore={entriesHasMore}
              loading={entriesLoadingMore}
              onLoadMore={loadMoreEntries}
              label="Load older transactions"
            />
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
