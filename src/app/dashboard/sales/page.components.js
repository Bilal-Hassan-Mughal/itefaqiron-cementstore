'use client';

import { lazy, Suspense } from 'react';
import { Box, Container, CircularProgress } from '@mui/material';
import DashboardLayout from '@/app/dashboard/components/dashboard-layout';

const SalesPageContent = lazy(() => import('./components/SalesPageContent'));

function SalePageFallback() {
  return (
    <DashboardLayout>
      <Container maxWidth={false} sx={{ py: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    </DashboardLayout>
  );
}

export default function SalesPage() {
  return (
    <Suspense fallback={<SalePageFallback />}>
      <SalesPageContent />
    </Suspense>
  );
}