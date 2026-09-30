'use client';

import dynamic from 'next/dynamic';
import { Suspense, useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Box,
  Typography,
  CircularProgress,
  Card,
  CardContent,
  Stack,
  IconButton,
  Button,
} from '@mui/material';
import {
  Badge as BadgeIcon,
  EventNote as EventNoteIcon,
  TableChart as TableChartIcon,
  Payments as PaymentsIcon,
  AccountBalanceWallet,
  Receipt as ReceiptIcon,
  ArrowForward,
  ChevronRight,
  ArrowBack,
  Groups,
  Schedule,
} from '@mui/icons-material';
import DashboardLayout from '../components/dashboard-layout';
import { BRAND, COMPANY } from '@/lib/brand-theme';
import { HrRefreshProvider, useHrRefresh, useHrRefreshVersion, HR_KEYS } from './context/HrRefreshContext';

const hrTabLoader = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
    <CircularProgress size={32} sx={{ color: BRAND.primary.blue }} />
  </Box>
);

const EmployeesTab = dynamic(() => import('./components/EmployeesTab'), { loading: hrTabLoader });
const AttendanceTab = dynamic(() => import('./components/AttendanceTab'), { loading: hrTabLoader });
const SalaryTab = dynamic(() => import('./components/SalaryTab'), { loading: hrTabLoader });
const SalaryAdvanceTab = dynamic(() => import('./components/SalaryAdvanceTab'), { loading: hrTabLoader });
const EmployeeLedgerTab = dynamic(() => import('./components/EmployeeLedgerTab'), { loading: hrTabLoader });
const EmployeeReceiveTab = dynamic(() => import('./components/EmployeeReceiveTab'), { loading: hrTabLoader });

const LEGACY_TAB_MAP = {
  employees: 'employees',
  attendance: 'attendance',
  salary: 'salary-sheet',
  payroll: 'salary-sheet',
  'salary-management': 'salary-sheet',
};

const HR_MODULES = [
  {
    id: 'employees',
    title: 'Employee Register',
    description: 'Add and manage employee profiles, contact details, and contract salary.',
    icon: BadgeIcon,
    accent: '#1A55E3',
    tint: '#e8effd',
  },
  {
    id: 'attendance',
    title: 'Attendance Sheet',
    description: 'Mark daily present, leave, absent, and half-day attendance.',
    icon: EventNoteIcon,
    accent: '#00a868',
    tint: '#dcfce7',
  },
  {
    id: 'salary-sheet',
    title: 'Salary Sheet',
    description: 'Review monthly salary breakdown for all employees.',
    icon: TableChartIcon,
    accent: '#f59e0b',
    tint: '#fef3c7',
  },
  {
    id: 'salary-clearance',
    title: 'Salary Clearance',
    description: 'Process final payments and recover outstanding advances.',
    icon: PaymentsIcon,
    accent: '#7c3aed',
    tint: '#ede9fe',
  },
  {
    id: 'salary-advance',
    title: 'Salary Advance',
    description: 'Record mid-month advances and track employee balances.',
    icon: AccountBalanceWallet,
    accent: '#FF0854',
    tint: '#ffe8f0',
  },
  {
    id: 'employee-ledger',
    title: 'Employee Ledger',
    description: 'Opening balances, advances, receipts, and salary deductions.',
    icon: AccountBalanceWallet,
    accent: '#0d9488',
    tint: '#ccfbf1',
  },
  {
    id: 'employee-receive',
    title: 'Receive Payment',
    description: 'Record cash/bank received from employees with printable PDF receipts.',
    icon: PaymentsIcon,
    accent: '#059669',
    tint: '#d1fae5',
  },
  {
    id: 'salary-receipt',
    title: 'Salary Receipt',
    description: 'Print official monthly salary invoice for any employee.',
    icon: ReceiptIcon,
    accent: '#334155',
    tint: '#f1f5f9',
  },
];

const fmtAmt = (v) => {
  const n = parseFloat(v || 0);
  return `Rs ${n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
};

function StatCard({ label, sublabel, value, icon: Icon, accent, tint }) {
  return (
    <Card
      elevation={0}
      sx={{
        borderRadius: '16px',
        border: '1px solid #e8edf4',
        bgcolor: '#ffffff',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
        height: '100%',
      }}
    >
      <CardContent sx={{ p: 2.25, '&:last-child': { pb: 2.25 }, position: 'relative' }}>
        <Box
          sx={{
            position: 'absolute',
            top: 16,
            right: 16,
            width: 44,
            height: 44,
            borderRadius: '12px',
            bgcolor: tint,
            color: accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sx={{ fontSize: 24 }} />
        </Box>
        <Typography
          sx={{
            fontSize: '0.65rem',
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: '#94a3b8',
            textTransform: 'uppercase',
            pr: 6,
          }}
        >
          {label}
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: '#64748b', mt: 0.35 }}>{sublabel}</Typography>
        <Typography sx={{ fontSize: '1.65rem', fontWeight: 900, color: '#0f172a', mt: 1, lineHeight: 1.1 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

function ModuleNavCard({ module, badge, onClick }) {
  const Icon = module.icon;

  return (
    <Card
      onClick={onClick}
      elevation={0}
      sx={{
        borderRadius: '20px',
        border: '1px solid #e8edf4',
        bgcolor: '#ffffff',
        boxShadow: '0 4px 20px rgba(15, 23, 42, 0.05)',
        cursor: 'pointer',
        height: '100%',
        position: 'relative',
        transition: 'all 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.1)',
          borderColor: `${module.accent}55`,
          '& .open-link': { gap: 1, color: module.accent },
        },
      }}
    >
      {badge > 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: 14,
            right: 14,
            minWidth: 22,
            height: 22,
            px: 0.75,
            borderRadius: '999px',
            bgcolor: '#ef4444',
            color: '#fff',
            fontSize: '0.7rem',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {badge}
        </Box>
      )}
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 }, display: 'flex', flexDirection: 'column', minHeight: 190 }}>
        <Box
          sx={{
            width: 46,
            height: 46,
            borderRadius: '14px',
            bgcolor: module.tint,
            color: module.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1.75,
          }}
        >
          <Icon sx={{ fontSize: 24 }} />
        </Box>
        <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a', mb: 0.75 }}>
          {module.title}
        </Typography>
        <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', lineHeight: 1.55, flex: 1 }}>
          {module.description}
        </Typography>
        <Stack
          direction="row"
          alignItems="center"
          spacing={0.5}
          className="open-link"
          sx={{ mt: 2, color: module.accent, fontWeight: 700, fontSize: '0.875rem', transition: 'all 0.2s ease' }}
        >
          <span>Open</span>
          <ChevronRight sx={{ fontSize: 20 }} />
        </Stack>
      </CardContent>
    </Card>
  );
}

function HrPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contentRef = useRef(null);

  const moduleParam = searchParams.get('module');
  const tabParam = searchParams.get('tab');
  const rawModule = moduleParam || (tabParam ? LEGACY_TAB_MAP[tabParam] : null);
  const activeModule = HR_MODULES.some((m) => m.id === rawModule) ? rawModule : null;

  const [stats, setStats] = useState({
    activeEmployees: 0,
    monthlyPayroll: 0,
    pendingClearance: 0,
    advanceBalance: 0,
  });
  const [contentVisible, setContentVisible] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);

  const activeModuleMeta = useMemo(
    () => HR_MODULES.find((m) => m.id === activeModule),
    [activeModule]
  );

  const isFlatModule = ['attendance', 'salary-sheet', 'salary-clearance', 'salary-advance', 'employee-ledger', 'employee-receive', 'salary-receipt'].includes(activeModule);
  const summaryVersion = useHrRefreshVersion(HR_KEYS.summary);
  const { invalidate } = useHrRefresh();

  useEffect(() => {
    if (activeModule) return;

    async function loadStats() {
      setLoadingStats(true);
      try {
        const res = await fetch('/api/hr/summary');
        if (res.ok) {
          const data = await res.json();
          setStats({
            activeEmployees: data.activeEmployees ?? 0,
            monthlyPayroll: data.monthlyPayroll ?? 0,
            pendingClearance: data.pendingClearance ?? 0,
            advanceBalance: data.advanceBalance ?? 0,
          });
        }
      } catch {
        /* optional */
      } finally {
        setLoadingStats(false);
      }
    }
    loadStats();
  }, [activeModule, summaryVersion]);

  const openModule = (moduleId) => {
    if (moduleId === activeModule) return;
    router.push(`/dashboard/hr?module=${moduleId}`, { scroll: false });
    setContentVisible(true);
    requestAnimationFrame(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const backToHub = () => {
    router.push('/dashboard/hr', { scroll: false });
    setContentVisible(true);
    invalidate([HR_KEYS.summary, HR_KEYS.employees, HR_KEYS.payroll, HR_KEYS.advances, HR_KEYS.ledger]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderModuleContent = () => {
    switch (activeModule) {
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
        return <EmployeeLedgerTab />;
      case 'employee-receive':
        return <EmployeeReceiveTab />;
      case 'salary-receipt':
        return <SalaryTab view="receipt" />;
      default:
        return null;
    }
  };

  const statCards = [
    {
      label: 'Active Employees',
      sublabel: 'On payroll',
      value: stats.activeEmployees,
      icon: Groups,
      accent: '#1A55E3',
      tint: '#e8effd',
    },
    {
      label: 'Monthly Payroll',
      sublabel: 'Contract total',
      value: fmtAmt(stats.monthlyPayroll),
      icon: AccountBalanceWallet,
      accent: '#f59e0b',
      tint: '#fef3c7',
    },
    {
      label: 'Pending Clearance',
      sublabel: 'Awaiting payment',
      value: stats.pendingClearance,
      icon: Schedule,
      accent: '#7c3aed',
      tint: '#ede9fe',
    },
    {
      label: 'Advance Balance',
      sublabel: 'Outstanding',
      value: fmtAmt(stats.advanceBalance),
      icon: PaymentsIcon,
      accent: '#FF0854',
      tint: '#ffe8f0',
    },
  ];

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 4 }}>
        {/* Hero header */}
        <Box
          sx={{
            mb: 3,
            p: { xs: 2.5, md: 3 },
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #1A55E3 0%, #1347c4 45%, #5E6EED 100%)',
            color: '#fff',
            boxShadow: '0 8px 32px rgba(26, 85, 227, 0.25)',
          }}
        >
          <Typography sx={{ fontSize: { xs: '1.5rem', md: '1.85rem' }, fontWeight: 900, letterSpacing: '-0.02em' }}>
            HR Management
          </Typography>
          <Typography sx={{ fontSize: '0.875rem', opacity: 0.88, mt: 0.5, maxWidth: 560 }}>
            {COMPANY.nameShort} — employees, attendance, payroll and salary clearance in one dashboard.
          </Typography>
        </Box>

        {/* Stats row */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr 1fr',
              md: 'repeat(2, 1fr)',
              lg: 'repeat(4, 1fr)',
            },
            gap: 2,
            mb: 3,
          }}
        >
          {loadingStats
            ? Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} sx={{ borderRadius: '16px', minHeight: 110, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CircularProgress size={24} sx={{ color: BRAND.primary.blue }} />
                </Card>
              ))
            : statCards.map((s) => <StatCard key={s.label} {...s} />)}
        </Box>

        {/* Hub: module grid */}
        {!activeModule && (
          <Box
            sx={{
              opacity: contentVisible ? 1 : 0,
              transform: contentVisible ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.28s ease, transform 0.28s ease',
            }}
          >
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', mb: 2 }}>
              HR Modules
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                gap: 2,
              }}
            >
              {HR_MODULES.map((module) => (
                <ModuleNavCard
                  key={module.id}
                  module={module}
                  badge={module.badgeKey ? stats[module.badgeKey] : 0}
                  onClick={() => openModule(module.id)}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Module view */}
        {activeModule && activeModuleMeta && (
          <Box ref={contentRef}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Button
                startIcon={<ArrowBack />}
                onClick={backToHub}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  color: '#64748b',
                  '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' },
                }}
              >
                HR Dashboard
              </Button>
              <ChevronRight sx={{ color: '#cbd5e1', fontSize: 20 }} />
              <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>{activeModuleMeta.title}</Typography>
            </Stack>

            <Box
              sx={{
                borderRadius: isFlatModule ? 0 : '20px',
                border: isFlatModule ? 'none' : '1px solid #e8edf4',
                bgcolor: '#ffffff',
                boxShadow: isFlatModule ? 'none' : '0 4px 24px rgba(15, 23, 42, 0.06)',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  px: { xs: 2, md: 2.5 },
                  py: 2,
                  borderBottom: '1px solid #e8edf4',
                  background: `linear-gradient(90deg, ${activeModuleMeta.tint} 0%, #ffffff 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1.5,
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: '12px',
                      bgcolor: '#fff',
                      color: activeModuleMeta.accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 8px rgba(15,23,42,0.06)',
                    }}
                  >
                    <activeModuleMeta.icon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>
                      {activeModuleMeta.title}
                    </Typography>
                    <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', maxWidth: 480 }}>
                      {activeModuleMeta.description}
                    </Typography>
                  </Box>
                </Stack>
                <IconButton
                  onClick={backToHub}
                  sx={{
                    bgcolor: '#fff',
                    border: '1px solid #e2e8f0',
                    '&:hover': { bgcolor: '#f8fafc' },
                  }}
                >
                  <ArrowForward sx={{ transform: 'rotate(180deg)', fontSize: 20 }} />
                </IconButton>
              </Box>

              <Box
                key={activeModule}
                sx={{
                  p: isFlatModule ? 0 : { xs: 1.5, md: 2.5 },
                  opacity: contentVisible ? 1 : 0,
                  transform: contentVisible ? 'translateY(0)' : 'translateY(12px)',
                  transition: 'opacity 0.3s ease, transform 0.3s ease',
                }}
              >
                {renderModuleContent()}
              </Box>
            </Box>
          </Box>
        )}
      </Box>
    </DashboardLayout>
  );
}

export default function HrPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
            <CircularProgress sx={{ color: BRAND.primary.blue }} />
          </Box>
        </DashboardLayout>
      }
    >
      <HrRefreshProvider>
        <HrPageContent />
      </HrRefreshProvider>
    </Suspense>
  );
}
