'use client';

import { useMemo, useState } from 'react';
import {
  Box, Typography, Button, TextField, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, InputAdornment, MenuItem,
  FormControl, InputLabel, Select, LinearProgress, Skeleton,
} from '@mui/material';
import { Add, Edit, Delete, Search } from '@mui/icons-material';
import { BRAND } from '@/lib/brand-theme';
import { CARD_SX, FILTER_SX, fmtAmt, filterEmployees } from './employeeRegisterShared';

export default function EmployeeRegisterList({
  employees,
  loading,
  refreshing,
  onAdd,
  onEdit,
  onDelete,
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const filtered = useMemo(
    () => filterEmployees(employees, { search, statusFilter }),
    [employees, search, statusFilter]
  );

  const stats = useMemo(() => {
    const list = employees || [];
    const active = list.filter((e) => e.status === 'ACTIVE');
    return {
      total: list.length,
      active: active.length,
      inactive: list.length - active.length,
      totalSalary: active.reduce((s, e) => s + parseFloat(e.basic_salary || 0), 0),
    };
  }, [employees]);

  const showSkeleton = loading && employees.length === 0;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {refreshing && (
        <LinearProgress
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            height: 3,
            borderRadius: 1,
            bgcolor: '#e8effd',
            '& .MuiLinearProgress-bar': { bgcolor: BRAND.primary.blue },
          }}
        />
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        {[
          { label: 'Total', value: stats.total, color: '#1A55E3' },
          { label: 'Active', value: stats.active, color: '#00a868' },
          { label: 'Inactive', value: stats.inactive, color: '#64748b' },
          { label: 'Total Basic Salary', value: fmtAmt(stats.totalSalary), color: '#5E6EED' },
        ].map((c) => (
          <Card key={c.label} sx={CARD_SX}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>{c.label}</Typography>
              {showSkeleton ? (
                <Skeleton width={64} height={32} />
              ) : (
                <Typography sx={{ fontSize: '1.35rem', fontWeight: 800, color: c.color }}>{c.value}</Typography>
              )}
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
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search sx={{ fontSize: 18 }} />
                  </InputAdornment>
                ),
              }}
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
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={onAdd}
              sx={{ bgcolor: BRAND.primary.blue, textTransform: 'none', fontWeight: 700 }}
            >
              Add Employee
            </Button>
          </Box>

          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #cbd5e1', maxHeight: 480 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: '#e8effd' }}>
                  {['#', 'Employee', 'Designation', 'Join Date', 'Basic Salary', 'Ledger Bal.', 'Leave / Absent', 'Status', 'Actions'].map((h) => (
                    <TableCell key={h} sx={{ fontWeight: 700, color: '#1347c4', fontSize: '0.72rem', borderColor: '#cbd5e1' }}>
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {showSkeleton
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 9 }).map((__, j) => (
                        <TableCell key={j} sx={{ borderColor: '#cbd5e1' }}>
                          <Skeleton variant="text" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                  : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} align="center" sx={{ py: 4, color: '#94a3b8' }}>
                        No employees found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((emp, i) => {
                      const bal = parseFloat(emp.ledger_balance ?? emp.opening_balance ?? 0);
                      return (
                        <TableRow key={emp.emp_id} hover sx={{ opacity: String(emp.emp_id).startsWith('temp-') ? 0.85 : 1 }}>
                          <TableCell sx={{ borderColor: '#cbd5e1' }}>{i + 1}</TableCell>
                          <TableCell sx={{ borderColor: '#cbd5e1' }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem' }}>{emp.emp_name}</Typography>
                            {emp.emp_cnic && (
                              <Typography sx={{ fontSize: '0.7rem', color: '#64748b' }}>{emp.emp_cnic}</Typography>
                            )}
                          </TableCell>
                          <TableCell sx={{ borderColor: '#cbd5e1' }}>{emp.designation || '—'}</TableCell>
                          <TableCell sx={{ borderColor: '#cbd5e1' }}>
                            {emp.join_date ? new Date(emp.join_date).toLocaleDateString('en-GB') : '—'}
                          </TableCell>
                          <TableCell sx={{ borderColor: '#cbd5e1', fontWeight: 700, fontFamily: 'monospace' }}>
                            {fmtAmt(emp.basic_salary)}
                          </TableCell>
                          <TableCell
                            sx={{
                              borderColor: '#cbd5e1',
                              fontWeight: 700,
                              fontFamily: 'monospace',
                              color: bal > 0 ? '#b91c1c' : bal < 0 ? '#15803d' : '#64748b',
                            }}
                          >
                            {fmtAmt(bal)}
                          </TableCell>
                          <TableCell sx={{ borderColor: '#cbd5e1', fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                            {emp.allowed_leaves_per_month ?? 2}L · {emp.allowed_absents_per_month ?? 0}A
                          </TableCell>
                          <TableCell sx={{ borderColor: '#cbd5e1' }}>
                            <Chip
                              size="small"
                              label={emp.status}
                              color={emp.status === 'ACTIVE' ? 'success' : 'default'}
                              sx={{ fontWeight: 700, height: 22 }}
                            />
                          </TableCell>
                          <TableCell sx={{ borderColor: '#cbd5e1' }}>
                            <IconButton size="small" onClick={() => onEdit(emp)} disabled={String(emp.emp_id).startsWith('temp-')}>
                              <Edit sx={{ fontSize: 18, color: BRAND.primary.blue }} />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => onDelete(emp)}
                              disabled={String(emp.emp_id).startsWith('temp-')}
                            >
                              <Delete sx={{ fontSize: 18, color: '#dc2626' }} />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
