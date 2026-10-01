'use client';

import { Box, Stack, Typography } from '@mui/material';

/**
 * Card section for employee register / profile forms.
 */
export default function EmployeeFormSection({ icon: Icon, title, subtitle, accent = '#1A55E3', children }) {
  return (
    <Box
      sx={{
        p: { xs: 2, sm: 2.5 },
        borderRadius: '16px',
        border: '1px solid #e2e8f0',
        bgcolor: '#ffffff',
        boxShadow: '0 1px 3px rgba(15, 23, 42, 0.05)',
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ mb: 2 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            flexShrink: 0,
            bgcolor: `${accent}14`,
            color: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sx={{ fontSize: 22 }} />
        </Box>
        <Box sx={{ minWidth: 0, pt: 0.25 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '0.9375rem', color: '#0f172a', lineHeight: 1.25 }}>
            {title}
          </Typography>
          {subtitle && (
            <Typography sx={{ fontSize: '0.75rem', color: '#64748b', mt: 0.35, lineHeight: 1.45 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Stack>
      <Stack spacing={2}>{children}</Stack>
    </Box>
  );
}
