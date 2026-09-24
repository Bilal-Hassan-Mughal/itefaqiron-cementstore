'use client';

import { Menu, Mail, Bell, Home, Plus, LogOut, Building2, Users, BarChart3, FileBarChart } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { HQ_BRAND, HQ_GRADIENTS, HQ_SIDEBAR } from '@/lib/brand-theme';

function getUserDisplayName(user) {
  const name = (user?.full_name || '').trim();
  if (name) return name;
  const email = (user?.email || '').trim();
  if (email) return email.split('@')[0];
  return 'Admin';
}

const PAGE_TITLES = {
  '/dashboard/hq': 'Dashboard',
  '/dashboard/hq/branches': 'Branches',
  '/dashboard/hq/users': 'Branch Users',
  '/dashboard/hq/reports': 'Reports',
  '/dashboard/hq/reports/sales': 'Sale Report',
  '/dashboard/hq/reports/purchases': 'Purchase Report',
  '/dashboard/hq/reports/payments': 'Payment Report',
  '/dashboard/hq/reports/profit': 'Profit Report',
  '/dashboard/hq/reports/customers-balance': 'Top Customers — Pending Balance',
  '/dashboard/hq/reports/suppliers-balance': 'Top Suppliers — To Pay',
  '/dashboard/hq/reports/customers-activity': 'Top Customers — Purchased vs Received',
  '/dashboard/hq/reports/customers-supplies': 'Top Customers — Purchased vs Received',
  '/dashboard/hq/reports/suppliers-activity': 'Top Suppliers — Purchased vs Paid',
  '/dashboard/hq/reports/expenses': 'Expense Report — Booked vs Settled',
  '/dashboard/hq/monitoring': 'Monitoring',
  '/dashboard/hq/settings': 'Settings',
};

export default function HqHeader({ setSidebarOpen, user, onLogout }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }));
  }, []);

  const pageTitle = useMemo(() => {
    if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
    if (pathname.startsWith('/dashboard/hq/branches/')) return 'Branch Details';
    if (pathname.startsWith('/dashboard/hq/reports/')) return 'Reports';
    return 'Head Office';
  }, [pathname]);

  const userDisplayName = getUserDisplayName(user);
  const userInitial = userDisplayName.charAt(0).toUpperCase();

  const isBranchesActive = pathname.startsWith('/dashboard/hq/branches');
  const isUsersActive = pathname.startsWith('/dashboard/hq/users');
  const isReportsActive = pathname.startsWith('/dashboard/hq/reports');
  const isMonitoringActive = pathname.startsWith('/dashboard/hq/monitoring');

  return (
    <header className="sticky top-0 z-30">
      {/* Top strip — navy gradient (Branch uses solid blue) */}
      <div
        className="text-white px-4 md:px-6 py-2 flex items-center justify-between shadow-[0_2px_12px_rgba(30,27,75,0.2)]"
        style={{ background: HQ_GRADIENTS.header }}
      >
        <div className="flex items-center gap-1">
          <button type="button" className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Messages">
            <Mail className="w-4 h-4" />
          </button>
          <button type="button" className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Notifications">
            <Bell className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="hidden sm:inline text-white/75 font-semibold tracking-wide">HEAD OFFICE</span>
          <span
            className="px-2.5 py-0.5 rounded-md text-[#1e1b4b] text-[10px] font-extrabold uppercase tracking-wide shadow-sm"
            style={{ background: HQ_BRAND.badge }}
          >
            Live
          </span>
          <span className="hidden md:inline text-white/90">{currentDate}</span>
          <button
            type="button"
            onClick={() => router.push('/dashboard/hq')}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="HQ Home"
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-lg hover:bg-[#f59e0b]/90 bg-white/10 border border-white/20 transition-colors"
            aria-label="Logout"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action bar — same layout as Branch header */}
      <div className="bg-white border-b border-[#e8ecf3] shadow-[0_1px_8px_rgba(15,23,42,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-500 hover:text-slate-800 p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => router.push('/dashboard/hq/branches?create=1')}
                className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all shadow-sm ${
                  isBranchesActive ? 'ring-2 ring-[#f59e0b]/40 ring-offset-1' : 'hover:brightness-105'
                }`}
                style={{ background: HQ_GRADIENTS.btnPrimary }}
              >
                <Building2 className="w-4 h-4" />
                New Branch
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/hq/users')}
                className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
                  isUsersActive ? 'ring-2 ring-[#4338ca]/20 ring-offset-1' : ''
                }`}
                style={{
                  borderColor: HQ_BRAND.primary,
                  color: HQ_BRAND.primaryDark,
                  background: isUsersActive ? HQ_BRAND.tint : 'transparent',
                }}
              >
                <Users className="w-4 h-4" />
                Branch Users
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/hq/reports')}
                className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
                  isReportsActive ? 'ring-2 ring-[#4338ca]/20 ring-offset-1' : ''
                }`}
                style={{
                  borderColor: HQ_BRAND.primary,
                  color: HQ_BRAND.primaryDark,
                  background: isReportsActive ? HQ_BRAND.tint : 'transparent',
                }}
              >
                <FileBarChart className="w-4 h-4" />
                Reports
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/hq/monitoring')}
                className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
                  isMonitoringActive ? 'ring-2 ring-[#0d9488]/25 ring-offset-1' : ''
                }`}
                style={{
                  borderColor: HQ_BRAND.teal,
                  color: HQ_BRAND.tealDark,
                  background: isMonitoringActive ? '#ecfdf5' : 'transparent',
                }}
              >
                <BarChart3 className="w-4 h-4" />
                Monitoring
              </button>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 font-medium">
            <span className="font-semibold" style={{ color: HQ_BRAND.primary }}>{pageTitle}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">Head Office Portal</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => router.push('/dashboard/hq/branches?create=1')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:brightness-105 active:scale-[0.98]"
              style={{
                background: HQ_GRADIENTS.btnAccent,
                boxShadow: '0 4px 14px rgba(124, 58, 237, 0.28)',
              }}
            >
              <Plus className="w-4 h-4" strokeWidth={2.25} />
              <span className="hidden sm:inline">Create Branch</span>
            </button>
            <div className="hidden md:flex items-center gap-2.5 pl-3 ml-1 border-l border-slate-200">
              <div className="text-right min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate max-w-[140px]" title={userDisplayName}>
                  {userDisplayName}
                </p>
                <p
                  className="text-[10px] uppercase tracking-wide font-bold truncate max-w-[140px]"
                  style={{ color: HQ_BRAND.highlightDark }}
                  title="HQ Administrator"
                >
                  HQ Admin
                </p>
              </div>
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center shadow-md shrink-0 ring-2 ring-white"
                style={{ background: HQ_SIDEBAR.avatarGradient }}
              >
                <span className="text-white text-xs font-bold">{userInitial}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="md:hidden px-4 pb-2.5 flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold" style={{ color: HQ_BRAND.primary }}>{pageTitle}</span>
          <span className="text-slate-300">|</span>
          <span>Head Office</span>
        </div>
      </div>
    </header>
  );
}
