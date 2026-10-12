'use client';

import { lazy, Suspense } from 'react';
import { Box, Container, CircularProgress } from '@mui/material';
import DashboardLayout from '@/app/dashboard/components/dashboard-layout';

const SalesPageContent = lazy(() => import('@/app/dashboard/sales/components/SalesPageContent'));

function SalePageFallback() {
  return (
    <DashboardLayout>
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Container>
    </DashboardLayout>
  );
}

export default function SalesV2Page() {
  return (
    <Suspense fallback={<SalePageFallback />}>
      <SalesPageContent />
    </Suspense>
  );
}
