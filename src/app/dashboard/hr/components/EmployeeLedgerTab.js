'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Typography, Card, CardContent, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, MenuItem, FormControl, InputLabel,
  Select, Chip, CircularProgress, InputAdornment, Button, Stack, ToggleButton,
  ToggleButtonGroup, IconButton, Tooltip, Collapse,
} from '@mui/material';
import {
  Search, AccountBalance, Refresh, FilterList, Payments, ClearAll, ExpandMore, ExpandLess,
} from '@mui/icons-material';
import { BRAND } from '@/lib/brand-theme';
import { useHrRefreshVersion, HR_KEYS } from '../context/HrRefreshContext';

const CARD_SX = {
  borderRadius: '12px',
  border: '1px solid #dce3ed',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
  bgcolor: '#ffffff',
};

const FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    fontSize: '0.8125rem',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&.Mui-focused fieldset': { borderColor: BRAND.supporting.periwinkle },
  },
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

function buildTransactionsQuery({ empId, from, to, type, reconcile }) {
  const p = new URLSearchParams({ transactions: 'true' });
  if (empId) p.set('emp_id', empId);
  if (from) p.set('from', from);
  if (to) p.set('to', to);
  if (type && type !== 'ALL') p.set('type', type);
  if (reconcile) p.set('reconcile', 'true');
  return p.toString();
}

export default function EmployeeLedgerTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scrollRef = useRef(null);

  const [summary, setSummary] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState(() => searchParams.get('emp_id') || '');
  const [entries, setEntries] = useState([]);
  const [closingBalance, setClosingBalance] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [showBalances, setShowBalances] = useState(false);

  const [balanceFilter, setBalanceFilter] = useState('ALL');
  const [empSearch, setEmpSearch] = useState('');

  const [entryFrom, setEntryFrom] = useState('');
  const [entryTo, setEntryTo] = useState('');
  const [entryType, setEntryType] = useState('ALL');
  const [entrySearch, setEntrySearch] = useState('');

  const ledgerVersion = useHrRefreshVersion(HR_KEYS.ledger);

  const summaryByEmpId = useMemo(() => {
    const map = new Map();
    summary.forEach((e) => map.set(String(e.emp_id), e));
    return map;
  }, [summary]);

  const loadSummary = useCallback(async (reconcile = false) => {
    setLoadingSummary(true);
    try {
      const q = reconcile ? '?summary=true&reconcile=true' : '?summary=true';
      const res = await fetch(`/api/employee-ledger${q}`);
      if (res.ok) setSummary(await res.json());
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadTransactions = useCallback(async (reconcile = false) => {
    setLoadingEntries(true);
    try {
      const qs = buildTransactionsQuery({
        empId: selectedEmpId || undefined,
        from: entryFrom || undefined,
        to: entryTo || undefined,
        type: entryType,
        reconcile,
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
  }, [selectedEmpId, entryFrom, entryTo, entryType]);

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

  const allowedEmpIds = useMemo(() => {
    if (balanceFilter === 'ALL' && !empSearch.trim()) return null;
    let list = summary;
    if (empSearch.trim()) {
      const q = empSearch.toLowerCase();
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
    return new Set(list.map((e) => String(e.emp_id)));
  }, [summary, balanceFilter, empSearch]);

  const visibleEntries = useMemo(() => {
    let rows = entries;
    if (allowedEmpIds) {
      rows = rows.filter((r) => allowedEmpIds.has(String(r.emp_id)));
    }
    if (entrySearch.trim()) {
      const q = entrySearch.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.bill_no || '').toLowerCase().includes(q) ||
          (r.details || '').toLowerCase().includes(q) ||
          (r.emp_name || '').toLowerCase().includes(q) ||
          String(r.trnx_type || '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [entries, allowedEmpIds, entrySearch]);

  const selectedEmployee = selectedEmpId ? summaryByEmpId.get(String(selectedEmpId)) : null;
  const closingMeta = selectedEmployee
    ? balanceMeta(closingBalance ?? selectedEmployee.closing_balance)
    : null;

  const entryTotals = useMemo(() => {
    return visibleEntries.reduce(
      (acc, r) => ({
        debit: acc.debit + parseFloat(r.debit_amount || 0),
        credit: acc.credit + parseFloat(r.credit_amount || 0),
      }),
      { debit: 0, credit: 0 }
    );
  }, [visibleEntries]);

  const employeePickerList = useMemo(() => {
    let list = summary;
    if (empSearch.trim()) {
      const q = empSearch.toLowerCase();
      list = list.filter(
        (e) =>
          e.emp_name.toLowerCase().includes(q) ||
          (e.designation || '').toLowerCase().includes(q) ||
          (e.department || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [summary, empSearch]);

  const clearEntryFilters = () => {
    setEntryFrom('');
    setEntryTo('');
    setEntryType('ALL');
    setEntrySearch('');
  };

  const clearEmpFilters = () => {
    setBalanceFilter('ALL');
    setEmpSearch('');
  };

  const handleRefresh = async (reconcile = false) => {
    await loadSummary(reconcile);
    await loadTransactions(reconcile);
  };

  const goReceivePayment = () => {
    const q = selectedEmpId ? `?module=employee-receive&emp_id=${selectedEmpId}` : '?module=employee-receive';
    router.push(`/dashboard/hr${q}`);
  };

  const showEmployeeColumn = !selectedEmpId;

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
        <CardContent sx={{ p: 2 }}>
          <Stack direction="row" flexWrap="wrap" gap={1.5} alignItems="center" sx={{ mb: 2 }}>
            <AccountBalance sx={{ color: '#0d9488' }} />
            <Typography sx={{ fontWeight: 800, fontSize: '1rem' }}>Employee ledger</Typography>
            <Chip
              size="small"
              label={selectedEmpId ? 'One account' : 'All employees'}
              sx={{ fontWeight: 700, bgcolor: '#f1f5f9' }}
            />
            {selectedEmployee && closingMeta && (
              <Chip
                size="small"
                label={`${closingMeta.label}: ${fmtAmt(closingBalance ?? selectedEmployee.closing_balance)}`}
                sx={{ bgcolor: closingMeta.bg, color: closingMeta.color, fontWeight: 800 }}
              />
            )}
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={() => handleRefresh(false)} disabled={loadingSummary || loadingEntries}>
                <Refresh sx={{ fontSize: 20 }} />
              </IconButton>
            </Tooltip>
            <Button size="small" onClick={() => handleRefresh(true)} disabled={loadingSummary || loadingEntries} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>
              Repair
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Payments />}
              onClick={goReceivePayment}
              disabled={!selectedEmpId}
              sx={{ textTransform: 'none', fontWeight: 700, borderColor: '#0d9488', color: '#0d9488' }}
            >
              Receive payment
            </Button>
          </Stack>

          <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mb: 2 }}>
            Oldest entries at top, latest at bottom. Default view shows every employee&apos;s transactions; pick an account to focus one ledger.
          </Typography>

          <Stack spacing={1.5} sx={{ mb: 2 }}>
            <Stack direction="row" flexWrap="wrap" gap={1} alignItems="center">
              <FilterList sx={{ fontSize: 18, color: '#64748b' }} />
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>Filters</Typography>
            </Stack>

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 240, flex: 1, maxWidth: 360, ...FIELD_SX }}>
                <InputLabel>Employee account</InputLabel>
                <Select
                  label="Employee account"
                  value={selectedEmpId}
                  onChange={(e) => setSelectedEmpId(e.target.value)}
                >
                  <MenuItem value="">
                    <strong>All employees — all transactions</strong>
                  </MenuItem>
                  {employeePickerList.map((e) => {
                    const meta = balanceMeta(e.closing_balance);
                    return (
                      <MenuItem key={e.emp_id} value={String(e.emp_id)}>
                        {e.emp_name}
                        {e.designation ? ` · ${e.designation}` : ''}
                        {' — '}
                        {fmtAmt(e.closing_balance)} ({meta.label})
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>

              <TextField
                size="small"
                type="date"
                label="From"
                InputLabelProps={{ shrink: true }}
                value={entryFrom}
                onChange={(e) => setEntryFrom(e.target.value)}
                sx={{ width: 140, ...FIELD_SX }}
              />
              <TextField
                size="small"
                type="date"
                label="To"
                InputLabelProps={{ shrink: true }}
                value={entryTo}
                onChange={(e) => setEntryTo(e.target.value)}
                sx={{ width: 140, ...FIELD_SX }}
              />
              <FormControl size="small" sx={{ minWidth: 160, ...FIELD_SX }}>
                <InputLabel>Type</InputLabel>
                <Select label="Type" value={entryType} onChange={(e) => setEntryType(e.target.value)}>
                  {ENTRY_TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                size="small"
                placeholder="Bill #, particulars, name…"
                value={entrySearch}
                onChange={(e) => setEntrySearch(e.target.value)}
                sx={{ flex: 1, minWidth: 160, ...FIELD_SX }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search sx={{ fontSize: 18, color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Button size="small" startIcon={<ClearAll />} onClick={clearEntryFilters} sx={{ textTransform: 'none' }}>
                Clear dates & search
              </Button>
            </Box>

            {!selectedEmpId && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={balanceFilter}
                  onChange={(_, v) => v && setBalanceFilter(v)}
                  sx={{ flexWrap: 'wrap', gap: 0.5, '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, fontSize: '0.72rem', px: 1.25, py: 0.35, borderRadius: '8px !important', border: '1px solid #cbd5e1 !important' } }}
                >
                  <ToggleButton value="ALL">All balances</ToggleButton>
                  <ToggleButton value="OWES" sx={{ '&.Mui-selected': { bgcolor: '#fef2f2', color: '#b91c1c' } }}>Employee owes</ToggleButton>
                  <ToggleButton value="WE_OWE" sx={{ '&.Mui-selected': { bgcolor: '#f0fdf4', color: '#15803d' } }}>We owe</ToggleButton>
                  <ToggleButton value="ZERO">Settled</ToggleButton>
                </ToggleButtonGroup>
                <TextField
                  size="small"
                  placeholder="Narrow by employee name…"
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  sx={{ width: 220, ...FIELD_SX }}
                />
                <Button size="small" onClick={clearEmpFilters} sx={{ textTransform: 'none' }}>Clear balance filters</Button>
              </Box>
            )}
          </Stack>

          {selectedEmployee && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1, mb: 2 }}>
              {[
                { label: 'Opening (pre-system)', value: fmtAmt(selectedEmployee.opening_balance) },
                { label: 'Total debit (shown)', value: fmtAmt(entryTotals.debit), color: '#b91c1c' },
                { label: 'Total credit (shown)', value: fmtAmt(entryTotals.credit), color: '#15803d' },
                { label: 'Closing balance', value: fmtAmt(closingBalance ?? selectedEmployee.closing_balance), color: closingMeta?.color },
              ].map((s) => (
                <Box key={s.label} sx={{ p: 1.25, borderRadius: '10px', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <Typography sx={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600 }}>{s.label}</Typography>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'monospace', color: s.color || '#0f172a' }}>{s.value}</Typography>
                </Box>
              ))}
            </Box>
          )}

          <Stack direction="row" alignItems="center" sx={{ mb: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>
              Transactions
            </Typography>
            <Chip size="small" label={visibleEntries.length} sx={{ ml: 1, height: 22, fontWeight: 700 }} />
            {(loadingSummary || loadingEntries) && <CircularProgress size={18} sx={{ ml: 1.5, color: BRAND.primary.blue }} />}
            <Box sx={{ flex: 1 }} />
            <Button
              size="small"
              endIcon={showBalances ? <ExpandLess /> : <ExpandMore />}
              onClick={() => setShowBalances((v) => !v)}
              sx={{ textTransform: 'none', fontSize: '0.75rem' }}
            >
              Employee balances
            </Button>
          </Stack>

          <Collapse in={showBalances}>
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', mb: 2, maxHeight: 220 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f8fafc' }}>
                    {['Employee', 'Balance', 'Status', ''].map((h) => (
                      <TableCell key={h || 'action'} sx={{ fontWeight: 700, fontSize: '0.68rem', py: 0.75 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {summary.slice(0, 50).map((e) => {
                    const meta = balanceMeta(e.closing_balance);
                    return (
                      <TableRow key={e.emp_id} hover>
                        <TableCell sx={{ fontSize: '0.8125rem', fontWeight: 600 }}>{e.emp_name}</TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontWeight: 700, color: meta.color, fontSize: '0.8125rem' }}>
                          {fmtAmt(e.closing_balance)}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={meta.label} sx={{ bgcolor: meta.bg, color: meta.color, height: 20, fontSize: '0.62rem', fontWeight: 700 }} />
                        </TableCell>
                        <TableCell align="right">
                          <Button size="small" onClick={() => setSelectedEmpId(String(e.emp_id))} sx={{ textTransform: 'none', fontSize: '0.72rem' }}>
                            View ledger
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Collapse>

          <TableContainer
            ref={scrollRef}
            component={Paper}
            elevation={0}
            sx={{ border: '1px solid #cbd5e1', maxHeight: { xs: 420, md: 520 }, bgcolor: '#fafbfc' }}
          >
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: '#e8effd' }}>
                  {(showEmployeeColumn
                    ? ['Date', 'Employee', 'Type', 'Bill #', 'Particulars', 'Debit', 'Credit', 'Balance']
                    : ['Date', 'Type', 'Bill #', 'Particulars', 'Debit', 'Credit', 'Balance']
                  ).map((h) => (
                    <TableCell
                      key={h}
                      sx={{ fontWeight: 700, fontSize: '0.68rem', color: '#1347c4', py: 1 }}
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
                    <TableCell colSpan={showEmployeeColumn ? 8 : 7} align="center" sx={{ py: 6 }}>
                      <CircularProgress size={28} sx={{ color: BRAND.primary.blue }} />
                    </TableCell>
                  </TableRow>
                ) : visibleEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={showEmployeeColumn ? 8 : 7} align="center" sx={{ py: 4, color: '#94a3b8' }}>
                      No transactions match your filters
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleEntries.map((row) => {
                    const chip = typeChipStyle(row.trnx_type);
                    return (
                      <TableRow key={row.el_id} hover sx={{ '&:last-child td': { borderBottom: 'none' } }}>
                        <TableCell sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                          {row.created_at ? new Date(row.created_at).toLocaleDateString('en-GB') : '—'}
                        </TableCell>
                        {showEmployeeColumn && (
                          <TableCell sx={{ fontSize: '0.8125rem', fontWeight: 600, maxWidth: 140 }}>
                            <Button
                              size="small"
                              onClick={() => setSelectedEmpId(String(row.emp_id))}
                              sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.8125rem', p: 0, minWidth: 0, justifyContent: 'flex-start' }}
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
