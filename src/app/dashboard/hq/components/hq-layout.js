'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  User,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { HQ_NAV, HQ_QUICK_ACTION, isHqNavActive } from './hq-nav';
import { COMPANY_NAME, HQ_LABEL } from './hq-brand';
import { useHqSession } from './use-hq-session';

export default function HqLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready } = useHqSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    [
      'user', 'login_mode', 'active_branch_id', 'active_branch_name',
      'active_branch_code', 'hq_pos_mode',
    ].forEach((k) => localStorage.removeItem(k));
    router.push('/?tab=hq');
  };

  if (!ready || !user) {
    return (
      <div className="hq-loading">
        <div className="hq-spinner" />
        <style jsx>{`
          .hq-loading {
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f1f5f9;
          }
          .hq-spinner {
            width: 44px;
            height: 44px;
            border: 3px solid #e2e8f0;
            border-top-color: #4f46e5;
            border-radius: 50%;
            animation: spin 0.75s linear infinite;
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className={`hq-shell ${collapsed ? 'hq-collapsed' : ''}`}>
      <aside className={`hq-sidebar ${sidebarOpen ? 'hq-sidebar-open' : ''}`}>
        <div className="hq-sidebar-brand">
          {!collapsed ? (
            <div>
              <p className="hq-brand-title">{COMPANY_NAME}</p>
              <p className="hq-brand-sub">{HQ_LABEL}</p>
            </div>
          ) : (
            <p className="hq-brand-collapsed" title={COMPANY_NAME}>HQ</p>
          )}
        </div>

        <nav className="hq-nav">
          {HQ_NAV.map((item) => {
            const Icon = item.icon;
            const active = isHqNavActive(pathname, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`hq-nav-item ${active ? 'hq-nav-active' : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={20} strokeWidth={active ? 2.25 : 2} />
                {!collapsed && (
                  <span className="hq-nav-text">
                    <span className="hq-nav-label">{item.label}</span>
                    <span className="hq-nav-desc">{item.description}</span>
                  </span>
                )}
                {active && <span className="hq-nav-indicator" />}
              </Link>
            );
          })}
        </nav>

        <div className="hq-sidebar-foot">
          <Link href={HQ_QUICK_ACTION.href} className="hq-quick-btn">
            <HQ_QUICK_ACTION.icon size={18} />
            {!collapsed && HQ_QUICK_ACTION.label}
          </Link>
          <button
            type="button"
            className="hq-collapse-btn"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          type="button"
          className="hq-overlay"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="hq-main">
        <header className="hq-topbar">
          <button
            type="button"
            className="hq-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            {sidebarOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="hq-topbar-spacer" />

          <div className="hq-user-chip">
            <User size={16} />
            <span>{user.full_name || user.email}</span>
          </div>
          <button type="button" className="hq-logout-btn" onClick={handleLogout}>
            <LogOut size={16} />
            <span>Logout</span>
          </button>
        </header>

        <main className="hq-content">{children}</main>
      </div>

      <style jsx global>{`
        .hq-shell {
          display: flex;
          min-height: 100vh;
          background: #f1f5f9;
          font-family: 'Segoe UI', system-ui, sans-serif;
        }

        .hq-sidebar {
          width: 268px;
          flex-shrink: 0;
          background: linear-gradient(180deg, #1e1b4b 0%, #312e81 45%, #3730a3 100%);
          color: white;
          display: flex;
          flex-direction: column;
          position: sticky;
          top: 0;
          height: 100vh;
          z-index: 200;
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 4px 0 24px rgba(30, 27, 75, 0.15);
        }

        .hq-collapsed .hq-sidebar {
          width: 76px;
        }

        .hq-sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 22px 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .hq-brand-icon {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .hq-brand-title {
          margin: 0;
          font-weight: 800;
          font-size: 0.82rem;
          line-height: 1.35;
        }

        .hq-brand-sub {
          margin: 2px 0 0;
          font-size: 0.72rem;
          opacity: 0.65;
        }

        .hq-brand-collapsed {
          margin: 0;
          font-weight: 800;
          font-size: 0.85rem;
          letter-spacing: 0.05em;
          text-align: center;
          width: 100%;
        }

        .hq-collapsed .hq-brand-collapsed {
          display: block;
        }

        .hq-nav {
          flex: 1;
          padding: 16px 12px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .hq-nav-item {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 14px;
          border-radius: 12px;
          color: rgba(255, 255, 255, 0.72);
          text-decoration: none;
          transition: all 0.22s ease;
          overflow: hidden;
        }

        .hq-nav-item:hover {
          background: rgba(255, 255, 255, 0.08);
          color: white;
          transform: translateX(2px);
        }

        .hq-nav-active {
          background: rgba(255, 255, 255, 0.14);
          color: white;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
        }

        .hq-nav-text {
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .hq-nav-label {
          font-weight: 700;
          font-size: 0.9rem;
        }

        .hq-nav-desc {
          font-size: 0.68rem;
          opacity: 0.55;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .hq-collapsed .hq-nav-desc,
        .hq-collapsed .hq-nav-label,
        .hq-collapsed .hq-brand-title,
        .hq-collapsed .hq-brand-sub {
          display: none;
        }

        .hq-collapsed .hq-nav-item {
          justify-content: center;
          padding: 12px;
        }

        .hq-nav-indicator {
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 24px;
          background: #38bdf8;
          border-radius: 0 4px 4px 0;
        }

        .hq-sidebar-foot {
          padding: 14px 12px 18px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .hq-quick-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 14px;
          border-radius: 11px;
          background: linear-gradient(135deg, #0284c7, #0ea5e9);
          color: white;
          font-weight: 700;
          font-size: 0.85rem;
          text-decoration: none;
          transition: transform 0.2s, box-shadow 0.2s;
          box-shadow: 0 4px 14px rgba(14, 165, 233, 0.35);
        }

        .hq-quick-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(14, 165, 233, 0.45);
        }

        .hq-collapse-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 8px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 8px;
          background: transparent;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          transition: background 0.2s;
        }

        .hq-collapse-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: white;
        }

        .hq-main {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .hq-topbar {
          height: 60px;
          background: white;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          padding: 0 20px;
          gap: 12px;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 1px 8px rgba(15, 23, 42, 0.04);
        }

        .hq-menu-btn {
          display: none;
          padding: 8px;
          border: none;
          background: #f1f5f9;
          border-radius: 10px;
          cursor: pointer;
          color: #475569;
        }

        .hq-topbar-spacer { flex: 1; }

        .hq-user-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: #f8fafc;
          border-radius: 999px;
          font-size: 0.85rem;
          font-weight: 600;
          color: #334155;
        }

        .hq-logout-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          background: white;
          color: #64748b;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .hq-logout-btn:hover {
          border-color: #fecaca;
          color: #dc2626;
          background: #fef2f2;
        }

        .hq-content {
          flex: 1;
          padding: 28px 24px 48px;
          max-width: 1400px;
          width: 100%;
          margin: 0 auto;
          animation: hqFadeIn 0.35s ease;
        }

        @keyframes hqFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .hq-overlay {
          display: none;
        }

        @media (max-width: 960px) {
          .hq-sidebar {
            position: fixed;
            left: 0;
            transform: translateX(-100%);
            transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          }
          .hq-sidebar-open {
            transform: translateX(0);
          }
          .hq-menu-btn { display: flex; }
          .hq-collapse-btn { display: none; }
          .hq-overlay {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.45);
            z-index: 150;
            border: none;
            cursor: pointer;
          }
          .hq-logout-btn span { display: none; }
        }
      `}</style>
    </div>
  );
}
