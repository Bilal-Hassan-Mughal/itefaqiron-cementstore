'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CircularProgress, useTheme, useMediaQuery } from '@mui/material';
import HqSidebar from './hq-sidebar';
import HqHeader from './hq-header';
import { useHqSession } from './use-hq-session';
import { HQ_MUI, SIDEBAR_WIDTH } from '@/lib/brand-theme';

const COLLAPSED_WIDTH = SIDEBAR_WIDTH.collapsed;
const EXPANDED_WIDTH = SIDEBAR_WIDTH.expanded;
const SIDEBAR_COLLAPSED_KEY = 'hq_sidebar_collapsed';

export default function HqLayout({ children }) {
  const router = useRouter();
  const { user, ready } = useHqSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (saved === 'true') setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebarCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleLogout = () => {
    [
      'user', 'login_mode', 'active_branch_id', 'active_branch_name',
      'active_branch_code', 'hq_pos_mode', 'isAuthenticated', 'userRole', 'userEmail',
    ].forEach((k) => localStorage.removeItem(k));
    router.push('/?tab=hq');
  };

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'), { noSsr: true, defaultMatches: false });

  const sidebarWidth = (!isMobile && collapsed) ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const sidebarTransition = theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.easeInOut,
    duration: theme.transitions.duration.standard,
  });

  if (!ready || !user) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#f4f6f9' }}>
        <CircularProgress size={80} sx={HQ_MUI.spinner} />
      </Box>
    );
  }

  return (
    <Box className="hq-shell dashboard-layout-root" sx={{ display: 'flex', height: '100vh', maxHeight: '100vh', overflow: 'hidden', bgcolor: '#f4f6f9' }}>
      <Box sx={{ '@media print': { display: 'none !important' } }}>
        <Suspense fallback={null}>
          <HqSidebar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            collapsed={collapsed}
            onToggleCollapse={toggleSidebarCollapsed}
          />
        </Suspense>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          minHeight: 0,
          width: { lg: `calc(100% - ${sidebarWidth}px)` },
          transition: sidebarTransition,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ '@media print': { display: 'none !important' } }}>
          <Suspense fallback={null}>
            <HqHeader
              sidebarOpen={sidebarOpen}
              setSidebarOpen={setSidebarOpen}
              user={user}
              onLogout={handleLogout}
            />
          </Suspense>
        </Box>

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
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
