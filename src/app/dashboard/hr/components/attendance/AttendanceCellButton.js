'use client';

import { Box, Typography } from '@mui/material';
import { KeyboardArrowDown } from '@mui/icons-material';
import { PRIMARY } from './attendanceSheetShared';

export default function AttendanceCellButton({
  meta, edited, clickable, isTodayCol, isPastCol, onClick,
}) {
  const isEmptyCell = clickable && (meta.label === '-' || meta.label === '—');
  return (
    <Box
      component={clickable ? 'button' : 'span'}
      type={clickable ? 'button' : undefined}
      onClick={clickable ? (e) => { e.stopPropagation(); onClick?.(e); } : undefined}
      sx={{
        width: 42,
        height: 34,
        mx: 'auto',
        borderRadius: '8px',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        p: 0,
        bgcolor: isEmptyCell ? '#fff' : meta.bg,
        color: meta.color,
        border: edited
          ? `2px solid ${PRIMARY}`
          : isEmptyCell
            ? meta.beforeJoin
              ? '1px dashed #cbd5e1'
              : isPastCol
                ? '1px dashed #94a3b8'
                : '1px dashed #64748b'
            : '1px solid transparent',
        transition: 'all 0.18s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: clickable ? 'pointer' : 'default',
        font: 'inherit',
        outline: 'none',
        pointerEvents: clickable ? 'auto' : 'none',
        position: 'relative',
        zIndex: 1,
        ...(clickable && {
          '&:hover': {
            borderColor: isTodayCol ? PRIMARY : '#94a3b8',
            transform: 'scale(1.06)',
            boxShadow: '0 4px 12px rgba(15,23,42,0.12)',
          },
          '&:active': { transform: 'scale(0.98)' },
        }),
      }}
    >
      <Typography component="span" sx={{ fontSize: '0.78rem', fontWeight: 800, lineHeight: 1 }}>
        {meta.label}
      </Typography>
      {clickable && (
        <KeyboardArrowDown sx={{ fontSize: 13, opacity: 0.35, mt: -0.1 }} />
      )}
    </Box>
  );
}
