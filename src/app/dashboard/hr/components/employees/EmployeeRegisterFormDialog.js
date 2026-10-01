'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, TextField,
  IconButton, Dialog, DialogContent, DialogActions,
  InputAdornment, MenuItem,
  FormControl, InputLabel, Select, Stack, CircularProgress,
} from '@mui/material';
import {
  Person, Work, AttachMoney, Phone, Badge,
  Home, Business, CalendarToday, Close, Save, CheckCircle, EventAvailable,
  HelpOutline, Block, AccountBalanceWallet,
} from '@mui/icons-material';
import {
  DIALOG_HEADER_SX, FIELD_SX, fmtAmt, FORM_FIELDS_ROW_SX,
} from './employeeRegisterShared';
import EmployeeFormSection from './EmployeeFormSection';

export default function EmployeeRegisterFormDialog({
  open,
  mode,
  initialData,
  saving,
  onClose,
  onSubmit,
  onHelp,
}) {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    if (open) setData(initialData);
  }, [open, initialData]);

  const accountBalanceLabel = useMemo(() => {
    if (mode === 'edit') {
      const live = parseFloat(data.ledger_balance ?? data.account_balance);
      if (data.ledger_balance != null && !Number.isNaN(live)) return fmtAmt(live);
    }
    const start = parseFloat(data.opening_balance);
    if (data.opening_balance !== '' && !Number.isNaN(start)) return fmtAmt(start);
    return '—';
  }, [mode, data.ledger_balance, data.account_balance, data.opening_balance]);

  const updateForm = (key, value) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  const fieldSx = { ...FIELD_SX, width: '100%' };

  return (
    <Dialog
      open={open}
      onClose={() => !saving && onClose()}
      maxWidth="md"
      fullWidth
      scroll="paper"
      PaperProps={{
        sx: {
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 28px 56px rgba(15, 23, 42, 0.16)',
          maxHeight: '94vh',
        },
      }}
    >
      <Box
        sx={{
          ...DIALOG_HEADER_SX,
          background: 'linear-gradient(135deg, #1A55E3 0%, #0f3d9e 100%)',
        }}
      >
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
          <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ flex: 1, minWidth: 0 }}>
            <IconButton
              size="small"
              aria-label="Form help"
              sx={{
                mt: 0.25,
                color: '#fff',
                bgcolor: 'rgba(255,255,255,0.12)',
                border: '1px solid rgba(255,255,255,0.22)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              }}
              onClick={onHelp}
            >
              <HelpOutline sx={{ fontSize: 20 }} />
            </IconButton>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: '1.2rem', lineHeight: 1.25 }}>
                {mode === 'add' ? 'Register New Employee' : 'Edit Employee Profile'}
              </Typography>
              <Typography sx={{ fontSize: '0.8125rem', opacity: 0.92, mt: 0.5, lineHeight: 1.45 }}>
                {mode === 'add'
                  ? 'Create the employee account, starting account balance, and payroll settings in one place'
                  : 'Update profile, salary, and starting balance (syncs to Employee Ledger)'}
              </Typography>
            </Box>
          </Stack>
          <IconButton
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
            sx={{
              color: '#fff',
              bgcolor: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.22)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' },
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </Stack>
      </Box>

      <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 3, bgcolor: '#f8fafc' }}>
        <Stack spacing={2.5}>
          <EmployeeFormSection
            icon={Person}
            title="Personal information"
            subtitle="Identity and contact details"
            accent="#1A55E3"
          >
            <Box sx={FORM_FIELDS_ROW_SX}>
              <TextField
                fullWidth
                required
                label="Full name"
                placeholder="e.g. Muhammad Ali Khan"
                value={data.emp_name}
                onChange={(e) => updateForm('emp_name', e.target.value)}
                sx={fieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person sx={{ fontSize: 20, color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label="CNIC"
                placeholder="35202-1234567-1"
                value={data.emp_cnic}
                onChange={(e) => updateForm('emp_cnic', e.target.value)}
                sx={fieldSx}
                helperText="Optional; must be unique if provided"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Badge sx={{ fontSize: 20, color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label="Phone number"
                placeholder="03XX-XXXXXXX"
                value={data.emp_phone}
                onChange={(e) => updateForm('emp_phone', e.target.value)}
                sx={fieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Phone sx={{ fontSize: 20, color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label="Home address"
                placeholder="Street, area, city"
                value={data.emp_address}
                onChange={(e) => updateForm('emp_address', e.target.value)}
                multiline
                minRows={2}
                maxRows={4}
                sx={fieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ alignSelf: 'flex-start', mt: 1.25 }}>
                      <Home sx={{ fontSize: 20, color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </EmployeeFormSection>

          <EmployeeFormSection
            icon={Work}
            title="Job details"
            subtitle="Role, department, and employment status"
            accent="#6366f1"
          >
            <Box sx={FORM_FIELDS_ROW_SX}>
              <TextField
                fullWidth
                label="Designation"
                placeholder="e.g. Salesman, Driver, Accountant"
                value={data.designation}
                onChange={(e) => updateForm('designation', e.target.value)}
                sx={fieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Work sx={{ fontSize: 20, color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label="Department"
                placeholder="e.g. Sales, Warehouse, Admin"
                value={data.department}
                onChange={(e) => updateForm('department', e.target.value)}
                sx={fieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Business sx={{ fontSize: 20, color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label="Join date"
                type="date"
                value={data.join_date}
                onChange={(e) => updateForm('join_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
                inputProps={{ lang: 'en-GB' }}
                sx={fieldSx}
                helperText="Pro-rating in join month"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarToday sx={{ fontSize: 18, color: '#94a3b8' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <FormControl fullWidth sx={fieldSx}>
                <InputLabel>Employment status</InputLabel>
                <Select
                  label="Employment status"
                  value={data.status}
                  onChange={(e) => updateForm('status', e.target.value)}
                  renderValue={(v) => (
                    v === 'ACTIVE' ? (
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        <CheckCircle sx={{ fontSize: 18, color: '#059669', flexShrink: 0 }} />
                        <Typography component="span" noWrap sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                          Active
                        </Typography>
                      </Stack>
                    ) : (
                      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                        <Block sx={{ fontSize: 18, color: '#94a3b8', flexShrink: 0 }} />
                        <Typography component="span" noWrap sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                          Inactive
                        </Typography>
                      </Stack>
                    )
                  )}
                >
                  <MenuItem value="ACTIVE">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <CheckCircle sx={{ fontSize: 18, color: '#059669' }} />
                      <span>Active — included in payroll</span>
                    </Stack>
                  </MenuItem>
                  <MenuItem value="INACTIVE">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Block sx={{ fontSize: 18, color: '#94a3b8' }} />
                      <span>Inactive — excluded from payroll</span>
                    </Stack>
                  </MenuItem>
                </Select>
              </FormControl>
            </Box>
          </EmployeeFormSection>

          <EmployeeFormSection
            icon={AccountBalanceWallet}
            title="Employee account & salary"
            subtitle="Two fields per row — starting balance syncs to Employee Ledger on save"
            accent="#059669"
          >
            <Box sx={FORM_FIELDS_ROW_SX}>
              <TextField
                fullWidth
                label="Basic salary (monthly)"
                type="number"
                placeholder="0"
                value={data.basic_salary}
                onChange={(e) => updateForm('basic_salary', e.target.value)}
                sx={fieldSx}
                helperText="Leave / absent rules apply at payroll"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Typography sx={{ fontWeight: 800, color: '#64748b', fontSize: '0.8125rem' }}>Rs</Typography>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label="Starting account balance"
                type="number"
                inputProps={{ step: '0.01' }}
                value={data.opening_balance}
                onChange={(e) => updateForm('opening_balance', e.target.value)}
                sx={fieldSx}
                helperText="+ employee owes · − you owe · OPENING row on save"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoney sx={{ fontSize: 20, color: '#059669' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                fullWidth
                label="Account balance"
                value={accountBalanceLabel}
                sx={{
                  ...fieldSx,
                  '& .MuiInputBase-input': {
                    fontWeight: 800,
                    fontFamily: 'ui-monospace, monospace',
                    color: '#1e3a8a',
                  },
                }}
                helperText={
                  mode === 'edit'
                    ? 'Live ledger total (advances, salary, receipts)'
                    : 'After register, same as starting until ledger activity'
                }
                InputProps={{
                  readOnly: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <AccountBalanceWallet sx={{ fontSize: 20, color: '#1A55E3' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
          </EmployeeFormSection>

          <EmployeeFormSection
            icon={EventAvailable}
            title="Leave & absent allowance"
            subtitle="Monthly limits before salary deduction"
            accent="#d97706"
          >
            <Box sx={FORM_FIELDS_ROW_SX}>
              <TextField
                fullWidth
                label="Allowed leaves per month"
                type="number"
                inputProps={{ min: 0, step: 1 }}
                value={data.allowed_leaves_per_month}
                onChange={(e) => updateForm('allowed_leaves_per_month', e.target.value)}
                sx={fieldSx}
                helperText="Approved leave (L) days with no deduction"
              />
              <TextField
                fullWidth
                label="Allowed absents per month"
                type="number"
                inputProps={{ min: 0, step: 1 }}
                value={data.allowed_absents_per_month}
                onChange={(e) => updateForm('allowed_absents_per_month', e.target.value)}
                sx={fieldSx}
                helperText="Absent (A) or unmarked days with no deduction"
              />
            </Box>
          </EmployeeFormSection>
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          bgcolor: '#fff',
          borderTop: '1px solid #e2e8f0',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Typography sx={{ fontSize: '0.8125rem', color: '#64748b' }}>
          <Box component="span" sx={{ color: '#dc2626', fontWeight: 700 }}>*</Box>
          {' '}
          Full name is required
        </Typography>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Button
            onClick={onClose}
            disabled={saving}
            sx={{ textTransform: 'none', color: '#475569', fontWeight: 600, px: 2 }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => onSubmit(data)}
            disabled={saving || !data.emp_name.trim()}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              px: 2.75,
              py: 1.1,
              borderRadius: '12px',
              bgcolor: '#1A55E3',
              boxShadow: '0 4px 14px rgba(26, 85, 227, 0.35)',
              '&:hover': { bgcolor: '#1347c4' },
              '&.Mui-disabled': { bgcolor: '#94a3b8', color: '#fff' },
            }}
          >
            {mode === 'add' ? 'Save employee' : 'Update employee'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
