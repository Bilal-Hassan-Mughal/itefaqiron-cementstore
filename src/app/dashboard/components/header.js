'use client';

import { Menu, Mail, Bell, Home, Plus, LogOut, UserPlus, BookOpen } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { getStaffRoleName, canStaffAccessPath, getRoleDisplayName } from '@/lib/staff-access';

function getUserDisplayName(user) {
  const name = (user?.full_name || '').trim();
  if (name) return name;
  const email = (user?.email || '').trim();
  if (email) return email.split('@')[0];
  return 'User';
}

function getUserRoleLabel(user) {
  const role = getStaffRoleName(user) || user?.role;
  return getRoleDisplayName(role);
}

export default function Header({ sidebarOpen, setSidebarOpen, activeTab, user, branchLabel, onLogout }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [currentDate, setCurrentDate] = useState('');

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }));
  }, []);

  const viewParam = searchParams?.get('view');
  const typeParam = searchParams?.get('type');
  const actionParam = searchParams?.get('action');

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

  const isAddCustomerActive =
    pathname === '/dashboard/customers' &&
    actionParam === 'add';

  const isLedgerActive = pathname === '/dashboard/finance';

  const handleAddCustomer = () => {
    if (pathname === '/dashboard/customers') {
      window.dispatchEvent(new CustomEvent('open-customer-form'));
      return;
    }
    router.push('/dashboard/customers?action=add');
  };

  const pageTitle = activeTab === 'dashboard'
    ? 'Dashboard'
    : activeTab === 'new-sale'
      ? 'New Sale'
      : activeTab === 'customers'
        ? 'Accounts'
        : String(activeTab || 'dashboard').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const branchCode = branchLabel || 'MAIN';
  const userDisplayName = getUserDisplayName(user);
  const userRoleLabel = getUserRoleLabel(user);
  const userInitial = userDisplayName.charAt(0).toUpperCase();

  const canNewSale = user && canStaffAccessPath(user, '/dashboard/sales');
  const canNewPurchase = user && canStaffAccessPath(user, '/dashboard/purchases');
  const canOrders = user && canStaffAccessPath(user, '/dashboard/orders');
  const canLedger = user && canStaffAccessPath(user, '/dashboard/finance');
  const canAddCustomerBtn = user && canStaffAccessPath(user, '/dashboard/customers');
  const canAddProduct = user && canStaffAccessPath(user, '/dashboard/products');
  const hasHeaderActions = canNewSale || canNewPurchase || canOrders || canLedger || canAddCustomerBtn || canAddProduct;

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
            {hasHeaderActions && (
            <div className="flex items-center gap-2 flex-wrap">
              {canNewSale && (
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
              )}
              {canNewPurchase && (
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
              )}
              {canOrders && (
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
              )}
            </div>
            )}
          </div>

          <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 font-medium">
            <span className="text-[#1A55E3] font-semibold">{pageTitle}</span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-600">{branchCode}</span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {canLedger && (
            <button
              type="button"
              onClick={() => router.push('/dashboard/finance')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isLedgerActive
                  ? 'text-white bg-[#4a57d4] border border-[#5E6EED]/40 shadow-[0_4px_12px_rgba(94,110,237,0.28)] ring-2 ring-[#5E6EED]/25 ring-offset-1'
                  : 'text-white bg-[#5E6EED] border border-[#5E6EED]/30 shadow-[0_1px_2px_rgba(94,110,237,0.2)] hover:bg-[#4a57d4] hover:shadow-[0_4px_12px_rgba(94,110,237,0.28)] active:bg-[#4338ca]'
              }`}
            >
              <BookOpen className="w-4 h-4" strokeWidth={2.25} />
              <span className="hidden sm:inline">Ledger</span>
            </button>
            )}
            {canAddCustomerBtn && (
            <button
              type="button"
              onClick={handleAddCustomer}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isAddCustomerActive
                  ? 'text-white bg-[#1347c4] border border-[#1A55E3]/40 shadow-[0_4px_12px_rgba(26,85,227,0.28)] ring-2 ring-[#1A55E3]/25 ring-offset-1'
                  : 'text-white bg-[#1A55E3] border border-[#1A55E3]/30 shadow-[0_1px_2px_rgba(26,85,227,0.2)] hover:bg-[#1347c4] hover:shadow-[0_4px_12px_rgba(26,85,227,0.28)] active:bg-[#103da8]'
              }`}
            >
              <UserPlus className="w-4 h-4" strokeWidth={2.25} />
              <span className="hidden sm:inline">Add Customer</span>
            </button>
            )}
            {canAddProduct && (
            <button
              type="button"
              onClick={() => router.push('/dashboard/products')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-[#00D284] border border-[#00c978]/30 shadow-[0_1px_2px_rgba(0,168,104,0.2)] hover:bg-[#00c978] hover:shadow-[0_4px_12px_rgba(0,210,132,0.28)] active:bg-[#00b872] transition-all duration-200"
            >
              <Plus className="w-4 h-4" strokeWidth={2.25} />
              <span className="hidden sm:inline">Add Product</span>
            </button>
            )}
            <div className="hidden md:flex items-center gap-2.5 pl-3 ml-1 border-l border-slate-200">
              <div className="text-right min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate max-w-[140px]" title={userDisplayName}>
                  {userDisplayName}
                </p>
                <p className="text-[10px] text-[#1A55E3] uppercase tracking-wide font-bold truncate max-w-[140px]" title={userRoleLabel}>
                  {userRoleLabel}
                </p>
              </div>
              <div className="w-9 h-9 bg-gradient-to-br from-[#1A55E3] to-[#5E6EED] rounded-full flex items-center justify-center shadow-sm shrink-0">
                <span className="text-white text-xs font-bold">
                  {userInitial}
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
