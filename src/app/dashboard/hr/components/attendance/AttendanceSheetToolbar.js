'use client';

import {
  Box, Typography, Button, Stack, IconButton, FormControl, Select, MenuItem, Chip, LinearProgress,
} from '@mui/material';
import {
  Save, ChevronLeft, ChevronRight, Print, Today as TodayIcon,
} from '@mui/icons-material';
import {
  MONTHS_FULL, PRIMARY, NAVY, ACCENT_GREEN, STATUS_OPTIONS,
} from './attendanceSheetShared';

export default function AttendanceSheetToolbar({
  month,
  year,
  dayCount,
  workerCount,
  designationFilter,
  designations,
  allEmployeeCount,
  allEmployees,
  isCurrentMonth,
  editCount,
  saving,
  refreshing,
  onShiftMonth,
  onGoToday,
  onDesignationChange,
  onMarkAllPresentToday,
  onPrint,
  onSave,
}) {
  return (
    <Box sx={{ position: 'relative' }}>
      {refreshing && (
        <LinearProgress
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 2,
            zIndex: 2,
            '& .MuiLinearProgress-bar': { bgcolor: PRIMARY },
          }}
        />
      )}
      <Box sx={{ px: { xs: 2, md: 2.5 }, py: 2, borderBottom: '1px solid #eef2f6', bgcolor: '#fafbfd' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ lg: 'center' }} justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <IconButton
              onClick={() => onShiftMonth(-1)}
              size="small"
              sx={{ border: '1px solid #e2e8f0', borderRadius: '10px', bgcolor: '#fff', width: 36, height: 36, '&:hover': { bgcolor: '#f1f5f9' } }}
            >
              <ChevronLeft fontSize="small" />
            </IconButton>
            <Box sx={{ minWidth: 150, textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 900, fontSize: '1.05rem', color: NAVY, lineHeight: 1.2 }}>
                {MONTHS_FULL[month - 1]} {year}
              </Typography>
              <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', mt: 0.25 }}>
                {dayCount} days · {workerCount} worker(s)
              </Typography>
            </Box>
            <IconButton
              onClick={() => onShiftMonth(1)}
              size="small"
              sx={{ border: '1px solid #e2e8f0', borderRadius: '10px', bgcolor: '#fff', width: 36, height: 36, '&:hover': { bgcolor: '#f1f5f9' } }}
            >
              <ChevronRight fontSize="small" />
            </IconButton>
            <Button
              size="small"
              variant="outlined"
              startIcon={<TodayIcon sx={{ fontSize: 16 }} />}
              onClick={onGoToday}
              sx={{
                ml: 0.5,
                textTransform: 'none',
                fontWeight: 700,
                borderRadius: '10px',
                borderColor: PRIMARY,
                color: PRIMARY,
                height: 36,
                '&:hover': { bgcolor: '#eef4ff' },
              }}
            >
              Today
            </Button>
          </Stack>

          <Stack direction="row" spacing={1.25} alignItems="center" flexWrap="wrap" useFlexGap>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <Select
                value={designationFilter}
                onChange={(e) => onDesignationChange(e.target.value)}
                displayEmpty
                sx={{
                  borderRadius: '10px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  bgcolor: '#fff',
                  height: 38,
                  '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
                }}
              >
                <MenuItem value="ALL">All designations ({allEmployeeCount})</MenuItem>
                {designations.filter((d) => d !== 'ALL').map((d) => (
                  <MenuItem key={d} value={d}>
                    {d} ({allEmployees.filter((e) => (e.designation || 'Unassigned') === d).length})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {isCurrentMonth && (
              <Button
                size="small"
                variant="outlined"
                onClick={onMarkAllPresentToday}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  borderRadius: '10px',
                  borderColor: ACCENT_GREEN,
                  color: ACCENT_GREEN,
                  height: 38,
                  whiteSpace: 'nowrap',
                  '&:hover': { bgcolor: '#ecfdf5', borderColor: ACCENT_GREEN },
                }}
              >
                All Present Today
              </Button>
            )}

            <Button
              size="small"
              variant="outlined"
              startIcon={<Print sx={{ fontSize: 17 }} />}
              onClick={onPrint}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '10px', borderColor: '#e2e8f0', color: '#475569', height: 38 }}
            >
              Print
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={<Save sx={{ fontSize: 17 }} />}
              onClick={onSave}
              disabled={saving || editCount === 0}
              sx={{
                bgcolor: PRIMARY,
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: '10px',
                height: 38,
                boxShadow: editCount > 0 ? '0 4px 12px rgba(26,85,227,0.3)' : 'none',
                '&:disabled': { bgcolor: '#e2e8f0', color: '#94a3b8' },
              }}
            >
              {saving ? 'Saving...' : editCount > 0 ? `Save (${editCount})` : 'Save'}
            </Button>
          </Stack>
        </Stack>

        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.75, pt: 1.5, borderTop: '1px dashed #e8edf4' }}>
          <Typography sx={{ fontSize: '0.78rem', color: '#64748b', mr: 1 }}>
            Click any past day or today to edit · Click date header for branch <strong>Off day</strong> (paid, no deduction) · Save after changes
          </Typography>
          {[...STATUS_OPTIONS.slice(0, 4), { label: '-', full: 'Unmarked', color: '#94a3b8', bg: '#f8fafc' }].map((s) => (
            <Chip
              key={s.label + s.full}
              label={`${s.label} ${s.full}`}
              size="small"
              sx={{
                height: 24,
                fontSize: '0.68rem',
                fontWeight: 700,
                bgcolor: s.bg,
                color: s.color,
                border: s.label === '-' ? '1px solid #e2e8f0' : 'none',
                '& .MuiChip-label': { px: 1 },
              }}
            />
          ))}
        </Stack>
      </Box>
    </Box>
  );
}
