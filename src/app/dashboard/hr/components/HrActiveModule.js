'use client';

import dynamic from 'next/dynamic';
import { Box, CircularProgress } from '@mui/material';
import { BRAND } from '@/lib/brand-theme';

const tabLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
    <CircularProgress size={32} sx={{ color: BRAND.primary.blue }} />
  </Box>
);

const lazy = (loader) => dynamic(loader, { loading: tabLoader, ssr: false });

const EmployeesTab = lazy(() => import('./EmployeesTab'));
const AttendanceTab = lazy(() => import('./AttendanceTab'));
const SalaryTab = lazy(() => import('./SalaryTab'));
const SalaryAdvanceTab = lazy(() => import('./SalaryAdvanceTab'));
const EmployeeLedgerTab = lazy(() => import('./EmployeeLedgerTab'));
const EmployeeReceiveTab = lazy(() => import('./EmployeeReceiveTab'));

/**
 * Loads only the active HR module chunk (code-split per tab).
 */
export default function HrActiveModule({ moduleId, backToHub }) {
  switch (moduleId) {
    case 'employees':
      return <EmployeesTab />;
    case 'attendance':
      return <AttendanceTab />;
    case 'salary-sheet':
      return <SalaryTab view="sheet" />;
    case 'salary-clearance':
      return <SalaryTab view="clearance" />;
    case 'salary-advance':
      return <SalaryAdvanceTab />;
    case 'employee-ledger':
      return <EmployeeLedgerTab onBackToHub={backToHub} />;
    case 'employee-receive':
      return <EmployeeReceiveTab />;
    case 'salary-receipt':
      return <SalaryTab view="receipt" />;
    default:
      return null;
  }
}
