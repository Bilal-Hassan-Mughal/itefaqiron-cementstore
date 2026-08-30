'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useRouter } from 'next/navigation';
import StaffPathGuard from './staff-path-guard';
import HqPosGuard from './hq-pos-guard';
import { resolveClientBranchId, getActiveBranchMeta, isHqPosMode, exitHqPosMode } from '@/lib/branch-client';
import { isHqUser } from '@/lib/branch-roles';
import {
  Box,
  CircularProgress,
  Typography,
  useTheme,
  useMediaQuery
} from '@mui/material';
import Header from './header';
import Sidebar from './sidebar';
import ClientOnly from './client-only';
import { SIDEBAR_WIDTH } from '@/lib/brand-theme';

const COLLAPSED_WIDTH = SIDEBAR_WIDTH.collapsed;
const EXPANDED_WIDTH = SIDEBAR_WIDTH.expanded;
const SIDEBAR_COLLAPSED_KEY = 'pos_sidebar_collapsed';

export default function DashboardLayout({ children }) {
  const [user, setUser] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [expandedDropdowns, setExpandedDropdowns] = useState({});
  const [isClient, setIsClient] = useState(false);
  const [branchLabel, setBranchLabel] = useState('');
  const [hqViewingBranch, setHqViewingBranch] = useState(false);
  const userRef = useRef(null);

  const router = useRouter();

  useEffect(() => {
    setIsClient(true);

    const userData = localStorage.getItem('user');
    if (!userData) {
      router.push('/');
      if (typeof window !== 'undefined') window.location.href = '/';
      return;
    }

    try {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      userRef.current = parsedUser;

      const meta = getActiveBranchMeta();
      setHqViewingBranch(isHqUser(parsedUser) && isHqPosMode());
      if (meta.name) setBranchLabel(`${meta.name} (${meta.code})`);
      else if (parsedUser.branch?.branch_name) {
        setBranchLabel(parsedUser.branch.branch_name);
      } else if (!isHqUser(parsedUser) && parsedUser.branch_id) {
        setBranchLabel(`Branch #${parsedUser.branch_id}`);
      }

      // Attach branch + user headers to all dashboard fetch calls
      const originalFetch = window.fetch.bind(window);
      window.__branchFetchPatched = true;
      window.fetch = (input, init = {}) => {
        const url = typeof input === 'string' ? input : input?.url || '';
        if (url.startsWith('/api/')) {
          const headers = new Headers(init.headers || {});
          const u = userRef.current;
          if (u && !headers.has('x-user-json')) {
            headers.set('x-user-json', JSON.stringify(u));
          }
          const branchId = resolveClientBranchId(u);
          if (branchId && !headers.has('x-branch-id')) {
            headers.set('x-branch-id', String(branchId));
          }
          return originalFetch(input, { ...init, headers });
        }
        return originalFetch(input, init);
      };

      const onBranchChanged = () => {
        const m = getActiveBranchMeta();
        setBranchLabel(m.name ? `${m.name} (${m.code})` : '');
        setHqViewingBranch(isHqUser(userRef.current) && isHqPosMode());
      };
      window.addEventListener('branch-changed', onBranchChanged);

      return () => {
        window.fetch = originalFetch;
        window.removeEventListener('branch-changed', onBranchChanged);
      };
    } catch (error) {
      router.push('/');
      if (typeof window !== 'undefined') window.location.href = '/';
    }

  }, [router]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (saved === 'true') setCollapsed(true);
    } catch {
      /* ignore storage errors */
    }
  }, []);

  const toggleSidebarCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        /* ignore storage errors */
      }
      return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('active_branch_id');
    localStorage.removeItem('active_branch_name');
    localStorage.removeItem('active_branch_code');
    localStorage.removeItem('login_mode');
    localStorage.removeItem('hq_pos_mode');
    router.push('/');
  };

  const handleBackToHq = () => {
    exitHqPosMode();
    setHqViewingBranch(false);
    setBranchLabel('');
    router.push('/dashboard/hq');
  };

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'), { noSsr: true, defaultMatches: false });

  const sidebarWidth = (!isMobile && collapsed) ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const sidebarTransition = theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.easeInOut,
    duration: theme.transitions.duration.standard,
  });

  if (!isClient || !user) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress size={80} />
      </Box>
    );
  }

  return (
    <>
    {isClient && user && (
      <Suspense fallback={null}>
        <StaffPathGuard user={user} isClient={isClient} />
        <HqPosGuard user={user} isClient={isClient} />
      </Suspense>
    )}
    <style>{`
      @media print {
        .no-print { display: none !important; }
        body { overflow: visible !important; background: white !important; }
        * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      }
    `}</style>
    <ClientOnly fallback={
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
        <CircularProgress size={80} />
      </Box>
    }>
      <Box className="dashboard-layout-root" sx={{ display: 'flex', height: '100vh', maxHeight: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
        {/* Sidebar — hidden when printing */}
        <Box sx={{ '@media print': { display: 'none !important' } }}>
          <Suspense fallback={null}>
            <Sidebar
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              collapsed={collapsed}
              onToggleCollapse={toggleSidebarCollapsed}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              expandedDropdowns={expandedDropdowns}
              setExpandedDropdowns={setExpandedDropdowns}
              user={user}
            />
          </Suspense>
        </Box>

        {/* Main Content */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            minWidth: 0,
            minHeight: 0,
            width: { lg: `calc(100% - ${sidebarWidth}px)` },
            transition: sidebarTransition,
            bgcolor: 'background.default',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            '@media print': { width: '100% !important', marginLeft: '0 !important', height: 'auto', maxHeight: 'none', overflow: 'visible' },
          }}
        >
          {/* HQ viewing branch banner */}
          {hqViewingBranch && (
            <Box
              sx={{
                bgcolor: '#4338ca',
                color: 'white',
                px: 2,
                py: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 1,
                '@media print': { display: 'none !important' },
              }}
            >
              <Typography variant="body2" fontWeight={600}>
                Head Office — viewing branch: {branchLabel || 'Selected branch'}
              </Typography>
              <Box
                component="button"
                onClick={handleBackToHq}
                sx={{
                  border: '1px solid rgba(255,255,255,0.4)',
                  bgcolor: 'rgba(255,255,255,0.12)',
                  color: 'white',
                  borderRadius: 1,
                  px: 1.5,
                  py: 0.5,
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                ← Back to Head Office
              </Box>
            </Box>
          )}

          {/* Header — hidden when printing */}
          <Box sx={{ '@media print': { display: 'none !important' } }}>
            <Suspense fallback={null}>
              <Header
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                activeTab={activeTab}
                user={user}
                branchLabel={branchLabel}
                onLogout={handleLogout}
              />
            </Suspense>
          </Box>

          {/* Main Content Area */}
          <Box
            className="dashboard-main-scroll"
            sx={{
              flex: '1 1 0',
              height: 0,
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              bgcolor: '#f4f6f9',
              p: { xs: 1.5, md: 2.5 },
              '@media print': { padding: 0, overflow: 'visible', height: 'auto' },
            }}
          >
            {children}
          </Box>
        </Box>
      </Box>
    </ClientOnly>
    </>
  );
}
