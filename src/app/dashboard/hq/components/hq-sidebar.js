'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  Typography,
  IconButton,
  Tooltip,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
} from '@mui/icons-material';
import {
  COMPANY,
  POWERED_BY,
  HQ_BRAND,
  HQ_SIDEBAR,
  HQ_NAV_FN,
  HQ_SIDEBAR_SECTION,
  SIDEBAR_WIDTH,
} from '@/lib/brand-theme';
import { HQ_NAV, isHqNavActive } from './hq-nav';
import { HQ_LABEL } from './hq-brand';

const COLLAPSED_WIDTH = SIDEBAR_WIDTH.collapsed;
const EXPANDED_WIDTH = SIDEBAR_WIDTH.expanded;

const NAV_FN_MAP = {
  dashboard: HQ_NAV_FN.overview,
  branches: HQ_NAV_FN.branches,
  users: HQ_NAV_FN.users,
  monitoring: HQ_NAV_FN.monitoring,
  settings: HQ_NAV_FN.settings,
};

export default function HqSidebar({ sidebarOpen, setSidebarOpen, collapsed, onToggleCollapse }) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'), { noSsr: true, defaultMatches: false });

  const drawerWidth = collapsed && !isMobile ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const isCollapsed = collapsed && !isMobile;

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, setSidebarOpen]);

  const isSearching = searchQuery.trim().length > 0;
  const filteredNav = isSearching
    ? HQ_NAV.filter(
        (item) =>
          item.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : HQ_NAV;

  const handleToggleCollapse = (e) => {
    e.preventDefault();
    e.stopPropagation();
    onToggleCollapse?.();
  };

  const drawerTransition = theme.transitions.create('width', {
    easing: theme.transitions.easing.easeInOut,
    duration: theme.transitions.duration.standard,
  });

  const renderNavLink = (item) => {
    const isActive = isHqNavActive(pathname, item.href);
    const fn = NAV_FN_MAP[item.id] || HQ_NAV_FN.overview;
    const Icon = item.icon;

    const linkInner = (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          pl: 1,
          pr: 1.25,
          py: 0.75,
          borderRadius: 2,
          cursor: 'pointer',
          color: isActive ? HQ_SIDEBAR.textOnActive : HQ_SIDEBAR.textActive,
          background: isActive ? HQ_SIDEBAR.bgActiveGradient : 'transparent',
          boxShadow: isActive ? '0 4px 14px rgba(67, 56, 202, 0.28)' : 'none',
          border: isActive ? '1px solid rgba(255,255,255,0.12)' : '1px solid transparent',
          transition: 'all 0.22s ease',
          '&:hover': {
            background: isActive ? HQ_SIDEBAR.bgActiveGradient : HQ_SIDEBAR.bgHover,
            color: isActive ? HQ_SIDEBAR.textOnActive : HQ_SIDEBAR.textActive,
            transform: isActive ? 'none' : 'translateX(2px)',
          },
        }}
      >
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            bgcolor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
            color: isActive ? HQ_SIDEBAR.textOnActive : fn.main,
          }}
        >
          <Icon size={18} strokeWidth={isActive ? 2.25 : 2} />
        </Box>
        {!isCollapsed && (
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography sx={{ fontSize: '0.8375rem', fontWeight: isActive ? 700 : 600, lineHeight: 1.3 }}>
              {item.label}
            </Typography>
            <Typography sx={{ fontSize: '0.68rem', color: isActive ? 'rgba(255,255,255,0.72)' : HQ_SIDEBAR.textMuted, lineHeight: 1.2 }}>
              {item.description}
            </Typography>
          </Box>
        )}
      </Box>
    );

    if (isCollapsed) {
      return (
        <Tooltip key={item.id} title={item.label} placement="right" arrow>
          <Box sx={{ px: 0.5, mb: 0.4 }}>
            <Link href={item.href} style={{ textDecoration: 'none', color: 'inherit' }}>
              {linkInner}
            </Link>
          </Box>
        </Tooltip>
      );
    }

    return (
      <Box key={item.id} sx={{ px: 1.5, mb: 0.4 }}>
        <Link href={item.href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          {linkInner}
        </Link>
      </Box>
    );
  };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', background: HQ_SIDEBAR.background }}>
      <Box className="hq-sidebar-header-shell" sx={{ flexShrink: 0, borderBottom: `1px solid ${HQ_SIDEBAR.border}` }}>
        <Box className="hq-sidebar-header-accent" aria-hidden="true">
          <span className="hq-sidebar-header-accent-shine" />
        </Box>

        {!isMobile && (
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: isCollapsed ? 'center' : 'flex-start',
              justifyContent: 'space-between',
              gap: 0.75,
              px: isCollapsed ? 0.75 : 1.25,
              pt: isCollapsed ? 0.65 : 0.75,
              pb: isCollapsed ? 1 : 1.1,
              flexDirection: isCollapsed ? 'column' : 'row',
            }}
          >
            {!isCollapsed ? (
              <Box className="hq-sidebar-brand" sx={{ flex: 1, minWidth: 0 }}>
                <Typography component="span" className="hq-sidebar-brand-title" sx={{ display: 'block' }}>
                  {COMPANY.nameShort}
                </Typography>
                <Typography component="span" className="hq-sidebar-brand-sub">
                  {HQ_LABEL}
                </Typography>
                <Box className="hq-sidebar-brand-glow" />
              </Box>
            ) : (
              <Typography className="hq-sidebar-brand-collapsed">HQ</Typography>
            )}

            <IconButton
              onClick={handleToggleCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              size="small"
              sx={{
                bgcolor: HQ_SIDEBAR.collapseBtn,
                color: '#ffffff',
                width: 30,
                height: 30,
                borderRadius: 1.5,
                flexShrink: 0,
                boxShadow: '0 2px 10px rgba(245, 158, 11, 0.4)',
                '&:hover': { bgcolor: HQ_SIDEBAR.collapseBtnHover, transform: 'scale(1.05)' },
              }}
            >
              {isCollapsed ? <ChevronRightIcon sx={{ fontSize: 17 }} /> : <ChevronLeftIcon sx={{ fontSize: 17 }} />}
            </IconButton>
          </Box>
        )}

        {isMobile && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, pt: 0.5, pb: 0.25 }}>
            <IconButton onClick={() => setSidebarOpen(false)} sx={{ color: HQ_SIDEBAR.textMuted, p: 0.5 }}>
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}

        {!isCollapsed && !isMobile && (
          <Box className="hq-sidebar-header-ornament" aria-hidden="true">
            <span /><span /><span />
          </Box>
        )}

        {isMobile && !isCollapsed && (
          <Box sx={{ px: 1.5, pb: 1.25, pt: 0.25 }}>
            <Box className="hq-sidebar-brand">
              <Typography component="span" className="hq-sidebar-brand-title" sx={{ display: 'block' }}>
                {COMPANY.nameShort}
              </Typography>
              <Typography component="span" className="hq-sidebar-brand-sub">{HQ_LABEL}</Typography>
              <Box className="hq-sidebar-brand-glow" />
            </Box>
          </Box>
        )}
      </Box>

      {!isCollapsed && (
        <Box sx={{ px: 1.5, py: 1.25, borderBottom: `1px solid ${HQ_SIDEBAR.border}` }}>
          <div className="hq-sidebar-search-wrap">
            <div className="hq-sidebar-search-inner">
              <SearchIcon className="hq-sidebar-search-icon" />
              <input
                type="text"
                className="hq-sidebar-search-input"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search HQ menu"
              />
              {searchQuery && (
                <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.25, color: '#94a3b8' }}>
                  <CloseIcon sx={{ fontSize: 15 }} />
                </IconButton>
              )}
            </div>
          </div>
        </Box>
      )}

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          py: 0.5,
          px: isCollapsed ? 0.75 : 0,
          scrollbarWidth: 'thin',
          scrollbarColor: `${HQ_SIDEBAR.bgActive} rgba(67, 56, 202, 0.08)`,
        }}
      >
        {!isCollapsed && (
          <Box sx={{ px: 1.5, pt: 1, pb: 0.5 }}>
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.75,
                px: 1.25,
                py: 0.45,
                borderRadius: 999,
                bgcolor: HQ_SIDEBAR_SECTION.bg,
                border: `1px solid ${HQ_BRAND.tintSoft}`,
              }}
            >
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: HQ_SIDEBAR_SECTION.accent }} />
              <Typography
                sx={{
                  fontSize: '0.625rem',
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: HQ_SIDEBAR_SECTION.label,
                }}
              >
                Head Office
              </Typography>
            </Box>
          </Box>
        )}
        {filteredNav.map(renderNavLink)}
        {isSearching && filteredNav.length === 0 && (
          <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: HQ_SIDEBAR.textMuted }}>
              No results for &quot;{searchQuery}&quot;
            </Typography>
          </Box>
        )}
      </Box>

      <Box
        className="hq-sidebar-powered-by"
        sx={{
          flexShrink: 0,
          borderTop: `1px solid ${HQ_SIDEBAR.border}`,
          bgcolor: HQ_SIDEBAR.bgElevated,
          px: isCollapsed ? 0.5 : 1.25,
          py: isCollapsed ? 1 : 1.15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
        }}
      >
        {!isCollapsed ? (
          <Box sx={{ width: '100%' }}>
            <Typography
              component="span"
              sx={{
                display: 'block',
                fontSize: '0.5625rem',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: HQ_SIDEBAR.textMuted,
                mb: 0.25,
              }}
            >
              {POWERED_BY.label}
            </Typography>
            <Typography component="span" className="hq-sidebar-powered-name" sx={{ display: 'block', fontSize: '0.75rem', fontWeight: 800 }}>
              {POWERED_BY.name}
            </Typography>
          </Box>
        ) : (
          <Tooltip title={`${POWERED_BY.label} ${POWERED_BY.name}`} placement="right" arrow>
            <Box className="hq-sidebar-powered-collapsed">{POWERED_BY.nameShort}</Box>
          </Tooltip>
        )}
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={isMobile ? sidebarOpen : true}
      onClose={() => setSidebarOpen(false)}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        transition: drawerTransition,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: `1px solid ${HQ_SIDEBAR.border}`,
          background: HQ_SIDEBAR.background,
          overflowX: 'hidden',
          boxShadow: HQ_SIDEBAR.drawerShadow,
          transition: drawerTransition,
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
