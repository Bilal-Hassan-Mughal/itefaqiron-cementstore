'use client';

import { Box, Typography, Skeleton } from '@mui/material';
import { HR_CARD_SX } from './hrUiShared';

export default function HrStatCard({ label, value, color = '#1A55E3', loading = false, icon: Icon }) {
  return (
    <Box sx={{ ...HR_CARD_SX, p: 2, minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
        <Typography sx={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </Typography>
        {Icon && (
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: '10px',
              bgcolor: `${color}18`,
              color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon sx={{ fontSize: 18 }} />
          </Box>
        )}
      </Box>
      {loading ? (
        <Skeleton width={72} height={36} sx={{ mt: 1 }} />
      ) : (
        <Typography sx={{ fontSize: '1.35rem', fontWeight: 900, color, mt: 0.75, lineHeight: 1.2, fontFamily: 'ui-monospace, monospace' }}>
          {value}
        </Typography>
      )}
    </Box>
  );
}
