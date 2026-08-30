'use client';

import { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Button, TextField, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  Chip, Grid, InputAdornment, MenuItem, Alert, Snackbar, Tooltip,
  FormControl, InputLabel, Select,
} from '@mui/material';
import {
  Add, Edit, Delete, Search, Person, Phone, Badge, Home,
  Work, BusinessCenter, CalendarToday, AttachMoney,
} from '@mui/icons-material';
import DashboardLayout from '../components/dashboard-layout';

const EMPTY_FORM = {
  emp_name: '', emp_phone: '', emp_cnic: '', emp_address: '',
  designation: '', department: '', join_date: '', basic_salary: '', status: 'ACTIVE',
};

const STATUS_COLORS = { ACTIVE: 'success', INACTIVE: 'default' };

export default function EmployeesPage() {
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
    if (statusFilter !== 'ALL') list = list.filter(e => e.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.emp_name.toLowerCase().includes(q) ||
        (e.emp_phone || '').includes(q) ||
        (e.emp_cnic || '').includes(q) ||
        (e.designation || '').toLowerCase().includes(q) ||
        (e.department || '').toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [employees, search, statusFilter]);

  async function fetchEmployees() {
    try {
      const res = await fetch('/api/employees');
      const data = await res.json();
      setEmployees(data);
    } catch { showSnack('Failed to load employees', 'error'); }
  }

  function showSnack(msg, severity = 'success') {
    setSnack({ open: true, msg, severity });
  }

  function openAdd() {
    setDialog({ open: true, mode: 'add', data: { ...EMPTY_FORM, join_date: new Date().toISOString().split('T')[0] } });
  }

  function openEdit(emp) {
    setDialog({
      open: true, mode: 'edit',
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
      },
    });
  }

  function closeDialog() { setDialog(d => ({ ...d, open: false })); }

  async function handleSave() {
    const { mode, data } = dialog;
    if (!data.emp_name.trim()) { showSnack('Name is required', 'error'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/employees', {
        method: mode === 'add' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { showSnack(json.error || 'Error saving', 'error'); return; }
      showSnack(mode === 'add' ? 'Employee added' : 'Employee updated');
      closeDialog();
      fetchEmployees();
    } catch { showSnack('Network error', 'error'); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(`/api/employees?id=${deleteDialog.id}`, { method: 'DELETE' });
      if (!res.ok) { showSnack('Failed to delete', 'error'); return; }
      showSnack('Employee deleted');
      setDeleteDialog({ open: false, id: null, name: '' });
      fetchEmployees();
    } catch { showSnack('Network error', 'error'); }
    finally { setLoading(false); }
  }

  function fmt(val) { return val ? new Intl.NumberFormat('en-PK').format(val) : '—'; }
  function fmtDate(d) { if (!d) return '—'; return new Date(d).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric' }); }

  const active = employees.filter(e => e.status === 'ACTIVE').length;

  return (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Employee Management</Typography>
            <Typography variant="body2" color="text.secondary">{active} active employees</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={openAdd}>Add Employee</Button>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Total Employees', value: employees.length, color: 'primary.main' },
            { label: 'Active', value: active, color: 'success.main' },
            { label: 'Inactive', value: employees.length - active, color: 'text.secondary' },
          ].map(c => (
            <Grid item xs={12} sm={4} key={c.label}>
              <Card elevation={1}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="h4" fontWeight={700} color={c.color}>{c.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{c.label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Filters */}
        <Card elevation={1} sx={{ mb: 2 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="Search by name, phone, CNIC..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
                sx={{ minWidth: 280 }}
              />
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Status</InputLabel>
                <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}>
                  <MenuItem value="ALL">All</MenuItem>
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="INACTIVE">Inactive</MenuItem>
                </Select>
              </FormControl>
            </Box>
          </CardContent>
        </Card>

        {/* Table */}
        <TableContainer component={Paper} elevation={1}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                {['#', 'Name', 'Phone', 'CNIC', 'Designation', 'Department', 'Join Date', 'Basic Salary', 'Status', 'Actions'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No employees found
                  </TableCell>
                </TableRow>
              ) : filtered.map((emp, i) => (
                <TableRow key={emp.emp_id} hover>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>{emp.emp_name}</TableCell>
                  <TableCell>{emp.emp_phone || '—'}</TableCell>
                  <TableCell>{emp.emp_cnic || '—'}</TableCell>
                  <TableCell>{emp.designation || '—'}</TableCell>
                  <TableCell>{emp.department || '—'}</TableCell>
                  <TableCell>{fmtDate(emp.join_date)}</TableCell>
                  <TableCell>Rs. {fmt(emp.basic_salary)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={emp.status} color={STATUS_COLORS[emp.status] || 'default'} />
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEdit(emp)}><Edit fontSize="small" /></IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteDialog({ open: true, id: emp.emp_id, name: emp.emp_name })}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Add/Edit Dialog */}
        <Dialog open={dialog.open} onClose={closeDialog} maxWidth="sm" fullWidth>
          <DialogTitle>{dialog.mode === 'add' ? 'Add New Employee' : 'Edit Employee'}</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField fullWidth label="Full Name *" value={dialog.data.emp_name}
                  onChange={e => setDialog(d => ({ ...d, data: { ...d.data, emp_name: e.target.value } }))}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Person fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Phone" value={dialog.data.emp_phone}
                  onChange={e => setDialog(d => ({ ...d, data: { ...d.data, emp_phone: e.target.value } }))}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Phone fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="CNIC" value={dialog.data.emp_cnic}
                  onChange={e => setDialog(d => ({ ...d, data: { ...d.data, emp_cnic: e.target.value } }))}
                  placeholder="12345-1234567-1"
                  InputProps={{ startAdornment: <InputAdornment position="start"><Badge fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Address" value={dialog.data.emp_address}
                  onChange={e => setDialog(d => ({ ...d, data: { ...d.data, emp_address: e.target.value } }))}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Home fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Designation" value={dialog.data.designation}
                  onChange={e => setDialog(d => ({ ...d, data: { ...d.data, designation: e.target.value } }))}
                  InputProps={{ startAdornment: <InputAdornment position="start"><Work fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Department" value={dialog.data.department}
                  onChange={e => setDialog(d => ({ ...d, data: { ...d.data, department: e.target.value } }))}
                  InputProps={{ startAdornment: <InputAdornment position="start"><BusinessCenter fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Join Date" type="date" value={dialog.data.join_date}
                  onChange={e => setDialog(d => ({ ...d, data: { ...d.data, join_date: e.target.value } }))}
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ startAdornment: <InputAdornment position="start"><CalendarToday fontSize="small" /></InputAdornment> }} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Basic Salary (Rs.)" type="number" value={dialog.data.basic_salary}
                  onChange={e => setDialog(d => ({ ...d, data: { ...d.data, basic_salary: e.target.value } }))}
                  InputProps={{ startAdornment: <InputAdornment position="start"><AttachMoney fontSize="small" /></InputAdornment> }} />
              </Grid>
              {dialog.mode === 'edit' && (
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select value={dialog.data.status} label="Status"
                      onChange={e => setDialog(d => ({ ...d, data: { ...d.data, status: e.target.value } }))}>
                      <MenuItem value="ACTIVE">Active</MenuItem>
                      <MenuItem value="INACTIVE">Inactive</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              )}
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button variant="contained" onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : dialog.mode === 'add' ? 'Add Employee' : 'Save Changes'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Delete Confirm */}
        <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, id: null, name: '' })} maxWidth="xs" fullWidth>
          <DialogTitle>Delete Employee</DialogTitle>
          <DialogContent>
            <Typography>Are you sure you want to delete <strong>{deleteDialog.name}</strong>? This will also remove all attendance and payroll records.</Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialog({ open: false, id: null, name: '' })}>Cancel</Button>
            <Button variant="contained" color="error" onClick={handleDelete} disabled={loading}>Delete</Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.msg}</Alert>
        </Snackbar>
      </Container>
    </DashboardLayout>
  );
}
