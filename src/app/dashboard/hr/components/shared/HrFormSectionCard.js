'use client';

import { Box, Typography, Stack } from '@mui/material';
import { HR_CARD_SX } from './hrUiShared';

/**
 * Full-width form block for HR money flows (advance, receive, clearance).
 */
export default function HrFormSectionCard({ title, subtitle, accent = '#1A55E3', children, maxWidth = 560 }) {
  return (
    <Box
      sx={{
        ...HR_CARD_SX,
        maxWidth,
        width: '100%',
        mx: 'auto',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 2,
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}dd 100%)`,
        }}
      >
        <Typography sx={{ fontWeight: 900, color: '#fff', fontSize: '1.05rem' }}>{title}</Typography>
        {subtitle && (
          <Typography sx={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.88)', mt: 0.35 }}>{subtitle}</Typography>
        )}
      </Box>
      <Stack spacing={2} sx={{ p: 2.5 }}>
        {children}
      </Stack>
    </Box>
  );
}
