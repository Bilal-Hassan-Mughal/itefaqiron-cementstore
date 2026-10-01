'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Box, Typography, Button, TextField, Grid,
  IconButton, Dialog, DialogContent, DialogActions,
  InputAdornment, MenuItem,
  FormControl, InputLabel, Select, Stack, CircularProgress,
} from '@mui/material';
import {
  Person, Work, AttachMoney, Phone, Badge,
  Home, Business, CalendarToday, Close, Save, CheckCircle, EventAvailable,
  HelpOutline, Block,
} from '@mui/icons-material';
import {
  DIALOG_HEADER_SX, FIELD_SX, SECTION_SX, fmtAmt,
} from './employeeRegisterShared';

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

  const salaryPreviewLabel = useMemo(() => {
    const salary = parseFloat(data.basic_salary || 0);
    return salary > 0 ? fmtAmt(salary) : '—';
  }, [data.basic_salary]);

  const updateForm = (key, value) => {
    setData((d) => ({ ...d, [key]: value }));
  };

  return (
      <Dialog
        open={open}
        onClose={() => !saving && onClose()}
        maxWidth="sm"
        fullWidth
        scroll="paper"
        PaperProps={{
          sx: {
            borderRadius: '16px',
            overflow: 'hidden',
            boxShadow: '0 24px 48px rgba(15, 23, 42, 0.18)',
            maxHeight: '92vh',
          },
        }}
      >
        <Box sx={DIALOG_HEADER_SX}>
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
                <Typography sx={{ fontWeight: 800, fontSize: '1.125rem', lineHeight: 1.25 }}>
                  {mode === 'add' ? 'Register New Employee' : 'Edit Employee Profile'}
                </Typography>
                <Typography sx={{ fontSize: '0.8125rem', opacity: 0.92, mt: 0.5, lineHeight: 1.45 }}>
                  {mode === 'add'
                    ? 'Add staff details for attendance and payroll processing'
                    : 'Update employee information, salary and ledger opening'}
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

        <DialogContent sx={{ px: 2.5, py: 2.5, bgcolor: '#f1f5f9' }}>
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
                    value={data.emp_name}
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
                    value={data.emp_cnic}
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
                    value={data.emp_phone}
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
                    value={data.emp_address}
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
                    value={data.designation}
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
                    value={data.department}
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
                    value={data.join_date}
                    onChange={(e) => updateForm('join_date', e.target.value)}
                    InputLabelProps={{ shrink: true }} inputProps={{ lang: 'en-GB' }}
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
                      value={data.status}
                      onChange={(e) => updateForm('status', e.target.value)}
                      renderValue={(v) => (
                        v === 'ACTIVE' ? (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <CheckCircle sx={{ fontSize: 18, color: '#059669' }} />
                            <Typography component="span" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                              Active — included in payroll
                            </Typography>
                          </Stack>
                        ) : (
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Block sx={{ fontSize: 18, color: '#94a3b8' }} />
                            <Typography component="span" sx={{ fontSize: '0.875rem', fontWeight: 600 }}>
                              Inactive — excluded from payroll
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
                </Grid>
              </Grid>
            </Box>

            <Box sx={SECTION_SX}>
              <SectionHeader icon={AttachMoney} title="Salary & ledger" subtitle="Monthly basic pay and pre-system balance" />
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} sm={7}>
                  <TextField
                    fullWidth
                    label="Basic Salary (Monthly)"
                    type="number"
                    placeholder="0"
                    value={data.basic_salary}
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
                      bgcolor: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      textAlign: 'center',
                    }}
                  >
                    <Typography sx={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>Monthly Basic</Typography>
                    <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: '#1A55E3', fontFamily: 'monospace' }}>
                      {salaryPreviewLabel}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Opening Balance (pre-system)"
                    type="number"
                    inputProps={{ step: '0.01' }}
                    value={data.opening_balance}
                    onChange={(e) => updateForm('opening_balance', e.target.value)}
                    sx={FIELD_SX}
                    helperText="+ = employee owes (pre-system advances). − = you owe them. Current total balance = opening + advances (see Employee Ledger)."
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <AttachMoney sx={{ fontSize: 20, color: '#16a34a' }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            <Box sx={SECTION_SX}>
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
                    value={data.allowed_leaves_per_month}
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
                    value={data.allowed_absents_per_month}
                    onChange={(e) => updateForm('allowed_absents_per_month', e.target.value)}
                    sx={FIELD_SX}
                    helperText="Absent (A) or unmarked days with no deduction"
                  />
                </Grid>
              </Grid>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            px: 2.5,
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
                py: 1,
                borderRadius: '10px',
                bgcolor: '#1A55E3',
                boxShadow: '0 2px 8px rgba(26, 85, 227, 0.35)',
                '&:hover': { bgcolor: '#1347c4' },
                '&.Mui-disabled': { bgcolor: '#94a3b8', color: '#fff' },
              }}
            >
              {mode === 'add' ? 'Save Employee' : 'Update Employee'}
            </Button>
          </Stack>
        </DialogActions>
      </Dialog>
  );
}
