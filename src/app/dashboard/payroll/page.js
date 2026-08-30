'use client';

import { useState, useEffect } from 'react';
import {
  Box, Container, Typography, Button, TextField, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Grid, MenuItem, Alert, Snackbar, Select, FormControl,
  InputLabel, Dialog, DialogTitle, DialogContent, DialogActions,
  Divider, Tabs, Tab, Tooltip, IconButton,
} from '@mui/material';
import {
  AutoAwesome, Edit, Save, CheckCircle, Settings, AttachMoney,
  People, Cancel, Refresh,
} from '@mui/icons-material';
import DashboardLayout from '../components/dashboard-layout';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const STATUS_COLOR = { PENDING: 'warning', PAID: 'success', CANCELLED: 'error' };

export default function PayrollPage() {
  const now = new Date();
  const [tab, setTab] = useState(0);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [payrolls, setPayrolls] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [editDialog, setEditDialog] = useState({ open: false, data: null });
  const [settingsDialog, setSettingsDialog] = useState({ open: false });
  const [hrSettings, setHrSettings] = useState({ allowed_leaves_per_month: 2, allowed_leaves_per_year: 24 });
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  useEffect(() => { fetchPayrolls(); }, [month, year]);
  useEffect(() => { fetchHrSettings(); }, []);

  async function fetchPayrolls() {
    try {
      const res = await fetch(`/api/payroll?month=${month}&year=${year}`);
      const data = await res.json();
      setPayrolls(data);
    } catch { showSnack('Failed to load payroll', 'error'); }
  }

  async function fetchHrSettings() {
    try {
      const res = await fetch('/api/hr-settings');
      const data = await res.json();
      setHrSettings(data);
    } catch {}
  }

  async function generatePayroll() {
    setGenerating(true);
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate: true, month, year }),
      });
      if (!res.ok) { showSnack('Failed to generate', 'error'); return; }
      showSnack('Payroll generated successfully');
      fetchPayrolls();
    } catch { showSnack('Network error', 'error'); }
    finally { setGenerating(false); }
  }

  async function markPaid(payroll_id) {
    try {
      const p = payrolls.find(p => p.payroll_id === payroll_id);
      if (!p) return;
      const res = await fetch('/api/payroll', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payroll_id,
          basic_salary: p.basic_salary, total_days: p.total_days,
          days_present: p.days_present, leaves_taken: p.leaves_taken,
          allowed_leaves: p.allowed_leaves, status: 'PAID',
          payment_date: new Date().toISOString().split('T')[0], notes: p.notes,
        }),
      });
      if (!res.ok) { showSnack('Failed to update', 'error'); return; }
      showSnack('Marked as paid');
      fetchPayrolls();
    } catch { showSnack('Network error', 'error'); }
  }

  async function saveEdit() {
    const d = editDialog.data;
    try {
      const res = await fetch('/api/payroll', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (!res.ok) { showSnack('Failed to save', 'error'); return; }
      showSnack('Payroll updated');
      setEditDialog({ open: false, data: null });
      fetchPayrolls();
    } catch { showSnack('Network error', 'error'); }
  }

  async function saveSettings() {
    setSettingsSaving(true);
    try {
      const res = await fetch('/api/hr-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hrSettings),
      });
      if (!res.ok) { showSnack('Failed to save settings', 'error'); return; }
      showSnack('Leave settings saved');
      setSettingsDialog({ open: false });
    } catch { showSnack('Network error', 'error'); }
    finally { setSettingsSaving(false); }
  }

  function showSnack(msg, severity = 'success') { setSnack({ open: true, msg, severity }); }
  function fmt(n) { return new Intl.NumberFormat('en-PK').format(Math.round(parseFloat(n) || 0)); }

  // Summary
  const totalNet = payrolls.reduce((s, p) => s + parseFloat(p.net_salary || 0), 0);
  const totalPaid = payrolls.filter(p => p.status === 'PAID').reduce((s, p) => s + parseFloat(p.net_salary || 0), 0);
  const totalPending = payrolls.filter(p => p.status === 'PENDING').reduce((s, p) => s + parseFloat(p.net_salary || 0), 0);

  return (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={700}>Payroll Management</Typography>
            <Typography variant="body2" color="text.secondary">
              {MONTHS[month - 1]} {year} — {payrolls.length} employees
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<Settings />} onClick={() => setSettingsDialog({ open: true })}>
              Leave Settings
            </Button>
            <Button variant="contained" startIcon={<AutoAwesome />} onClick={generatePayroll} disabled={generating}>
              {generating ? 'Generating...' : 'Generate Payroll'}
            </Button>
          </Box>
        </Box>

        {/* Month/Year selector */}
        <Card elevation={1} sx={{ mb: 3 }}>
          <CardContent sx={{ py: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <FormControl size="small" sx={{ minWidth: 140 }}>
                <InputLabel>Month</InputLabel>
                <Select value={month} label="Month" onChange={e => setMonth(e.target.value)}>
                  {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField size="small" label="Year" type="number" value={year}
                onChange={e => setYear(parseInt(e.target.value))} sx={{ width: 100 }} />
              <Button size="small" variant="outlined" startIcon={<Refresh />} onClick={fetchPayrolls}>Refresh</Button>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                Allowed leaves/month: <strong>{hrSettings.allowed_leaves_per_month}</strong>
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: 'Total Payroll', value: `Rs. ${fmt(totalNet)}`, color: 'primary.main' },
            { label: 'Paid', value: `Rs. ${fmt(totalPaid)}`, color: 'success.main' },
            { label: 'Pending', value: `Rs. ${fmt(totalPending)}`, color: 'warning.main' },
            { label: 'Employees', value: payrolls.length, color: 'text.primary' },
          ].map(c => (
            <Grid item xs={12} sm={6} md={3} key={c.label}>
              <Card elevation={1}>
                <CardContent sx={{ py: 2 }}>
                  <Typography variant="h5" fontWeight={700} color={c.color}>{c.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{c.label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Payroll Table */}
        <TableContainer component={Paper} elevation={1}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                {['#', 'Employee', 'Basic Salary', 'Total Days', 'Present', 'Leaves', 'Allowed', 'Excess', 'Deduction/Day', 'Total Deduction', 'Net Salary', 'Status', 'Actions'].map(h => (
                  <TableCell key={h} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {payrolls.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={13} align="center" sx={{ py: 5 }}>
                    <Box sx={{ color: 'text.secondary' }}>
                      <AutoAwesome sx={{ fontSize: 40, mb: 1, opacity: 0.4 }} />
                      <Typography>No payroll for this period. Click <strong>Generate Payroll</strong> to auto-calculate from attendance.</Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ) : payrolls.map((p, i) => (
                <TableRow key={p.payroll_id} hover
                  sx={{ backgroundColor: p.status === 'PAID' ? 'rgba(46,125,50,0.04)' : 'inherit' }}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{p.employee?.emp_name}</Typography>
                    {p.employee?.designation && <Typography variant="caption" color="text.secondary">{p.employee.designation}</Typography>}
                  </TableCell>
                  <TableCell>Rs. {fmt(p.basic_salary)}</TableCell>
                  <TableCell>{p.total_days}</TableCell>
                  <TableCell>{parseFloat(p.days_present)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={p.leaves_taken} color={p.leaves_taken > p.allowed_leaves ? 'error' : 'default'} />
                  </TableCell>
                  <TableCell>{p.allowed_leaves}</TableCell>
                  <TableCell>
                    {p.excess_leaves > 0
                      ? <Chip size="small" label={p.excess_leaves} color="error" />
                      : <Chip size="small" label="0" color="success" />}
                  </TableCell>
                  <TableCell>Rs. {fmt(p.deduction_per_day)}</TableCell>
                  <TableCell sx={{ color: parseFloat(p.total_deduction) > 0 ? 'error.main' : 'inherit' }}>
                    Rs. {fmt(p.total_deduction)}
                  </TableCell>
                  <TableCell sx={{ fontWeight: 700, color: 'success.main' }}>Rs. {fmt(p.net_salary)}</TableCell>
                  <TableCell>
                    <Chip size="small" label={p.status} color={STATUS_COLOR[p.status] || 'default'} />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => setEditDialog({ open: true, data: { ...p } })}>
                          <Edit fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {p.status !== 'PAID' && (
                        <Tooltip title="Mark as Paid">
                          <IconButton size="small" color="success" onClick={() => markPaid(p.payroll_id)}>
                            <CheckCircle fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Edit Dialog */}
        {editDialog.data && (
          <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, data: null })} maxWidth="sm" fullWidth>
            <DialogTitle>Edit Payroll — {editDialog.data.employee?.emp_name}</DialogTitle>
            <DialogContent>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                {[
                  { label: 'Basic Salary', field: 'basic_salary', type: 'number' },
                  { label: 'Total Days', field: 'total_days', type: 'number' },
                  { label: 'Days Present', field: 'days_present', type: 'number' },
                  { label: 'Leaves Taken', field: 'leaves_taken', type: 'number' },
                  { label: 'Allowed Leaves', field: 'allowed_leaves', type: 'number' },
                ].map(f => (
                  <Grid item xs={12} sm={6} key={f.field}>
                    <TextField fullWidth size="small" label={f.label} type={f.type}
                      value={editDialog.data[f.field]}
                      onChange={e => setEditDialog(d => ({ ...d, data: { ...d.data, [f.field]: e.target.value } }))} />
                  </Grid>
                ))}
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select value={editDialog.data.status} label="Status"
                      onChange={e => setEditDialog(d => ({ ...d, data: { ...d.data, status: e.target.value } }))}>
                      <MenuItem value="PENDING">Pending</MenuItem>
                      <MenuItem value="PAID">Paid</MenuItem>
                      <MenuItem value="CANCELLED">Cancelled</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Payment Date" type="date"
                    value={editDialog.data.payment_date ? String(editDialog.data.payment_date).split('T')[0] : ''}
                    onChange={e => setEditDialog(d => ({ ...d, data: { ...d.data, payment_date: e.target.value } }))}
                    InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Notes" multiline rows={2}
                    value={editDialog.data.notes || ''}
                    onChange={e => setEditDialog(d => ({ ...d, data: { ...d.data, notes: e.target.value } }))} />
                </Grid>
                <Grid item xs={12}>
                  <Divider />
                  <Box sx={{ mt: 1, p: 1.5, backgroundColor: 'action.hover', borderRadius: 1 }}>
                    {(() => {
                      const d = editDialog.data;
                      const excess = Math.max(0, (parseInt(d.leaves_taken) || 0) - (parseInt(d.allowed_leaves) || 0));
                      const perDay = (parseFloat(d.basic_salary) || 0) / (parseInt(d.total_days) || 30);
                      const deduction = excess * perDay;
                      const net = (parseFloat(d.basic_salary) || 0) - deduction;
                      return (
                        <Grid container spacing={1}>
                          <Grid item xs={6}><Typography variant="caption" color="text.secondary">Excess Leaves</Typography><Typography variant="body2" fontWeight={700} color={excess > 0 ? 'error.main' : 'text.primary'}>{excess}</Typography></Grid>
                          <Grid item xs={6}><Typography variant="caption" color="text.secondary">Total Deduction</Typography><Typography variant="body2" fontWeight={700} color="error.main">Rs. {new Intl.NumberFormat('en-PK').format(Math.round(deduction))}</Typography></Grid>
                          <Grid item xs={12}><Typography variant="caption" color="text.secondary">Net Salary</Typography><Typography variant="h6" fontWeight={700} color="success.main">Rs. {new Intl.NumberFormat('en-PK').format(Math.round(net))}</Typography></Grid>
                        </Grid>
                      );
                    })()}
                  </Box>
                </Grid>
              </Grid>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditDialog({ open: false, data: null })}>Cancel</Button>
              <Button variant="contained" onClick={saveEdit}>Save Changes</Button>
            </DialogActions>
          </Dialog>
        )}

        {/* Leave Settings Dialog */}
        <Dialog open={settingsDialog.open} onClose={() => setSettingsDialog({ open: false })} maxWidth="xs" fullWidth>
          <DialogTitle>Leave Policy Settings</DialogTitle>
          <DialogContent>
            <Grid container spacing={2} sx={{ mt: 0.5 }}>
              <Grid item xs={12}>
                <TextField fullWidth label="Allowed Leaves per Month" type="number"
                  value={hrSettings.allowed_leaves_per_month}
                  onChange={e => setHrSettings(s => ({ ...s, allowed_leaves_per_month: e.target.value }))}
                  helperText="Leaves beyond this will cause salary deduction" />
              </Grid>
              <Grid item xs={12}>
                <TextField fullWidth label="Allowed Leaves per Year" type="number"
                  value={hrSettings.allowed_leaves_per_year}
                  onChange={e => setHrSettings(s => ({ ...s, allowed_leaves_per_year: e.target.value }))}
                  helperText="For annual leave tracking reference" />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setSettingsDialog({ open: false })}>Cancel</Button>
            <Button variant="contained" onClick={saveSettings} disabled={settingsSaving}>
              {settingsSaving ? 'Saving...' : 'Save Settings'}
            </Button>
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
