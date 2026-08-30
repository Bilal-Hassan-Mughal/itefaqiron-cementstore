'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useHqSession } from '../../components/use-hq-session';
import HqStatCard from '../../components/hq-stat-card';
import { branchFetch, enterBranchAsHq } from '@/lib/branch-client';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Snackbar,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  ArrowLeft,
  Building2,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  MapPin,
  PauseCircle,
  Pencil,
  Phone,
  PlayCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  UserPlus,
  Users,
  Package,
  Store,
  Share2,
  Receipt,
  BookOpen,
  AlertTriangle,
} from 'lucide-react';
import BranchLoginCredentialsPanel, { BranchCodeCopyRow } from '@/components/BranchLoginCredentialsPanel';

const PENDING_CREDS_KEY = 'itefaq_pending_branch_credentials';

const ROLE_OPTIONS = [
  { value: 'BRANCH_SUPER_ADMIN', label: 'Branch Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'SALESMAN', label: 'Salesman' },
];

const STAT_ITEMS = [
  { key: 'users', label: 'Staff Users', icon: Users, color: '#4338ca' },
  { key: 'customers', label: 'Customers', icon: Users, color: '#7c3aed' },
  { key: 'products', label: 'Products', icon: Package, color: '#ea580c' },
  { key: 'sales', label: 'Sales', icon: ShoppingCart, color: '#059669' },
  { key: 'purchases', label: 'Purchases', icon: ShoppingBag, color: '#d97706' },
  { key: 'stores', label: 'Stores', icon: Store, color: '#0284c7' },
  { key: 'expenses', label: 'Expenses', icon: Receipt, color: '#dc2626' },
  { key: 'ledger', label: 'Ledger', icon: BookOpen, color: '#64748b' },
];

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' });
}

function SectionPanel({ title, subtitle, children, action }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        overflow: 'hidden',
        bgcolor: 'white',
        borderColor: '#e2e8f0',
        boxShadow: '0 2px 10px rgba(15,23,42,0.03)',
        height: '100%',
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 1.75,
          bgcolor: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 2,
        }}
      >
        <Box>
          <Typography fontWeight={800} sx={{ color: '#0f172a' }}>{title}</Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action}
      </Box>
      <Box sx={{ p: 2.5 }}>{children}</Box>
    </Paper>
  );
}

function InfoField({ label, value, children }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </Typography>
      <Box sx={{ mt: 0.5 }}>
        {children || (
          <Typography fontWeight={600} sx={{ color: '#0f172a' }}>{value || '—'}</Typography>
        )}
      </Box>
    </Box>
  );
}

const tableHeadSx = { fontWeight: 800, bgcolor: '#f8fafc', color: '#334155', fontSize: '0.75rem' };

function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

export default function BranchDetailPage() {
  const router = useRouter();
  const params = useParams();
  const branchId = params?.id;
  const { user, ready } = useHqSession();

  const [branch, setBranch] = useState(null);
  const [canDelete, setCanDelete] = useState(false);
  const [deleteBlockReason, setDeleteBlockReason] = useState('');
  const [hasBusinessData, setHasBusinessData] = useState(false);
  const [dataStorage, setDataStorage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [tab, setTab] = useState(0);

  const [infoForm, setInfoForm] = useState({
    branch_code: '',
    branch_name: '',
    address: '',
    phone: '',
  });

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleteDropData, setDeleteDropData] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'SALESMAN',
    status: 'ACTIVE',
  });
  const [userSaving, setUserSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [loginInfoUser, setLoginInfoUser] = useState(null);

  const [loginCodeForm, setLoginCodeForm] = useState('');
  const [savingLoginCode, setSavingLoginCode] = useState(false);

  const [deleteUserTarget, setDeleteUserTarget] = useState(null);
  const [deleteUserConfirm, setDeleteUserConfirm] = useState('');
  const [deleteUserForce, setDeleteUserForce] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(PENDING_CREDS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.branchId && String(parsed.branchId) === String(branchId)) {
        setCreatedCredentials(parsed.credentials);
        setTab(2);
      }
      sessionStorage.removeItem(PENDING_CREDS_KEY);
    } catch {
      sessionStorage.removeItem(PENDING_CREDS_KEY);
    }
  }, [branchId]);

  const loadBranch = useCallback(async (currentUser) => {
    if (!branchId) return;
    setLoading(true);
    setError('');
    try {
      const res = await branchFetch(currentUser, `/api/branches/${branchId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load branch');
      setBranch(data.branch);
      setCanDelete(data.can_delete);
      setDeleteBlockReason(data.delete_block_reason || '');
      setHasBusinessData(!!data.has_business_data);
      setDataStorage(data.data_storage || '');
      setInfoForm({
        branch_code: data.branch.branch_code || '',
        branch_name: data.branch.branch_name || '',
        address: data.branch.address || '',
        phone: data.branch.phone || '',
      });
      setLoginCodeForm(data.branch.branch_code || '');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    if (ready && user) loadBranch(user);
  }, [ready, user, loadBranch]);

  const handleSaveInfo = async () => {
    if (!user) return;
    setSaving(true);
    setError('');
    try {
      const res = await branchFetch(user, `/api/branches/${branchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(infoForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save');
      setSuccess('Branch details saved');
      await loadBranch(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!user || !branch) return;
    const next = branch.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setSaving(true);
    try {
      const res = await branchFetch(user, `/api/branches/${branchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      setSuccess(`Branch is now ${next}`);
      await loadBranch(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !branch) return;
    setDeleting(true);
    setError('');
    try {
      const res = await branchFetch(user, `/api/branches/${branchId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          confirm_code: deleteConfirm,
          drop_data: deleteDropData,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete branch');
      router.push('/dashboard/hq/branches');
    } catch (e) {
      setError(e.message);
      setDeleting(false);
    }
  };

  const openAddUser = () => {
    setEditingUser(null);
    setShowPassword(true);
    setUserForm({ full_name: '', email: '', password: '', role: 'SALESMAN', status: 'ACTIVE' });
    setUserDialogOpen(true);
  };

  const openEditUser = (u) => {
    setEditingUser(u);
    setShowPassword(false);
    setUserForm({
      full_name: u.full_name || '',
      email: u.email || '',
      password: '',
      role: u.role || 'SALESMAN',
      status: u.status || 'ACTIVE',
    });
    setUserDialogOpen(true);
  };

  const openResetPassword = (u) => {
    const pwd = generatePassword(10);
    setResetPasswordUser(u);
    setResetPasswordValue(pwd);
    setShowResetPassword(true);
  };

  const handleSaveLoginCode = async () => {
    if (!user || !loginCodeForm.trim()) return;
    setSavingLoginCode(true);
    setError('');
    try {
      const res = await branchFetch(user, `/api/branches/${branchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ branch_code: loginCodeForm.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update branch code');
      setSuccess('Branch login code updated');
      await loadBranch(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setSavingLoginCode(false);
    }
  };

  const handleToggleUserStatus = async (u) => {
    if (!user) return;
    const next = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    setError('');
    try {
      const res = await branchFetch(user, `/api/branches/${branchId}/users/${u.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update status');
      setSuccess(`User is now ${next}`);
      await loadBranch(user);
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSaveUser = async () => {
    if (!user) return;
    setUserSaving(true);
    setError('');
    try {
      const url = editingUser
        ? `/api/branches/${branchId}/users/${editingUser.user_id}`
        : `/api/branches/${branchId}/users`;
      const payload = { ...userForm };
      if (editingUser && !payload.password.trim()) delete payload.password;

      const res = await branchFetch(user, url, {
        method: editingUser ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save user');
      setUserDialogOpen(false);
      if (!editingUser) {
        setCreatedCredentials({
          branchCode: branch?.branch_code || data.login_hint?.branch_code,
          branchName: branch?.branch_name,
          email: data.user?.email || userForm.email.trim().toLowerCase(),
          password: userForm.password,
          fullName: data.user?.full_name || userForm.full_name.trim(),
          role: data.user?.role || userForm.role,
        });
        setTab(2);
      } else if (userForm.password.trim()) {
        setCreatedCredentials({
          branchCode: branch?.branch_code,
          branchName: branch?.branch_name,
          email: data.user?.email || userForm.email.trim().toLowerCase(),
          password: userForm.password,
          fullName: data.user?.full_name || userForm.full_name.trim(),
          role: data.user?.role || userForm.role,
        });
        setSuccess('Credentials updated — save the new password below');
      } else {
        setSuccess('User updated');
      }
      await loadBranch(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setUserSaving(false);
    }
  };

  const handleResetPassword = async () => {
    if (!user || !resetPasswordUser || resetPasswordValue.trim().length < 6) return;
    setResettingPassword(true);
    setError('');
    try {
      const res = await branchFetch(user, `/api/branches/${branchId}/users/${resetPasswordUser.user_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: resetPasswordValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset password');
      setCreatedCredentials({
        branchCode: branch?.branch_code,
        branchName: branch?.branch_name,
        email: resetPasswordUser.email,
        password: resetPasswordValue.trim(),
        fullName: resetPasswordUser.full_name,
        role: resetPasswordUser.role,
      });
      setResetPasswordUser(null);
      setResetPasswordValue('');
      setSuccess('Password reset — share new credentials with the user');
      await loadBranch(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setResettingPassword(false);
    }
  };

  const handleDeleteUser = (u) => {
    const count = branch?.users?.length ?? 0;
    setDeleteUserTarget(u);
    setDeleteUserConfirm('');
    setDeleteUserForce(count <= 1);
  };

  const confirmDeleteUser = async () => {
    if (!user || !deleteUserTarget) return;
    const count = branch?.users?.length ?? 0;
    setDeletingUser(true);
    setError('');
    try {
      const res = await branchFetch(user, `/api/branches/${branchId}/users/${deleteUserTarget.user_id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: deleteUserForce || count <= 1 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete user');
      setSuccess(data.was_last_user ? 'User removed — branch has no login accounts until you add one' : 'User removed');
      setDeleteUserTarget(null);
      setDeleteUserConfirm('');
      await loadBranch(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setDeletingUser(false);
    }
  };

  const handleOpenPos = () => {
    if (!branch || branch.status !== 'ACTIVE') return;
    enterBranchAsHq(branch);
    router.push('/dashboard');
  };

  if (!ready) return null;

  if (loading && !branch) {
    return (
      <Box sx={{ py: 10, textAlign: 'center' }}>
        <CircularProgress sx={{ color: '#4338ca' }} />
      </Box>
    );
  }

  if (!branch) {
    return (
      <>
        <Alert severity="error" sx={{ borderRadius: 2 }}>{error || 'Branch not found'}</Alert>
        <Button
          startIcon={<ArrowLeft size={16} />}
          onClick={() => router.push('/dashboard/hq/branches')}
          sx={{ mt: 2, fontWeight: 700 }}
        >
          Back to Branches
        </Button>
      </>
    );
  }

  const counts = branch._count || {};
  const branchUsers = branch.users || [];
  const isActive = branch.status === 'ACTIVE';

  const isolationLabel =
    branch.isolation_mode === 'DEDICATED'
      ? (branch.db_name || '—')
      : branch.isolation_mode === 'PREFIXED'
        ? `${branch.table_prefix || branch.branch_code?.toLowerCase()}_*`
        : 'Shared tables (main sales, customers, …)';

  return (
    <>
      {/* Back navigation */}
      <Button
        startIcon={<ArrowLeft size={16} />}
        onClick={() => router.push('/dashboard/hq/branches')}
        sx={{ mb: 2, color: '#64748b', fontWeight: 600, '&:hover': { bgcolor: '#f1f5f9' } }}
      >
        Back to Branches
      </Button>

      {/* Branch identity header */}
      <Paper
        variant="outlined"
        sx={{
          mb: 2.5,
          borderRadius: 2.5,
          overflow: 'hidden',
          borderColor: isActive ? '#c7d2fe' : '#e2e8f0',
          boxShadow: isActive ? '0 4px 20px rgba(67,56,202,0.08)' : '0 2px 10px rgba(15,23,42,0.03)',
        }}
      >
        <Box
          sx={{
            px: 3,
            py: 2.5,
            background: isActive
              ? 'linear-gradient(135deg, #312e81 0%, #4338ca 60%, #4f46e5 100%)'
              : 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
            color: 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 2.5,
                bgcolor: 'rgba(255,255,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.2)',
                flexShrink: 0,
              }}
            >
              <Building2 size={26} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: '-0.02em' }}>
                {branch.branch_name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                <Chip
                  label={branch.branch_code}
                  size="small"
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 800, fontFamily: 'monospace' }}
                />
                <Chip
                  label={branch.status}
                  size="small"
                  sx={{
                    bgcolor: isActive ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.15)',
                    color: 'white',
                    fontWeight: 700,
                  }}
                />
                {branch.branch_code === 'MAIN' && (
                  <Chip label="Default branch" size="small" variant="outlined" sx={{ borderColor: 'rgba(255,255,255,0.4)', color: 'white' }} />
                )}
              </Box>
              <Typography variant="caption" sx={{ opacity: 0.85, display: 'block', mt: 1 }}>
                Created {formatDate(branch.created_at)} · Updated {formatDate(branch.updated_at)}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              startIcon={<LogIn size={16} />}
              onClick={handleOpenPos}
              disabled={!isActive}
              sx={{
                bgcolor: 'white',
                color: '#4338ca',
                fontWeight: 800,
                borderRadius: 2,
                px: 2.5,
                '&:hover': { bgcolor: '#f8fafc' },
                '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.6)' },
              }}
            >
              Open POS
            </Button>
            <Button
              variant="outlined"
              startIcon={isActive ? <PauseCircle size={16} /> : <PlayCircle size={16} />}
              onClick={handleToggleStatus}
              disabled={saving}
              sx={{
                borderColor: 'rgba(255,255,255,0.5)',
                color: 'white',
                fontWeight: 700,
                borderRadius: 2,
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255,255,255,0.1)' },
              }}
            >
              {isActive ? 'Suspend' : 'Activate'}
            </Button>
          </Box>
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>
      )}

      {/* Tabs */}
      <Paper variant="outlined" sx={{ mb: 2.5, borderRadius: 2.5, bgcolor: 'white', overflow: 'hidden' }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            px: 1,
            borderBottom: '1px solid #e2e8f0',
            '& .MuiTab-root': { fontWeight: 700, textTransform: 'none', minHeight: 48 },
            '& .Mui-selected': { color: '#4338ca' },
            '& .MuiTabs-indicator': { bgcolor: '#4338ca', height: 3, borderRadius: '3px 3px 0 0' },
          }}
        >
          <Tab label="Overview" />
          <Tab label="Edit Details" />
          <Tab icon={<KeyRound size={16} />} iconPosition="start" label={`Login & Credentials (${branchUsers.length})`} />
          <Tab label="Danger Zone" sx={{ color: tab === 3 ? '#dc2626 !important' : undefined }} />
        </Tabs>
      </Paper>

      {/* OVERVIEW */}
      {tab === 0 && (
        <>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            {STAT_ITEMS.map(({ key, label, icon, color }) => (
              <Grid item xs={6} sm={4} md={3} key={key}>
                <HqStatCard icon={icon} label={label} value={counts[key] ?? 0} color={color} />
              </Grid>
            ))}
          </Grid>

          <Grid container spacing={2.5}>
            <Grid item xs={12} lg={6}>
              <SectionPanel
                title="Data Isolation"
                subtitle="How this branch stores its business data"
                action={
                  <Database size={18} color="#64748b" />
                }
              >
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <InfoField label="Mode" value={branch.isolation_mode || 'SHARED'} />
                  </Grid>
                  <Grid item xs={6}>
                    <InfoField label="Provision Status">
                      <Chip
                        size="small"
                        label={branch.provision_status || 'PENDING'}
                        color={branch.provision_status === 'ACTIVE' ? 'success' : branch.provision_status === 'FAILED' ? 'error' : 'default'}
                        sx={{ fontWeight: 700 }}
                      />
                    </InfoField>
                  </Grid>
                  <Grid item xs={12}>
                    <InfoField label="Table prefix / Database" value={isolationLabel} />
                  </Grid>
                  {branch.provision_message && (
                    <Grid item xs={12}>
                      <Typography variant="body2" color="text.secondary">{branch.provision_message}</Typography>
                    </Grid>
                  )}
                  {branch.provision_status !== 'ACTIVE' && (
                    <Grid item xs={12}>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={async () => {
                          if (!user) return;
                          setSaving(true);
                          try {
                            const res = await branchFetch(user, `/api/branches/${branchId}`, {
                              method: 'PATCH',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ action: 'reprovision' }),
                            });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || 'Provision failed');
                            setSuccess('Dedicated tables created');
                            await loadBranch(user);
                          } catch (e) {
                            setError(e.message);
                          } finally {
                            setSaving(false);
                          }
                        }}
                        disabled={saving}
                        sx={{ fontWeight: 700, borderRadius: 2 }}
                      >
                        Create dedicated tables
                      </Button>
                    </Grid>
                  )}
                </Grid>
              </SectionPanel>
            </Grid>

            <Grid item xs={12} lg={6}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <SectionPanel title="Branch Information" subtitle="Contact and identification details">
                  <Grid container spacing={1}>
                    <Grid item xs={12} sm={6}>
                      <InfoField label="Branch Code (login)">
                        <BranchCodeCopyRow branchCode={branch.branch_code} label="" />
                      </InfoField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <InfoField label="Branch Name" value={branch.branch_name} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <InfoField label="Address">
                        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'flex-start' }}>
                          <MapPin size={14} color="#64748b" style={{ marginTop: 3, flexShrink: 0 }} />
                          <Typography>{branch.address || '—'}</Typography>
                        </Box>
                      </InfoField>
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <InfoField label="Phone">
                        <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
                          <Phone size={14} color="#64748b" />
                          <Typography fontWeight={600}>{branch.phone || '—'}</Typography>
                        </Box>
                      </InfoField>
                    </Grid>
                  </Grid>
                </SectionPanel>

                <SectionPanel
                  title="Branch Login"
                  subtitle="Staff access credentials path"
                  action={<ShieldCheck size={18} color="#059669" />}
                >
                  <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                    Staff sign in at <strong>/login/branch</strong> with branch code <strong>{branch.branch_code}</strong>
                  </Alert>
                  {branchUsers.filter((u) => u.role === 'BRANCH_SUPER_ADMIN').length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No Branch Super Admin assigned yet. Add one in the Users tab.
                    </Typography>
                  ) : (
                    branchUsers
                      .filter((u) => u.role === 'BRANCH_SUPER_ADMIN')
                      .map((u) => (
                        <Box
                          key={u.user_id}
                          sx={{
                            p: 1.75,
                            bgcolor: '#f0fdf4',
                            borderRadius: 2,
                            border: '1px solid #bbf7d0',
                            mb: 1,
                          }}
                        >
                          <Typography variant="body2" fontWeight={700}>{u.full_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{u.email}</Typography>
                          <Chip size="small" label="Branch Super Admin" sx={{ mt: 0.75, fontWeight: 700, height: 22 }} />
                        </Box>
                      ))
                  )}
                </SectionPanel>
              </Box>
            </Grid>
          </Grid>
        </>
      )}

      {/* EDIT DETAILS */}
      {tab === 1 && (
        <SectionPanel title="Edit Branch Details" subtitle="Branch code is used at /login/branch for staff sign-in">
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Branch Code"
                value={infoForm.branch_code}
                onChange={(e) => setInfoForm({ ...infoForm, branch_code: e.target.value.toUpperCase() })}
                helperText="Used at branch login (e.g. MAIN, LHR)"
                sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Branch Name"
                value={infoForm.branch_name}
                onChange={(e) => setInfoForm({ ...infoForm, branch_name: e.target.value })}
                sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Address"
                value={infoForm.address}
                onChange={(e) => setInfoForm({ ...infoForm, address: e.target.value })}
                multiline
                rows={3}
                sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth
                label="Phone"
                value={infoForm.phone}
                onChange={(e) => setInfoForm({ ...infoForm, phone: e.target.value })}
                sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
              />
            </Grid>
            <Grid item xs={12}>
              <Button
                variant="contained"
                startIcon={<Save size={16} />}
                onClick={handleSaveInfo}
                disabled={saving || !infoForm.branch_code.trim() || !infoForm.branch_name.trim()}
                sx={{
                  fontWeight: 800,
                  borderRadius: 2,
                  px: 3,
                  background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                }}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </Button>
            </Grid>
          </Grid>
        </SectionPanel>
      )}

      {/* LOGIN & CREDENTIALS */}
      {tab === 2 && (
        <>
          <SectionPanel
            title="Branch Login Settings"
            subtitle="Branch code is required at /login/branch — staff also need their email and password"
            action={<ShieldCheck size={18} color="#059669" />}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Branch login code"
                  value={loginCodeForm}
                  onChange={(e) => setLoginCodeForm(e.target.value.toUpperCase())}
                  helperText="2–12 characters (e.g. MAIN, LHR)"
                  sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
                  InputProps={{ sx: { fontFamily: 'monospace', fontWeight: 800 } }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Login URL"
                  value={typeof window !== 'undefined' ? `${window.location.origin}/login/branch` : '/login/branch'}
                  InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                  sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    startIcon={<Save size={16} />}
                    onClick={handleSaveLoginCode}
                    disabled={savingLoginCode || !loginCodeForm.trim() || loginCodeForm === branch.branch_code}
                    sx={{ fontWeight: 700, borderRadius: 2 }}
                  >
                    {savingLoginCode ? 'Saving…' : 'Save Login Code'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ExternalLink size={16} />}
                    href="/login/branch"
                    target="_blank"
                    sx={{ fontWeight: 700, borderRadius: 2 }}
                  >
                    Open Login Page
                  </Button>
                </Box>
              </Grid>
            </Grid>
            <Box sx={{ mt: 2 }}>
              <BranchCodeCopyRow branchCode={branch.branch_code} />
            </Box>
          </SectionPanel>

          {createdCredentials && (
            <Box sx={{ mb: 2.5 }}>
              <BranchLoginCredentialsPanel
                variant="mui"
                credentials={createdCredentials}
                title={createdCredentials.password ? 'Updated credentials — save now' : 'Branch admin credentials'}
                onClose={() => setCreatedCredentials(null)}
              />
            </Box>
          )}

          <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
            <Box
              sx={{
                px: 2.5,
                py: 1.75,
                bgcolor: '#f8fafc',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
              }}
            >
              <Box>
                <Typography fontWeight={800}>Staff Login Accounts</Typography>
                <Typography variant="caption" color="text.secondary">
                  Full control — edit email, password, role, status, or delete any account
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="small"
                startIcon={<UserPlus size={16} />}
                onClick={openAddUser}
                sx={{ fontWeight: 700, borderRadius: 2 }}
              >
                Add User
              </Button>
            </Box>

            {branchUsers.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Users size={40} color="#94a3b8" style={{ marginBottom: 12 }} />
                <Typography fontWeight={700} gutterBottom>No login accounts</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Add a Branch Super Admin so staff can sign in at /login/branch.
                </Typography>
                <Button variant="outlined" startIcon={<UserPlus size={16} />} onClick={openAddUser}>
                  Add First User
                </Button>
              </Box>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={tableHeadSx}>Name</TableCell>
                    <TableCell sx={tableHeadSx}>Email (login)</TableCell>
                    <TableCell sx={tableHeadSx}>Role</TableCell>
                    <TableCell sx={tableHeadSx}>Active</TableCell>
                    <TableCell sx={tableHeadSx}>Last Login</TableCell>
                    <TableCell align="right" sx={tableHeadSx}>Manage</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {branchUsers.map((u) => (
                    <TableRow key={u.user_id} hover>
                      <TableCell><Typography fontWeight={700}>{u.full_name}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace' }}>{u.email}</Typography></TableCell>
                      <TableCell>
                        <Chip size="small" label={u.role.replace(/_/g, ' ')} sx={{ fontWeight: 600, height: 22, fontSize: '0.65rem' }} />
                      </TableCell>
                      <TableCell>
                        <Switch
                          size="small"
                          checked={u.status === 'ACTIVE'}
                          onChange={() => handleToggleUserStatus(u)}
                          color="success"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption">{formatDate(u.last_logged_in)}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Share login info">
                          <IconButton size="small" onClick={() => setLoginInfoUser(u)} sx={{ color: '#0284c7' }}>
                            <Share2 size={16} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit credentials">
                          <IconButton size="small" onClick={() => openEditUser(u)} sx={{ color: '#4338ca' }}>
                            <Pencil size={16} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Reset password">
                          <IconButton size="small" onClick={() => openResetPassword(u)} sx={{ color: '#7c3aed' }}>
                            <KeyRound size={16} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete user">
                          <IconButton size="small" onClick={() => handleDeleteUser(u)} sx={{ color: '#dc2626' }}>
                            <Trash2 size={16} />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Paper>
        </>
      )}

      {/* DANGER ZONE */}
      {tab === 3 && (
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2.5,
            overflow: 'hidden',
            borderColor: '#fecaca',
            bgcolor: '#fffbfb',
          }}
        >
          <Box sx={{ px: 2.5, py: 1.75, bgcolor: '#fef2f2', borderBottom: '1px solid #fecaca', display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertTriangle size={18} color="#dc2626" />
            <Typography fontWeight={800} color="error">Danger Zone</Typography>
          </Box>
          <Box sx={{ p: 2.5, maxWidth: 640 }}>
            <Typography variant="h6" fontWeight={700} color="error" gutterBottom>Delete Branch</Typography>
            {canDelete ? (
              <>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Remove <strong>only this shop</strong> ({branch.branch_code}) from Head Office.
                  Other branches and your main system are <strong>not affected</strong>.
                </Typography>
                {dataStorage && (
                  <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                    <strong>This branch stores data in:</strong> {dataStorage}
                  </Alert>
                )}
                {hasBusinessData && (
                  <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                    This branch has business records (sales, customers, stock, etc.).
                  </Alert>
                )}
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Trash2 size={16} />}
                  onClick={() => {
                    setDeleteConfirm('');
                    setDeleteDropData(false);
                    setDeleteOpen(true);
                  }}
                  sx={{ fontWeight: 700, borderRadius: 2 }}
                >
                  Delete Branch…
                </Button>
              </>
            ) : (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                {deleteBlockReason || 'This branch cannot be deleted.'}
                {' '}Use <strong>Suspend</strong> to block login instead.
              </Alert>
            )}
          </Box>
        </Paper>
      )}

      {/* Edit / Add user credentials */}
      <Dialog open={userDialogOpen} onClose={() => !userSaving && setUserDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>
          {editingUser ? 'Edit Login Credentials' : 'Add Branch Login Account'}
        </DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            Login requires: branch code <strong>{branch.branch_code}</strong> + email + password at /login/branch
          </Alert>
          <TextField
            label="Full Name"
            value={userForm.full_name}
            onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
            required
            fullWidth
          />
          <TextField
            label="Email (login username)"
            type="email"
            value={userForm.email}
            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            required
            fullWidth
            InputProps={{ sx: { fontFamily: 'monospace' } }}
          />
          <TextField
            label={editingUser ? 'New Password (leave blank to keep current)' : 'Password'}
            type={showPassword ? 'text' : 'password'}
            value={userForm.password}
            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            helperText="Minimum 6 characters"
            fullWidth
            InputProps={{
              sx: { fontFamily: 'monospace' },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setShowPassword((v) => !v)} edge="end">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshCw size={14} />}
            onClick={() => {
              const pwd = generatePassword(10);
              setUserForm((f) => ({ ...f, password: pwd }));
              setShowPassword(true);
            }}
            sx={{ alignSelf: 'flex-start', fontWeight: 700, borderRadius: 2 }}
          >
            Generate secure password
          </Button>
          <TextField select label="Role" value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })} fullWidth>
            {ROLE_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Status" value={userForm.status} onChange={(e) => setUserForm({ ...userForm, status: e.target.value })} fullWidth>
            <MenuItem value="ACTIVE">Active — can log in</MenuItem>
            <MenuItem value="INACTIVE">Inactive — login blocked</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setUserDialogOpen(false)} disabled={userSaving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveUser}
            disabled={
              userSaving
              || !userForm.full_name.trim()
              || !userForm.email.trim()
              || (!editingUser && userForm.password.trim().length < 6)
              || (editingUser && userForm.password.trim().length > 0 && userForm.password.trim().length < 6)
            }
            sx={{ fontWeight: 700 }}
          >
            {userSaving ? 'Saving…' : editingUser ? 'Save Credentials' : 'Create Account'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset password */}
      <Dialog open={!!resetPasswordUser} onClose={() => !resettingPassword && setResetPasswordUser(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Reset Password</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {resetPasswordUser && (
            <>
              <Typography variant="body2" color="text.secondary">
                Set a new password for <strong>{resetPasswordUser.full_name}</strong> ({resetPasswordUser.email})
              </Typography>
              <TextField
                fullWidth
                label="New password"
                type={showResetPassword ? 'text' : 'password'}
                value={resetPasswordValue}
                onChange={(e) => setResetPasswordValue(e.target.value)}
                helperText="Minimum 6 characters"
                InputProps={{
                  sx: { fontFamily: 'monospace' },
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowResetPassword((v) => !v)}>
                        {showResetPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshCw size={14} />}
                onClick={() => setResetPasswordValue(generatePassword(10))}
                sx={{ alignSelf: 'flex-start', fontWeight: 700 }}
              >
                Generate new password
              </Button>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setResetPasswordUser(null)} disabled={resettingPassword}>Cancel</Button>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleResetPassword}
            disabled={resettingPassword || resetPasswordValue.trim().length < 6}
            sx={{ fontWeight: 700 }}
          >
            {resettingPassword ? 'Saving…' : 'Reset & Show Credentials'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete user confirmation */}
      <Dialog open={!!deleteUserTarget} onClose={() => !deletingUser && setDeleteUserTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle color="error" sx={{ fontWeight: 800 }}>Delete Login Account</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {deleteUserTarget && (
            <>
              <Typography variant="body2">
                Permanently remove <strong>{deleteUserTarget.full_name}</strong> ({deleteUserTarget.email}) from this branch.
              </Typography>
              {(branch?.users?.length ?? 0) <= 1 && (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                  This is the <strong>last user</strong> on this branch. After deletion, no one can log in until you add a new account.
                </Alert>
              )}
              <TextField
                fullWidth
                label="Type email to confirm"
                value={deleteUserConfirm}
                onChange={(e) => setDeleteUserConfirm(e.target.value.trim().toLowerCase())}
                placeholder={deleteUserTarget.email}
                InputProps={{ sx: { fontFamily: 'monospace' } }}
              />
              {(branch?.users?.length ?? 0) <= 1 && (
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={deleteUserForce}
                      onChange={(e) => setDeleteUserForce(e.target.checked)}
                      color="error"
                    />
                  }
                  label="I understand — remove the last login account"
                />
              )}
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteUserTarget(null)} disabled={deletingUser}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={
              deletingUser
              || deleteUserConfirm !== deleteUserTarget?.email?.toLowerCase()
              || ((branch?.users?.length ?? 0) <= 1 && !deleteUserForce)
            }
            onClick={confirmDeleteUser}
            sx={{ fontWeight: 700 }}
          >
            {deletingUser ? 'Deleting…' : 'Delete Account'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!loginInfoUser} onClose={() => setLoginInfoUser(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Share login details</DialogTitle>
        <DialogContent>
          {loginInfoUser && (
            <BranchLoginCredentialsPanel
              variant="mui"
              compact
              credentials={{
                branchCode: branch.branch_code,
                branchName: branch.branch_name,
                email: loginInfoUser.email,
                fullName: loginInfoUser.full_name,
                role: loginInfoUser.role,
              }}
              title={`Login info — ${loginInfoUser.full_name}`}
              subtitle="Password cannot be retrieved. Use Reset Password to set a new one."
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<KeyRound size={16} />}
            onClick={() => {
              const u = loginInfoUser;
              setLoginInfoUser(null);
              if (u) openResetPassword(u);
            }}
          >
            Reset Password
          </Button>
          <Button
            startIcon={<Pencil size={16} />}
            onClick={() => {
              const u = loginInfoUser;
              setLoginInfoUser(null);
              if (u) openEditUser(u);
            }}
          >
            Edit
          </Button>
          <Button variant="contained" onClick={() => setLoginInfoUser(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle color="error" sx={{ fontWeight: 800 }}>Delete This Branch Only</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          <Alert severity="info" sx={{ borderRadius: 2 }}>
            <strong>Scope:</strong> Only <strong>{branch.branch_name}</strong> ({branch.branch_code}) will be removed.
            {' '}All other branches, MAIN branch, and Head Office stay untouched.
          </Alert>

          <Typography variant="body2" color="text.secondary">
            Branch login accounts for <strong>{branch.branch_code}</strong> will be removed.
            Choose what happens to <strong>this branch&apos;s</strong> sales, stock, and records — not the whole system.
          </Typography>

          <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Typography variant="subtitle2" fontWeight={800} gutterBottom>
              What to do with <strong>{branch.branch_code}</strong> data?
            </Typography>
            <FormControl component="fieldset" fullWidth>
              <RadioGroup
                value={deleteDropData ? 'drop' : 'keep'}
                onChange={(e) => setDeleteDropData(e.target.value === 'drop')}
              >
                <FormControlLabel
                  value="keep"
                  control={<Radio color="primary" />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={700}>
                        Remove branch only — keep this shop&apos;s data
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                        Deletes the {branch.branch_code} branch record and its login users from HQ.
                        This branch&apos;s sales, stock, and tables remain in the database (other branches unaffected).
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start', mb: 1 }}
                />
                <FormControlLabel
                  value="drop"
                  control={<Radio color="error" />}
                  label={
                    <Box>
                      <Typography variant="body2" fontWeight={700} color="error">
                        Remove branch + erase this shop&apos;s data only
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                        {branch.isolation_mode === 'DEDICATED'
                          ? `Permanently drops only the ${branch.branch_code} dedicated database (${branch.db_name || '—'}). Other branches are safe.`
                          : branch.isolation_mode === 'PREFIXED'
                            ? `Permanently drops only ${branch.table_prefix || branch.branch_code?.toLowerCase()}_* tables for ${branch.branch_code}. Other branch tables are not touched.`
                            : `Permanently deletes only ${branch.branch_code} rows from shared tables (sales, customers, stock, etc.). Other branches keep their data.`}
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start' }}
                />
              </RadioGroup>
            </FormControl>
          </Box>

          {deleteDropData && (
            <Alert severity="error" sx={{ borderRadius: 2 }}>
              <strong>This shop&apos;s data will be permanently erased.</strong>
              {' '}Only {branch.branch_code} is affected — not MAIN, not other branches, not the full system.
            </Alert>
          )}

          <TextField
            fullWidth
            label={`Type ${branch.branch_code} to confirm deletion of this branch`}
            value={deleteConfirm}
            onChange={(e) => setDeleteConfirm(e.target.value.toUpperCase())}
            placeholder={branch.branch_code}
            helperText="Confirmation applies to this branch only"
            InputProps={{ sx: { fontFamily: 'monospace', fontWeight: 700 } }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            disabled={deleting || deleteConfirm !== branch.branch_code}
            onClick={handleDelete}
            sx={{ fontWeight: 700 }}
          >
            {deleting
              ? 'Deleting…'
              : deleteDropData
                ? `Delete ${branch.branch_code} & Erase Its Data`
                : `Delete ${branch.branch_code} Only (Keep Data)`}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess('')}
        message={success}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  );
}
