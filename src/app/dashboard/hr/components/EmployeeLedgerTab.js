'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, TextField, Table, TableBody, TableCell,
  TableContainer, TableRow, Paper, MenuItem, FormControl, InputLabel,
  Select, Chip, CircularProgress, InputAdornment, Button, Stack, ToggleButton,
  ToggleButtonGroup, IconButton, Tooltip, Divider, Grid,
} from '@mui/material';
import {
  Search, AccountBalance, Refresh, FilterList, ClearAll, PictureAsPdf, PersonSearch,
} from '@mui/icons-material';
import { BRAND } from '@/lib/brand-theme';
import { downloadEmployeeLedgerPdf } from '@/lib/employee-ledger-pdf';
import { useHrRefreshVersion, HR_KEYS } from '../context/HrRefreshContext';

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

const FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    fontSize: '0.8125rem',
    bgcolor: '#fff',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&.Mui-focused fieldset': { borderColor: BRAND.supporting.periwinkle },
  },
  '& .MuiInputLabel-root': { fontSize: '0.8125rem' },
};

const ENTRY_TYPES = [
  { value: 'ALL', label: 'All types' },
  { value: 'OPENING', label: 'Opening' },
  { value: 'ADVANCE', label: 'Advance' },
  { value: 'ADVANCE_REV', label: 'Advance cancel' },
  { value: 'ADVANCE_SETTLED', label: 'Payroll recovery' },
  { value: 'RECEIPT', label: 'Payment received' },
  { value: 'SALARY_DED', label: 'Salary deduction' },
  { value: 'PAYROLL_RECOVERY', label: 'Salary recovery' },
  { value: 'PAYROLL_PAYABLE', label: 'Company balance paid' },
];

const fmtAmt = (v) => {
  const n = parseFloat(v || 0);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

function balanceMeta(closing) {
  const n = parseFloat(closing || 0);
  if (n > 0.009) {
    return { label: 'Employee owes', color: '#b91c1c', bg: '#fef2f2' };
  }
  if (n < -0.009) {
    return { label: 'Company owes', color: '#15803d', bg: '#f0fdf4' };
  }
  return { label: 'Settled', color: '#64748b', bg: '#f1f5f9' };
}

function typeChipStyle(type) {
  const t = String(type || '').toUpperCase();
  if (t === 'ADVANCE') return { bgcolor: '#fef2f2', color: '#b91c1c' };
  if (t === 'RECEIPT' || t === 'ADVANCE_SETTLED' || t === 'PAYROLL_RECOVERY') return { bgcolor: '#f0fdf4', color: '#15803d' };
  if (t === 'ADVANCE_REV') return { bgcolor: '#fff7ed', color: '#c2410c' };
  if (t === 'OPENING') return { bgcolor: '#eff6ff', color: '#1d4ed8' };
  return { bgcolor: '#f1f5f9', color: '#475569' };
}

function typeLabel(type) {
  const found = ENTRY_TYPES.find((x) => x.value === type);
  return found?.label || type || '—';
}

function buildTransactionsQuery({ empId, from, to, type, q }) {
  const p = new URLSearchParams({ transactions: 'true' });
  if (empId) p.set('emp_id', empId);
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  if (type && type !== 'ALL') p.set('type', type);
  if (q && String(q).trim()) p.set('q', String(q).trim());
  return p.toString();
}

export default function EmployeeLedgerTab() {
  const searchParams = useSearchParams();
  const scrollRef = useRef(null);

  const [summary, setSummary] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState(() => searchParams.get('emp_id') || '');
  const [entries, setEntries] = useState([]);
  const [closingBalance, setClosingBalance] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [balanceFilter, setBalanceFilter] = useState('ALL');
  const [empPickerSearch, setEmpPickerSearch] = useState('');

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

  const summaryByEmpId = useMemo(() => {
    const map = new Map();
    summary.forEach((e) => map.set(String(e.emp_id), e));
    return map;
  }, [summary]);

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const res = await fetch('/api/employee-ledger?summary=true');
      if (res.ok) setSummary(await res.json());
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadTransactions = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const qs = buildTransactionsQuery({
        empId: selectedEmpId || undefined,
        from: entryFrom || undefined,
        to: entryTo || undefined,
        type: entryType,
        q: entrySearchDebounced || undefined,
      });
      const res = await fetch(`/api/employee-ledger?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setEntries(Array.isArray(data.entries) ? data.entries : []);
        setClosingBalance(data.closing_balance ?? null);
      }
    } finally {
      setLoadingEntries(false);
    }
  }, [selectedEmpId, entryFrom, entryTo, entryType, entrySearchDebounced]);

  useEffect(() => { loadSummary(); }, [loadSummary, ledgerVersion]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions, ledgerVersion]);

  useEffect(() => {
    if (!loadingEntries && entries.length > 0 && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [loadingEntries, entries.length, selectedEmpId]);

  const portfolioStats = useMemo(() => {
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
    return { receivable, payable, owesCount, settledCount, total: summary.length };
  }, [summary]);

  const filteredSummary = useMemo(() => {
    let list = summary;
    if (empPickerSearch.trim()) {
      const q = empPickerSearch.toLowerCase();
      list = list.filter(
        (e) =>
          e.emp_name.toLowerCase().includes(q) ||
          (e.designation || '').toLowerCase().includes(q) ||
          (e.department || '').toLowerCase().includes(q)
      );
    }
    if (balanceFilter === 'OWES') list = list.filter((e) => parseFloat(e.closing_balance || 0) > 0.009);
    if (balanceFilter === 'WE_OWE') list = list.filter((e) => parseFloat(e.closing_balance || 0) < -0.009);
    if (balanceFilter === 'ZERO') list = list.filter((e) => Math.abs(parseFloat(e.closing_balance || 0)) < 0.01);
    return list;
  }, [summary, balanceFilter, empPickerSearch]);

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
  const closingMeta = selectedEmployee
    ? balanceMeta(closingBalance ?? selectedEmployee.closing_balance)
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
    await loadSummary();
    await loadTransactions();
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
  const colSpan = showEmployeeColumn ? 8 : 7;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        {[
          { label: 'Employees', value: portfolioStats.total, sub: 'On ledger', color: '#1A55E3' },
          { label: 'Employee owes (total)', value: fmtAmt(portfolioStats.receivable), sub: `${portfolioStats.owesCount} staff`, color: '#b91c1c' },
          { label: 'Company owes (total)', value: fmtAmt(portfolioStats.payable), sub: 'Credit balances', color: '#15803d' },
          { label: 'Settled', value: portfolioStats.settledCount, sub: 'Zero balance', color: '#64748b' },
        ].map((c) => (
          <Card key={c.label} sx={CARD_SX}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography sx={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>{c.label}</Typography>
              <Typography sx={{ fontSize: '1.2rem', fontWeight: 800, color: c.color, fontFamily: c.label.includes('total') ? 'monospace' : 'inherit' }}>
                {c.value}
              </Typography>
              <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8' }}>{c.sub}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card sx={CARD_SX}>
        <CardContent sx={{ p: { xs: 1.5, md: 2 } }}>
          <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center" sx={{ mb: 2 }}>
            <AccountBalance sx={{ color: '#1347c4' }} />
            <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>Employee ledger</Typography>
            {selectedEmployee && closingMeta && (
              <Chip
                size="small"
                label={`${closingMeta.label}: ${fmtAmt(closingBalance ?? selectedEmployee.closing_balance)}`}
                sx={{ bgcolor: closingMeta.bg, color: closingMeta.color, fontWeight: 800 }}
              />
            )}
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Refresh data">
              <IconButton size="small" onClick={handleRefresh} disabled={loadingSummary || loadingEntries}>
                <Refresh sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              variant="contained"
              startIcon={pdfLoading ? <CircularProgress size={16} color="inherit" /> : <PictureAsPdf />}
              onClick={handleDownloadPdf}
              disabled={pdfLoading || loadingEntries || visibleEntries.length === 0}
              sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#1347c4', '&:hover': { bgcolor: '#1e3a8a' } }}
            >
              Download PDF
            </Button>
          </Stack>

          <Box sx={FILTER_PANEL_SX}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <FilterList sx={{ fontSize: 20, color: '#1347c4' }} />
              <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>Filters</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', flex: 1 }}>
                Date and type load from server · search matches bill #, details, employee name
              </Typography>
              <Button
                size="small"
                startIcon={<ClearAll />}
                onClick={resetAllFilters}
                sx={{ textTransform: 'none', fontWeight: 600, color: '#64748b' }}
              >
                Reset all
              </Button>
            </Stack>

            <Grid container spacing={1.5}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth size="small" sx={FIELD_SX}>
                  <InputLabel>Employee account</InputLabel>
                  <Select
                    label="Employee account"
                    value={selectedEmpId}
                    onChange={(e) => setSelectedEmpId(e.target.value)}
                    MenuProps={{ PaperProps: { sx: { maxHeight: 360 } } }}
                  >
                    <MenuItem value="">
                      <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>All employees</Typography>
                    </MenuItem>
                    {employeesForSelect.map((e) => {
                      const meta = balanceMeta(e.closing_balance);
                      return (
                        <MenuItem key={e.emp_id} value={String(e.emp_id)}>
                          <Stack direction="row" justifyContent="space-between" width="100%" spacing={1}>
                            <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>
                              {e.emp_name}
                              {e.designation ? ` · ${e.designation}` : ''}
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: meta.color, fontWeight: 700, fontFamily: 'monospace' }}>
                              {fmtAmt(e.closing_balance)}
                            </Typography>
                          </Stack>
                        </MenuItem>
                      );
                    })}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  size="small"
                  label="Find in account list"
                  placeholder="Name, designation, department…"
                  value={empPickerSearch}
                  onChange={(e) => setEmpPickerSearch(e.target.value)}
                  sx={FIELD_SX}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonSearch sx={{ fontSize: 20, color: '#94a3b8' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={6} sm={4} md={3}>
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
              </Grid>
              <Grid item xs={6} sm={4} md={3}>
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
              </Grid>
              <Grid item xs={12} sm={4} md={3}>
                <FormControl fullWidth size="small" sx={FIELD_SX}>
                  <InputLabel>Transaction type</InputLabel>
                  <Select label="Transaction type" value={entryType} onChange={(e) => setEntryType(e.target.value)}>
                    {ENTRY_TYPES.map((t) => (
                      <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search transactions"
                  placeholder="Bill #, particulars…"
                  value={entrySearch}
                  onChange={(e) => setEntrySearch(e.target.value)}
                  sx={FIELD_SX}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search sx={{ fontSize: 18, color: '#94a3b8' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              {!selectedEmpId && (
                <Grid item xs={12}>
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
                </Grid>
              )}
            </Grid>

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
                { label: 'Opening (pre-system)', value: fmtAmt(selectedEmployee.opening_balance) },
                { label: 'Total debit (filtered)', value: fmtAmt(entryTotals.debit), color: '#b91c1c' },
                { label: 'Total credit (filtered)', value: fmtAmt(entryTotals.credit), color: '#15803d' },
                { label: 'Closing balance', value: fmtAmt(closingBalance ?? selectedEmployee.closing_balance), color: closingMeta?.color },
              ].map((s) => (
                <Box key={s.label} sx={{ p: 1.25, borderRadius: '10px', bgcolor: '#fff', border: '1px solid #e2e8f0' }}>
                  <Typography sx={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>{s.label}</Typography>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'monospace', color: s.color || '#0f172a' }}>{s.value}</Typography>
                </Box>
              ))}
            </Box>
          )}

          <Divider sx={{ my: 2 }} />

          <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a' }}>Transactions</Typography>
            <Chip size="small" label={visibleEntries.length} sx={{ ml: 1, height: 22, fontWeight: 700, bgcolor: '#e8effd', color: '#1347c4' }} />
            {(loadingSummary || loadingEntries) && <CircularProgress size={18} sx={{ ml: 1.5, color: BRAND.primary.blue }} />}
            <Typography sx={{ ml: 1.5, fontSize: '0.72rem', color: '#94a3b8' }}>Oldest first · scroll for latest</Typography>
          </Stack>

          <TableContainer
            ref={scrollRef}
            component={Paper}
            elevation={0}
            sx={{ border: '1px solid #cbd5e1', borderRadius: '10px', maxHeight: { xs: 440, md: 540 }, bgcolor: '#fff' }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: '#1347c4' }}>
                  {(showEmployeeColumn
                    ? ['Date', 'Employee', 'Type', 'Bill #', 'Particulars', 'Debit', 'Credit', 'Balance']
                    : ['Date', 'Type', 'Bill #', 'Particulars', 'Debit', 'Credit', 'Balance']
                  ).map((h) => (
                    <TableCell
                      key={h}
                      sx={{ fontWeight: 700, fontSize: '0.68rem', color: '#fff', py: 1.1, borderBottom: 'none' }}
                      align={['Debit', 'Credit', 'Balance'].includes(h) ? 'right' : 'left'}
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
                        <TableCell sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB') : '—'}
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
                        <TableCell>
                          <Chip
                            size="small"
                            label={typeLabel(row.trnx_type)}
                            sx={{ height: 20, fontSize: '0.62rem', fontWeight: 700, bgcolor: chip.bgcolor, color: chip.color }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.72rem', fontWeight: 600 }}>{row.bill_no || '—'}</TableCell>
                        <TableCell sx={{ maxWidth: 280, fontSize: '0.75rem' }}>{row.details || '—'}</TableCell>
                        <TableCell align="right" sx={{ color: row.debit_amount > 0 ? '#b91c1c' : '#cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {row.debit_amount > 0 ? fmtAmt(row.debit_amount) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ color: row.credit_amount > 0 ? '#15803d' : '#cbd5e1', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {row.credit_amount > 0 ? fmtAmt(row.credit_amount) : '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                          {fmtAmt(row.closing_balance)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
