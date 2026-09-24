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
  LocalShipping as TruckIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  Clear as ClearIcon,
  Info as InfoIcon,
  CalendarMonth as CalendarIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  Inventory as CargoIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';

const EMPTY_FORM = {
  v_vehicle_no: '',
  v_driver_name: '',
  v_driver_no: '',
};

const CARD_SX = {
  borderRadius: '12px',
  border: '1px solid #dce3ed',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
  bgcolor: '#ffffff',
  overflow: 'hidden',
};

const EXCEL_TABLE_SX = {
  minWidth: 900,
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

const getDriverStatus = (vehicle) => {
  const hasName = Boolean((vehicle.v_driver_name || '').trim());
  const hasPhone = Boolean((vehicle.v_driver_no || '').trim());
  if (hasName && hasPhone) return { label: 'Complete', color: '#059669', bg: '#dcfce7' };
  if (hasName || hasPhone) return { label: 'Partial', color: '#d97706', bg: '#fef3c7' };
  return { label: 'No Driver', color: '#64748b', bg: '#f1f5f9' };
};

export default function VehiclesPage() {
  const router = useRouter();

  const [vehicles, setVehicles] = useState([]);
  const [summary, setSummary] = useState({
    totalRecords: 0,
    withDrivers: 0,
    withPhone: 0,
    thisMonth: 0,
  });
  const [cargoTripCount, setCargoTripCount] = useState(0);

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
  const [driverFilter, setDriverFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [viewVehicle, setViewVehicle] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const showSnackbar = (message, severity = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  const filteredByDate = useMemo(() => {
    return vehicles.filter((item) => {
      if (!item.created_at) return true;
      const d = new Date(item.created_at);
      if (dateFrom && d < new Date(`${dateFrom}T00:00:00`)) return false;
      if (dateTo && d > new Date(`${dateTo}T23:59:59`)) return false;
      return true;
    });
  }, [vehicles, dateFrom, dateTo]);

  const filteredByDriver = useMemo(() => {
    return filteredByDate.filter((item) => {
      const hasName = Boolean((item.v_driver_name || '').trim());
      const hasPhone = Boolean((item.v_driver_no || '').trim());
      if (driverFilter === 'with_driver') return hasName;
      if (driverFilter === 'with_phone') return hasPhone;
      if (driverFilter === 'complete') return hasName && hasPhone;
      if (driverFilter === 'missing') return !hasName && !hasPhone;
      return true;
    });
  }, [filteredByDate, driverFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy, sortOrder, driverFilter]);

  const fetchCargoCount = useCallback(async () => {
    try {
      const res = await fetch('/api/cargo?limit=1');
      if (res.ok) {
        const data = await res.json();
        setCargoTripCount(data.pagination?.total || data.summary?.totalRecords || 0);
      }
    } catch {
      /* optional */
    }
  }, []);

  const fetchVehicles = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        sortBy,
        sortOrder,
      });
      if (debouncedSearch) params.set('search', debouncedSearch);

      const response = await fetch(`/api/vehicles?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch vehicles');

      const data = await response.json();

      // Backward compatible: plain array response
      if (Array.isArray(data)) {
        setVehicles(data);
        setSummary({
          totalRecords: data.length,
          withDrivers: data.filter((v) => (v.v_driver_name || '').trim()).length,
          withPhone: data.filter((v) => (v.v_driver_no || '').trim()).length,
          thisMonth: data.filter((v) => {
            const d = new Date(v.created_at);
            const monthStart = new Date();
            monthStart.setDate(1);
            monthStart.setHours(0, 0, 0, 0);
            return d >= monthStart;
          }).length,
        });
        setTotalRecords(data.length);
        setTotalPages(1);
      } else {
        setVehicles(Array.isArray(data.vehicles) ? data.vehicles : []);
        setSummary(data.summary || { totalRecords: 0, withDrivers: 0, withPhone: 0, thisMonth: 0 });
        setTotalRecords(data.pagination?.total || 0);
        setTotalPages(Math.max(1, data.pagination?.pages || 1));
      }
    } catch (error) {
      console.error('Error fetching vehicles:', error);
      showSnackbar('Failed to load vehicles', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    fetchCargoCount();
  }, [fetchCargoCount]);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setEditingVehicle(null);
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEditForm = (vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      v_vehicle_no: vehicle.v_vehicle_no || '',
      v_driver_name: vehicle.v_driver_name || '',
      v_driver_no: vehicle.v_driver_no || '',
    });
    setFormOpen(true);
  };

  const handleFormChange = (key) => (e) => {
    let value = e.target.value;
    if (key === 'v_vehicle_no') value = value.toUpperCase();
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.v_vehicle_no.trim()) {
      showSnackbar('Vehicle number is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        v_vehicle_no: formData.v_vehicle_no.trim(),
        v_driver_name: formData.v_driver_name.trim() || null,
        v_driver_no: formData.v_driver_no.trim() || null,
      };

      const response = await fetch('/api/vehicles', {
        method: editingVehicle ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingVehicle ? { id: editingVehicle.v_id, ...payload } : payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Save failed');
      }

      showSnackbar(editingVehicle ? 'Vehicle updated successfully' : 'Vehicle added successfully', 'success');
      setFormOpen(false);
      resetForm();
      fetchVehicles();
    } catch (error) {
      showSnackbar(error.message || 'Failed to save vehicle', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (vehicle) => {
    if (!window.confirm(`Delete vehicle ${vehicle.v_vehicle_no}?`)) return;

    try {
      const response = await fetch(`/api/vehicles?id=${vehicle.v_id}`, { method: 'DELETE' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Delete failed');
      }
      showSnackbar('Vehicle deleted', 'success');
      fetchVehicles();
    } catch (error) {
      showSnackbar(error.message || 'Failed to delete vehicle', 'error');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDateFrom('');
    setDateTo('');
    setDriverFilter('all');
    setSortBy('created_at');
    setSortOrder('desc');
  };

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 1400, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2.5, pb: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Vehicle Management</Typography>
            <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mt: 0.5 }}>
              Register fleet vehicles, assign drivers, and use them across cargo & billing
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
            Add Vehicle
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
            Where vehicles are used
          </Typography>
          <Typography sx={{ fontSize: '0.8125rem', color: '#334155', lineHeight: 1.55 }}>
            Registered vehicles appear in <strong>Cargo Management</strong> when recording freight trips.
            Purchase bills can also store a vehicle number on the bill. Keep driver details here so staff can pick the right truck quickly.
            {cargoTripCount > 0 && (
              <> There are <strong>{cargoTripCount}</strong> cargo trip record{cargoTripCount !== 1 ? 's' : ''} in the system.</>
            )}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap', gap: 1 }}>
            <Chip
              size="small"
              label="Cargo Management"
              icon={<CargoIcon sx={{ fontSize: 16 }} />}
              onClick={() => router.push('/dashboard/cargo')}
              sx={{ bgcolor: '#eef0fe', color: '#4a57d4', fontWeight: 600, cursor: 'pointer' }}
            />
            <Chip
              size="small"
              label="Purchases"
              onClick={() => router.push('/dashboard/purchases')}
              sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 600, cursor: 'pointer' }}
            />
          </Stack>
        </Alert>

        {/* Stats */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
            gap: 1.5,
          }}
        >
          <StatCard title="Total Vehicles" value={summary.totalRecords} subtitle={`${totalRecords} matching search`} icon={TruckIcon} tone="periwinkle" />
          <StatCard title="With Driver Name" value={summary.withDrivers} icon={PersonIcon} tone="blue" />
          <StatCard title="With Phone" value={summary.withPhone} icon={PhoneIcon} tone="cyan" />
          <StatCard title="Added This Month" value={summary.thisMonth} icon={CalendarIcon} tone="green" />
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
                placeholder="Vehicle, driver, phone..."
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
                <InputLabel>Driver Info</InputLabel>
                <Select label="Driver Info" value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)}>
                  <MenuItem value="all">All vehicles</MenuItem>
                  <MenuItem value="complete">Complete profile</MenuItem>
                  <MenuItem value="with_driver">Has driver name</MenuItem>
                  <MenuItem value="with_phone">Has phone</MenuItem>
                  <MenuItem value="missing">Missing driver info</MenuItem>
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
                  <MenuItem value="v_vehicle_no-asc">Vehicle A–Z</MenuItem>
                  <MenuItem value="v_vehicle_no-desc">Vehicle Z–A</MenuItem>
                  <MenuItem value="v_driver_name-asc">Driver A–Z</MenuItem>
                  <MenuItem value="v_driver_name-desc">Driver Z–A</MenuItem>
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
            <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>Fleet Register</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
              Page {page} of {totalPages} · {filteredByDriver.length} shown
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
                      {['#', 'Vehicle', 'Driver', 'Phone', 'Status', 'Added', 'Updated By', 'Actions'].map((h) => (
                        <TableCell key={h} sx={EXCEL_HEAD_SX}>
                          {h}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredByDriver.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#94a3b8' }}>
                          No vehicles found. Click &quot;Add Vehicle&quot; to register your first truck.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredByDriver.map((vehicle, index) => {
                        const status = getDriverStatus(vehicle);
                        return (
                          <TableRow
                            key={vehicle.v_id}
                            hover
                            sx={{ '&:hover': { bgcolor: '#f8fafc' }, cursor: 'pointer' }}
                            onClick={() => {
                              setViewVehicle(vehicle);
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
                                    width: 36,
                                    height: 36,
                                    borderRadius: '8px',
                                    bgcolor: '#e8effd',
                                    color: '#1A55E3',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: '0.7rem',
                                  }}
                                >
                                  {vehicle.v_vehicle_no.slice(0, 3)}
                                </Box>
                                <Box>
                                  <Typography sx={{ fontWeight: 800, fontSize: '0.875rem', color: '#0f172a', letterSpacing: '0.02em' }}>
                                    {vehicle.v_vehicle_no}
                                  </Typography>
                                  <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8' }}>ID #{vehicle.v_id}</Typography>
                                </Box>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              {vehicle.v_driver_name ? (
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                  <PersonIcon sx={{ fontSize: 16, color: '#64748b' }} />
                                  <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, color: '#334155' }}>
                                    {vehicle.v_driver_name}
                                  </Typography>
                                </Stack>
                              ) : (
                                <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8', fontStyle: 'italic' }}>Not assigned</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {vehicle.v_driver_no ? (
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                  <PhoneIcon sx={{ fontSize: 15, color: '#0aa3bd' }} />
                                  <Typography sx={{ fontSize: '0.8125rem', fontFamily: 'monospace', color: '#0f172a' }}>
                                    {vehicle.v_driver_no}
                                  </Typography>
                                </Stack>
                              ) : (
                                <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>—</Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={status.label}
                                size="small"
                                sx={{
                                  height: 24,
                                  fontSize: '0.68rem',
                                  fontWeight: 700,
                                  bgcolor: status.bg,
                                  color: status.color,
                                }}
                              />
                            </TableCell>
                            <TableCell sx={{ whiteSpace: 'nowrap', color: '#475569' }}>
                              {vehicle.created_at ? formatDatePK(vehicle.created_at) : '—'}
                            </TableCell>
                            <TableCell>
                              {vehicle.updated_by_user?.full_name ? (
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Avatar sx={{ width: 26, height: 26, fontSize: '0.7rem', bgcolor: '#5E6EED' }}>
                                    {vehicle.updated_by_user.full_name.charAt(0).toUpperCase()}
                                  </Avatar>
                                  <Typography sx={{ fontSize: '0.75rem', color: '#475569' }}>
                                    {vehicle.updated_by_user.full_name}
                                  </Typography>
                                </Stack>
                              ) : (
                                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>—</Typography>
                              )}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Stack direction="row" spacing={0.25}>
                                <Tooltip title="View">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setViewVehicle(vehicle);
                                      setViewOpen(true);
                                    }}
                                  >
                                    <VisibilityIcon sx={{ fontSize: 18, color: '#64748b' }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Edit">
                                  <IconButton size="small" onClick={() => openEditForm(vehicle)}>
                                    <EditIcon sx={{ fontSize: 18, color: BRAND.primary.blue }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton size="small" onClick={() => handleDelete(vehicle)}>
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
              <TruckIcon />
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                  {editingVehicle ? 'Edit Vehicle' : 'Register New Vehicle'}
                </Typography>
                <Typography sx={{ fontSize: '0.75rem', opacity: 0.9 }}>
                  Vehicle number is unique across the branch
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
              <Grid item xs={12}>
                <TextField
                  label="Vehicle Number *"
                  size="small"
                  fullWidth
                  required
                  value={formData.v_vehicle_no}
                  onChange={handleFormChange('v_vehicle_no')}
                  placeholder="e.g. LEA-1234"
                  sx={FILTER_FIELD_SX}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <TruckIcon sx={{ fontSize: 18, color: '#94a3b8' }} />
                      </InputAdornment>
                    ),
                  }}
                  helperText="Stored in uppercase · must be unique"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Driver Name"
                  size="small"
                  fullWidth
                  value={formData.v_driver_name}
                  onChange={handleFormChange('v_driver_name')}
                  placeholder="Driver full name"
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
                  label="Driver Phone"
                  size="small"
                  fullWidth
                  value={formData.v_driver_no}
                  onChange={handleFormChange('v_driver_no')}
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
              {editingVehicle ? 'Update Vehicle' : 'Save Vehicle'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>

      {/* View */}
      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: '14px' } }}>
        {viewVehicle && (
          <>
            <DialogTitle sx={{ pb: 1 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    bgcolor: '#e8effd',
                    color: '#1A55E3',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TruckIcon />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '0.03em' }}>
                    {viewVehicle.v_vehicle_no}
                  </Typography>
                  <Typography sx={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Vehicle #{viewVehicle.v_id}
                  </Typography>
                </Box>
                <Chip
                  label={getDriverStatus(viewVehicle).label}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    bgcolor: getDriverStatus(viewVehicle).bg,
                    color: getDriverStatus(viewVehicle).color,
                  }}
                />
              </Stack>
            </DialogTitle>
            <DialogContent dividers>
              <Stack spacing={2}>
                <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <Stack spacing={1.5}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PersonIcon sx={{ fontSize: 18, color: '#64748b' }} />
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Driver Name</Typography>
                        <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>
                          {viewVehicle.v_driver_name || 'Not assigned'}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PhoneIcon sx={{ fontSize: 18, color: '#0aa3bd' }} />
                      <Box>
                        <Typography sx={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>Driver Phone</Typography>
                        <Typography sx={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace' }}>
                          {viewVehicle.v_driver_no || '—'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Stack>
                </Box>

                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <Box sx={{ p: 1.5, bgcolor: '#eef0fe', borderRadius: '8px' }}>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>Registered</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>
                      {viewVehicle.created_at ? formatDatePK(viewVehicle.created_at) : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1.5, bgcolor: '#e6fff4', borderRadius: '8px' }}>
                    <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>Last Updated</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>
                      {viewVehicle.updated_at ? formatDatePK(viewVehicle.updated_at) : '—'}
                    </Typography>
                  </Box>
                </Box>

                {viewVehicle.updated_by_user?.full_name && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: '#5E6EED' }}>
                      {viewVehicle.updated_by_user.full_name.charAt(0)}
                    </Avatar>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#475569' }}>
                      Last edited by <strong>{viewVehicle.updated_by_user.full_name}</strong>
                    </Typography>
                  </Stack>
                )}

                {!viewVehicle.v_driver_name && !viewVehicle.v_driver_no && (
                  <Alert severity="warning" icon={<WarningIcon fontSize="inherit" />} sx={{ borderRadius: '8px', py: 0.5 }}>
                    <Typography sx={{ fontSize: '0.8125rem' }}>
                      Add driver details so staff can identify this vehicle quickly on cargo trips.
                    </Typography>
                  </Alert>
                )}
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 2.5, py: 1.5, justifyContent: 'space-between' }}>
              <Button
                size="small"
                startIcon={<CargoIcon />}
                onClick={() => {
                  setViewOpen(false);
                  router.push('/dashboard/cargo');
                }}
                sx={{ textTransform: 'none', color: '#4a57d4' }}
              >
                Cargo Trips
              </Button>
              <Stack direction="row" spacing={1}>
                <Button onClick={() => setViewOpen(false)} sx={{ textTransform: 'none' }}>Close</Button>
                <Button
                  variant="contained"
                  startIcon={<EditIcon />}
                  onClick={() => {
                    setViewOpen(false);
                    openEditForm(viewVehicle);
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
