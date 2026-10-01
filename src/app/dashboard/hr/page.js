'use client';

import { Suspense, useState, useMemo, useRef } from 'react';
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
} from '@mui/icons-material';
import DashboardLayout from '../components/dashboard-layout';
import { BRAND, COMPANY } from '@/lib/brand-theme';
import { HrRefreshProvider, useHrRefresh, HR_KEYS } from './context/HrRefreshContext';
import HrActiveModule from './components/HrActiveModule';

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
    accentDark: '#1347c4',
    tint: '#dbeafe',
  },
  {
    id: 'attendance',
    title: 'Attendance Sheet',
    description: 'Mark daily present, leave, absent, and half-day attendance.',
    icon: EventNoteIcon,
    accent: '#059669',
    accentDark: '#047857',
    tint: '#d1fae5',
  },
  {
    id: 'salary-sheet',
    title: 'Salary Sheet',
    description: 'Review monthly salary breakdown for all employees.',
    icon: TableChartIcon,
    accent: '#d97706',
    accentDark: '#b45309',
    tint: '#fef3c7',
  },
  {
    id: 'salary-clearance',
    title: 'Salary Clearance',
    description: 'Process final payments and recover outstanding advances.',
    icon: PaymentsIcon,
    accent: '#7c3aed',
    accentDark: '#6d28d9',
    tint: '#ede9fe',
  },
  {
    id: 'salary-advance',
    title: 'Salary Advance',
    description: 'Record mid-month advances and track employee balances.',
    icon: AccountBalanceWallet,
    accent: '#e11d48',
    accentDark: '#be123c',
    tint: '#ffe4e6',
  },
  {
    id: 'employee-ledger',
    title: 'Employee Account Ledger',
    description: 'View each employee’s running balance — opening, advances, receipts, and salary recovery.',
    icon: AccountBalanceWallet,
    accent: '#0d9488',
    accentDark: '#0f766e',
    tint: '#ccfbf1',
  },
  {
    id: 'employee-receive',
    title: 'Receive Payment',
    description: 'Record cash/bank received from employees with printable PDF receipts.',
    icon: PaymentsIcon,
    accent: '#0284c7',
    accentDark: '#0369a1',
    tint: '#e0f2fe',
  },
  {
    id: 'salary-receipt',
    title: 'Salary Receipt',
    description: 'Print official monthly salary invoice for any employee.',
    icon: ReceiptIcon,
    accent: '#4f46e5',
    accentDark: '#4338ca',
    tint: '#e0e7ff',
  },
];

const HR_MODULE_COUNT = HR_MODULES.length;

function ModuleNavCard({ module, badge, onClick, index = 0 }) {
  const Icon = module.icon;
  const accentDeep = module.accentDark || module.accent;

  return (
    <Card
      onClick={onClick}
      elevation={0}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        '@keyframes hrModuleIn': {
          from: { opacity: 0, transform: 'translateY(14px)' },
          to: { opacity: 1, transform: 'translateY(0)' },
        },
        animation: `hrModuleIn 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${index * 0.045}s both`,
        borderRadius: '18px',
        border: `1px solid ${module.accent}30`,
        background: `linear-gradient(165deg, #ffffff 0%, ${module.tint} 100%)`,
        boxShadow: `0 2px 8px ${module.accent}12, 0 1px 2px rgba(15, 23, 42, 0.04)`,
        cursor: 'pointer',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.32s ease, box-shadow 0.32s ease, transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)',
        '&::after': {
          content: '""',
          position: 'absolute',
          top: -40,
          right: -40,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${module.accent}28 0%, transparent 68%)`,
          pointerEvents: 'none',
          transition: 'transform 0.35s ease, opacity 0.35s ease',
          opacity: 0.85,
        },
        '&:hover, &:focus-visible': {
          outline: 'none',
          transform: 'translateY(-4px)',
          boxShadow: `0 16px 40px ${module.accent}28, 0 4px 12px rgba(15, 23, 42, 0.06)`,
          borderColor: `${module.accent}70`,
          '&::after': {
            transform: 'scale(1.15)',
            opacity: 1,
          },
          '& .module-icon-wrap': {
            transform: 'translateY(-1px) scale(1.05)',
            boxShadow: `0 8px 20px ${module.accent}35`,
          },
          '& .module-open-pill': {
            bgcolor: module.accent,
            color: '#fff',
            borderColor: module.accent,
            boxShadow: `0 4px 12px ${module.accent}40`,
          },
          '& .module-open-chevron': {
            transform: 'translateX(3px)',
          },
        },
        '&:active': {
          transform: 'translateY(-1px)',
          transitionDuration: '0.12s',
        },
      }}
    >
      {badge > 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
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
            zIndex: 1,
          }}
        >
          {badge}
        </Box>
      )}
      <CardContent
        sx={{
          p: 2.5,
          '&:last-child': { pb: 2.5 },
          display: 'flex',
          flexDirection: 'column',
          minHeight: { xs: 172, md: 182 },
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          className="module-icon-wrap"
          sx={{
            width: 48,
            height: 48,
            borderRadius: '14px',
            background: `linear-gradient(145deg, ${module.accent} 0%, ${accentDeep} 100%)`,
            color: '#ffffff',
            boxShadow: `0 6px 16px ${module.accent}45`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mb: 1.75,
            transition: 'transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.32s ease',
            flexShrink: 0,
          }}
        >
          <Icon sx={{ fontSize: 24 }} />
        </Box>
        <Typography
          sx={{
            fontWeight: 800,
            fontSize: '1rem',
            color: '#0f172a',
            letterSpacing: '-0.02em',
            mb: 0.65,
            lineHeight: 1.25,
          }}
        >
          {module.title}
        </Typography>
        <Typography
          sx={{
            fontSize: '0.8125rem',
            color: '#64748b',
            lineHeight: 1.6,
            flex: 1,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {module.description}
        </Typography>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="flex-end"
          className="module-open-pill"
          sx={{
            mt: 2,
            alignSelf: 'flex-start',
            gap: 0.35,
            px: 1.35,
            py: 0.55,
            borderRadius: '999px',
            border: `1px solid ${module.accent}40`,
            bgcolor: 'rgba(255,255,255,0.92)',
            color: module.accent,
            fontWeight: 700,
            fontSize: '0.72rem',
            letterSpacing: '0.03em',
            transition: 'all 0.28s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        >
          <span>Open</span>
          <ChevronRight
            className="module-open-chevron"
            sx={{ fontSize: 17, transition: 'transform 0.28s ease' }}
          />
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

  const [contentVisible, setContentVisible] = useState(true);

  const activeModuleMeta = useMemo(
    () => HR_MODULES.find((m) => m.id === activeModule),
    [activeModule]
  );

  const isFlatModule = ['attendance', 'salary-sheet', 'salary-clearance', 'salary-advance', 'employee-ledger', 'employee-receive', 'salary-receipt'].includes(activeModule);
  const hideHrHubHeader = activeModule === 'employee-ledger';
  const { invalidate } = useHrRefresh();

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

  return (
    <DashboardLayout>
      <Box sx={{ maxWidth: 1440, mx: 'auto', pb: 4 }}>
        {/* Hub: module grid */}
        {!activeModule && (
          <Box
            sx={{
              opacity: contentVisible ? 1 : 0,
              transform: contentVisible ? 'translateY(0)' : 'translateY(8px)',
              transition: 'opacity 0.28s ease, transform 0.28s ease',
            }}
          >
            <Box
              sx={{
                mb: 3,
                px: { xs: 2, md: 3 },
                py: { xs: 2.25, md: 2.5 },
                borderRadius: '20px',
                border: '1px solid #e8edf4',
                background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 55%, #f1f5f9 100%)',
                boxShadow: '0 4px 24px rgba(15, 23, 42, 0.05)',
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { sm: 'center' },
                justifyContent: 'space-between',
                gap: 2,
              }}
            >
              <Stack direction="row" spacing={1.75} alignItems="center">
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '14px',
                    background: `linear-gradient(135deg, ${BRAND.primary.blue} 0%, ${BRAND.supporting.periwinkle} 100%)`,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(26, 85, 227, 0.28)',
                    flexShrink: 0,
                  }}
                >
                  <BadgeIcon sx={{ fontSize: 26 }} />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 900, fontSize: { xs: '1.2rem', md: '1.35rem' }, color: '#0f172a', letterSpacing: '-0.02em' }}>
                    HR Management
                  </Typography>
                  <Typography sx={{ fontSize: '0.8125rem', color: '#64748b', mt: 0.35, maxWidth: 520 }}>
                    {COMPANY.nameShort} — choose a module for employees, payroll, and staff accounts.
                  </Typography>
                </Box>
              </Stack>
              <Box
                sx={{
                  px: 2,
                  py: 1.15,
                  borderRadius: '14px',
                  background: `linear-gradient(135deg, ${BRAND.tint.blue} 0%, #ffffff 100%)`,
                  border: `1px solid ${BRAND.primary.blue}22`,
                  textAlign: { xs: 'left', sm: 'center' },
                  minWidth: { sm: 108 },
                  boxShadow: '0 2px 8px rgba(26, 85, 227, 0.08)',
                }}
              >
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Modules
                </Typography>
                <Typography
                  sx={{
                    fontSize: '1.5rem',
                    fontWeight: 900,
                    lineHeight: 1.1,
                    fontFamily: 'monospace',
                    background: `linear-gradient(135deg, ${BRAND.primary.blue}, ${BRAND.supporting.periwinkle})`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {HR_MODULE_COUNT}
                </Typography>
              </Box>
            </Box>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
                gap: { xs: 1.75, md: 2.25 },
                alignItems: 'stretch',
              }}
            >
              {HR_MODULES.map((module, index) => (
                <ModuleNavCard
                  key={module.id}
                  module={module}
                  badge={0}
                  index={index}
                  onClick={() => openModule(module.id)}
                />
              ))}
            </Box>
          </Box>
        )}

        {/* Module view */}
        {activeModule && activeModuleMeta && (
          <Box ref={contentRef}>
            {!hideHrHubHeader && (
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
            )}

            <Box
              sx={{
                borderRadius: hideHrHubHeader || isFlatModule ? 0 : '20px',
                border: hideHrHubHeader || isFlatModule ? 'none' : '1px solid #e8edf4',
                bgcolor: hideHrHubHeader ? 'transparent' : '#ffffff',
                boxShadow: hideHrHubHeader || isFlatModule ? 'none' : '0 4px 24px rgba(15, 23, 42, 0.06)',
                overflow: 'hidden',
              }}
            >
              {!hideHrHubHeader && (
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
              )}

              <Box
                key={activeModule}
                sx={{
                  p: isFlatModule ? 0 : { xs: 1.5, md: 2.5 },
                  opacity: contentVisible ? 1 : 0,
                  transform: contentVisible ? 'translateY(0)' : 'translateY(12px)',
                  transition: 'opacity 0.3s ease, transform 0.3s ease',
                }}
              >
                <HrActiveModule moduleId={activeModule} backToHub={backToHub} />
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
