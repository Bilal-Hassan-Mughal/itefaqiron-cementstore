'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  TextField,
  Card,
  CardContent,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  MenuItem,
  Snackbar,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Tabs,
  Tab,
  Tooltip,
  IconButton,
  InputAdornment,
  Alert,
  Stack,
  Avatar,
} from '@mui/material';
import {
  Add,
  Edit,
  Save,
  CheckCircle,
  Settings,
  AttachMoney,
  People,
  Cancel,
  Refresh,
  Print,
  Delete,
  Search,
  Payment,
  Receipt,
  TrendingDown,
  TrendingUp,
  AccountBalance,
  CalendarToday,
  Badge,
  AutoAwesome,
} from '@mui/icons-material';
import DashboardLayout from '../components/dashboard-layout';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function SalaryManagementPage() {
  const now = new Date();
  const [tab, setTab] = useState(0);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  // Data states
  const [employees, setEmployees] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [payrolls, setPayrolls] = useState([]);
  const [advanceSummary, setAdvanceSummary] = useState([]);
  const [loading, setLoading] = useState(false);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [advanceStatusFilter, setAdvanceStatusFilter] = useState('ALL');

  // Modals
  const [issueAdvanceDialog, setIssueAdvanceDialog] = useState(false);
  const [advanceFormData, setAdvanceFormData] = useState({
    emp_id: '',
    amount: '',
    advance_date: new Date().toISOString().split('T')[0],
    payment_mode: 'CASH',
    reason: '',
  });

  const [editPayrollDialog, setEditPayrollDialog] = useState({ open: false, data: null });
  const [payslipDialog, setPayslipDialog] = useState({ open: false, payroll: null });
  const [generating, setGenerating] = useState(false);

  // Snackbar
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });
  const showSnack = (msg, severity = 'success') => setSnack({ open: true, msg, severity });

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchPayrolls();
  }, [month, year]);

  async function fetchInitialData() {
    try {
      setLoading(true);
      const [empRes, advRes, advSumRes] = await Promise.all([
        fetch('/api/employees'),
        fetch('/api/employee-advances'),
        fetch('/api/employee-advances?summary=true'),
      ]);

      if (empRes.ok) setEmployees(await empRes.json());
      if (advRes.ok) setAdvances(await advRes.json());
      if (advSumRes.ok) setAdvanceSummary(await advSumRes.json());
    } catch (e) {
      showSnack('Failed to load initial data', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function fetchPayrolls() {
    try {
      const res = await fetch(`/api/payroll?month=${month}&year=${year}`);
      if (res.ok) setPayrolls(await res.json());
    } catch {
      showSnack('Failed to load payroll records', 'error');
    }
  }

  async function fetchAdvances() {
    try {
      const [advRes, advSumRes] = await Promise.all([
        fetch('/api/employee-advances'),
        fetch('/api/employee-advances?summary=true'),
      ]);
      if (advRes.ok) setAdvances(await advRes.json());
      if (advSumRes.ok) setAdvanceSummary(await advSumRes.json());
    } catch {}
  }

  // Handle issuing advance salary
  async function handleIssueAdvance() {
    if (!advanceFormData.emp_id) {
      showSnack('Please select an employee', 'error');
      return;
    }
    if (!advanceFormData.amount || parseFloat(advanceFormData.amount) <= 0) {
      showSnack('Please enter a valid advance amount', 'error');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/employee-advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(advanceFormData),
      });

      if (res.ok) {
        showSnack('Advance salary issued successfully!');
        setIssueAdvanceDialog(false);
        setAdvanceFormData({
          emp_id: '',
          amount: '',
          advance_date: new Date().toISOString().split('T')[0],
          payment_mode: 'CASH',
          reason: '',
        });
        fetchAdvances();
        fetchPayrolls();
      } else {
        const json = await res.json();
        showSnack(json.error || 'Failed to issue advance salary', 'error');
      }
    } catch {
      showSnack('Network error issuing advance', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Handle canceling advance salary
  async function handleCancelAdvance(advance_id) {
    if (!confirm('Are you sure you want to cancel this advance salary record?')) return;
    try {
      const res = await fetch('/api/employee-advances', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advance_id, status: 'CANCELLED' }),
      });
      if (res.ok) {
        showSnack('Advance record cancelled');
        fetchAdvances();
      } else {
        showSnack('Failed to cancel advance', 'error');
      }
    } catch {
      showSnack('Error cancelling advance', 'error');
    }
  }

  // Generate monthly payroll
  async function handleGeneratePayroll() {
    setGenerating(true);
    try {
      const res = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generate: true, month, year }),
      });
      if (!res.ok) {
        showSnack('Failed to generate monthly payroll', 'error');
        return;
      }
      showSnack(`Monthly payroll for ${MONTHS[month - 1]} ${year} generated successfully`);
      fetchPayrolls();
      fetchAdvances();
    } catch {
      showSnack('Error generating payroll', 'error');
    } finally {
      setGenerating(false);
    }
  }

  // Mark Payroll as Paid
  async function handleMarkPaid(payroll) {
    try {
      const res = await fetch('/api/payroll', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payroll_id: payroll.payroll_id,
          basic_salary: payroll.basic_salary,
          total_days: payroll.total_days,
          days_present: payroll.days_present,
          leaves_taken: payroll.leaves_taken,
          allowed_leaves: payroll.allowed_leaves,
          advance_deduction: payroll.advance_deduction,
          bonus: payroll.bonus,
          other_deduction: payroll.other_deduction,
          status: 'PAID',
          payment_date: new Date().toISOString().split('T')[0],
          notes: payroll.notes,
        }),
      });

      if (res.ok) {
        showSnack(`Salary marked as PAID for ${payroll.employee?.emp_name}`);
        fetchPayrolls();
        fetchAdvances();
      } else {
        showSnack('Failed to update salary status', 'error');
      }
    } catch {
      showSnack('Error updating salary status', 'error');
    }
  }

  // Save edit payroll modal
  async function handleSavePayrollEdit() {
    const d = editPayrollDialog.data;
    if (!d) return;
    try {
      const res = await fetch('/api/payroll', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(d),
      });
      if (res.ok) {
        showSnack('Payroll record updated successfully');
        setEditPayrollDialog({ open: false, data: null });
        fetchPayrolls();
      } else {
        showSnack('Failed to update payroll', 'error');
      }
    } catch {
      showSnack('Error updating payroll', 'error');
    }
  }

  // Print Pay Slip
  function handlePrintPayslip(payroll) {
    setPayslipDialog({ open: true, payroll });
    setTimeout(() => {
      window.print();
    }, 300);
  }

  // Filtered Advances
  const filteredAdvances = useMemo(() => {
    let list = advances;
    if (advanceStatusFilter !== 'ALL') {
      list = list.filter((a) => a.status === advanceStatusFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (a) =>
          a.employee?.emp_name?.toLowerCase().includes(q) ||
          (a.reason || '').toLowerCase().includes(q) ||
          (a.payment_mode || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [advances, advanceStatusFilter, searchTerm]);

  // Overall Stats
  const totalPendingAdvances = useMemo(() => {
    return advances
      .filter((a) => a.status === 'PENDING')
      .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
  }, [advances]);

  const totalMonthlyPayrollPaid = useMemo(() => {
    return payrolls
      .filter((p) => p.status === 'PAID')
      .reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0);
  }, [payrolls]);

  const activeEmployeeCount = employees.filter((e) => e.status === 'ACTIVE').length;

  return (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ mt: 3, mb: 6 }}>
        {/* Top Header & Title */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: '#111', letterSpacing: -0.5 }}>
              Salary & Advance Management
            </Typography>
            <Typography variant="body2" sx={{ color: '#666', mt: 0.5 }}>
              Manage employee base salaries, advance payments, attendance deductions, and monthly pay slips
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <Button
              variant="contained"
              color="warning"
              startIcon={<AttachMoney />}
              onClick={() => setIssueAdvanceDialog(true)}
              sx={{ borderRadius: '12px', fontWeight: 700, textTransform: 'none', px: 2.5 }}
            >
              Issue Advance Salary
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={<AutoAwesome />}
              onClick={handleGeneratePayroll}
              disabled={generating}
              sx={{ borderRadius: '12px', fontWeight: 700, textTransform: 'none', px: 2.5 }}
            >
              {generating ? 'Generating...' : 'Generate Monthly Payroll'}
            </Button>
          </Stack>
        </Box>

        {/* Overview Metric Cards */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={4} md={4}>
            <Card
              sx={{
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(30,60,114,0.2)',
              }}
            >
              <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 700, fontSize: '0.82rem' }}>
                    Active Employees
                  </Typography>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 32, height: 32 }}>
                    <People sx={{ color: '#fff', fontSize: 18 }} />
                  </Avatar>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, mb: 0.2, fontSize: '1.4rem' }}>
                  {activeEmployeeCount}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.72rem' }}>
                  Registered in HR System
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4} md={4}>
            <Card
              sx={{
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #f857a6 0%, #ff5858 100%)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(248,87,166,0.2)',
              }}
            >
              <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 700, fontSize: '0.82rem' }}>
                    Outstanding Advances
                  </Typography>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 32, height: 32 }}>
                    <TrendingDown sx={{ color: '#fff', fontSize: 18 }} />
                  </Avatar>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, mb: 0.2, fontSize: '1.4rem' }}>
                  Rs. {fmtAmt(totalPendingAdvances)}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.72rem' }}>
                  To be deducted in upcoming payrolls
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4} md={4}>
            <Card
              sx={{
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(17,153,142,0.2)',
              }}
            >
              <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 700, fontSize: '0.82rem' }}>
                    Paid Salary ({MONTHS[month - 1]})
                  </Typography>
                  <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', width: 32, height: 32 }}>
                    <CheckCircle sx={{ color: '#fff', fontSize: 18 }} />
                  </Avatar>
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, mb: 0.2, fontSize: '1.4rem' }}>
                  Rs. {fmtAmt(totalMonthlyPayrollPaid)}
                </Typography>
                <Typography variant="caption" sx={{ opacity: 0.8, fontSize: '0.72rem' }}>
                  Disbursed for {MONTHS[month - 1]} {year}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Tab Navigation */}
        <Paper sx={{ borderRadius: '16px', mb: 3, overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
          <Tabs
            value={tab}
            onChange={(e, v) => setTab(v)}
            sx={{
              bgcolor: '#fafafa',
              borderBottom: '1px solid #eee',
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 700, fontSize: '0.95rem', py: 2 },
            }}
          >
            <Tab icon={<AttachMoney />} iconPosition="start" label="Advance Salary Management" />
            <Tab icon={<Payment />} iconPosition="start" label="Monthly Payroll & Processing" />
            <Tab icon={<Badge />} iconPosition="start" label="Employee Salary Overview" />
          </Tabs>

          {/* TAB 0: Advance Salary Management */}
          {tab === 0 && (
            <Box sx={{ p: 3 }}>
              {/* Advance Filters */}
              <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    placeholder="Search by employee, notes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    fullWidth
                    size="small"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Search fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ bgcolor: '#fff' }}
                  />
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <FormControl fullWidth size="small" sx={{ bgcolor: '#fff' }}>
                    <InputLabel>Advance Status</InputLabel>
                    <Select
                      value={advanceStatusFilter}
                      onChange={(e) => setAdvanceStatusFilter(e.target.value)}
                      label="Advance Status"
                    >
                      <MenuItem value="ALL">All Statuses</MenuItem>
                      <MenuItem value="PENDING">Pending Deduction</MenuItem>
                      <MenuItem value="DEDUCTED">Deducted in Payroll</MenuItem>
                      <MenuItem value="CANCELLED">Cancelled</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={12} md={5} sx={{ textAlign: 'right' }}>
                  <Button
                    variant="outlined"
                    startIcon={<Refresh />}
                    onClick={fetchAdvances}
                    sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 600 }}
                  >
                    Refresh List
                  </Button>
                </Grid>
              </Grid>

              {/* Advance List Table */}
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden' }}>
                <Table>
                  <TableHead sx={{ bgcolor: '#f4f6f8' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Employee</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Designation</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Payment Mode</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Reason / Notes</TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="right">
                        Amount (Rs.)
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="center">
                        Status
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="center">
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {filteredAdvances.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#888' }}>
                          No advance salary records found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredAdvances.map((adv) => (
                        <TableRow key={adv.advance_id} hover>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {new Date(adv.advance_date).toLocaleDateString('en-GB')}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#111' }}>
                            {adv.employee?.emp_name || 'N/A'}
                          </TableCell>
                          <TableCell>{adv.employee?.designation || '—'}</TableCell>
                          <TableCell>
                            <Chip
                              label={adv.payment_mode || 'CASH'}
                              size="small"
                              variant="outlined"
                              color={adv.payment_mode === 'BANK_TRANSFER' ? 'info' : 'default'}
                            />
                          </TableCell>
                          <TableCell>{adv.reason || '—'}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, color: '#d32f2f' }}>
                            Rs. {fmtAmt(adv.amount)}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={adv.status}
                              size="small"
                              color={
                                adv.status === 'PENDING'
                                  ? 'warning'
                                  : adv.status === 'DEDUCTED'
                                  ? 'success'
                                  : 'error'
                              }
                              sx={{ fontWeight: 700 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            {adv.status === 'PENDING' && (
                              <Tooltip title="Cancel Advance">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleCancelAdvance(adv.advance_id)}
                                >
                                  <Cancel fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* TAB 1: Monthly Payroll & Processing */}
          {tab === 1 && (
            <Box sx={{ p: 3 }}>
              {/* Month/Year selector */}
              <Grid container spacing={2} alignItems="center" sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4} md={3}>
                  <FormControl fullWidth size="small" sx={{ bgcolor: '#fff' }}>
                    <InputLabel>Month</InputLabel>
                    <Select value={month} onChange={(e) => setMonth(e.target.value)} label="Month">
                      {MONTHS.map((m, idx) => (
                        <MenuItem key={m} value={idx + 1}>
                          {m}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={4} md={3}>
                  <FormControl fullWidth size="small" sx={{ bgcolor: '#fff' }}>
                    <InputLabel>Year</InputLabel>
                    <Select value={year} onChange={(e) => setYear(e.target.value)} label="Year">
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <MenuItem key={y} value={y}>
                          {y}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={4} md={6} sx={{ textAlign: 'right' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AutoAwesome />}
                    onClick={handleGeneratePayroll}
                    disabled={generating}
                    sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, mr: 1 }}
                  >
                    {generating ? 'Processing...' : `Recalculate ${MONTHS[month - 1]} ${year}`}
                  </Button>
                </Grid>
              </Grid>

              {/* Payroll Table */}
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden' }}>
                <Table>
                  <TableHead sx={{ bgcolor: '#f4f6f8' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Employee</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Base Salary</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Present / Days</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Leave Deductions</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#d32f2f' }}>Advance Deduction</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#2e7d32' }}>Bonus / Allowances</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#111' }} align="right">
                        Net Payable Salary
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="center">
                        Status
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800 }} align="center">
                        Actions
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {payrolls.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 4, color: '#888' }}>
                          No payroll records generated for {MONTHS[month - 1]} {year}. Click &quot;Generate Monthly Payroll&quot; above.
                        </TableCell>
                      </TableRow>
                    ) : (
                      payrolls.map((p) => (
                        <TableRow key={p.payroll_id} hover>
                          <TableCell>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#111' }}>
                              {p.employee?.emp_name}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#777' }}>
                              {p.employee?.designation || 'Staff'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Rs. {fmtAmt(p.basic_salary)}</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>
                            {p.days_present} / {p.total_days} days
                          </TableCell>
                          <TableCell sx={{ color: '#d32f2f' }}>Rs. {fmtAmt(p.total_deduction)}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#d32f2f' }}>
                            Rs. {fmtAmt(p.advance_deduction)}
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#2e7d32' }}>
                            + Rs. {fmtAmt(p.bonus)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#111' }}>
                            Rs. {fmtAmt(p.net_salary)}
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={p.status}
                              size="small"
                              color={p.status === 'PAID' ? 'success' : 'warning'}
                              sx={{ fontWeight: 700 }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={0.5} justifyContent="center">
                              {p.status !== 'PAID' && (
                                <Tooltip title="Mark Salary Paid">
                                  <IconButton color="success" size="small" onClick={() => handleMarkPaid(p)}>
                                    <CheckCircle fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Edit / Adjust Amounts">
                                <IconButton
                                  color="info"
                                  size="small"
                                  onClick={() =>
                                    setEditPayrollDialog({
                                      open: true,
                                      data: {
                                        payroll_id: p.payroll_id,
                                        emp_name: p.employee?.emp_name,
                                        basic_salary: String(p.basic_salary),
                                        total_days: p.total_days,
                                        days_present: p.days_present,
                                        leaves_taken: p.leaves_taken,
                                        allowed_leaves: p.allowed_leaves,
                                        advance_deduction: String(p.advance_deduction || 0),
                                        bonus: String(p.bonus || 0),
                                        other_deduction: String(p.other_deduction || 0),
                                        status: p.status,
                                        notes: p.notes || '',
                                      },
                                    })
                                  }
                                >
                                  <Edit fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Print Pay Slip">
                                <IconButton color="secondary" size="small" onClick={() => handlePrintPayslip(p)}>
                                  <Print fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* TAB 2: Employee Salary Overview */}
          {tab === 2 && (
            <Box sx={{ p: 3 }}>
              <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px', overflow: 'hidden' }}>
                <Table>
                  <TableHead sx={{ bgcolor: '#f4f6f8' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Employee Name</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Department / Role</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Base Salary (Rs.)</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#d32f2f' }}>Pending Advance Balance</TableCell>
                      <TableCell sx={{ fontWeight: 800, color: '#2e7d32' }}>Total Deducted Advances</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Total Advance Issued</TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {advanceSummary.map((sum) => (
                      <TableRow key={sum.emp_id} hover>
                        <TableCell sx={{ fontWeight: 700, color: '#111' }}>{sum.emp_name}</TableCell>
                        <TableCell>{sum.designation || sum.department || 'Staff'}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>Rs. {fmtAmt(sum.basic_salary)}</TableCell>
                        <TableCell sx={{ fontWeight: 800, color: sum.pending_advance_balance > 0 ? '#d32f2f' : '#888' }}>
                          Rs. {fmtAmt(sum.pending_advance_balance)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600, color: '#2e7d32' }}>
                          Rs. {fmtAmt(sum.total_deducted)}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>
                          Rs. {fmtAmt(sum.total_advances_given)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </Paper>

        {/* Modal 1: Issue Advance Salary */}
        <Dialog open={issueAdvanceDialog} onClose={() => setIssueAdvanceDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, bgcolor: '#fff3e0', borderBottom: '1px solid #ffe0b2' }}>
            Issue Advance Salary
          </DialogTitle>
          <DialogContent sx={{ pt: 2 }}>
            <Box sx={{ pt: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth size="small" sx={{ minWidth: 400 }}>
                    <InputLabel id="select-emp-label">Select Employee</InputLabel>
                    <Select
                      labelId="select-emp-label"
                      value={advanceFormData.emp_id}
                      onChange={(e) => setAdvanceFormData((p) => ({ ...p, emp_id: e.target.value }))}
                      label="Select Employee"
                      sx={{ width: '100%', minWidth: 400 }}
                    >
                      {employees.map((emp) => (
                        <MenuItem key={emp.emp_id} value={emp.emp_id}>
                          {emp.emp_name} ({emp.designation || 'Staff'}) — Base: Rs. {fmtAmt(emp.basic_salary)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Advance Amount (Rs.)"
                    type="number"
                    fullWidth
                    size="small"
                    value={advanceFormData.amount}
                    onChange={(e) => setAdvanceFormData((p) => ({ ...p, amount: e.target.value }))}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Issuance Date"
                    type="date"
                    fullWidth
                    size="small"
                    InputLabelProps={{ shrink: true }}
                    value={advanceFormData.advance_date}
                    onChange={(e) => setAdvanceFormData((p) => ({ ...p, advance_date: e.target.value }))}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="select-paymode-label">Payment Mode</InputLabel>
                    <Select
                      labelId="select-paymode-label"
                      value={advanceFormData.payment_mode}
                      onChange={(e) => setAdvanceFormData((p) => ({ ...p, payment_mode: e.target.value }))}
                      label="Payment Mode"
                      sx={{ width: '100%' }}
                    >
                      <MenuItem value="CASH">Cash</MenuItem>
                      <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Reason / Notes"
                    fullWidth
                    size="small"
                    value={advanceFormData.reason}
                    onChange={(e) => setAdvanceFormData((p) => ({ ...p, reason: e.target.value }))}
                    placeholder="e.g. Medical emergency advance..."
                  />
                </Grid>
              </Grid>
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: '1px solid #eee' }}>
            <Button onClick={() => setIssueAdvanceDialog(false)} color="inherit">
              Cancel
            </Button>
            <Button variant="contained" color="warning" onClick={handleIssueAdvance} sx={{ fontWeight: 700 }}>
              Issue Advance
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal 2: Edit / Adjust Payroll Entry */}
        <Dialog open={editPayrollDialog.open} onClose={() => setEditPayrollDialog({ open: false, data: null })} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800, bgcolor: '#e3f2fd', borderBottom: '1px solid #bbdefb' }}>
            Adjust Salary & Deductions — {editPayrollDialog.data?.emp_name}
          </DialogTitle>
          <DialogContent sx={{ pt: 3 }}>
            {editPayrollDialog.data && (
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Base Salary (Rs.)"
                    type="number"
                    fullWidth
                    size="small"
                    value={editPayrollDialog.data.basic_salary}
                    onChange={(e) =>
                      setEditPayrollDialog((p) => ({
                        ...p,
                        data: { ...p.data, basic_salary: e.target.value },
                      }))
                    }
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Advance Deduction (Rs.)"
                    type="number"
                    fullWidth
                    size="small"
                    value={editPayrollDialog.data.advance_deduction}
                    onChange={(e) =>
                      setEditPayrollDialog((p) => ({
                        ...p,
                        data: { ...p.data, advance_deduction: e.target.value },
                      }))
                    }
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Bonus / Allowance (Rs.)"
                    type="number"
                    fullWidth
                    size="small"
                    value={editPayrollDialog.data.bonus}
                    onChange={(e) =>
                      setEditPayrollDialog((p) => ({
                        ...p,
                        data: { ...p.data, bonus: e.target.value },
                      }))
                    }
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Other Deduction (Rs.)"
                    type="number"
                    fullWidth
                    size="small"
                    value={editPayrollDialog.data.other_deduction}
                    onChange={(e) =>
                      setEditPayrollDialog((p) => ({
                        ...p,
                        data: { ...p.data, other_deduction: e.target.value },
                      }))
                    }
                  />
                </Grid>

                <Grid item xs={12}>
                  <TextField
                    label="Notes"
                    fullWidth
                    size="small"
                    value={editPayrollDialog.data.notes}
                    onChange={(e) =>
                      setEditPayrollDialog((p) => ({
                        ...p,
                        data: { ...p.data, notes: e.target.value },
                      }))
                    }
                  />
                </Grid>
              </Grid>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, borderTop: '1px solid #eee' }}>
            <Button onClick={() => setEditPayrollDialog({ open: false, data: null })} color="inherit">
              Cancel
            </Button>
            <Button variant="contained" color="primary" onClick={handleSavePayrollEdit} sx={{ fontWeight: 700 }}>
              Save Adjustments
            </Button>
          </DialogActions>
        </Dialog>

        {/* Modal 3: Payslip Dialog */}
        <Dialog open={payslipDialog.open} onClose={() => setPayslipDialog({ open: false, payroll: null })} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800 }}>Employee Pay Slip</DialogTitle>
          <DialogContent>
            {payslipDialog.payroll && (
              <Box id="printable-payslip" sx={{ p: 2, border: '1px solid #eee', borderRadius: '8px', bgcolor: '#fff' }}>
                <Typography variant="h6" align="center" sx={{ fontWeight: 800 }}>
                  ITTEFAQ IRON & STEEL
                </Typography>
                <Typography variant="caption" display="block" align="center" sx={{ color: '#666', mb: 2 }}>
                  SALARY VOUCHER — {MONTHS[month - 1]} {year}
                </Typography>

                <Divider sx={{ my: 1 }} />

                <Grid container spacing={1} sx={{ mb: 2 }}>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Employee:</strong> {payslipDialog.payroll.employee?.emp_name}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Role:</strong> {payslipDialog.payroll.employee?.designation || 'Staff'}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Period:</strong> {MONTHS[month - 1]} {year}
                    </Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="body2">
                      <strong>Status:</strong> {payslipDialog.payroll.status}
                    </Typography>
                  </Grid>
                </Grid>

                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell>Basic Salary</TableCell>
                      <TableCell align="right">Rs. {fmtAmt(payslipDialog.payroll.basic_salary)}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#d32f2f' }}>Leave Deductions</TableCell>
                      <TableCell align="right" sx={{ color: '#d32f2f' }}>
                        - Rs. {fmtAmt(payslipDialog.payroll.total_deduction)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#d32f2f' }}>Advance Salary Deduction</TableCell>
                      <TableCell align="right" sx={{ color: '#d32f2f' }}>
                        - Rs. {fmtAmt(payslipDialog.payroll.advance_deduction)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ color: '#2e7d32' }}>Bonus / Allowances</TableCell>
                      <TableCell align="right" sx={{ color: '#2e7d32' }}>
                        + Rs. {fmtAmt(payslipDialog.payroll.bonus)}
                      </TableCell>
                    </TableRow>
                    <TableRow sx={{ bgcolor: '#f4f6f8' }}>
                      <TableCell sx={{ fontWeight: 800 }}>Net Disbursed Salary</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
                        Rs. {fmtAmt(payslipDialog.payroll.net_salary)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPayslipDialog({ open: false, payroll: null })}>Close</Button>
            <Button variant="contained" startIcon={<Print />} onClick={() => window.print()}>
              Print Voucher
            </Button>
          </DialogActions>
        </Dialog>

        {/* Snackbar */}
        <Snackbar
          open={snack.open}
          autoHideDuration={4000}
          onClose={() => setSnack((p) => ({ ...p, open: false }))}
        >
          <Alert severity={snack.severity}>{snack.msg}</Alert>
        </Snackbar>
      </Container>
    </DashboardLayout>
  );
}
