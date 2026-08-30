'use client';

import { Menu, Mail, Bell, Home, Plus, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export default function Header({ sidebarOpen, setSidebarOpen, activeTab, user, branchLabel, onLogout }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }));
  }, []);

  const viewParam = searchParams?.get('view');
  const typeParam = searchParams?.get('type');

  const isNewSaleActive =
    pathname === '/dashboard/sales' &&
    typeParam !== 'return';

  const isNewPurchaseActive =
    pathname === '/dashboard/purchases' &&
    (viewParam === 'create' || viewParam === 'new') &&
    typeParam !== 'return';

  const isOrdersActive =
    pathname === '/dashboard/orders' &&
    viewParam === 'create';

  const pageTitle = activeTab === 'dashboard'
    ? 'Dashboard'
    : activeTab === 'new-sale'
      ? 'New Sale'
      : activeTab === 'customers'
        ? 'Accounts'
        : String(activeTab || 'dashboard').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const branchCode = branchLabel || 'MAIN';

  return (
    <header className="sticky top-0 z-30">
      {/* Top blue strip */}
      <div className="bg-[#1A55E3] text-white px-4 md:px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button type="button" className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Messages">
            <Mail className="w-4 h-4" />
          </button>
          <button type="button" className="p-2 rounded-lg hover:bg-white/10 transition-colors" aria-label="Notifications">
            <Bell className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="hidden sm:inline text-white/80">Status</span>
          <span className="px-2.5 py-0.5 rounded-md bg-[#FF0854] text-white text-[10px] font-bold uppercase tracking-wide">
            Live
          </span>
          <span className="hidden md:inline text-white/90">{currentDate}</span>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Home"
          >
            <Home className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="p-2 rounded-lg hover:bg-[#FF0854]/90 bg-white/10 border border-white/20 transition-colors"
            aria-label="Logout"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main action bar */}
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
                onClick={() => router.push('/dashboard/sales')}
                className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm ${
                  isNewSaleActive
                    ? 'bg-[#1347c4] text-white ring-2 ring-[#1A55E3]/30 ring-offset-1'
                    : 'bg-[#1A55E3] text-white hover:bg-[#1347c4]'
                }`}
              >
                New Sale
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/purchases?view=create')}
                className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
                  isNewPurchaseActive
                    ? 'border-[#1A55E3] bg-[#e8effd] text-[#1347c4] ring-2 ring-[#1A55E3]/20 ring-offset-1'
                    : 'border-[#1A55E3] text-[#1A55E3] hover:bg-[#e8effd]'
                }`}
              >
                New Purchase
              </button>
              <button
                type="button"
                onClick={() => router.push('/dashboard/orders?view=create&type=ORDER')}
                className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${
                  isOrdersActive
                    ? 'border-[#0DCAF0] bg-[#e0f7fc] text-[#0e7490] ring-2 ring-[#0DCAF0]/25 ring-offset-1'
                    : 'border-[#0DCAF0] text-[#0891b2] hover:bg-[#e0f7fc]'
                }`}
              >
                Orders
              </button>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 font-medium">
            <span className="text-[#1A55E3] font-semibold">{pageTitle}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">{branchCode}</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => router.push('/dashboard/products')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#00D284] text-white text-sm font-semibold hover:bg-[#00b872] transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Product</span>
            </button>
            <div className="hidden lg:flex items-center gap-2 pl-3 ml-1 border-l border-slate-200">
              <div className="text-right">
                <p className="text-sm font-semibold text-slate-900 truncate max-w-[120px]">
                  {user?.full_name || user?.email || 'User'}
                </p>
                <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium truncate max-w-[120px]">
                  {branchLabel || user?.role?.displayName || user?.role?.name || user?.role || 'Admin'}
                </p>
              </div>
              <div className="w-9 h-9 bg-gradient-to-br from-[#1A55E3] to-[#5E6EED] rounded-full flex items-center justify-center shadow-sm">
                <span className="text-white text-xs font-bold">
                  {(user?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="md:hidden px-4 pb-2.5 flex items-center gap-2 text-xs text-slate-500">
          <span className="text-[#1A55E3] font-semibold">{pageTitle}</span>
          <span className="text-slate-300">|</span>
          <span>{branchCode}</span>
        </div>
      </div>
    </header>
  );
}
