'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Box, Container, Typography, Button, TextField, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Grid, MenuItem, Alert, Snackbar, Select, FormControl,
  InputLabel, Tabs, Tab, Tooltip, IconButton, Badge,
} from '@mui/material';
import {
  CalendarToday, CheckCircle, Cancel, AccessTime, Save,
  People, TrendingUp, EventBusy, BeachAccess,
} from '@mui/icons-material';
import DashboardLayout from '../components/dashboard-layout';

const STATUS_OPTIONS = [
  { value: 'PRESENT', label: 'Present', color: 'success' },
  { value: 'ABSENT', label: 'Absent', color: 'error' },
  { value: 'HALF_DAY', label: 'Half Day', color: 'warning' },
  { value: 'LEAVE', label: 'Leave', color: 'info' },
  { value: 'HOLIDAY', label: 'Holiday', color: 'default' },
];

const STATUS_COLOR = { PRESENT: 'success', ABSENT: 'error', HALF_DAY: 'warning', LEAVE: 'info', HOLIDAY: 'default' };

function todayStr() { return new Date().toISOString().split('T')[0]; }

export default function AttendancePage() {
  const [tab, setTab] = useState(0);
  const [date, setDate] = useState(todayStr());
  const [employees, setEmployees] = useState([]);
  const [attMap, setAttMap] = useState({}); // emp_id -> attendance row
  const [rows, setRows] = useState([]);     // editable rows for daily view
  const [monthYear, setMonthYear] = useState(() => {
    const n = new Date();
    return { month: n.getMonth() + 1, year: n.getFullYear() };
  });
  const [monthAtt, setMonthAtt] = useState([]);
  const [saving, setSaving] = useState(false);
  const [snack, setSnack] = useState({ open: false, msg: '', severity: 'success' });

  useEffect(() => { fetchEmployees(); }, []);
  useEffect(() => { if (tab === 0) fetchDayAttendance(); }, [date, employees]);
  useEffect(() => { if (tab === 1) fetchMonthAttendance(); }, [tab, monthYear]);

  async function fetchEmployees() {
    const res = await fetch('/api/employees?status=ACTIVE');
    const data = await res.json();
    setEmployees(data);
  }

  async function fetchDayAttendance() {
    if (!employees.length) return;
    try {
      const res = await fetch(`/api/attendance?date=${date}`);
      const data = await res.json();
      const map = {};
      data.forEach(a => { map[a.emp_id] = a; });
      setAttMap(map);
      setRows(employees.map(emp => ({
        emp_id: emp.emp_id,
        emp_name: emp.emp_name,
        designation: emp.designation || '',
        department: emp.department || '',
        status: map[emp.emp_id]?.status || 'PRESENT',
        in_time: map[emp.emp_id]?.in_time || '',
        out_time: map[emp.emp_id]?.out_time || '',
        notes: map[emp.emp_id]?.notes || '',
        att_id: map[emp.emp_id]?.att_id || null,
      })));
    } catch { showSnack('Failed to load attendance', 'error'); }
  }

  async function fetchMonthAttendance() {
    try {
      const { month, year } = monthYear;
      const res = await fetch(`/api/attendance?month=${month}&year=${year}`);
      const data = await res.json();
      setMonthAtt(data);
    } catch { showSnack('Failed to load monthly attendance', 'error'); }
  }

  function updateRow(emp_id, field, value) {
    setRows(r => r.map(row => row.emp_id === emp_id ? { ...row, [field]: value } : row));
  }

  function markAll(status) {
    setRows(r => r.map(row => ({ ...row, status })));
  }

  async function saveAttendance() {
    setSaving(true);
    try {
      const payload = rows.map(r => ({
        emp_id: r.emp_id, att_date: date,
        in_time: r.in_time || null, out_time: r.out_time || null,
        status: r.status, notes: r.notes || null,
      }));
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { showSnack('Failed to save', 'error'); return; }
      showSnack('Attendance saved successfully');
      fetchDayAttendance();
    } catch { showSnack('Network error', 'error'); }
    finally { setSaving(false); }
  }

  function showSnack(msg, severity = 'success') { setSnack({ open: true, msg, severity }); }

  // Summary for daily view
  const summary = rows.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {});

  // Monthly summary per employee
  const monthSummary = employees.map(emp => {
    const att = monthAtt.filter(a => a.emp_id === emp.emp_id);
    return {
      emp_id: emp.emp_id,
      emp_name: emp.emp_name,
      designation: emp.designation || '',
      present: att.filter(a => a.status === 'PRESENT').length,
      absent: att.filter(a => a.status === 'ABSENT').length,
      half_day: att.filter(a => a.status === 'HALF_DAY').length,
      leave: att.filter(a => a.status === 'LEAVE').length,
      holiday: att.filter(a => a.status === 'HOLIDAY').length,
      total: att.length,
    };
  });

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

  return (
    <DashboardLayout>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Typography variant="h5" fontWeight={700} mb={3}>Attendance Management</Typography>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
          <Tab label="Daily Attendance" icon={<CalendarToday />} iconPosition="start" />
          <Tab label="Monthly Summary" icon={<TrendingUp />} iconPosition="start" />
        </Tabs>

        {/* ─── Daily Tab ─── */}
        {tab === 0 && (
          <>
            {/* Controls */}
            <Card elevation={1} sx={{ mb: 2 }}>
              <CardContent sx={{ py: 1.5 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <TextField type="date" label="Date" value={date}
                    onChange={e => setDate(e.target.value)}
                    InputLabelProps={{ shrink: true }} size="small" />
                  <Button size="small" variant="outlined" onClick={() => setDate(todayStr())}>Today</Button>
                  <Box sx={{ flex: 1 }} />
                  <Button size="small" variant="outlined" color="success" onClick={() => markAll('PRESENT')}>Mark All Present</Button>
                  <Button size="small" variant="outlined" color="error" onClick={() => markAll('ABSENT')}>Mark All Absent</Button>
                  <Button size="small" variant="outlined" color="default" onClick={() => markAll('HOLIDAY')}>Holiday</Button>
                  <Button variant="contained" startIcon={<Save />} onClick={saveAttendance} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Attendance'}
                  </Button>
                </Box>
              </CardContent>
            </Card>

            {/* Summary chips */}
            <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
              {STATUS_OPTIONS.map(s => (
                <Chip key={s.value} size="small" color={s.color} icon={<People sx={{ fontSize: 14 }} />}
                  label={`${s.label}: ${summary[s.value] || 0}`} variant={summary[s.value] ? 'filled' : 'outlined'} />
              ))}
            </Box>

            {/* Attendance Table */}
            <TableContainer component={Paper} elevation={1}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    {['#', 'Employee', 'Designation', 'Status', 'In Time', 'Out Time', 'Notes'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        No active employees found. Add employees first.
                      </TableCell>
                    </TableRow>
                  ) : rows.map((row, i) => (
                    <TableRow key={row.emp_id} hover
                      sx={{ backgroundColor: row.status === 'ABSENT' ? 'rgba(211,47,47,0.04)' : row.status === 'HOLIDAY' ? 'rgba(0,0,0,0.02)' : 'inherit' }}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={600}>{row.emp_name}</Typography>
                        {row.department && <Typography variant="caption" color="text.secondary">{row.department}</Typography>}
                      </TableCell>
                      <TableCell>{row.designation || '—'}</TableCell>
                      <TableCell>
                        <Select size="small" value={row.status}
                          onChange={e => updateRow(row.emp_id, 'status', e.target.value)}
                          sx={{ minWidth: 120 }}>
                          {STATUS_OPTIONS.map(s => (
                            <MenuItem key={s.value} value={s.value}>
                              <Chip size="small" label={s.label} color={s.color} sx={{ cursor: 'pointer' }} />
                            </MenuItem>
                          ))}
                        </Select>
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="time" value={row.in_time}
                          onChange={e => updateRow(row.emp_id, 'in_time', e.target.value)}
                          disabled={row.status === 'ABSENT' || row.status === 'HOLIDAY'}
                          sx={{ width: 120 }} InputLabelProps={{ shrink: true }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" type="time" value={row.out_time}
                          onChange={e => updateRow(row.emp_id, 'out_time', e.target.value)}
                          disabled={row.status === 'ABSENT' || row.status === 'HOLIDAY'}
                          sx={{ width: 120 }} InputLabelProps={{ shrink: true }} />
                      </TableCell>
                      <TableCell>
                        <TextField size="small" value={row.notes}
                          onChange={e => updateRow(row.emp_id, 'notes', e.target.value)}
                          placeholder="Optional note" sx={{ width: 150 }} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        {/* ─── Monthly Tab ─── */}
        {tab === 1 && (
          <>
            <Card elevation={1} sx={{ mb: 2 }}>
              <CardContent sx={{ py: 1.5 }}>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Month</InputLabel>
                    <Select value={monthYear.month} label="Month"
                      onChange={e => setMonthYear(m => ({ ...m, month: e.target.value }))}>
                      {MONTHS.map((m, i) => <MenuItem key={i} value={i + 1}>{m}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField size="small" label="Year" type="number" value={monthYear.year}
                    onChange={e => setMonthYear(m => ({ ...m, year: parseInt(e.target.value) }))}
                    sx={{ width: 100 }} />
                </Box>
              </CardContent>
            </Card>

            <TableContainer component={Paper} elevation={1}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    {['#', 'Employee', 'Designation', 'Present', 'Absent', 'Half Day', 'Leave', 'Holiday', 'Total Days'].map(h => (
                      <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {monthSummary.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>No data</TableCell>
                    </TableRow>
                  ) : monthSummary.map((s, i) => (
                    <TableRow key={s.emp_id} hover>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell fontWeight={600}>{s.emp_name}</TableCell>
                      <TableCell>{s.designation || '—'}</TableCell>
                      <TableCell><Chip size="small" label={s.present} color="success" /></TableCell>
                      <TableCell><Chip size="small" label={s.absent} color={s.absent > 0 ? 'error' : 'default'} /></TableCell>
                      <TableCell><Chip size="small" label={s.half_day} color={s.half_day > 0 ? 'warning' : 'default'} /></TableCell>
                      <TableCell><Chip size="small" label={s.leave} color={s.leave > 0 ? 'info' : 'default'} /></TableCell>
                      <TableCell><Chip size="small" label={s.holiday} /></TableCell>
                      <TableCell><strong>{s.total}</strong></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}

        <Snackbar open={snack.open} autoHideDuration={3000} onClose={() => setSnack(s => ({ ...s, open: false }))}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <Alert severity={snack.severity} onClose={() => setSnack(s => ({ ...s, open: false }))}>{snack.msg}</Alert>
        </Snackbar>
      </Container>
    </DashboardLayout>
  );
}
