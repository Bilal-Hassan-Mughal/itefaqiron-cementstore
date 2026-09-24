'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { formatDatePK } from '@/lib/date-helper';
import { BRAND } from '@/lib/brand-theme';
import DashboardLayout from '../components/dashboard-layout';
import {
  Box,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Autocomplete,
  Chip,
  InputAdornment,
  Stack,
  Alert,
  Snackbar,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  LocalShipping as TruckIcon,
  AttachMoney as MoneyIcon,
  Receipt as ReceiptIcon,
  TrendingDown as ExpenseIcon,
  AccountBalance as LedgerIcon,
  Clear as ClearIcon,
  Info as InfoIcon,
  CalendarMonth as CalendarIcon,
  Close as CloseIcon,
  Save as SaveIcon,
} from '@mui/icons-material';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const EXPENSE_FIELDS = [
  { key: 'exp1', label: 'Toll / Route', short: 'Toll' },
  { key: 'exp2', label: 'Diesel / Fuel', short: 'Diesel' },
  { key: 'exp3', label: 'Loading', short: 'Loading' },
  { key: 'exp4', label: 'Unloading', short: 'Unload' },
  { key: 'exp5', label: 'Driver / Bhatta', short: 'Driver' },
  { key: 'exp6', label: 'Bilty / Commission', short: 'Bilty' },
  { key: 'others', label: 'Other Expenses', short: 'Other' },
];

const EMPTY_FORM = {
  vehicle_no: '',
  total_cargo_fare: '',
  exp1: '',
  exp2: '',
  exp3: '',
  exp4: '',
  exp5: '',
  exp6: '',
  others: '',
};

const CARD_SX = {
  borderRadius: '12px',
  border: '1px solid #dce3ed',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
  bgcolor: '#ffffff',
  overflow: 'hidden',
};

const EXCEL_TABLE_SX = {
  minWidth: 960,
  borderCollapse: 'collapse',
  '& .MuiTableCell-root': {
    border: '1px solid #cbd5e1',
    py: 0.75,
    px: 1.25,
    fontSize: '0.8125rem',
    lineHeight: 1.35,
  },
};

const EXCEL_HEAD_SX = {
  bgcolor: '#e8effd',
  color: '#1347c4',
  fontWeight: 700,
  fontSize: '0.72rem',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  zIndex: 2,
  borderBottom: '2px solid #94a3b8 !important',
};

const NUM_CELL_SX = {
  textAlign: 'right',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontVariantNumeric: 'tabular-nums',
};

const FILTER_FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    bgcolor: '#fff',
    fontSize: '0.8125rem',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&:hover fieldset': { borderColor: '#94a3b8' },
    '&.Mui-focused fieldset': {
      borderColor: BRAND.supporting.periwinkle,
      borderWidth: '1.5px',
    },
  },
  '& .MuiInputLabel-root': { fontSize: '0.8125rem', fontWeight: 500 },
};

const sumExpenses = (item) =>
  EXPENSE_FIELDS.reduce((sum, { key }) => sum + parseFloat(item?.[key] || 0), 0);

const netAmount = (item) => parseFloat(item?.total_cargo_fare || 0) - sumExpenses(item);

const parseNum = (val) => {
  if (val === '' || val === null || val === undefined) return 0;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : 0;
};

function StatCard({ title, value, subtitle, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: { bg: '#e8effd', color: '#1A55E3' },
    green: { bg: '#e6fff4', color: '#00a868' },
    pink: { bg: '#ffe8f0', color: '#cc0644' },
    periwinkle: { bg: '#eef0fe', color: '#5E6EED' },
  };
  const t = tones[tone] || tones.blue;

  return (
    <Card sx={CARD_SX}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              bgcolor: t.bg,
              color: t.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon sx={{ fontSize: 22 }} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{title}</Typography>
            <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: '#0f172a', lineHeight: 1.2 }}>{value}</Typography>
            {subtitle && (
              <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', mt: 0.25 }}>{subtitle}</Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function CargoPage() {
  const router = useRouter();

  const [cargo, setCargo] = useState([]);
  const [summary, setSummary] = useState({
    totalRecords: 0,
    totalFare: 0,
    totalExpenses: 0,
    netAmount: 0,
    thisMonth: 0,
  });
  const [vehicles, setVehicles] = useState([]);
  const [cargoAccountCount, setCargoAccountCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingCargo, setEditingCargo] = useState(null);
  const [viewCargo, setViewCargo] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const formTotals = useMemo(() => {
    const fare = parseNum(formData.total_cargo_fare);
    const expenses = EXPENSE_FIELDS.reduce((sum, { key }) => sum + parseNum(formData[key]), 0);
    return { fare, expenses, net: fare - expenses };
  }, [formData]);

  const filteredByDate = useMemo(() => {
    return cargo.filter((item) => {
      if (!item.created_at) return true;
      const d = new Date(item.created_at);
      if (dateFrom && d < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && d > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [cargo, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy, sortOrder]);

  const fetchStaticData = useCallback(async () => {
    try {
      const [vehiclesRes, customersRes] = await Promise.all([
        fetch('/api/vehicles'),
        fetch('/api/customers?dropdown=true'),
      ]);

      if (vehiclesRes.ok) {
        const data = await vehiclesRes.json();
        const list = Array.isArray(data) ? data : (data.vehicles || []);
        setVehicles(Array.isArray(list) ? list : []);
      }

      if (customersRes.ok) {
        const data = await customersRes.json();
        const list = data.value || data;
        const accounts = (Array.isArray(list) ? list : []).filter(
          (c) => (c.customer_type?.cus_type_title || '').toLowerCase() === 'cargo'
        );
        setCargoAccountCount(accounts.length);
      }
    } catch (error) {
      console.error('Error fetching reference data:', error);
    }
  }, []);

  const fetchCargo = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        sortOrder,
      });
      if (debouncedSearch) params.set('search', debouncedSearch);

      const response = await fetch(`/api/cargo?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch cargo');

      const data = await response.json();
      setCargo(Array.isArray(data.cargo) ? data.cargo : []);
      setSummary(data.summary || {
        totalRecords: data.pagination?.total || 0,
        totalFare: 0,
        totalExpenses: 0,
        netAmount: 0,
        thisMonth: 0,
      });
      setTotalRecords(data.pagination?.total || 0);
      setTotalPages(Math.max(1, data.pagination?.pages || 1));
    } catch (error) {
      console.error('Error fetching cargo:', error);
      showSnackbar('Failed to load cargo records', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchStaticData();
  }, [fetchStaticData]);

  useEffect(() => {
    fetchCargo();
  }, [fetchCargo]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingCargo(null);
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (item) => {
    setEditingCargo(item);
    setFormData({
      vehicle_no: item.vehicle_no || '',
      total_cargo_fare: item.total_cargo_fare ?? '',
      exp1: item.exp1 ?? '',
      exp2: item.exp2 ?? '',
      exp3: item.exp3 ?? '',
      exp4: item.exp4 ?? '',
      exp5: item.exp5 ?? '',
      exp6: item.exp6 ?? '',
      others: item.others ?? '',
    });
    setFormOpen(true);
  };

  const handleFormNumberChange = (key) => (e) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setFormData((prev) => ({ ...prev, [key]: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.vehicle_no.trim()) {
      showSnackbar('Vehicle number is required', 'error');
      return;
    }

    const payload = {
      vehicle_no: formData.vehicle_no.trim(),
      total_cargo_fare: parseNum(formData.total_cargo_fare),
      ...Object.fromEntries(EXPENSE_FIELDS.map(({ key }) => [key, parseNum(formData[key])])),
    };

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/cargo', {
        method: editingCargo ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingCargo ? { id: editingCargo.cargo_id, ...payload } : payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Save failed');
      }

      showSnackbar(editingCargo ? 'Cargo record updated' : 'Cargo record created', 'success');
      setFormOpen(false);
      resetForm();
      fetchCargo();
    } catch (error) {
      showSnackbar(error.message || 'Failed to save cargo record', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete cargo record for ${item.vehicle_no}?`)) return;

    try {
      const response = await fetch(`/api/cargo?id=${item.cargo_id}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Delete failed');
      }
      showSnackbar('Cargo record deleted', 'success');
      fetchCargo();
    } catch (error) {
      showSnackbar(error.message || 'Failed to delete cargo record', 'error');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  const vehicleOptions = useMemo(
    () => vehicles.map((v) => v.v_vehicle_no).filter(Boolean),
    [vehicles]
  );

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 1400, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5, pb: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Cargo Management</Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mt: 0.5 }}>
              Track vehicle freight fares, trip expenses, and net cargo profit
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={openCreateForm}
            sx={{
              bgcolor: BRAND.primary.blue,
              background: `linear-gradient(180deg, ${BRAND.primary.blue} 0%, #1347c4 100%)`,
              borderRadius: '10px',
              px: 2.5,
              py: 1,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: '0 4px 14px rgba(26,85,227,0.28)',
              '&:hover': { filter: 'brightness(1.05)' },
            }}
          >
            New Cargo Entry
          </Button>
        </Box>

        {/* Info banner */}
        <Alert
          severity="info"
          icon={<InfoIcon fontSize="inherit" />}
          sx={{
            borderRadius: '12px',
            border: '1px solid #bfdbfe',
            bgcolor: '#eff6ff',
            '& .MuiAlert-message': { width: '100%' },
          }}
        >
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, color: '#1e40af', mb: 0.5 }}>
            How cargo works in this system
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.55 }}>
            This page records <strong>vehicle trip freight</strong> (bilty-style fare minus expenses). It is separate from
            ledger cargo charges on <strong>Purchases</strong> (Out Delivery → cargo accounts with type &quot;cargo&quot;) and
            <strong> Sales/Orders</strong> (Delivery charges → transport accounts). Those use Accounts, not this table.
            {cargoAccountCount > 0 && (
              <> You have <strong>{cargoAccountCount}</strong> cargo ledger account{cargoAccountCount !== 1 ? 's' : ''} for purchase billing.</>
            )}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap', gap: 1 }}>
            <Chip
              size="small"
              label="Purchases → Cargo Accounts"
              onClick={() => router.push('/dashboard/purchases')}
              sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }}
            />
            <Chip
              size="small"
              label="Sales → Transport Accounts"
              onClick={() => router.push('/dashboard/sales')}
              sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 600, cursor: 'pointer' }}
            />
            <Chip
              size="small"
              label="Manage Accounts"
              onClick={() => router.push('/dashboard/customers')}
              icon={<LedgerIcon sx={{ fontSize: 16 }} />}
              sx={{ bgcolor: '#eef0fe', color: '#4a57d4', fontWeight: 600, cursor: 'pointer' }}
            />
          </Stack>
        </Alert>

        {/* Stats */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(5, 1fr)' },
            gap: 1.5,
          }}
        >
          <StatCard title="Total Records" value={summary.totalRecords} subtitle={`${totalRecords} matching filters`} icon={TruckIcon} tone="periwinkle" />
          <StatCard title="Total Fare" value={fmtAmt(summary.totalFare)} icon={MoneyIcon} tone="blue" />
          <StatCard title="Total Expenses" value={fmtAmt(summary.totalExpenses)} icon={ExpenseIcon} tone="pink" />
          <StatCard title="Net Amount" value={fmtAmt(summary.netAmount)} subtitle="Fare minus expenses" icon={ReceiptIcon} tone="green" />
          <StatCard title="This Month" value={summary.thisMonth} subtitle="Entries this month" icon={CalendarIcon} tone="blue" />
        </Box>

        {/* Filters */}
        <Card sx={CARD_SX}>
          <Box
            sx={{
              px: 2.5,
              py: 1.75,
              borderBottom: '1px solid #e2e8f0',
              background: 'linear-gradient(90deg, #e8effd 0%, #ffffff 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography sx={{ fontWeight: 700, color: '#1347c4', fontSize: '0.9rem' }}>Search & Filters</Typography>
            <Button size="small" startIcon={<ClearIcon />} onClick={clearFilters} sx={{ textTransform: 'none', color: '#64748b' }}>
              Clear
            </Button>
          </Box>
          <CardContent sx={{ p: 2 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
                gap: 2,
              }}
            >
              <TextField
                label="Search vehicle"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={FILTER_FIELD_SX}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="Date from"
                type="date"
                size="small"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                InputLabelProps={{ shrink: true }} inputProps={{ lang: 'en-GB' }}
                sx={FILTER_FIELD_SX}
              />
              <TextField
                label="Date to"
                type="date"
                size="small"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                InputLabelProps={{ shrink: true }} inputProps={{ lang: 'en-GB' }}
                sx={FILTER_FIELD_SX}
              />
              <FormControl size="small" sx={FILTER_FIELD_SX}>
                <InputLabel>Sort</InputLabel>
                <Select
                  label="Sort"
                  value={`${sortBy}-${sortOrder}`}
                  onChange={(e) => {
                    const [field, order] = e.target.value.split('-');
                    setSortBy(field);
                    setSortOrder(order);
                  }}
                >
                  <MenuItem value="created_at-desc">Newest first</MenuItem>
                  <MenuItem value="created_at-asc">Oldest first</MenuItem>
                  <MenuItem value="vehicle_no-asc">Vehicle A–Z</MenuItem>
                  <MenuItem value="vehicle_no-desc">Vehicle Z–A</MenuItem>
                  <MenuItem value="total_cargo_fare-desc">Fare high–low</MenuItem>
                  <MenuItem value="total_cargo_fare-asc">Fare low–high</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </CardContent>
        </Card>

        {/* Table */}
        <Card sx={{ ...CARD_SX, flex: 1 }}>
          <Box
            sx={{
              px: 2.5,
              py: 1.5,
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1,
            }}
          >
            <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>Cargo Records</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
              Page {page} of {totalPages} · {filteredByDate.length} shown
            </Typography>
          </Box>

          {loading ? (
            <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress sx={{ color: BRAND.primary.blue }} />
            </Box>
          ) : (
            <>
              <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 520 }}>
                <Table stickyHeader sx={EXCEL_TABLE_SX}>
                  <TableHead>
                    <TableRow>
                      {['#', 'Vehicle', 'Total Fare', 'Expenses', 'Net', 'Top Expenses', 'Date', 'Actions'].map((h, i) => (
                        <TableCell key={h} sx={EXCEL_HEAD_SX} align={i >= 2 && i <= 4 ? 'right' : 'left'}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredByDate.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#94a3b8' }}>
                          No cargo records found. Click &quot;New Cargo Entry&quot; to add one.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredByDate.map((item, index) => {
                        const expenses = sumExpenses(item);
                        const net = netAmount(item);
                        const topExpenses = EXPENSE_FIELDS
                          .map(({ key, short }) => ({ short, val: parseFloat(item[key] || 0) }))
                          .filter((e) => e.val > 0)
                          .sort((a, b) => b.val - a.val)
                          .slice(0, 2);

                        return (
                          <TableRow
                            key={item.cargo_id}
                            hover
                            sx={{ '&:hover': { bgcolor: '#f8fafc' }, cursor: 'pointer' }}
                            onClick={() => {
                              setViewCargo(item);
                              setViewOpen(true);
                            }}
                          >
                            <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>
                              {(page - 1) * limit + index + 1}
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Box
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '8px',
                                    bgcolor: '#eef0fe',
                                    color: '#5E6EED',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <TruckIcon sx={{ fontSize: 18 }} />
                                </Box>
                                <Box>
                                  <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#0f172a' }}>
                                    {item.vehicle_no}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8' }}>ID #{item.cargo_id}</Typography>
                                </Box>
                              </Stack>
                            </TableCell>
                            <TableCell sx={NUM_CELL_SX}>{fmtAmt(item.total_cargo_fare)}</TableCell>
                            <TableCell sx={{ ...NUM_CELL_SX, color: '#dc2626' }}>{fmtAmt(expenses)}</TableCell>
                            <TableCell sx={{ ...NUM_CELL_SX, color: net >= 0 ? '#059669' : '#dc2626', fontWeight: 700 }}>
                              {fmtAmt(net)}
                            </TableCell>
                            <TableCell>
                              {topExpenses.length === 0 ? (
                                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</Typography>
                              ) : (
                                <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                                  {topExpenses.map((e) => (
                                    <Chip
                                      key={e.short}
                                      label={`${e.short}: ${fmtAmt(e.val)}`}
                                      size="small"
                                      sx={{ height: 22, fontSize: '0.68rem', bgcolor: '#f1f5f9' }}
                                    />
                                  ))}
                                </Stack>
                              )}
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', color: '#475569' }}>
                              {item.created_at ? formatDatePK(item.created_at) : '—'}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Stack direction="row" spacing={0.25}>
                                <Tooltip title="View">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setViewCargo(item);
                                      setViewOpen(true);
                                    }}
                                  >
                                    <VisibilityIcon sx={{ fontSize: 18, color: '#64748b' }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit">
                                  <IconButton size="small" onClick={() => openEditForm(item)}>
                                    <EditIcon sx={{ fontSize: 18, color: BRAND.primary.blue }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton size="small" onClick={() => handleDelete(item)}>
                                    <DeleteIcon sx={{ fontSize: 18, color: '#dc2626' }} />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2, borderTop: '1px solid #e2e8f0' }}>
                  <Pagination
                    count={totalPages}
                    page={page}
                    onChange={(_, p) => setPage(p)}
                    color="primary"
                    shape="rounded"
                    size="small"
                  />
                </Box>
              )}
            </>
          )}
        </Card>
      </Box>

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onClose={() => !isSubmitting && setFormOpen(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: '14px' } }}>
        <DialogTitle sx={{ pb: 1, background: 'linear-gradient(90deg, #1A55E3 0%, #5E6EED 100%)', color: '#fff' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TruckIcon />
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                  {editingCargo ? 'Edit Cargo Entry' : 'New Cargo Entry'}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', opacity: 0.9 }}>
                  Record freight fare and trip expenses for a vehicle
                </Typography>
              </Box>
            </Stack>
            <IconButton onClick={() => setFormOpen(false)} sx={{ color: '#fff' }} disabled={isSubmitting}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent sx={{ pt: 2.5 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  freeSolo
                  options={vehicleOptions}
                  value={formData.vehicle_no}
                  onInputChange={(_, value) => setFormData((prev) => ({ ...prev, vehicle_no: value || '' }))}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Vehicle Number *"
                      required
                      size="small"
                      placeholder="e.g. LEA-1234"
                      sx={FILTER_FIELD_SX}
                      helperText="Pick from Vehicles or type manually"
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  label="Total Cargo Fare"
                  size="small"
                  fullWidth
                  value={formData.total_cargo_fare}
                  onChange={handleFormNumberChange('total_cargo_fare')}
                  sx={FILTER_FIELD_SX}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <MoneyIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>

              <Grid item xs={12}>
                <Divider sx={{ my: 0.5 }}>
                  <Chip label="Trip Expenses" size="small" sx={{ fontWeight: 700, bgcolor: '#f1f5f9' }} />
                </Divider>
              </Grid>

              {EXPENSE_FIELDS.map(({ key, label }) => (
                <Grid item xs={12} sm={6} md={4} key={key}>
                  <TextField
                    label={label}
                    size="small"
                    fullWidth
                    value={formData[key]}
                    onChange={handleFormNumberChange(key)}
                    sx={FILTER_FIELD_SX}
                  />
                </Grid>
              ))}

              <Grid item xs={12}>
                <Box
                  sx={{
                    mt: 1,
                    p: 2,
                    borderRadius: '10px',
                    bgcolor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gap: 1,
                  }}
                >
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Total Fare</Typography>
                    <Typography sx={{ fontWeight: 800, color: '#1A55E3' }}>{fmtAmt(formTotals.fare)}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Total Expenses</Typography>
                    <Typography sx={{ fontWeight: 800, color: '#dc2626' }}>{fmtAmt(formTotals.expenses)}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600 }}>Net Amount</Typography>
                    <Typography sx={{ fontWeight: 800, color: formTotals.net >= 0 ? '#059669' : '#dc2626' }}>
                      {fmtAmt(formTotals.net)}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0' }}>
            <Button onClick={() => setFormOpen(false)} disabled={isSubmitting} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              disabled={isSubmitting}
              startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                bgcolor: BRAND.primary.blue,
                '&:hover': { bgcolor: '#1347c4' },
              }}
            >
              {editingCargo ? 'Update Record' : 'Save Record'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '14px' } }}>
        {viewCargo && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box sx={{ width: 40, height: 40, borderRadius: '10px', bgcolor: '#eef0fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <TruckIcon sx={{ color: '#5E6EED' }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>{viewCargo.vehicle_no}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Cargo #{viewCargo.cargo_id} · {viewCargo.created_at ? formatDatePK(viewCargo.created_at) : '—'}
                  </Typography>
                </Box>
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
                  <Box sx={{ p: 1.5, bgcolor: '#e8effd', borderRadius: '8px' }}>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>Fare</Typography>
                    <Typography sx={{ fontWeight: 800, color: '#1A55E3' }}>{fmtAmt(viewCargo.total_cargo_fare)}</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, bgcolor: '#ffe8f0', borderRadius: '8px' }}>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>Expenses</Typography>
                    <Typography sx={{ fontWeight: 800, color: '#dc2626' }}>{fmtAmt(sumExpenses(viewCargo))}</Typography>
                  </Box>
                  <Box sx={{ p: 1.5, bgcolor: '#e6fff4', borderRadius: '8px' }}>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>Net</Typography>
                    <Typography sx={{ fontWeight: 800, color: netAmount(viewCargo) >= 0 ? '#059669' : '#dc2626' }}>
                      {fmtAmt(netAmount(viewCargo))}
                    </Typography>
                  </Box>
                </Box>

                <Box>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155', mb: 1 }}>Expense Breakdown</Typography>
                  <Table size="small" sx={{ border: '1px solid #e2e8f0' }}>
                    <TableBody>
                      {EXPENSE_FIELDS.map(({ key, label }) => {
                        const val = parseFloat(viewCargo[key] || 0);
                        if (val <= 0) return null;
                        return (
                          <TableRow key={key}>
                            <TableCell sx={{ fontSize: '0.8125rem', color: '#475569' }}>{label}</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>{fmtAmt(val)}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </Box>

                {viewCargo.updated_by_user?.full_name && (
                  <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                    Last updated by {viewCargo.updated_by_user.full_name}
                  </Typography>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 2.5, py: 1.5 }}>
              <Button onClick={() => setViewOpen(false)} sx={{ textTransform: 'none' }}>Close</Button>
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => {
                  setViewOpen(false);
                  openEditForm(viewCargo);
                }}
                sx={{ textTransform: 'none', fontWeight: 700, bgcolor: BRAND.primary.blue }}
              >
                Edit
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </DashboardLayout>
  );
}
