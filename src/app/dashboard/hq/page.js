'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert } from '@mui/material';
import { Building2, PlayCircle, Users, ShoppingCart, BarChart3, FileBarChart } from 'lucide-react';
import { branchFetch } from '@/lib/branch-client';
import {
  HQ_KPI_PALETTE,
  HQ_QUICK_ENTRY_TONES,
  HQ_UI,
} from '@/lib/brand-theme';
import HqQuickActions from './components/hq-quick-actions';
import HqReportsSection from './components/hq-reports-section';
import { useHqSession } from './components/use-hq-session';

const REFRESH_MS = 30000;

export default function HqDashboardPage() {
  const { user, ready } = useHqSession();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async (currentUser, silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    try {
      const res = await branchFetch(currentUser, '/api/branches/stats');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load dashboard');
      setSummary(data.summary);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready || !user) return;
    loadData(user);
    const timer = setInterval(() => loadData(user, true), REFRESH_MS);
    return () => clearInterval(timer);
  }, [ready, user, loadData]);

  if (!ready) return null;

  const kpiData = [
    { title: 'Total Shops', value: summary?.total_branches ?? 0, icon: Building2, theme: 'indigo' },
    {
      title: 'Active Shops',
      value: summary?.active_branches ?? 0,
      icon: PlayCircle,
      theme: 'green',
      sub: summary?.suspended_branches ? `${summary.suspended_branches} suspended` : null,
    },
    { title: 'Branch Staff', value: summary?.total_users ?? 0, icon: Users, theme: 'cyan' },
    { title: 'Network Sales', value: summary?.total_sales ?? 0, icon: ShoppingCart, theme: 'gold' },
  ];

  const quickEntryActions = [
    { title: 'Create Branch', subtitle: 'Add a new shop location', icon: Building2, tone: 'indigo', path: '/dashboard/hq/branches?create=1' },
    { title: 'Branch Users', subtitle: 'Manage staff accounts', icon: Users, tone: 'violet', path: '/dashboard/hq/users' },
    { title: 'Reports', subtitle: 'Sales, profit & expenses', icon: FileBarChart, tone: 'violet', path: '/dashboard/hq/reports' },
    { title: 'Live Monitoring', subtitle: 'Compare branch activity', icon: BarChart3, tone: 'neutral', path: '/dashboard/hq/monitoring' },
  ];

  return (
    <div className={HQ_UI.pageWrap}>
      {error && (
        <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`${HQ_UI.card} p-5 animate-pulse`}>
              <div className="h-20 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {kpiData.map((kpi) => {
              const p = HQ_KPI_PALETTE[kpi.theme] || HQ_KPI_PALETTE.indigo;
              const Icon = kpi.icon;
              return (
                <div key={kpi.title} className={`${HQ_UI.card} ${HQ_UI.cardHover} p-5 ring-1 ${p.ring}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">{kpi.title}</p>
                      <p className="text-[1.65rem] font-extrabold text-slate-900 tracking-tight leading-none">
                        {typeof kpi.value === 'number' ? kpi.value.toLocaleString() : kpi.value}
                      </p>
                      {kpi.sub && <p className="text-xs text-slate-400 mt-2">{kpi.sub}</p>}
                    </div>
                    <div className={`w-12 h-12 rounded-xl ${p.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <Icon className={`w-5 h-5 ${p.icon}`} strokeWidth={2.25} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-5">
            <HqQuickActions />

            <div className={`${HQ_UI.card} overflow-hidden`}>
              <div className={HQ_UI.sectionHeader}>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Quick Entry</h3>
                <p className="text-xs text-slate-500 mt-0.5 font-medium">High-priority HQ actions</p>
              </div>
              <div className="p-4 space-y-3 bg-gradient-to-b from-white to-slate-50/50">
                {quickEntryActions.map((action) => {
                  const isPrimary = action.tone === 'indigo' || action.tone === 'violet';
                  const toneStyle = HQ_QUICK_ENTRY_TONES[action.tone] || HQ_QUICK_ENTRY_TONES.neutral;
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.title}
                      type="button"
                      onClick={() => { window.location.href = action.path; }}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200 ${toneStyle.className}`}
                    >
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isPrimary ? 'bg-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]' : 'bg-slate-100'}`}>
                        <Icon className={`w-4 h-4 ${isPrimary ? 'text-white' : 'text-slate-600'}`} strokeWidth={2.25} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-bold leading-tight ${isPrimary ? 'text-white' : 'text-slate-900'}`}>{action.title}</p>
                        <p className={`text-[11px] mt-0.5 truncate ${isPrimary ? 'text-white/85' : 'text-slate-500'}`}>{action.subtitle}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <HqReportsSection user={user} />
        </>
      )}
    </div>
  );
}
