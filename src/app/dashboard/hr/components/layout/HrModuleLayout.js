'use client';

import { Box } from '@mui/material';

/**
 * Consistent inner padding for HR module tabs (hub header lives on hr/page.js).
 */
export default function HrModuleLayout({ children, dense = false, fillViewport = false }) {
  return (
    <Box
      sx={{
        px: { xs: 0, sm: dense ? 0 : 0.5 },
        pb: dense || fillViewport ? 0 : 3,
        minHeight: fillViewport ? 0 : 200,
        ...(fillViewport && {
          flex: 1,
          minHeight: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }),
      }}
    >
      {children}
    </Box>
  );
}
