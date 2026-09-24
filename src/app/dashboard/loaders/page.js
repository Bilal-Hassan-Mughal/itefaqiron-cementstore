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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Grid,
  Avatar,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
  LocalShipping as TransportIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Clear as ClearIcon,
  Info as InfoIcon,
  CalendarMonth as CalendarIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Tag as TagIcon,
  AccountBalanceWallet as WalletIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  PointOfSale as SalesIcon,
  AssignmentReturn as ReturnIcon,
} from '@mui/icons-material';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const EMPTY_FORM = {
  loader_name: '',
  loader_number: '',
  loader_phone: '',
  loader_balance: '',
};

const CARD_SX = {
  borderRadius: '12px',
  border: '1px solid #dce3ed',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
  bgcolor: '#ffffff',
  overflow: 'hidden',
};

const EXCEL_TABLE_SX = {
  minWidth: 980,
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

function StatCard({ title, value, subtitle, icon: Icon, tone = 'blue' }) {
  const tones = {
    blue: { bg: '#e8effd', color: '#1A55E3' },
    green: { bg: '#e6fff4', color: '#00a868' },
    pink: { bg: '#ffe8f0', color: '#cc0644' },
    periwinkle: { bg: '#eef0fe', color: '#5E6EED' },
    cyan: { bg: '#e6faff', color: '#0aa3bd' },
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

const getBalanceMeta = (balance) => {
  const n = parseFloat(balance || 0);
  if (n > 0) return { label: 'Credit', color: '#059669', bg: '#dcfce7', icon: TrendingUpIcon };
  if (n < 0) return { label: 'Due', color: '#dc2626', bg: '#fee2e2', icon: TrendingDownIcon };
  return { label: 'Settled', color: '#64748b', bg: '#f1f5f9', icon: WalletIcon };
};

export default function LoadersPage() {
  const router = useRouter();

  const [loaders, setLoaders] = useState([]);
  const [summary, setSummary] = useState({
    totalRecords: 0,
    positiveBalance: 0,
    negativeBalance: 0,
    zeroBalance: 0,
    totalBalance: 0,
    thisMonth: 0,
  });

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [balanceFilter, setBalanceFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingLoader, setEditingLoader] = useState(null);
  const [viewLoader, setViewLoader] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const filteredByDate = useMemo(() => {
    return loaders.filter((item) => {
      if (!item.created_at) return true;
      const d = new Date(item.created_at);
      if (dateFrom && d < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && d > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [loaders, dateFrom, dateTo]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, balanceFilter, sortBy, sortOrder]);

  const fetchLoaders = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        sortOrder,
        balanceFilter,
      });
      if (debouncedSearch) params.set('search', debouncedSearch);

      const response = await fetch(`/api/loaders?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch loaders');

      const data = await response.json();

      if (Array.isArray(data)) {
        setLoaders(data);
        const totalBal = data.reduce((s, l) => s + parseFloat(l.loader_balance || 0), 0);
        setSummary({
          totalRecords: data.length,
          positiveBalance: data.filter((l) => parseFloat(l.loader_balance || 0) > 0).length,
          negativeBalance: data.filter((l) => parseFloat(l.loader_balance || 0) < 0).length,
          zeroBalance: data.filter((l) => parseFloat(l.loader_balance || 0) === 0).length,
          totalBalance: totalBal,
          thisMonth: data.filter((l) => {
            const d = new Date(l.created_at);
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            return d >= monthStart;
          }).length,
        });
        setTotalRecords(data.length);
        setTotalPages(1);
      } else {
        setLoaders(Array.isArray(data.loaders) ? data.loaders : []);
        setSummary(data.summary || {
          totalRecords: 0,
          positiveBalance: 0,
          negativeBalance: 0,
          zeroBalance: 0,
          totalBalance: 0,
          thisMonth: 0,
        });
        setTotalRecords(data.pagination?.total || 0);
        setTotalPages(Math.max(1, data.pagination?.pages || 1));
      }
    } catch (error) {
      console.error('Error fetching loaders:', error);
      showSnackbar('Failed to load loaders', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, balanceFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchLoaders();
  }, [fetchLoaders]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingLoader(null);
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (loader) => {
    setEditingLoader(loader);
    setFormData({
      loader_name: loader.loader_name || '',
      loader_number: loader.loader_number || '',
      loader_phone: loader.loader_phone || '',
      loader_balance: loader.loader_balance ?? '',
    });
    setFormOpen(true);
  };

  const handleFormChange = (key) => (e) => {
    setFormData((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const handleBalanceChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^-?\d*\.?\d*$/.test(value)) {
      setFormData((prev) => ({ ...prev, loader_balance: value }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.loader_name.trim()) {
      showSnackbar('Loader name is required', 'error');
      return;
    }
    if (!formData.loader_number.trim()) {
      showSnackbar('Loader number is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        loader_name: formData.loader_name.trim(),
        loader_number: formData.loader_number.trim(),
        loader_phone: formData.loader_phone.trim() || null,
        loader_balance: formData.loader_balance === '' ? 0 : parseFloat(formData.loader_balance) || 0,
      };

      const response = await fetch('/api/loaders', {
        method: editingLoader ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingLoader ? { id: editingLoader.loader_id, ...payload } : payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Save failed');
      }

      showSnackbar(editingLoader ? 'Loader updated successfully' : 'Loader added successfully', 'success');
      setFormOpen(false);
      resetForm();
      fetchLoaders();
    } catch (error) {
      showSnackbar(error.message || 'Failed to save loader', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (loader) => {
    if (!window.confirm(`Delete loader "${loader.loader_name}"?`)) return;

    try {
      const response = await fetch(`/api/loaders?id=${loader.loader_id}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Delete failed');
      }
      showSnackbar('Loader deleted', 'success');
      fetchLoaders();
    } catch (error) {
      showSnackbar(error.message || 'Failed to delete loader', 'error');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setBalanceFilter('all');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 1400, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5, pb: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>
              Loader / Transport Management
            </Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mt: 0.5 }}>
              Manage loaders, transport staff, and running balances linked to sales
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
            Add Loader
          </Button>
        </Box>

        {/* Info */}
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
            Where loaders are used
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.55 }}>
            Loaders are assigned on <strong>Sales</strong> bills for delivery/transport handling.
            Their <strong>balance</strong> is adjusted automatically on sale returns when shipping is reversed.
            This is separate from transport <strong>Accounts</strong> (ledger) used for delivery charge posting.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap', gap: 1 }}>
            <Chip
              size="small"
              label="Sales"
              icon={<SalesIcon sx={{ fontSize: 16 }} />}
              onClick={() => router.push('/dashboard/sales')}
              sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 600, cursor: 'pointer' }}
            />
            <Chip
              size="small"
              label="Sale Returns"
              icon={<ReturnIcon sx={{ fontSize: 16 }} />}
              onClick={() => router.push('/dashboard/sale-returns')}
              sx={{ bgcolor: '#ffe8f0', color: '#cc0644', fontWeight: 600, cursor: 'pointer' }}
            />
            <Chip
              size="small"
              label="Vehicles"
              icon={<TransportIcon sx={{ fontSize: 16 }} />}
              onClick={() => router.push('/dashboard/vehicles')}
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
          <StatCard title="Total Loaders" value={summary.totalRecords} subtitle={`${totalRecords} matching filters`} icon={TransportIcon} tone="periwinkle" />
          <StatCard title="Credit Balance" value={summary.positiveBalance} subtitle="Positive balance" icon={TrendingUpIcon} tone="green" />
          <StatCard title="Due / Negative" value={summary.negativeBalance} subtitle="Negative balance" icon={TrendingDownIcon} tone="pink" />
          <StatCard title="Net Balance" value={fmtAmt(summary.totalBalance)} subtitle="Sum of all balances" icon={WalletIcon} tone="blue" />
          <StatCard title="Added This Month" value={summary.thisMonth} icon={CalendarIcon} tone="cyan" />
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
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(5, 1fr)' },
                gap: 2,
              }}
            >
              <TextField
                label="Search"
                size="small"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Name, number, phone..."
                sx={{ ...FILTER_FIELD_SX, gridColumn: { md: 'span 2' } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <FormControl size="small" sx={FILTER_FIELD_SX}>
                <InputLabel>Balance</InputLabel>
                <Select label="Balance" value={balanceFilter} onChange={(e) => setBalanceFilter(e.target.value)}>
                  <MenuItem value="all">All balances</MenuItem>
                  <MenuItem value="positive">Credit (positive)</MenuItem>
                  <MenuItem value="negative">Due (negative)</MenuItem>
                  <MenuItem value="zero">Settled (zero)</MenuItem>
                </Select>
              </FormControl>
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
                  <MenuItem value="loader_name-asc">Name A–Z</MenuItem>
                  <MenuItem value="loader_name-desc">Name Z–A</MenuItem>
                  <MenuItem value="loader_balance-desc">Balance high–low</MenuItem>
                  <MenuItem value="loader_balance-asc">Balance low–high</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </CardContent>
        </Card>

        {/* Table */}
        <Card sx={CARD_SX}>
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
            <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>Loader Register</Typography>
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
                      {['#', 'Loader', 'Number', 'Phone', 'Balance', 'Status', 'Added', 'Actions'].map((h, i) => (
                        <TableCell key={h} sx={EXCEL_HEAD_SX} align={i === 4 ? 'right' : 'left'}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredByDate.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#94a3b8' }}>
                          No loaders found. Click &quot;Add Loader&quot; to register transport staff.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredByDate.map((loader, index) => {
                        const balMeta = getBalanceMeta(loader.loader_balance);
                        const BalIcon = balMeta.icon;

                        return (
                          <TableRow
                            key={loader.loader_id}
                            hover
                            sx={{ '&:hover': { bgcolor: '#f8fafc' }, cursor: 'pointer' }}
                            onClick={() => {
                              setViewLoader(loader);
                              setViewOpen(true);
                            }}
                          >
                            <TableCell sx={{ color: '#64748b', fontWeight: 600 }}>
                              {(page - 1) * limit + index + 1}
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Avatar sx={{ width: 34, height: 34, fontSize: '0.85rem', fontWeight: 800, bgcolor: '#5E6EED' }}>
                                  {(loader.loader_name || '?').charAt(0).toUpperCase()}
                                </Avatar>
                                <Box>
                                  <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', color: '#0f172a' }}>
                                    {loader.loader_name}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8' }}>ID #{loader.loader_id}</Typography>
                                </Box>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <TagIcon sx={{ fontSize: 15, color: '#94a3b8' }} />
                                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'monospace', color: '#334155' }}>
                                  {loader.loader_number}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              {loader.loader_phone ? (
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                  <PhoneIcon sx={{ fontSize: 15, color: '#0aa3bd' }} />
                                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'monospace' }}>{loader.loader_phone}</Typography>
                                </Stack>
                              ) : (
                                <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>—</Typography>
                              )}
                            </TableCell>
                            <TableCell sx={{ ...NUM_CELL_SX, fontWeight: 800, color: balMeta.color }}>
                              {fmtAmt(loader.loader_balance)}
                            </TableCell>
                            <TableCell>
                              <Chip
                                icon={<BalIcon sx={{ fontSize: '14px !important' }} />}
                                label={balMeta.label}
                                size="small"
                                sx={{
                                  height: 24,
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  bgcolor: balMeta.bg,
                                  color: balMeta.color,
                                  '& .MuiChip-icon': { color: balMeta.color },
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', color: '#475569' }}>
                              {loader.created_at ? formatDatePK(loader.created_at) : '—'}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Stack direction="row" spacing={0.25}>
                                <Tooltip title="View">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setViewLoader(loader);
                                      setViewOpen(true);
                                    }}
                                  >
                                    <VisibilityIcon sx={{ fontSize: 18, color: '#64748b' }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit">
                                  <IconButton size="small" onClick={() => openEditForm(loader)}>
                                    <EditIcon sx={{ fontSize: 18, color: BRAND.primary.blue }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton size="small" onClick={() => handleDelete(loader)}>
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

      {/* Create / Edit */}
      <Dialog open={formOpen} onClose={() => !isSubmitting && setFormOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: '14px' } }}>
        <DialogTitle sx={{ pb: 1, background: 'linear-gradient(90deg, #1A55E3 0%, #5E6EED 100%)', color: '#fff' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TransportIcon />
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                  {editingLoader ? 'Edit Loader' : 'Register New Loader'}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', opacity: 0.9 }}>
                  Loader number must be unique
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
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Loader Name *"
                  size="small"
                  fullWidth
                  required
                  value={formData.loader_name}
                  onChange={handleFormChange('loader_name')}
                  placeholder="Full name"
                  sx={FILTER_FIELD_SX}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PersonIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Loader Number *"
                  size="small"
                  fullWidth
                  required
                  value={formData.loader_number}
                  onChange={handleFormChange('loader_number')}
                  placeholder="Unique ID / code"
                  sx={FILTER_FIELD_SX}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <TagIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Phone"
                  size="small"
                  fullWidth
                  value={formData.loader_phone}
                  onChange={handleFormChange('loader_phone')}
                  placeholder="03XX-XXXXXXX"
                  sx={FILTER_FIELD_SX}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <PhoneIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Opening Balance"
                  size="small"
                  fullWidth
                  value={formData.loader_balance}
                  onChange={handleBalanceChange}
                  placeholder="0.00"
                  sx={FILTER_FIELD_SX}
                  helperText="Updated automatically on sale returns"
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <WalletIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                      </InputAdornment>
                    ),
                  }}
                />
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
              {editingLoader ? 'Update Loader' : 'Save Loader'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* View */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '14px' } }}>
        {viewLoader && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Avatar sx={{ width: 48, height: 48, fontWeight: 800, bgcolor: '#5E6EED', fontSize: '1.1rem' }}>
                  {(viewLoader.loader_name || '?').charAt(0).toUpperCase()}
                </Avatar>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>{viewLoader.loader_name}</Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>
                    #{viewLoader.loader_number} · ID {viewLoader.loader_id}
                  </Typography>
                </Box>
                <Chip
                  label={getBalanceMeta(viewLoader.loader_balance).label}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    bgcolor: getBalanceMeta(viewLoader.loader_balance).bg,
                    color: getBalanceMeta(viewLoader.loader_balance).color,
                  }}
                />
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: '10px',
                    bgcolor: getBalanceMeta(viewLoader.loader_balance).bg,
                    border: `1px solid ${getBalanceMeta(viewLoader.loader_balance).color}33`,
                    textAlign: 'center',
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Current Balance</Typography>
                  <Typography
                    sx={{
                      fontSize: '1.75rem',
                      fontWeight: 900,
                      color: getBalanceMeta(viewLoader.loader_balance).color,
                      fontFamily: 'monospace',
                    }}
                  >
                    {fmtAmt(viewLoader.loader_balance)}
                  </Typography>
                </Box>

                <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PhoneIcon sx={{ fontSize: 18, color: '#0aa3bd' }} />
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Phone</Typography>
                        <Typography sx={{ fontWeight: 700 }}>{viewLoader.loader_phone || '—'}</Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <Box sx={{ p: 1.5, bgcolor: '#eef0fe', borderRadius: '8px' }}>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>Registered</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>
                      {viewLoader.created_at ? formatDatePK(viewLoader.created_at) : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5, bgcolor: '#e6fff4', borderRadius: '8px' }}>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>Last Updated</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>
                      {viewLoader.updated_at ? formatDatePK(viewLoader.updated_at) : '—'}
                    </Typography>
                  </Box>
                </Box>

                {viewLoader.updated_by_user?.full_name && (
                  <Typography sx={{ fontSize: '0.8125rem', color: '#475569' }}>
                    Last edited by <strong>{viewLoader.updated_by_user.full_name}</strong>
                  </Typography>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 2.5, py: 1.5, justifyContent: 'space-between' }}>
              <Button
                size="small"
                startIcon={<SalesIcon />}
                onClick={() => {
                  setViewOpen(false);
                  router.push('/dashboard/sales');
                }}
                sx={{ textTransform: 'none', color: '#15803d' }}
              >
                Go to Sales
              </Button>
              <Stack direction="row" spacing={1}>
                <Button onClick={() => setViewOpen(false)} sx={{ textTransform: 'none' }}>Close</Button>
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={() => {
                    setViewOpen(false);
                    openEditForm(viewLoader);
                  }}
                  sx={{ textTransform: 'none', fontWeight: 700, bgcolor: BRAND.primary.blue }}
                >
                  Edit
                </Button>
              </Stack>
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
