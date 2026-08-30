'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { SampleFormat } from '@digitalpersona/devices';
import FingerprintScanner from '@/components/FingerprintScanner';
import DashboardLayout from '../components/dashboard-layout';

// Material-UI imports
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Grid,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Alert,
  Snackbar,
  CircularProgress,
  LinearProgress,
  Tab,
  Tabs,
  Divider,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Stack
} from '@mui/material';

import {
  Security as SecurityIcon,
  Lock as LockIcon,
  Fingerprint as FingerprintIcon,
  VpnKey as VpnKeyIcon,
  Person as PersonIcon,
  PersonAdd as PersonAddIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Shield as ShieldIcon,
  AdminPanelSettings as AdminIcon,
  Badge as BadgeIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Key as KeyIcon,
  Close as CloseIcon,
  Backspace as BackspaceIcon,
  Store as StoreIcon,
  Settings as SettingsIcon,
  Check as CheckIcon,
  Info as InfoIcon
} from '@mui/icons-material';

export default function SettingsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Snackbar notifications
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'info' });
  const showSnackbar = (message, severity = 'info') => {
    setSnackbar({ open: true, message, severity });
  };

  // Add User Dialog State
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserForm, setNewUserForm] = useState({ full_name: '', email: '', password: '', role: 'SALESMAN' });
  const [addingUser, setAddingUser] = useState(false);

  // PIN Setup State
  const [pinUserId, setPinUserId] = useState(null);
  const [pinDigits, setPinDigits] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinStep, setPinStep] = useState('enter');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  // Fingerprint Setup State
  const [fpUserId, setFpUserId] = useState(null);
  const [fpSamples, setFpSamples] = useState([]);
  const [fpError, setFpError] = useState('');
  const [fpSuccess, setFpSuccess] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  // Initial Auth & Data Load
  const fetchUsers = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.users || [];
        setUsers(list);
      } else {
        setUsers([]);
        showSnackbar('Failed to load user accounts', 'error');
      }
    } catch (e) {
      console.error('Error fetching users:', e);
      setUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/login');
      return;
    }

    try {
      const user = JSON.parse(userData);
      if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
        router.push('/dashboard');
        return;
      }
      setCurrentUser(user);
      fetchUsers(false);
    } catch {
      router.push('/login');
    }
  }, [router, fetchUsers]);

  // Handle Add New User
  const handleAddUserSubmit = async (e) => {
    e.preventDefault();
    if (!newUserForm.full_name.trim()) return showSnackbar('Full name is required', 'error');
    if (!newUserForm.email.trim()) return showSnackbar('Email is required', 'error');
    if (!newUserForm.password || newUserForm.password.length < 6) return showSnackbar('Password must be at least 6 characters', 'error');

    setAddingUser(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUserForm),
      });

      if (res.ok) {
        showSnackbar('User account created successfully!', 'success');
        setAddUserOpen(false);
        setNewUserForm({ full_name: '', email: '', password: '', role: 'SALESMAN' });
        await fetchUsers(true);
      } else {
        const err = await res.json();
        showSnackbar(err.error || 'Failed to create user', 'error');
      }
    } catch (error) {
      showSnackbar('Error creating user account', 'error');
    } finally {
      setAddingUser(false);
    }
  };

  // PIN Functions
  function startPinSetup(userId) {
    setPinUserId(userId);
    setPinDigits('');
    setPinConfirm('');
    setPinStep('enter');
    setPinError('');
    setPinSuccess('');
  }

  function cancelPinSetup() {
    setPinUserId(null);
    setPinDigits('');
    setPinConfirm('');
    setPinError('');
    setPinSuccess('');
    setPinStep('enter');
  }

  function handlePinDigit(digit) {
    if (pinStep === 'enter' && pinDigits.length < 6) setPinDigits((p) => p + digit);
    else if (pinStep === 'confirm' && pinConfirm.length < 6) setPinConfirm((p) => p + digit);
  }

  function handlePinBack() {
    if (pinStep === 'enter') setPinDigits((p) => p.slice(0, -1));
    else setPinConfirm((p) => p.slice(0, -1));
  }

  async function handlePinNext() {
    if (pinStep === 'enter') {
      if (pinDigits.length !== 6) {
        setPinError('Enter all 6 digits.');
        return;
      }
      setPinError('');
      setPinConfirm('');
      setPinStep('confirm');
      return;
    }

    if (pinConfirm.length !== 6) {
      setPinError('Confirm all 6 digits.');
      return;
    }

    if (pinDigits !== pinConfirm) {
      setPinError('PINs do not match. Try again.');
      setPinDigits('');
      setPinConfirm('');
      setPinStep('enter');
      return;
    }

    setPinLoading(true);
    setPinError('');
    try {
      const res = await fetch('/api/settings/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: pinUserId, pin: pinDigits }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to set PIN');
      setPinSuccess('PIN set successfully!');
      showSnackbar('PIN set successfully!', 'success');
      await fetchUsers(true);
      setTimeout(cancelPinSetup, 800);
    } catch (error) {
      setPinError(error.message || 'Failed to set PIN');
    } finally {
      setPinLoading(false);
    }
  }

  async function removePin(userId) {
    if (!confirm('Are you sure you want to remove the PIN for this user?')) return;
    try {
      const res = await fetch('/api/settings/pin', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        showSnackbar('PIN removed successfully', 'success');
        await fetchUsers(true);
      } else {
        showSnackbar('Failed to remove PIN', 'error');
      }
    } catch {
      showSnackbar('Error removing PIN', 'error');
    }
  }

  // Fingerprint Functions
  function startFingerprintSetup(userId) {
    setFpUserId(userId);
    setFpSamples([]);
    setFpError('');
    setFpSuccess('');
  }

  function cancelFingerprintSetup() {
    setFpUserId(null);
    setFpSamples([]);
    setFpError('');
    setFpSuccess('');
    setFpLoading(false);
  }

  async function submitFingerprintEnrollment() {
    if (fpSamples.length < 2) {
      setFpError('Need at least 2 good scans. Keep fingers dry/clean and try again.');
      return;
    }
    if (!fpUserId) return;

    setFpLoading(true);
    setFpError('');
    setFpSuccess('');
    try {
      const res = await fetch('/api/fingerprint/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: fpUserId,
          finger: 'right-index',
          format: 'PngImage',
          templates: fpSamples.map((s) => s.template),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Enrollment failed');
      setFpSuccess('Fingerprint enrolled successfully!');
      showSnackbar('Fingerprint enrolled successfully!', 'success');
      await fetchUsers(true);

      // Keep local user object in sync
      try {
        const raw = localStorage.getItem('user');
        if (raw) {
          const u = JSON.parse(raw);
          if (u && u.user_id === fpUserId) {
            u.fingerprint_enrolled = true;
            localStorage.setItem('user', JSON.stringify(u));
          }
        }
      } catch (e) {
        // ignore
      }

      setTimeout(cancelFingerprintSetup, 800);
    } catch (error) {
      setFpError(error.message || 'Enrollment failed');
    } finally {
      setFpLoading(false);
    }
  }

  async function removeFingerprint(userId) {
    if (!confirm('Are you sure you want to remove fingerprint templates for this user?')) return;
    try {
      const res = await fetch('/api/fingerprint/enroll', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove fingerprint');
      showSnackbar('Fingerprint template removed successfully', 'success');
      await fetchUsers(true);

      try {
        const raw = localStorage.getItem('user');
        if (raw) {
          const u = JSON.parse(raw);
          if (u && u.user_id === userId) {
            u.fingerprint_enrolled = false;
            localStorage.setItem('user', JSON.stringify(u));
          }
        }
      } catch (e) {
        // ignore
      }
    } catch (error) {
      showSnackbar(error.message || 'Failed to remove fingerprint', 'error');
    }
  }

  // Active PIN string helper
  const activePin = pinStep === 'enter' ? pinDigits : pinConfirm;
  const pinUserObj = users.find((u) => u.user_id === pinUserId);
  const fpUserObj = users.find((u) => u.user_id === fpUserId);

  // Security Statistics
  const usersWithPin = users.filter((u) => u.pin_code).length;
  const usersWithFp = users.filter((u) => u.fingerprint_enrolled).length;

  return (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Header Banner */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            mb: 3,
            borderRadius: 3,
            background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%)',
            color: 'white',
            boxShadow: '0 10px 25px -5px rgba(49, 46, 129, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 2
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{
                width: 56,
                height: 56,
                bgcolor: 'rgba(255, 255, 255, 0.15)',
                border: '2px solid rgba(255, 255, 255, 0.25)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
              }}
            >
              <SecurityIcon sx={{ fontSize: 32, color: '#38bdf8' }} />
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', mb: 0.5 }}>
                Security & Authentication Settings
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                Manage user access credentials, 6-digit authorization PINs, and DigitalPersona biometric fingerprints.
              </Typography>
            </Box>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon className={refreshing ? 'spin' : ''} />}
              onClick={() => fetchUsers(false)}
              disabled={refreshing}
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,0.4)',
                borderRadius: 2,
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' }
              }}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<PersonAddIcon />}
              onClick={() => setAddUserOpen(true)}
              sx={{
                bgcolor: '#10b981',
                color: 'white',
                fontWeight: 700,
                borderRadius: 2,
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
                '&:hover': { bgcolor: '#059669' }
              }}
            >
              Add User
            </Button>
          </Stack>
        </Paper>

        {/* Top Metric Cards */}
        <Grid container spacing={2.5} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4}>
            <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, p: 2.5, bgcolor: '#ffffff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                    Registered Users
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#0f172a' }}>
                    {loading ? <Skeleton width={60} /> : users.length}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#eff6ff', color: '#2563eb', width: 48, height: 48 }}>
                  <PersonIcon />
                </Avatar>
              </Box>
              <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1.5 }}>
                Active system accounts in database
              </Typography>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, p: 2.5, bgcolor: '#ffffff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                    PIN Security Coverage
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#0f172a' }}>
                    {loading ? <Skeleton width={60} /> : `${usersWithPin} / ${users.length}`}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#f0fdf4', color: '#16a34a', width: 48, height: 48 }}>
                  <LockIcon />
                </Avatar>
              </Box>
              <LinearProgress
                variant="determinate"
                value={users.length > 0 ? (usersWithPin / users.length) * 100 : 0}
                sx={{ mt: 1.5, height: 6, borderRadius: 3, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#16a34a' } }}
              />
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, p: 2.5, bgcolor: '#ffffff' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, textTransform: 'uppercase' }}>
                    Fingerprint Enrolled
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, color: '#0f172a' }}>
                    {loading ? <Skeleton width={60} /> : `${usersWithFp} / ${users.length}`}
                  </Typography>
                </Box>
                <Avatar sx={{ bgcolor: '#f5f3ff', color: '#7c3aed', width: 48, height: 48 }}>
                  <FingerprintIcon />
                </Avatar>
              </Box>
              <LinearProgress
                variant="determinate"
                value={users.length > 0 ? (usersWithFp / users.length) * 100 : 0}
                sx={{ mt: 1.5, height: 6, borderRadius: 3, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#7c3aed' } }}
              />
            </Card>
          </Grid>
        </Grid>

        {/* Section Tabs */}
        <Card elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            sx={{
              px: 2,
              pt: 1,
              bgcolor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              '& .MuiTab-root': { fontWeight: 700, fontSize: '0.95rem', textTransform: 'none' }
            }}
          >
            <Tab icon={<ShieldIcon />} iconPosition="start" label="User Authentication & Biometrics" />
            <Tab icon={<SettingsIcon />} iconPosition="start" label="System Preferences" />
          </Tabs>

          {/* TAB 1: User Security Table */}
          {activeTab === 0 && (
            <TableContainer component={Box}>
              <Table>
                <TableHead sx={{ bgcolor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, color: '#64748b', py: 1.5 }}>User Profile</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#64748b', py: 1.5 }}>System Role</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#64748b', py: 1.5 }}>PIN Status</TableCell>
                    <TableCell sx={{ fontWeight: 800, color: '#64748b', py: 1.5 }}>Fingerprint Status</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, color: '#64748b', py: 1.5, pr: 3 }}>Security Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    [1, 2, 3].map((n) => (
                      <TableRow key={n}>
                        <TableCell><Skeleton variant="circular" width={40} height={40} sx={{ display: 'inline-block', mr: 2, verticalAlign: 'middle' }} /><Skeleton variant="text" width={140} sx={{ display: 'inline-block' }} /></TableCell>
                        <TableCell><Skeleton width={80} /></TableCell>
                        <TableCell><Skeleton width={100} /></TableCell>
                        <TableCell><Skeleton width={100} /></TableCell>
                        <TableCell align="right"><Skeleton width={200} sx={{ ml: 'auto' }} /></TableCell>
                      </TableRow>
                    ))
                  ) : users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                        <Typography variant="body1" color="text.secondary">No users found.</Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((u) => {
                      const isSuperAdmin = u.role === 'SUPER_ADMIN';
                      const isAdmin = u.role === 'ADMIN';
                      return (
                        <TableRow key={u.user_id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                          {/* User Avatar & Name */}
                          <TableCell sx={{ py: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Avatar
                                sx={{
                                  bgcolor: isSuperAdmin ? '#4338ca' : isAdmin ? '#2563eb' : '#059669',
                                  fontWeight: 800,
                                  width: 42,
                                  height: 42
                                }}
                              >
                                {u.full_name ? u.full_name.charAt(0).toUpperCase() : 'U'}
                              </Avatar>
                              <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                  {u.full_name}
                                </Typography>
                                <Typography variant="caption" sx={{ color: '#64748b' }}>
                                  {u.email}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>

                          {/* Role Chip */}
                          <TableCell sx={{ py: 2 }}>
                            <Chip
                              icon={isSuperAdmin || isAdmin ? <AdminIcon fontSize="small" /> : <PersonIcon fontSize="small" />}
                              label={u.role}
                              size="small"
                              sx={{
                                fontWeight: 700,
                                fontSize: '0.75rem',
                                bgcolor: isSuperAdmin ? '#eef2ff' : isAdmin ? '#eff6ff' : '#ecfdf5',
                                color: isSuperAdmin ? '#3730a3' : isAdmin ? '#1d4ed8' : '#047857',
                                border: '1px solid',
                                borderColor: isSuperAdmin ? '#c7d2fe' : isAdmin ? '#bfdbfe' : '#a7f3d0'
                              }}
                            />
                          </TableCell>

                          {/* PIN Status */}
                          <TableCell sx={{ py: 2 }}>
                            <Chip
                              icon={u.pin_code ? <CheckCircleIcon style={{ color: '#16a34a' }} /> : <LockIcon style={{ color: '#64748b' }} />}
                              label={u.pin_code ? 'PIN Configured' : 'No PIN Set'}
                              size="small"
                              variant="outlined"
                              sx={{
                                fontWeight: 700,
                                color: u.pin_code ? '#15803d' : '#64748b',
                                borderColor: u.pin_code ? '#bbf7d0' : '#cbd5e1',
                                bgcolor: u.pin_code ? '#f0fdf4' : '#f8fafc'
                              }}
                            />
                          </TableCell>

                          {/* Fingerprint Status */}
                          <TableCell sx={{ py: 2 }}>
                            <Chip
                              icon={u.fingerprint_enrolled ? <FingerprintIcon style={{ color: '#7c3aed' }} /> : <CancelIcon style={{ color: '#94a3b8' }} />}
                              label={u.fingerprint_enrolled ? 'FP Enrolled' : 'Not Enrolled'}
                              size="small"
                              variant="outlined"
                              sx={{
                                fontWeight: 700,
                                color: u.fingerprint_enrolled ? '#6d28d9' : '#64748b',
                                borderColor: u.fingerprint_enrolled ? '#ddd6fe' : '#cbd5e1',
                                bgcolor: u.fingerprint_enrolled ? '#f5f3ff' : '#f8fafc'
                              }}
                            />
                          </TableCell>

                          {/* Action Buttons */}
                          <TableCell align="right" sx={{ py: 2, pr: 3 }}>
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<VpnKeyIcon />}
                                onClick={() => startPinSetup(u.user_id)}
                                sx={{
                                  borderRadius: 2,
                                  fontWeight: 700,
                                  fontSize: '0.78rem',
                                  color: '#1d4ed8',
                                  borderColor: '#bfdbfe',
                                  bgcolor: '#eff6ff',
                                  '&:hover': { bgcolor: '#dbeafe', borderColor: '#93c5fd' }
                                }}
                              >
                                {u.pin_code ? 'Change PIN' : 'Set PIN'}
                              </Button>

                              {u.pin_code && (
                                <Tooltip title="Remove PIN">
                                  <IconButton
                                    size="small"
                                    onClick={() => removePin(u.user_id)}
                                    sx={{ color: '#dc2626', bgcolor: '#fef2f2', border: '1px solid #fecaca', '&:hover': { bgcolor: '#fee2e2' } }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}

                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<FingerprintIcon />}
                                onClick={() => startFingerprintSetup(u.user_id)}
                                sx={{
                                  borderRadius: 2,
                                  fontWeight: 700,
                                  fontSize: '0.78rem',
                                  color: '#6d28d9',
                                  borderColor: '#ddd6fe',
                                  bgcolor: '#f5f3ff',
                                  '&:hover': { bgcolor: '#ede9fe', borderColor: '#c4b5fd' }
                                }}
                              >
                                {u.fingerprint_enrolled ? 'Re-enroll FP' : 'Enroll FP'}
                              </Button>

                              {u.fingerprint_enrolled && (
                                <Tooltip title="Remove Fingerprint">
                                  <IconButton
                                    size="small"
                                    onClick={() => removeFingerprint(u.user_id)}
                                    sx={{ color: '#dc2626', bgcolor: '#fef2f2', border: '1px solid #fecaca', '&:hover': { bgcolor: '#fee2e2' } }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* TAB 2: System Preferences */}
          {activeTab === 1 && (
            <Box sx={{ p: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <StoreIcon color="primary" /> POS System Preferences
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Configure default behavior for POS invoice creation and print format.
                    </Typography>
                    <Stack spacing= {2}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Store Name Header"
                        defaultValue="Ittefaq Iron & Cement Store"
                        disabled
                        helperText="Configured in main company profile"
                      />
                      <TextField
                        fullWidth
                        size="small"
                        label="Default Low Stock Threshold"
                        defaultValue="10"
                        disabled
                        helperText="Products with stock below this trigger low-stock alerts"
                      />
                    </Stack>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
                    <Typography variant="h6" sx={{ fontWeight: 800, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                      <ShieldIcon color="secondary" /> Step-Up Security Policy
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      High-privilege actions (cash drawer opening, high discount approval) require PIN or Fingerprint authorization.
                    </Typography>
                    <Alert severity="info" sx={{ borderRadius: 2 }}>
                      Step-up authentication is currently active for <strong>Cash Returns</strong> and <strong>Sensitive System Deletions</strong>.
                    </Alert>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </Card>

        {/* DIALOG 1: Add User Modal */}
        <Dialog open={addUserOpen} onClose={() => setAddUserOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, p: 1 } }}>
          <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>Create System User</DialogTitle>
          <form onSubmit={handleAddUserSubmit}>
            <DialogContent sx={{ pt: 1 }}>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  required
                  label="Full Name"
                  value={newUserForm.full_name}
                  onChange={(e) => setNewUserForm({ ...newUserForm, full_name: e.target.value })}
                  InputProps={{ startAdornment: <InputAdornment position="start"><PersonIcon color="action" /></InputAdornment> }}
                />
                <TextField
                  fullWidth
                  required
                  type="email"
                  label="Email Address"
                  value={newUserForm.email}
                  onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  InputProps={{ startAdornment: <InputAdornment position="start"><EmailIcon color="action" /></InputAdornment> }}
                />
                <TextField
                  fullWidth
                  required
                  type="password"
                  label="Password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                  InputProps={{ startAdornment: <InputAdornment position="start"><KeyIcon color="action" /></InputAdornment> }}
                  helperText="Minimum 6 characters"
                />
                <FormControl fullWidth>
                  <InputLabel>Role</InputLabel>
                  <Select
                    value={newUserForm.role}
                    label="Role"
                    onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                  >
                    <MenuItem value="SALESMAN">SALESMAN</MenuItem>
                    <MenuItem value="ADMIN">ADMIN</MenuItem>
                    <MenuItem value="SUPER_ADMIN">SUPER_ADMIN</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setAddUserOpen(false)} color="inherit">Cancel</Button>
              <Button type="submit" variant="contained" disabled={addingUser} sx={{ bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}>
                {addingUser ? <CircularProgress size={20} color="inherit" /> : 'Create Account'}
              </Button>
            </DialogActions>
          </form>
        </Dialog>

        {/* DIALOG 2: Set PIN Code Modal */}
        <Dialog open={!!pinUserId} onClose={cancelPinSetup} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
          <DialogTitle sx={{ textAlign: 'center', pt: 3, pb: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {pinStep === 'enter' ? 'Set 6-Digit PIN' : 'Confirm 6-Digit PIN'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              User: <strong>{pinUserObj?.full_name}</strong>
            </Typography>
          </DialogTitle>

          <DialogContent sx={{ px: 3, py: 1 }}>
            {/* Animated PIN Dots */}
            <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'center', my: 2 }}>
              {[0, 1, 2, 3, 4, 5].map((i) => {
                const filled = i < activePin.length;
                return (
                  <Box
                    key={i}
                    sx={{
                      width: 44,
                      height: 52,
                      borderRadius: 2.5,
                      border: '2px solid',
                      borderColor: filled ? '#2563eb' : '#cbd5e1',
                      bgcolor: filled ? '#eff6ff' : '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 800,
                      color: '#1d4ed8',
                      transition: 'all 0.15s ease-in-out'
                    }}
                  >
                    {filled ? '●' : ''}
                  </Box>
                );
              })}
            </Box>

            {/* Numeric Touch Keypad */}
            <Grid container spacing={1} sx={{ mt: 1, mb: 1 }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <Grid item xs={4} key={num}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={() => handlePinDigit(String(num))}
                    sx={{
                      py: 1.5,
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      borderRadius: 2.5,
                      borderColor: '#e2e8f0',
                      color: '#0f172a',
                      '&:hover': { bgcolor: '#f1f5f9', borderColor: '#94a3b8' }
                    }}
                  >
                    {num}
                  </Button>
                </Grid>
              ))}
              <Grid item xs={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handlePinBack}
                  sx={{
                    py: 1.5,
                    borderRadius: 2.5,
                    borderColor: '#fecaca',
                    bgcolor: '#fef2f2',
                    color: '#dc2626',
                    '&:hover': { bgcolor: '#fee2e2' }
                  }}
                >
                  <BackspaceIcon />
                </Button>
              </Grid>
              <Grid item xs={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => handlePinDigit('0')}
                  sx={{
                    py: 1.5,
                    fontSize: '1.25rem',
                    fontWeight: 800,
                    borderRadius: 2.5,
                    borderColor: '#e2e8f0',
                    color: '#0f172a',
                    '&:hover': { bgcolor: '#f1f5f9' }
                  }}
                >
                  0
                </Button>
              </Grid>
              <Grid item xs={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={() => (pinStep === 'enter' ? setPinDigits('') : setPinConfirm(''))}
                  sx={{
                    py: 1.5,
                    fontSize: '0.85rem',
                    fontWeight: 800,
                    borderRadius: 2.5,
                    borderColor: '#e2e8f0',
                    color: '#64748b',
                    '&:hover': { bgcolor: '#f1f5f9' }
                  }}
                >
                  CLR
                </Button>
              </Grid>
            </Grid>

            {pinError && <Alert severity="error" sx={{ mt: 1, borderRadius: 2 }}>{pinError}</Alert>}
            {pinSuccess && <Alert severity="success" sx={{ mt: 1, borderRadius: 2 }}>{pinSuccess}</Alert>}
          </DialogContent>

          <DialogActions sx={{ p: 3, pt: 1 }}>
            <Button onClick={cancelPinSetup} color="inherit" sx={{ fontWeight: 700 }}>Cancel</Button>
            <Button
              fullWidth
              variant="contained"
              onClick={handlePinNext}
              disabled={pinLoading || activePin.length !== 6}
              sx={{
                py: 1.2,
                borderRadius: 2.5,
                fontWeight: 800,
                bgcolor: '#2563eb',
                '&:hover': { bgcolor: '#1d4ed8' }
              }}
            >
              {pinLoading ? <CircularProgress size={22} color="inherit" /> : pinStep === 'enter' ? 'Next →' : 'Save PIN Code'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* DIALOG 3: Fingerprint Enrollment Modal */}
        <Dialog open={!!fpUserId} onClose={cancelFingerprintSetup} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 4, p: 1 } }}>
          <DialogTitle sx={{ textAlign: 'center', pt: 3, pb: 0 }}>
            <Avatar sx={{ bgcolor: '#f5f3ff', color: '#7c3aed', width: 56, height: 56, mx: 'auto', mb: 1 }}>
              <FingerprintIcon sx={{ fontSize: 36 }} />
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Enroll Fingerprint Template
            </Typography>
            <Typography variant="caption" color="text.secondary">
              User: <strong>{fpUserObj?.full_name}</strong>
            </Typography>
          </DialogTitle>

          <DialogContent sx={{ px: 3, py: 2 }}>
            <Box sx={{ my: 1, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1, color: '#4c1d95' }}>
                Scan Progress: {fpSamples.length} / 4 (Minimum 2 scans required)
              </Typography>
              <LinearProgress
                variant="determinate"
                value={(fpSamples.length / 4) * 100}
                sx={{ height: 8, borderRadius: 4, bgcolor: '#ede9fe', '& .MuiLinearProgress-bar': { bgcolor: '#7c3aed' } }}
              />
            </Box>

            <FingerprintScanner
              format={SampleFormat.PngImage}
              autoStart
              onSample={(s) => {
                setFpSamples((prev) => {
                  if (prev.length >= 4) return prev;
                  return [...prev, s];
                });
              }}
              hint={`Captured ${fpSamples.length}/4 scans.`}
            />

            <Alert severity="info" sx={{ mt: 2, borderRadius: 2.5, fontSize: '0.8rem' }}>
              <strong>Hardware Requirement:</strong> Fingerprint scanning requires a physical <strong>DigitalPersona U.are.U 4500 USB Reader</strong> connected to this computer, and the <strong>DigitalPersona WebAgent</strong> running on Windows (<code style={{ fontSize: '0.75rem' }}>ws://127.0.0.1:9001</code>).
              <br />
              💡 <em>If no USB reader is attached to this PC, use <strong>6-digit PIN Security</strong> instead for instant 100% reliable authorization.</em>
            </Alert>

            {fpError && <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>{fpError}</Alert>}
            {fpSuccess && <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}>{fpSuccess}</Alert>}
          </DialogContent>

          <DialogActions sx={{ p: 3, pt: 1 }}>
            <Button onClick={cancelFingerprintSetup} color="inherit" sx={{ fontWeight: 700 }}>Cancel</Button>
            <Button
              fullWidth
              variant="contained"
              onClick={submitFingerprintEnrollment}
              disabled={fpLoading || fpSamples.length < 2}
              sx={{
                py: 1.2,
                borderRadius: 2.5,
                fontWeight: 800,
                bgcolor: '#7c3aed',
                '&:hover': { bgcolor: '#6d28d9' }
              }}
            >
              {fpLoading ? <CircularProgress size={22} color="inherit" /> : 'Save Fingerprint Template'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Global Snackbar Notifications */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%', borderRadius: 2, fontWeight: 700 }}>
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Container>
    </DashboardLayout>
  );
}
