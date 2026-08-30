'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Grid, TextField, Typography, Alert, IconButton,
  Tooltip, Snackbar, MenuItem, Select, FormControl, InputLabel, InputAdornment, Paper,
} from '@mui/material';
import {
  Building2, LogIn, Plus, Settings, PauseCircle, PlayCircle, ChevronRight,
  Search, Store, MapPin, Phone, Database, Users, ShoppingCart, Package, Users2
} from 'lucide-react';
import { branchFetch, enterBranchAsHq } from '@/lib/branch-client';
import BranchLoginCredentialsPanel from '@/components/BranchLoginCredentialsPanel';
import HqPageHeader from '../components/hq-page-header';
import { useHqSession } from '../components/use-hq-session';
import {
  BranchCreateForm,
  BranchCreatingLoader,
  CREATE_STATUS_MESSAGES,
} from '../components/hq-branch-create-dialog';

const PENDING_CREDS_KEY = 'itefaq_pending_branch_credentials';

export default function HqBranchesPage() {
  return (
    <Suspense fallback={<Box sx={{ py: 10, textAlign: 'center' }}><CircularProgress /></Box>}>
      <HqBranchesContent />
    </Suspense>
  );
}

function HqBranchesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, ready } = useHqSession();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creatingLabel, setCreatingLabel] = useState('');
  const [createStatusIdx, setCreateStatusIdx] = useState(0);
  const [togglingId, setTogglingId] = useState(null);
  const [createdBranchCredentials, setCreatedBranchCredentials] = useState(null);
  const [pendingBranchId, setPendingBranchId] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modeFilter, setModeFilter] = useState('ALL');

  const [form, setForm] = useState({
    branch_code: '', branch_name: '', address: '', phone: '',
    admin_email: '', admin_password: '', admin_full_name: '',
  });

  const loadData = useCallback(async (currentUser) => {
    setLoading(true);
    setError('');
    try {
      const res = await branchFetch(currentUser, '/api/branches/stats');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load branches');
      setBranches(data.branches || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && user) loadData(user);
  }, [ready, user, loadData]);

  useEffect(() => {
    if (searchParams.get('create') === '1') setDialogOpen(true);
  }, [searchParams]);

  useEffect(() => {
    if (!creating) {
      setCreateStatusIdx(0);
      return undefined;
    }
    const timer = window.setInterval(() => {
      setCreateStatusIdx((i) => (i + 1) % CREATE_STATUS_MESSAGES.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [creating]);

  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);
    setCreatingLabel(form.branch_code.trim().toUpperCase() || form.branch_name.trim());
    setError('');
    try {
      const res = await branchFetch(user, '/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create branch');
      setDialogOpen(false);
      const adminPassword = form.admin_password;
      setForm({ branch_code: '', branch_name: '', address: '', phone: '', admin_email: '', admin_password: '', admin_full_name: '' });
      setCreatedBranchCredentials({
        branchCode: data.branch?.branch_code,
        branchName: data.branch?.branch_name,
        email: data.adminUser?.email,
        password: adminPassword,
        fullName: data.adminUser?.full_name,
        role: data.adminUser?.role || 'BRANCH_SUPER_ADMIN',
      });
      setPendingBranchId(data.branch?.branch_id || null);
      setSuccess(`Branch ${data.branch?.branch_code} created successfully`);
      await loadData(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
      setCreatingLabel('');
    }
  };

  const handleToggleStatus = async (branch, e) => {
    e?.stopPropagation();
    if (!user) return;
    const next = branch.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setTogglingId(branch.branch_id);
    try {
      const res = await branchFetch(user, `/api/branches/${branch.branch_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadNext(next)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update branch status');
      setSuccess(`Branch ${branch.branch_code} is now ${next}`);
      await loadData(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setTogglingId(null);
    }
  };

  function payloadNext(next) {
    return { status: next };
  }

  // Filter logic
  const filteredBranches = branches.filter((b) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      b.branch_code?.toLowerCase().includes(q) ||
      b.branch_name?.toLowerCase().includes(q) ||
      b.address?.toLowerCase().includes(q) ||
      b.phone?.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    const matchesMode = modeFilter === 'ALL' || (b.isolation_mode || 'SHARED') === modeFilter;

    return matchesSearch && matchesStatus && matchesMode;
  });

  if (!ready) return null;

  return (
    <>
      <HqPageHeader
        icon={Building2}
        title="Store Branches"
        subtitle="Manage all shop storefronts, configure branch administrators, toggle store access, or jump directly into any branch POS."
        action={
          <Button
            variant="contained"
            startIcon={<Plus size={18} />}
            onClick={() => setDialogOpen(true)}
            disabled={creating}
            sx={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
              borderRadius: 2.5,
              px: 3,
              py: 1.2,
              fontWeight: 700,
              boxShadow: '0 4px 14px rgba(79,70,229,0.3)',
            }}
          >
            Create New Shop
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Filter Toolbar */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 2.5,
          bgcolor: 'white',
          borderColor: '#e2e8f0',
          boxShadow: '0 2px 10px rgba(15,23,42,0.03)',
        }}
      >
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={5} md={6}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search shop name, branch code, address, phone…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search size={18} color="#64748b" />
                  </InputAdornment>
                ),
              }}
              sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
            />
          </Grid>

          <Grid item xs={6} sm={3.5} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                label="Status"
                onChange={(e) => setStatusFilter(e.target.value)}
                sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
              >
                <MenuItem value="ALL">All Statuses</MenuItem>
                <MenuItem value="ACTIVE">Active Only</MenuItem>
                <MenuItem value="SUSPENDED">Suspended Only</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} sm={3.5} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Isolation Mode</InputLabel>
              <Select
                value={modeFilter}
                label="Isolation Mode"
                onChange={(e) => setModeFilter(e.target.value)}
                sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
              >
                <MenuItem value="ALL">All Modes</MenuItem>
                <MenuItem value="SHARED">SHARED (Main)</MenuItem>
                <MenuItem value="PREFIXED">PREFIXED (Tables)</MenuItem>
                <MenuItem value="DEDICATED">DEDICATED (DB)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1, borderTop: '1px border #f1f5f9' }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Showing <strong>{filteredBranches.length}</strong> of <strong>{branches.length}</strong> shop branches
          </Typography>
          {(searchTerm || statusFilter !== 'ALL' || modeFilter !== 'ALL') && (
            <Button
              size="small"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setModeFilter('ALL');
              }}
              sx={{ fontSize: '0.75rem' }}
            >
              Reset Filters
            </Button>
          )}
        </Box>
      </Paper>

      {/* Branch Cards Grid */}
      {loading ? (
        <Box sx={{ py: 10, textAlign: 'center' }}><CircularProgress /></Box>
      ) : filteredBranches.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 5, textAlign: 'center', borderRadius: 3 }}>
          <Store size={48} color="#94a3b8" style={{ marginBottom: 16 }} />
          <Typography variant="h6" fontWeight={700} gutterBottom>No matching branches found</Typography>
          <Typography color="text.secondary" sx={{ mb: 2 }}>
            Try adjusting your search criteria or create a new branch.
          </Typography>
          <Button variant="contained" startIcon={<Plus size={18} />} onClick={() => setDialogOpen(true)}>
            Create New Shop
          </Button>
        </Paper>
      ) : (
        <Grid container spacing={2.5}>
          {filteredBranches.map((b) => {
            const isActive = b.status === 'ACTIVE';
            return (
              <Grid item xs={12} md={6} lg={4} key={b.branch_id}>
                <Card
                  variant="outlined"
                  onClick={() => router.push(`/dashboard/hq/branches/${b.branch_id}`)}
                  sx={{
                    borderRadius: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    borderColor: isActive ? '#c7d2fe' : '#f1f5f9',
                    opacity: isActive ? 1 : 0.82,
                    boxShadow: isActive ? '0 4px 16px rgba(67,56,202,0.06)' : 'none',
                    transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
                    '&:hover': {
                      boxShadow: '0 12px 32px rgba(67,56,202,0.15)',
                      transform: 'translateY(-4px)',
                      borderColor: '#818cf8',
                    },
                  }}
                >
                  {/* Shop Storefront Header Banner */}
                  <Box
                    sx={{
                      p: 2,
                      background: isActive
                        ? 'linear-gradient(135deg, #312e81 0%, #4338ca 60%, #4f46e5 100%)'
                        : 'linear-gradient(135deg, #475569 0%, #64748b 100%)',
                      color: 'white',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2,
                          bgcolor: 'rgba(255,255,255,0.18)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Store size={22} color="white" />
                      </Box>
                      <Box>
                        <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                          {b.branch_name}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                          <Chip
                            size="small"
                            label={`CODE: ${b.branch_code}`}
                            sx={{
                              bgcolor: 'rgba(255,255,255,0.22)',
                              color: 'white',
                              fontWeight: 800,
                              fontFamily: 'monospace',
                              fontSize: '0.7rem',
                              height: 20,
                            }}
                          />
                        </Box>
                      </Box>
                    </Box>

                    <Chip
                      size="small"
                      label={b.status}
                      color={isActive ? 'success' : 'default'}
                      sx={{
                        fontWeight: 700,
                        fontSize: '0.7rem',
                        height: 22,
                        bgcolor: isActive ? '#22c55e' : 'rgba(255,255,255,0.3)',
                        color: 'white',
                      }}
                    />
                  </Box>

                  {/* Shop Info & Live Metrics */}
                  <CardContent sx={{ p: 2.5, flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                      {b.address ? (
                        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <MapPin size={15} color="#6366f1" style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.address}</span>
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                          No location address registered
                        </Typography>
                      )}

                      {b.phone && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Phone size={14} color="#6366f1" style={{ flexShrink: 0 }} />
                          {b.phone}
                        </Typography>
                      )}
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip
                        size="small"
                        icon={<Database size={12} />}
                        label={`Mode: ${b.isolation_mode || 'SHARED'}`}
                        variant="outlined"
                        sx={{ fontSize: '0.68rem', height: 22, bgcolor: '#f8fafc' }}
                      />
                    </Box>

                    {/* Store Metrics Pill Grid */}
                    <Grid container spacing={1} sx={{ bgcolor: '#f8fafc', p: 1.5, borderRadius: 2, border: '1px solid #e2e8f0', mt: 'auto' }}>
                      {[
                        ['Users', b._count?.users ?? 0, Users2, '#0891b2'],
                        ['Customers', b._count?.customers ?? 0, Users, '#7c3aed'],
                        ['Products', b._count?.products ?? 0, Package, '#ea580c'],
                        ['Sales', b._count?.sales ?? 0, ShoppingCart, '#059669'],
                      ].map(([lbl, val, Icon, col]) => (
                        <Grid item xs={6} key={lbl}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Icon size={14} color={col} />
                            <Box>
                              <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1 }}>
                                {lbl}
                              </Typography>
                              <Typography variant="body2" fontWeight={800} sx={{ color: col }}>
                                {val}
                              </Typography>
                            </Box>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>

                    {/* Actions */}
                    <Box
                      sx={{ display: 'flex', gap: 1, pt: 1, flexWrap: 'wrap' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Settings size={14} />}
                        onClick={() => router.push(`/dashboard/hq/branches/${b.branch_id}`)}
                        sx={{ flex: 1, borderRadius: 2, fontWeight: 700 }}
                      >
                        Manage
                      </Button>

                      <Button
                        size="small"
                        variant="contained"
                        startIcon={<LogIn size={14} />}
                        disabled={!isActive}
                        onClick={() => { enterBranchAsHq(b); router.push('/dashboard'); }}
                        sx={{ flex: 1, borderRadius: 2, fontWeight: 700, bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
                      >
                        Open POS
                      </Button>

                      <Tooltip title={isActive ? 'Suspend shop' : 'Activate shop'}>
                        <IconButton
                          size="small"
                          color={isActive ? 'warning' : 'success'}
                          disabled={togglingId === b.branch_id}
                          onClick={(e) => handleToggleStatus(b, e)}
                          sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}
                        >
                          {isActive ? <PauseCircle size={18} /> : <PlayCircle size={18} />}
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}

      {/* Dialog — Create New Shop Branch */}
      <Dialog
        open={dialogOpen}
        onClose={() => !creating && setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        disableEscapeKeyDown={creating}
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: creating
              ? '0 24px 60px rgba(67,56,202,0.22)'
              : '0 12px 40px rgba(15,23,42,0.12)',
          },
        }}
      >
        {creating ? (
          <BranchCreatingLoader label={creatingLabel} statusIdx={createStatusIdx} />
        ) : (
          <BranchCreateForm
            form={form}
            setForm={setForm}
            creating={creating}
            onCancel={() => setDialogOpen(false)}
            onSubmit={handleCreate}
          />
        )}
      </Dialog>

      {/* Post-creation Credential Dialog */}
      <Dialog open={!!createdBranchCredentials} onClose={() => setCreatedBranchCredentials(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Branch Created — Credentials Generated</DialogTitle>
        <DialogContent>
          {createdBranchCredentials && (
            <BranchLoginCredentialsPanel
              variant="mui"
              credentials={createdBranchCredentials}
              title="Branch Super Admin Login"
              subtitle="Copy or share these login details with the branch manager."
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCreatedBranchCredentials(null)}>Close</Button>
          <Button
            variant="contained"
            endIcon={<ChevronRight size={16} />}
            onClick={() => {
              if (pendingBranchId && createdBranchCredentials) {
                sessionStorage.setItem(
                  PENDING_CREDS_KEY,
                  JSON.stringify({ branchId: pendingBranchId, credentials: createdBranchCredentials })
                );
                router.push(`/dashboard/hq/branches/${pendingBranchId}`);
              }
              setCreatedBranchCredentials(null);
            }}
          >
            Open Branch Details
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!success} autoHideDuration={4000} onClose={() => setSuccess('')} message={success} />
    </>
  );
}
