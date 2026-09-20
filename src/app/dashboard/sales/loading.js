'use client';

import DashboardLayout from '../components/dashboard-layout';
import { Box, CircularProgress, Container, Typography } from '@mui/material';

export default function SalesLoading() {
  return (
    <DashboardLayout>
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Box
          sx={{
            minHeight: 360,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
          }}
        >
          <CircularProgress size={48} />
          <Typography sx={{ fontWeight: 700, color: '#64748b' }}>Opening sales…</Typography>
        </Box>
      </Container>
    </DashboardLayout>
  );
}
