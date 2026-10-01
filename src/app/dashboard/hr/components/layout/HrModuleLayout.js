'use client';

import { Box } from '@mui/material';

/**
 * Consistent inner padding for HR module tabs (hub header lives on hr/page.js).
 */
export default function HrModuleLayout({ children, dense = false }) {
  return (
    <Box
      sx={{
        px: { xs: 0, sm: dense ? 0 : 0.5 },
        pb: 3,
        minHeight: 200,
      }}
    >
      {children}
    </Box>
  );
}
