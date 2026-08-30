'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box, Paper, Table, TableBody, TableCell, TableHead, TableRow, Chip,
  CircularProgress, Alert, TextField, InputAdornment, Button, Grid,
  FormControl, InputLabel, Select, MenuItem, Typography, Dialog, DialogTitle,
  DialogContent, DialogActions, Avatar, Tooltip, IconButton
} from '@mui/material';
import { Users, Search, Shield, Building2, Share2, RefreshCw, KeyRound, UserCheck } from 'lucide-react';
import { branchFetch } from '@/lib/branch-client';
import BranchLoginCredentialsPanel from '@/components/BranchLoginCredentialsPanel';
import HqPageHeader from '../components/hq-page-header';
import HqStatCard from '../components/hq-stat-card';
import { useHqSession } from '../components/use-hq-session';

function formatDate(d) {
  if (!d) return 'Never logged in';
  return new Date(d).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

const ROLE_COLORS = {
  BRANCH_SUPER_ADMIN: { bg: '#e0e7ff', color: '#3730a3', label: 'Branch Super Admin' },
  BRANCH_ADMIN: { bg: '#dbeafe', color: '#1e40af', label: 'Branch Admin' },
  MANAGER: { bg: '#fef3c7', color: '#92400e', label: 'Manager' },
  SALESMAN: { bg: '#dcfce7', color: '#166534', label: 'Salesman' },
  ACCOUNTANT: { bg: '#f3e8ff', color: '#6b21a8', label: 'Accountant' },
  STOCK_MANAGER: { bg: '#ffedd5', color: '#9a3412', label: 'Stock Manager' },
  LOADER: { bg: '#f1f5f9', color: '#334155', label: 'Loader' },
};

export default function HqUsersPage() {
  const router = useRouter();
  const { user, ready } = useHqSession();
  const [users, setUsers] = useState([]);
  const [branchesList, setBranchesList] = useState([]);
  const [stats, setStats] = useState({ total: 0, active: 0, admins: 0, staff: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Selected user for credentials modal
  const [selectedUserCredentials, setSelectedUserCredentials] = useState(null);

  const loadData = useCallback(async (currentUser) => {
    setLoading(true);
    setError('');
    try {
      const [resUsers, resBranches] = await Promise.all([
        branchFetch(currentUser, '/api/branches/hq-users'),
        branchFetch(currentUser, '/api/branches/public'),
      ]);

      const dataUsers = await resUsers.json();
      if (!resUsers.ok) throw new Error(dataUsers.error || 'Failed to load users');

      const dataBranches = await resBranches.json();

      const loadedUsers = dataUsers.users || [];
      setUsers(loadedUsers);
      setBranchesList(dataBranches.branches || []);

      const total = loadedUsers.length;
      const active = loadedUsers.filter((u) => u.status === 'ACTIVE').length;
      const admins = loadedUsers.filter((u) => u.role?.includes('ADMIN')).length;
      const staff = total - admins;

      setStats({ total, active, admins, staff });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (ready && user) loadData(user);
  }, [ready, user, loadData]);

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.full_name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.branch?.branch_code?.toLowerCase().includes(q) ||
      u.branch?.branch_name?.toLowerCase().includes(q);

    const matchesBranch = branchFilter === 'ALL' || String(u.branch_id) === String(branchFilter);
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;

    return matchesSearch && matchesBranch && matchesRole && matchesStatus;
  });

  const handleOpenCredentials = (u) => {
    setSelectedUserCredentials({
      branchCode: u.branch?.branch_code,
      branchName: u.branch?.branch_name,
      email: u.email,
      fullName: u.full_name,
      role: u.role,
    });
  };

  if (!ready) return null;

  return (
    <>
      <HqPageHeader
        icon={Users}
        title="Branch Staff Directory"
        subtitle="Overview of all branch administrators, managers, and staff accounts across all store locations."
        action={
          <Button
            variant="outlined"
            startIcon={<RefreshCw size={16} />}
            onClick={() => user && loadData(user)}
            disabled={loading}
            sx={{ borderRadius: 2 }}
          >
            Refresh List
          </Button>
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* KPI Stats Row */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <HqStatCard icon={Users} label="Total Staff Accounts" value={stats.total} color="#0891b2" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <HqStatCard icon={UserCheck} label="Active Users" value={stats.active} color="#16a34a" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <HqStatCard icon={Shield} label="Branch Admins" value={stats.admins} color="#4338ca" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <HqStatCard icon={Building2} label="Staff Members" value={stats.staff} color="#7c3aed" />
        </Grid>
      </Grid>

      {/* Filter Toolbar */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, borderRadius: 2.5, bgcolor: 'white', borderColor: '#e2e8f0' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={4} md={3}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search name, email, branch code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start"><Search size={18} color="#64748b" /></InputAdornment>
                ),
              }}
              sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
            />
          </Grid>

          <Grid item xs={12} sm={4} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Branch</InputLabel>
              <Select
                value={branchFilter}
                label="Branch"
                onChange={(e) => setBranchFilter(e.target.value)}
                sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
              >
                <MenuItem value="ALL">All Branches</MenuItem>
                {branchesList.map((b) => (
                  <MenuItem key={b.branch_id} value={b.branch_id}>
                    {b.branch_code} — {b.branch_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} sm={2} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Role</InputLabel>
              <Select
                value={roleFilter}
                label="Role"
                onChange={(e) => setRoleFilter(e.target.value)}
                sx={{ bgcolor: '#f8fafc', borderRadius: 2 }}
              >
                <MenuItem value="ALL">All Roles</MenuItem>
                <MenuItem value="BRANCH_SUPER_ADMIN">Branch Super Admin</MenuItem>
                <MenuItem value="BRANCH_ADMIN">Branch Admin</MenuItem>
                <MenuItem value="MANAGER">Manager</MenuItem>
                <MenuItem value="SALESMAN">Salesman</MenuItem>
                <MenuItem value="ACCOUNTANT">Accountant</MenuItem>
                <MenuItem value="STOCK_MANAGER">Stock Manager</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6} sm={2} md={3}>
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
                <MenuItem value="INACTIVE">Inactive Only</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pt: 1, borderTop: '1px border #f1f5f9' }}>
          <Typography variant="caption" color="text.secondary" fontWeight={600}>
            Showing <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> user accounts
          </Typography>
          {(search || branchFilter !== 'ALL' || roleFilter !== 'ALL' || statusFilter !== 'ALL') && (
            <Button
              size="small"
              onClick={() => {
                setSearch('');
                setBranchFilter('ALL');
                setRoleFilter('ALL');
                setStatusFilter('ALL');
              }}
              sx={{ fontSize: '0.75rem' }}
            >
              Reset Filters
            </Button>
          )}
        </Box>
      </Paper>

      {/* Users Data Table */}
      <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
        {loading ? (
          <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 800 }}>User</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Branch</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Assigned Role</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 800 }}>Last Login</TableCell>
                <TableCell align="right" sx={{ fontWeight: 800 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUsers.map((u) => {
                const roleConfig = ROLE_COLORS[u.role] || { bg: '#f1f5f9', color: '#475569', label: u.role };
                const initials = u.full_name
                  ? u.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
                  : u.email[0].toUpperCase();

                return (
                  <TableRow key={u.user_id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          sx={{
                            width: 34,
                            height: 34,
                            fontSize: '0.85rem',
                            fontWeight: 800,
                            bgcolor: roleConfig.bg,
                            color: roleConfig.color,
                            border: `1px solid ${roleConfig.color}33`,
                          }}
                        >
                          {initials}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={700} sx={{ color: '#0f172a' }}>
                            {u.full_name || 'No Name'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display="block">
                            {u.email}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell>
                      {u.branch ? (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            size="small"
                            label={u.branch.branch_code}
                            sx={{ fontWeight: 800, fontFamily: 'monospace', bgcolor: '#eef2ff', color: '#3730a3' }}
                          />
                          <Typography variant="caption" fontWeight={600} color="text.secondary">
                            {u.branch.branch_name}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>

                    <TableCell>
                      <Chip
                        size="small"
                        label={roleConfig.label}
                        sx={{
                          bgcolor: roleConfig.bg,
                          color: roleConfig.color,
                          fontWeight: 700,
                          fontSize: '0.72rem',
                          height: 22,
                        }}
                      />
                    </TableCell>

                    <TableCell>
                      <Chip
                        size="small"
                        label={u.status}
                        color={u.status === 'ACTIVE' ? 'success' : 'default'}
                        sx={{ fontWeight: 700, fontSize: '0.7rem', height: 22 }}
                      />
                    </TableCell>

                    <TableCell>
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>
                        {formatDate(u.last_logged_in)}
                      </Typography>
                    </TableCell>

                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1 }}>
                        <Tooltip title="View / Share Login Info">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenCredentials(u)}
                            sx={{ color: '#4f46e5', border: '1px solid #e0e7ff', bgcolor: '#f5f3ff' }}
                          >
                            <Share2 size={16} />
                          </IconButton>
                        </Tooltip>

                        {u.branch_id && (
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => router.push(`/dashboard/hq/branches/${u.branch_id}`)}
                            sx={{ borderRadius: 1.5, textTransform: 'none', fontWeight: 600, px: 1.5 }}
                          >
                            Open Shop
                          </Button>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}

              {filteredUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                    <Users size={36} color="#cbd5e1" style={{ marginBottom: 8 }} />
                    <Typography variant="body2" fontWeight={600}>No user accounts match your filters</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Share Credentials Dialog */}
      <Dialog
        open={!!selectedUserCredentials}
        onClose={() => setSelectedUserCredentials(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Share Branch Login Credentials</DialogTitle>
        <DialogContent>
          {selectedUserCredentials && (
            <BranchLoginCredentialsPanel
              variant="mui"
              credentials={selectedUserCredentials}
              title="Staff Login Information"
              subtitle="Copy or send these instructions to the staff member."
            />
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSelectedUserCredentials(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
