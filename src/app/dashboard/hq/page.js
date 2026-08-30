'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Grid, Typography, CircularProgress, Alert, IconButton, Tooltip, Chip,
} from '@mui/material';
import { Building2, PlayCircle, Users, ShoppingCart, RefreshCw, Circle } from 'lucide-react';
import { branchFetch } from '@/lib/branch-client';
import { COMPANY_NAME } from './components/hq-brand';
import HqStatCard from './components/hq-stat-card';
import HqQuickActions from './components/hq-quick-actions';
import HqBranchSnapshot from './components/hq-branch-snapshot';
import { useHqSession } from './components/use-hq-session';

const REFRESH_MS = 30000;

export default function HqDashboardPage() {
  const { user, ready } = useHqSession();
  const [branches, setBranches] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const loadData = useCallback(async (currentUser, silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const res = await branchFetch(currentUser, '/api/branches/stats');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load dashboard');
      setSummary(data.summary);
      setBranches(data.branches || []);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    loadData(user);
    const timer = setInterval(() => loadData(user, true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [ready, user, loadData]);

  if (!ready) return null;

  const firstName = user?.full_name?.split(' ')[0] || 'Admin';

  return (
    <>
      {/* Welcome banner — company name as text only, clean gradient */}
      <Box
        sx={{
          mb: 3,
          p: { xs: 2.5, md: 3 },
          borderRadius: 3,
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #4338ca 100%)',
          color: 'white',
          boxShadow: '0 8px 28px rgba(49, 46, 129, 0.2)',
        }}
      >
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          <Box>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                fontWeight: 600,
                opacity: 0.85,
                letterSpacing: '0.02em',
                mb: 0.75,
              }}
            >
              {COMPANY_NAME}
            </Typography>
            <Typography variant="h5" fontWeight={800} sx={{ lineHeight: 1.2 }}>
              {greeting}, {firstName}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.75, mt: 0.5, fontWeight: 500 }}>
              Monitor all shop branches from one place
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            {lastUpdated && (
              <Chip
                icon={<Circle size={8} fill="#4ade80" color="#4ade80" />}
                label={lastUpdated.toLocaleTimeString()}
                size="small"
                sx={{
                  bgcolor: 'rgba(255,255,255,0.12)',
                  color: 'white',
                  fontWeight: 600,
                  border: '1px solid rgba(255,255,255,0.15)',
                  '& .MuiChip-icon': { ml: 0.5 },
                }}
              />
            )}
            <Tooltip title="Refresh">
              <IconButton
                size="small"
                onClick={() => user && loadData(user, true)}
                disabled={refreshing}
                sx={{
                  bgcolor: 'rgba(255,255,255,0.12)',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.15)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                }}
              >
                <RefreshCw size={18} className={refreshing ? 'hq-spin' : ''} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ py: 10, textAlign: 'center' }}>
          <CircularProgress sx={{ color: '#4338ca' }} />
        </Box>
      ) : (
        <>
          {/* Essential KPIs only — 4 metrics HQ actually needs at a glance */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={6} md={3}>
              <HqStatCard
                icon={Building2}
                label="Total Shops"
                value={summary?.total_branches}
                color="#4338ca"
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <HqStatCard
                icon={PlayCircle}
                label="Active Shops"
                value={summary?.active_branches}
                color="#16a34a"
                sub={summary?.suspended_branches ? `${summary.suspended_branches} suspended` : undefined}
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <HqStatCard
                icon={Users}
                label="Branch Staff"
                value={summary?.total_users}
                color="#0891b2"
              />
            </Grid>
            <Grid item xs={6} md={3}>
              <HqStatCard
                icon={ShoppingCart}
                label="Network Sales"
                value={summary?.total_sales}
                color="#059669"
              />
            </Grid>
          </Grid>

          {/* Quick navigation — compact, no duplicate nav text */}
          <HqQuickActions />

          {/* Branch snapshot — sales chart + shop list only */}
          <HqBranchSnapshot branches={branches} />
        </>
      )}

      <style jsx global>{`
        .hq-spin {
          animation: hqRefreshSpin 0.8s linear infinite;
        }
        @keyframes hqRefreshSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
