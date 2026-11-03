'use client';

import { Box, Typography, Skeleton } from '@mui/material';
import { HR_CARD_SX } from './hrUiShared';

export default function HrStatCard({
  label,
  value,
  color = '#1A55E3',
  loading = false,
  icon: Icon,
  compact = false,
  embedded = false,
}) {
  const shellSx = embedded
    ? { minWidth: 0, p: compact ? { xs: 1.25, md: 1.5 } : 2, borderRadius: 0, border: 'none', boxShadow: 'none', bgcolor: 'transparent' }
    : { ...HR_CARD_SX, p: compact ? 1.35 : 2, minWidth: 0 };

  return (
    <Box sx={shellSx}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Typography
          sx={{
            fontSize: compact ? '0.62rem' : '0.72rem',
            color: '#64748b',
            fontWeight: 700,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            lineHeight: 1.3,
          }}
        >
          {label}
        </Typography>
        {Icon && (
          <Box
            sx={{
              width: compact ? 26 : 32,
              height: compact ? 26 : 32,
              borderRadius: compact ? '8px' : '10px',
              bgcolor: `${color}14`,
              color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon sx={{ fontSize: compact ? 15 : 18 }} />
          </Box>
        )}
      </Box>
      {loading ? (
        <Skeleton width={72} height={compact ? 26 : 36} sx={{ mt: 0.75 }} />
      ) : (
        <Typography
          sx={{
            fontSize: compact ? '1.05rem' : '1.35rem',
            fontWeight: 900,
            color,
            mt: compact ? 0.5 : 0.75,
            lineHeight: 1.2,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {value}
        </Typography>
      )}
    </Box>
  );
}
