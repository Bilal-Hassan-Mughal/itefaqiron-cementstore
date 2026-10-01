'use client';

import { Box, Typography, MenuItem, Popover, Divider } from '@mui/material';
import { Check } from '@mui/icons-material';
import {
  MONTHS_FULL, PRIMARY, NAVY, CELL_STATUS_OPTIONS, CLEAR_SENTINEL,
} from './attendanceSheetShared';

export default function AttendanceStatusPicker({
  open,
  anchorEl,
  onClose,
  statusPicker,
  month,
  year,
  pickerSelectedValue,
  isOffDay,
  isBeforeJoinDay,
  onChoose,
}) {
  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      transformOrigin={{ vertical: 'top', horizontal: 'center' }}
      slotProps={{
        paper: {
          sx: {
            borderRadius: '14px',
            border: '1px solid #e8edf4',
            boxShadow: '0 16px 48px rgba(15,23,42,0.14)',
            minWidth: 210,
            overflow: 'hidden',
            zIndex: 1400,
          },
        },
      }}
      sx={{ zIndex: 1400 }}
    >
      {statusPicker && (
        <Box>
          <Box sx={{ px: 2, py: 1.25, bgcolor: '#f8fafc', borderBottom: '1px solid #eef2f6' }}>
            <Typography sx={{ fontWeight: 800, fontSize: '0.8125rem', color: NAVY }}>
              {statusPicker.empName}
            </Typography>
            <Typography sx={{ fontSize: '0.72rem', color: '#64748b' }}>
              {MONTHS_FULL[month - 1]} {statusPicker.day}, {year}
              {isOffDay ? ' · Off day' : ''}
              {isBeforeJoinDay ? ' · Before join (salary ignores)' : ''}
            </Typography>
          </Box>
          {CELL_STATUS_OPTIONS.map((opt) => {
            const selected = opt.value === pickerSelectedValue;
            return (
              <MenuItem
                key={opt.value}
                onClick={() => onChoose(opt.value)}
                sx={{
                  py: 1.1,
                  px: 2,
                  gap: 1.25,
                  fontWeight: selected ? 800 : 500,
                  fontSize: '0.8125rem',
                  bgcolor: selected ? '#eef4ff' : 'transparent',
                  transition: 'background-color 0.12s ease',
                  '&:hover': { bgcolor: selected ? '#eef4ff' : '#f8fafc' },
                }}
              >
                <Box sx={{
                  width: 30, height: 26, borderRadius: '7px', bgcolor: opt.bg, color: opt.color,
                  fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: opt.value === CLEAR_SENTINEL ? '1px solid #e2e8f0' : 'none',
                }}>
                  {opt.label}
                </Box>
                <Typography sx={{ flex: 1, fontSize: '0.8125rem' }}>{opt.full}</Typography>
                {selected && <Check sx={{ fontSize: 18, color: PRIMARY }} />}
              </MenuItem>
            );
          })}
          {isOffDay && (
            <>
              <Divider />
              <Box sx={{ px: 2, py: 1, bgcolor: '#fffbeb' }}>
                <Typography sx={{ fontSize: '0.72rem', color: '#92400e' }}>
                  Off day — select <strong>Present</strong> if employee worked
                </Typography>
              </Box>
            </>
          )}
        </Box>
      )}
    </Popover>
  );
}
