'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, TextField, Card, CardContent, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Dialog, DialogContent, DialogActions,
  Chip, InputAdornment, MenuItem, Alert, Snackbar,
  FormControl, InputLabel, Select, Stack, Avatar, Divider, CircularProgress,
} from '@mui/material';
import {
  Add, Edit, Delete, Search, Person, Work, AttachMoney, Phone, Badge,
  Home, Business, CalendarToday, Close, Save, CheckCircle, EventAvailable,
} from '@mui/icons-material';
import { BRAND } from '@/lib/brand-theme';

const CARD_SX = {
  borderRadius: '12px',
  border: '1px solid #dce3ed',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
  bgcolor: '#ffffff',
};

const FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    bgcolor: '#fff',
    fontSize: '0.875rem',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&:hover fieldset': { borderColor: '#94a3b8' },
    '&.Mui-focused fieldset': {
      borderColor: BRAND.supporting.periwinkle,
      borderWidth: '1.5px',
    },
  },
  '& .MuiInputLabel-root': { fontSize: '0.8125rem', fontWeight: 500 },
  '& .MuiFormHelperText-root': { fontSize: '0.72rem', mt: 0.5 },
};

const FILTER_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '8px',
    fontSize: '0.8125rem',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&.Mui-focused fieldset': { borderColor: BRAND.supporting.periwinkle },
  },
};

const SECTION_SX = {
  p: 2,
  borderRadius: '12px',
  border: '1px solid #e2e8f0',
  bgcolor: '#fafbfd',
};

const EMPTY_FORM = {
  emp_name: '', emp_phone: '', emp_cnic: '', emp_address: '',
  designation: '', department: '', join_date: '', basic_salary: '', status: 'ACTIVE',
  allowed_leaves_per_month: '2', allowed_absents_per_month: '0',
};

const fmtAmt = (v) => parseFloat(v || 0).toLocaleString('en-PK');

function SectionHeader({ icon: Icon, title, subtitle }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.75 }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '10px',
          bgcolor: '#e8effd',
          color: '#1A55E3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon sx={{ fontSize: 20 }} />
      </Box>
      <Box>
        <Typography sx={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', lineHeight: 1.2 }}>{title}</Typography>
        {subtitle && (
          <Typography sx={{ fontSize: '0.72rem', color: '#64748b', mt: 0.15 }}>{subtitle}</Typography>
        )}
      </Box>
    </Stack>
  );
}
export default function EmployeesTab() {
  const [employees, setEmployees] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dialog, setDialog] = useState({ open: false, mode: 'add', data: EMPTY_FORM });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, id: null, name: '' });
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchEmployees(); }, []);

  useEffect(() => {
    let list = employees;
    if (statusFilter !== 'ALL') list = list.filter((e) => e.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((e) =>
        e.emp_name.toLowerCase().includes(q) ||
        (e.emp_cnic || '').includes(q) ||
        (e.designation || '').toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [employees, search, statusFilter]);

  async function fetchEmployees() {
    try {
      const res = await fetch('/api/employees');
      setEmployees(await res.json());
    } catch {
      setSnack({ open: true, msg: 'Failed to load employees', severity: 'error' });
    }
  }

  function openAdd() {
    setDialog({
      open: true,
      mode: 'add',
      data: {
        ...EMPTY_FORM,
        join_date: (() => {
          const n = new Date();
          return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
        })(),
        allowed_leaves_per_month: '2',
        allowed_absents_per_month: '0',
      },
    });
  }

  function openEdit(emp) {
    setDialog({
      open: true,
      mode: 'edit',
      data: {
        emp_id: emp.emp_id,
        emp_name: emp.emp_name,
        emp_phone: emp.emp_phone || '',
        emp_cnic: emp.emp_cnic || '',
        emp_address: emp.emp_address || '',
        designation: emp.designation || '',
        department: emp.department || '',
        join_date: emp.join_date ? emp.join_date.split('T')[0] : '',
        basic_salary: String(emp.basic_salary),
        status: emp.status,
        allowed_leaves_per_month: String(emp.allowed_leaves_per_month ?? 2),
        allowed_absents_per_month: String(emp.allowed_absents_per_month ?? 0),
      },
    });
  }

  async function handleSave() {
    const { mode, data } = dialog;
    if (!data.emp_name.trim()) {
      setSnack({ open: true, msg: 'Name is required', severity: 'error' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/employees', {
        method: mode === 'add' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setSnack({ open: true, msg: json.error || 'Save failed', severity: 'error' });
        return;
      }
      setSnack({ open: true, msg: mode === 'add' ? 'Employee added' : 'Employee updated', severity: 'success' });
      setDialog((d) => ({ ...d, open: false }));
      fetchEmployees();
    } catch {
      setSnack({ open: true, msg: 'Network error', severity: 'error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees?id=${deleteDialog.id}`, { method: 'DELETE' });
      if (!res.ok) {
        setSnack({ open: true, msg: 'Delete failed', severity: 'error' });
        return;
      }
      setSnack({ open: true, msg: 'Employee deleted', severity: 'success' });
      setDeleteDialog({ open: false, id: null, name: '' });
      fetchEmployees();
    } finally {
      setLoading(false);
    }
  }

  const active = employees.filter((e) => e.status === 'ACTIVE').length;

  const formPreview = useMemo(() => {
    const name = dialog.data.emp_name.trim();
    const salary = parseFloat(dialog.data.basic_salary || 0);
    return {
      initials: name ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase() : '?',
      salaryLabel: salary > 0 ? fmtAmt(salary) : '—',
    };
  }, [dialog.data.emp_name, dialog.data.basic_salary]);

  const updateForm = (key, value) => {
    setDialog((d) => ({ ...d, data: { ...d.data, [key]: value } }));
  };

  return (    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        {[
          { label: 'Total', value: employees.length, color: '#1A55E3' },
          { label: 'Active', value: active, color: '#00a868' },
          { label: 'Inactive', value: employees.length - active, color: '#64748b' },
          { label: 'Total Basic Salary', value: fmtAmt(employees.filter((e) => e.status === 'ACTIVE').reduce((s, e) => s + parseFloat(e.basic_salary || 0), 0)), color: '#5E6EED' },
        ].map((c) => (
          <Card key={c.label} sx={CARD_SX}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{c.label}</Typography>
              <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: c.color }}>{c.value}</Typography>
            </CardContent>
          </Card>
        ))}
      </Box>

      <Card sx={CARD_SX}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search employees..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ ...FILTER_SX, minWidth: 220 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><Search sx={{ fontSize: 18 }} /></InputAdornment> }}
            />
            <FormControl size="small" sx={{ minWidth: 140, ...FILTER_SX }}>
              <InputLabel>Status</InputLabel>
              <Select label="Status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <MenuItem value="ALL">All</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="INACTIVE">Inactive</MenuItem>
              </Select>
            </FormControl>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" startIcon={<Add />} onClick={openAdd} sx={{ bgcolor: BRAND.primary.blue, textTransform: 'none', fontWeight: 700 }}>
              Add Employee
            </Button>
          </Box>

          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #cbd5e1', maxHeight: 480 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#e8effd' }}>
                  {['#', 'Employee', 'Designation', 'Join Date', 'Basic Salary', 'Leave / Absent', 'Status', 'Actions'].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, color: '#1347c4', fontSize: '0.72rem', borderColor: '#cbd5e1' }}>{h}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: '#94a3b8' }}>No employees found</TableCell></TableRow>
                ) : filtered.map((emp, i) => (
                  <TableRow key={emp.emp_id} hover>
                    <TableCell sx={{ borderColor: '#cbd5e1' }}>{i + 1}</TableCell>
                    <TableCell sx={{ borderColor: '#cbd5e1' }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>{emp.emp_name}</Typography>
                      {emp.emp_cnic && <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>{emp.emp_cnic}</Typography>}
                    </TableCell>
                    <TableCell sx={{ borderColor: '#cbd5e1' }}>{emp.designation || '—'}</TableCell>
                    <TableCell sx={{ borderColor: '#cbd5e1' }}>{emp.join_date ? new Date(emp.join_date).toLocaleDateString('en-GB') : '—'}</TableCell>
                    <TableCell sx={{ borderColor: '#cbd5e1', fontWeight: 700, fontFamily: 'monospace' }}>{fmtAmt(emp.basic_salary)}</TableCell>
                    <TableCell sx={{ borderColor: '#cbd5e1', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                      {emp.allowed_leaves_per_month ?? 2}L · {emp.allowed_absents_per_month ?? 0}A
                    </TableCell>
                    <TableCell sx={{ borderColor: '#cbd5e1' }}>
                      <Chip size="small" label={emp.status} color={emp.status === 'ACTIVE' ? 'success' : 'default'} sx={{ fontWeight: 700, height: 22 }} />
                    </TableCell>
                    <TableCell sx={{ borderColor: '#cbd5e1' }}>
                      <IconButton size="small" onClick={() => openEdit(emp)}><Edit sx={{ fontSize: 18, color: BRAND.primary.blue }} /></IconButton>
                      <IconButton size="small" onClick={() => setDeleteDialog({ open: true, id: emp.emp_id, name: emp.emp_name })}><Delete sx={{ fontSize: 18, color: '#dc2626' }} /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <Dialog
        open={dialog.open}
        onClose={() => !loading && setDialog((d) => ({ ...d, open: false }))}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.18)',
          },
        }}
      >
        {/* Header */}
        <Box
          sx={{
            px: 3,
            py: 2.25,
            background: 'linear-gradient(135deg, #1A55E3 0%, #5E6EED 100%)',
            color: '#fff',
          }}
        >
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={2} alignItems="center">
              <Avatar
                sx={{
                  width: 52,
                  height: 52,
                  bgcolor: 'rgba(255,255,255,0.2)',
                  border: '2px solid rgba(255,255,255,0.35)',
                  fontWeight: 800,
                  fontSize: '1.1rem',
                }}
              >
                {formPreview.initials}
              </Avatar>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', lineHeight: 1.2 }}>
                  {dialog.mode === 'add' ? 'Register New Employee' : 'Edit Employee Profile'}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', opacity: 0.9, mt: 0.35 }}>
                  {dialog.mode === 'add'
                    ? 'Add staff details for attendance and payroll processing'
                    : 'Update employee information and salary'}
                </Typography>
              </Box>
            </Stack>
            <IconButton
              onClick={() => setDialog((d) => ({ ...d, open: false }))}
              disabled={loading}
              sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.15)', '&:hover': { bgcolor: 'rgba(255,255,255,0.25)' } }}
            >
              <Close />
            </IconButton>
          </Stack>
        </Box>

        <DialogContent sx={{ px: 3, py: 3, bgcolor: '#f8fafc' }}>
          <Stack spacing={2.5}>
            {/* Personal */}
            <Box sx={SECTION_SX}>
              <SectionHeader icon={Person} title="Personal Information" subtitle="Name, contact and identity" />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    label="Full Name"
                    placeholder="e.g. Muhammad Ali Khan"
                    value={dialog.data.emp_name}
                    onChange={(e) => updateForm('emp_name', e.target.value)}
                    sx={FIELD_SX}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Person sx={{ fontSize: 20, color: '#94a3b8' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="CNIC"
                    placeholder="35202-1234567-1"
                    value={dialog.data.emp_cnic}
                    onChange={(e) => updateForm('emp_cnic', e.target.value)}
                    sx={FIELD_SX}
                    helperText="National ID (optional)"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Badge sx={{ fontSize: 20, color: '#94a3b8' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    placeholder="03XX-XXXXXXX"
                    value={dialog.data.emp_phone}
                    onChange={(e) => updateForm('emp_phone', e.target.value)}
                    sx={FIELD_SX}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Phone sx={{ fontSize: 20, color: '#94a3b8' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Home Address"
                    placeholder="Street, area, city"
                    value={dialog.data.emp_address}
                    onChange={(e) => updateForm('emp_address', e.target.value)}
                    multiline
                    minRows={2}
                    sx={FIELD_SX}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.25 }}>
                          <Home sx={{ fontSize: 20, color: '#94a3b8' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Job */}
            <Box sx={SECTION_SX}>
              <SectionHeader icon={Work} title="Job Details" subtitle="Role, department and joining date" />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Designation"
                    placeholder="e.g. Salesman, Driver, Accountant"
                    value={dialog.data.designation}
                    onChange={(e) => updateForm('designation', e.target.value)}
                    sx={FIELD_SX}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Work sx={{ fontSize: 20, color: '#94a3b8' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Department"
                    placeholder="e.g. Sales, Warehouse, Admin"
                    value={dialog.data.department}
                    onChange={(e) => updateForm('department', e.target.value)}
                    sx={FIELD_SX}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Business sx={{ fontSize: 20, color: '#94a3b8' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Join Date"
                    type="date"
                    value={dialog.data.join_date}
                    onChange={(e) => updateForm('join_date', e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={FIELD_SX}
                    helperText="Used for salary pro-rating in join month"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <CalendarToday sx={{ fontSize: 18, color: '#94a3b8' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth sx={FIELD_SX}>
                    <InputLabel>Employment Status</InputLabel>
                    <Select
                      label="Employment Status"
                      value={dialog.data.status}
                      onChange={(e) => updateForm('status', e.target.value)}
                    >
                      <MenuItem value="ACTIVE">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <CheckCircle sx={{ fontSize: 18, color: '#059669' }} />
                          <span>Active — included in payroll</span>
                        </Stack>
                      </MenuItem>
                      <MenuItem value="INACTIVE">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 18, height: 18, borderRadius: '50%', bgcolor: '#94a3b8' }} />
                          <span>Inactive — excluded from payroll</span>
                        </Stack>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
            </Box>

            {/* Salary */}
            <Box sx={{ ...SECTION_SX, bgcolor: '#eef0fe', borderColor: '#c7d2fe' }}>
              <SectionHeader icon={AttachMoney} title="Salary" subtitle="Monthly basic pay for payroll calculation" />
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={7}>
                  <TextField
                    fullWidth
                    label="Basic Salary (Monthly)"
                    type="number"
                    placeholder="0"
                    value={dialog.data.basic_salary}
                    onChange={(e) => updateForm('basic_salary', e.target.value)}
                    sx={FIELD_SX}
                    helperText="Leave and absent deductions apply during payroll generation"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Typography sx={{ fontWeight: 800, color: '#64748b', fontSize: '0.8125rem' }}>Rs</Typography>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={5}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: '10px',
                      bgcolor: '#fff',
                      border: '1px solid #c7d2fe',
                      textAlign: 'center',
                    }}
                  >
                    <Typography sx={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Monthly Basic</Typography>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: '#1A55E3', fontFamily: 'monospace' }}>
                      {formPreview.salaryLabel}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </Box>

            {/* Leave & Absent Policy */}
            <Box sx={{ ...SECTION_SX, bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
              <SectionHeader
                icon={EventAvailable}
                title="Leave & Absent Allowance"
                subtitle="Per-month limits before salary deduction (used when generating payroll)"
              />
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Allowed Leaves per Month"
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    value={dialog.data.allowed_leaves_per_month}
                    onChange={(e) => updateForm('allowed_leaves_per_month', e.target.value)}
                    sx={FIELD_SX}
                    helperText="Approved leave (L) days with no deduction"
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Allowed Absents per Month"
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    value={dialog.data.allowed_absents_per_month}
                    onChange={(e) => updateForm('allowed_absents_per_month', e.target.value)}
                    sx={FIELD_SX}
                    helperText="Absent (A) or unmarked days with no deduction"
                  />
                </Grid>
              </Grid>
            </Box>
          </Stack>
        </DialogContent>

        <Divider />

        <DialogActions
          sx={{
            px: 3,
            py: 2,
            bgcolor: '#fff',
            justifyContent: 'space-between',
          }}
        >
          <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            <Box component="span" sx={{ color: '#dc2626' }}>*</Box> Full name is required
          </Typography>
          <Stack direction="row" spacing={1.5}>
            <Button
              onClick={() => setDialog((d) => ({ ...d, open: false }))}
              disabled={loading}
              sx={{ textTransform: 'none', color: '#64748b', fontWeight: 600, px: 2.5 }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={loading || !dialog.data.emp_name.trim()}
              startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <Save />}
              sx={{
                textTransform: 'none',
                fontWeight: 700,
                px: 3,
                py: 1,
                borderRadius: '10px',
                bgcolor: BRAND.primary.blue,
                background: `linear-gradient(180deg, ${BRAND.primary.blue} 0%, #1347c4 100%)`,
                boxShadow: '0 4px 14px rgba(26,85,227,0.28)',
                '&:hover': { filter: 'brightness(1.05)' },
              }}
            >
              {dialog.mode === 'add' ? 'Save Employee' : 'Update Employee'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, id: null, name: '' })}
        PaperProps={{ sx: { borderRadius: '14px', minWidth: 360 } }}
      >
        <Box sx={{ px: 3, pt: 2.5, pb: 1 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>Delete Employee</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: '#64748b', mt: 1 }}>
            Remove <strong>{deleteDialog.name}</strong> from the system? This cannot be undone.
          </Typography>
        </Box>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteDialog({ open: false, id: null, name: '' })} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={loading} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar open={snack.open} autoHideDuration={3500} onClose={() => setSnack((s) => ({ ...s, open: false }))} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={snack.severity}>{snack.msg}</Alert>
      </Snackbar>
    </Box>
  );
}
