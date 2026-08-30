'use client';

import { Box, Typography } from '@mui/material';

export default function HqPageHeader({ title, subtitle, icon: Icon, action }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 2,
        mb: 3,
      }}
    >
      <Box>
        <Typography
          variant="h4"
          fontWeight={800}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5, color: '#0f172a' }}
        >
          {Icon && <Icon size={30} color="#4338ca" />}
          {title}
        </Typography>
        {subtitle && (
          <Typography color="text.secondary" sx={{ maxWidth: 640, lineHeight: 1.55 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action && <Box>{action}</Box>}
    </Box>
  );
}
