'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import {
  Box, Typography, Button, TextField, Card, CardContent,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, IconButton, Chip, InputAdornment, MenuItem,
  FormControl, InputLabel, Select, LinearProgress, Skeleton, Tooltip, Stack,
} from '@mui/material';
import { Add, Edit, Delete, Search, AccountBalanceWallet, MenuBook } from '@mui/icons-material';
import { BRAND } from '@/lib/brand-theme';
import { CARD_SX, FILTER_SX, fmtAmt } from './employeeRegisterShared';
import HrStatCard from '../shared/HrStatCard';
import EmployeeBalanceChip from '../shared/EmployeeBalanceChip';
import { HR_TABLE_HEAD_SX } from '../shared/hrUiShared';
import HrLoadMoreTrigger from '../shared/HrLoadMoreTrigger';

export default function EmployeeRegisterList({
  employees,
  stats,
  total,
  loading,
  loadingMore,
  refreshing,
  hasMore,
  onLoadMore,
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onAdd,
  onEdit,
  onDelete,
  onViewLedger,
}) {
  const scrollRef = useRef(null);
  const [localSearch, setLocalSearch] = useState(search ?? '');

  useEffect(() => {
    setLocalSearch(search ?? '');
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (localSearch !== (search ?? '')) onSearchChange?.(localSearch);
    }, 350);
    return () => clearTimeout(t);
  }, [localSearch, search, onSearchChange]);

  const headerStats = useMemo(() => {
    if (stats) {
      return {
        total: stats.total ?? total ?? 0,
        active: stats.active ?? 0,
        inactive: stats.inactive ?? 0,
        totalSalary: stats.totalSalary ?? 0,
        receivable: stats.receivable ?? 0,
      };
    }
    const list = employees || [];
    const active = list.filter((e) => e.status === 'ACTIVE');
    const receivable = list.reduce((s, e) => {
      const b = parseFloat(e.ledger_balance ?? e.opening_balance ?? 0);
      return b > 0 ? s + b : s;
    }, 0);
    return {
      total: total ?? list.length,
      active: active.length,
      inactive: list.length - active.length,
      totalSalary: active.reduce((sum, e) => sum + parseFloat(e.basic_salary || 0), 0),
      receivable,
    };
  }, [stats, employees, total]);

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

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(5, 1fr)' }, gap: 1.5 }}>
        <HrStatCard label="Employees" value={headerStats.total} color="#1A55E3" loading={showSkeleton} icon={AccountBalanceWallet} />
        <HrStatCard label="Active" value={headerStats.active} color="#059669" loading={showSkeleton} />
        <HrStatCard label="Inactive" value={headerStats.inactive} color="#64748b" loading={showSkeleton} />
        <HrStatCard label="Monthly basic (active)" value={fmtAmt(headerStats.totalSalary)} color="#6366f1" loading={showSkeleton} />
        <HrStatCard
          label="Ledger receivable"
          value={fmtAmt(headerStats.receivable)}
          color="#b91c1c"
          loading={showSkeleton}
          icon={MenuBook}
        />
      </Box>

      <Card sx={CARD_SX}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center', mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search name, CNIC, designation…"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              sx={{ ...FILTER_SX, minWidth: 240, flex: { xs: '1 1 100%', sm: '1 1 280px' } }}
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
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => onStatusFilterChange?.(e.target.value)}
              >
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
              sx={{ bgcolor: BRAND.primary.blue, textTransform: 'none', fontWeight: 700, borderRadius: '10px', px: 2.5 }}
            >
              Register employee
            </Button>
          </Box>

          <TableContainer
            ref={scrollRef}
            component={Paper}
            elevation={0}
            sx={{ border: '1px solid #cbd5e1', borderRadius: '12px', maxHeight: 520, overflow: 'auto' }}
          >
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  {['#', 'Employee', 'Job', 'Join', 'Salary', 'Starting balance', 'Account balance', 'Leave', 'Status', 'Actions'].map((h, idx) => (
                    <TableCell
                      key={h}
                      align={['Salary', 'Starting balance', 'Account balance'].includes(h) ? 'right' : idx === 0 ? 'center' : 'left'}
                      sx={HR_TABLE_HEAD_SX}
                    >
                      {h}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {showSkeleton
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 10 }).map((__, j) => (
                        <TableCell key={j} sx={{ borderColor: '#e2e8f0' }}>
                          <Skeleton variant="text" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                  : employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 5, color: '#94a3b8', borderColor: '#e2e8f0' }}>
                        No employees match your filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    employees.map((emp, i) => {
                      const starting = parseFloat(emp.opening_balance ?? 0);
                      const ledger = parseFloat(emp.ledger_balance ?? emp.account_balance ?? starting);
                      const isTemp = String(emp.emp_id).startsWith('temp-');
                      return (
                        <TableRow
                          key={emp.emp_id}
                          hover
                          sx={{
                            opacity: isTemp ? 0.88 : 1,
                            '& td': { borderColor: '#e2e8f0', fontSize: '0.8125rem' },
                          }}
                        >
                          <TableCell align="center">{i + 1}</TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 700 }}>{emp.emp_name}</Typography>
                            {emp.emp_phone && (
                              <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>{emp.emp_phone}</Typography>
                            )}
                            {emp.emp_cnic && (
                              <Typography sx={{ fontSize: '0.68rem', color: '#94a3b8' }}>{emp.emp_cnic}</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 600 }}>{emp.designation || '—'}</Typography>
                            <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>{emp.department || ''}</Typography>
                          </TableCell>
                          <TableCell>
                            {emp.join_date ? new Date(emp.join_date).toLocaleDateString('en-GB') : '—'}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700, fontFamily: 'ui-monospace, monospace' }}>
                            {fmtAmt(emp.basic_salary)}
                          </TableCell>
                          <TableCell align="right" sx={{ fontFamily: 'ui-monospace, monospace', color: '#475569' }}>
                            {fmtAmt(starting)}
                          </TableCell>
                          <TableCell align="right">
                            <EmployeeBalanceChip balance={ledger} />
                          </TableCell>
                          <TableCell sx={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569' }}>
                            {emp.allowed_leaves_per_month ?? 2}L · {emp.allowed_absents_per_month ?? 0}A
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={emp.status}
                              color={emp.status === 'ACTIVE' ? 'success' : 'default'}
                              sx={{ fontWeight: 700, height: 22 }}
                            />
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.25}>
                              <Tooltip title="Employee ledger">
                                <span>
                                  <IconButton size="small" onClick={() => onViewLedger?.(emp)} disabled={isTemp}>
                                    <MenuBook sx={{ fontSize: 18, color: '#0d9488' }} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Edit">
                                <span>
                                  <IconButton size="small" onClick={() => onEdit(emp)} disabled={isTemp}>
                                    <Edit sx={{ fontSize: 18, color: BRAND.primary.blue }} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <span>
                                  <IconButton size="small" onClick={() => onDelete(emp)} disabled={isTemp}>
                                    <Delete sx={{ fontSize: 18, color: '#dc2626' }} />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
              </TableBody>
            </Table>
            <HrLoadMoreTrigger
              rootRef={scrollRef}
              hasMore={hasMore}
              loading={loadingMore}
              onLoadMore={onLoadMore}
            />
          </TableContainer>
          {total > employees.length && (
            <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8', mt: 1 }}>
              Showing {employees.length} of {total} — scroll for more
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
