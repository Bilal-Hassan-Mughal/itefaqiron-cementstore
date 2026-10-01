'use client';

import { Box } from '@mui/material';
import { FIELD_SX } from './employeeRegisterShared';

/**
 * Full-width field slot — one control per row, equal width.
 */
export default function EmployeeFormField({ children }) {
  return (
    <Box sx={{ width: '100%' }}>
      {typeof children === 'function'
        ? children({ sx: { ...FIELD_SX, width: '100%' } })
        : children}
    </Box>
  );
}

export { FIELD_SX };
