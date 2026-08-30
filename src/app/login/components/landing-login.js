'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, MapPin, Phone, Store } from 'lucide-react';
import { LoginFormFields } from './login-shell';
import { useAuthLogin, useSessionGuard } from './use-login';

const BRAND = {
  branch: {
    badge: 'Branch Portal',
    badgeColor: '#0DCAF0',
    title: 'Sign in to your branch POS — sales, stock, and accounts for your location.',
    subtitle: 'Select your branch, then use credentials from your manager.',
    accent: '#1A55E3',
    accentDark: '#1347c4',
    submitLabel: 'Sign in to Branch',
  },
  hq: {
    badge: 'Head Office Portal',
    badgeColor: '#5E6EED',
    title: 'Manage all branches from one place — create locations and assign admins.',
    subtitle: 'Use your HQ administrator credentials only.',
    accent: '#5E6EED',
    accentDark: '#4a57d4',
    submitLabel: 'Sign in to Head Office',
  },
};

export default function LandingLogin() {
  useSessionGuard();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'hq' ? 'hq' : 'branch';
  const [tab, setTab] = useState(initialTab);
  const [animKey, setAnimKey] = useState(0);

  const branchAuth = useAuthLogin('branch');
  const hqAuth = useAuthLogin('hq');

  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(true);

  useEffect(() => {
    const t = searchParams.get('tab') === 'hq' ? 'hq' : 'branch';
    setTab(t);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBranchesLoading(true);
      try {
        const res = await fetch('/api/branches/public');
        const data = await res.json();
        if (!res.ok || cancelled) return;
        const list = data.branches || [];
        setBranches(list);
        if (list.length === 1) branchAuth.setBranchCode(list[0].branch_code);
      } catch {
        /* fallback to manual entry in form */
      } finally {
        if (!cancelled) setBranchesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTab = (next) => {
    if (next === tab) return;
    setTab(next);
    setAnimKey((k) => k + 1);
    if (typeof window !== 'undefined') {
      const url = next === 'hq' ? '/?tab=hq' : '/';
      window.history.replaceState(null, '', url);
    }
  };

  const brand = BRAND[tab];
  const isBranch = tab === 'branch';

  return (
    <div className="landing-root">
      {/* Brand panel */}
      <div className="landing-brand">
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />

        <div className="brand-content">
          <div className="brand-logo">
            <Store size={48} color="white" strokeWidth={1.5} />
          </div>

          <h1 className="brand-title">
            Itefaq Iron &amp;<br />Cement Store
          </h1>
          <p className="brand-title-ur">اتفاق آئرن اینڈ سیمنٹ سٹور</p>
          <div className="brand-divider" />

          <span className="brand-badge" key={`badge-${tab}`}>
            <span className="badge-dot" style={{ background: brand.badgeColor }} />
            {brand.badge}
          </span>

          <p className="brand-desc" key={`desc-${tab}`}>
            {brand.title}
          </p>
          <p className="brand-sub">{brand.subtitle}</p>

          <div className="brand-contact">
            <span><MapPin size={14} /> Gujrat Sargodha Road, Pahrian Wali</span>
            <span><Phone size={14} /> 0346-7560306 · 0300-7560306</span>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="landing-form-panel">
        <div className="form-wrap">
          <div className="tab-switch" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={isBranch}
              className={`tab-btn ${isBranch ? 'tab-active tab-branch' : ''}`}
              onClick={() => switchTab('branch')}
            >
              <Store size={16} />
              Branch
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={!isBranch}
              className={`tab-btn ${!isBranch ? 'tab-active tab-hq' : ''}`}
              onClick={() => switchTab('hq')}
            >
              <Building2 size={16} />
              Head Office
            </button>
            <span
              className="tab-indicator"
              style={{
                transform: isBranch ? 'translateX(0)' : 'translateX(100%)',
                background: isBranch
                  ? 'linear-gradient(135deg, #0284c7, #0ea5e9)'
                  : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                boxShadow: isBranch
                  ? '0 4px 14px rgba(2, 132, 199, 0.35)'
                  : '0 4px 14px rgba(79, 70, 229, 0.35)',
              }}
            />
          </div>

          <div className="form-header">
            <h2>{isBranch ? 'Branch Sign In' : 'HQ Sign In'}</h2>
            <p>{isBranch ? 'Your store POS system' : 'Administrator access'}</p>
          </div>

          <div className="form-body" key={animKey}>
            {isBranch ? (
              <LoginFormFields
                email={branchAuth.email}
                setEmail={branchAuth.setEmail}
                password={branchAuth.password}
                setPassword={branchAuth.setPassword}
                branchCode={branchAuth.branchCode}
                setBranchCode={branchAuth.setBranchCode}
                showBranchCode
                branchOptions={branches.length > 0 ? branches : null}
                branchesLoading={branchesLoading}
                showPassword={branchAuth.showPassword}
                setShowPassword={branchAuth.setShowPassword}
                error={branchAuth.error}
                loading={branchAuth.loading}
                submitLabel={brand.submitLabel}
                accent={brand.accent}
                accentDark={brand.accentDark}
                onSubmit={branchAuth.handleSubmit}
              />
            ) : (
              <LoginFormFields
                email={hqAuth.email}
                setEmail={hqAuth.setEmail}
                password={hqAuth.password}
                setPassword={hqAuth.setPassword}
                showPassword={hqAuth.showPassword}
                setShowPassword={hqAuth.setShowPassword}
                error={hqAuth.error}
                loading={hqAuth.loading}
                submitLabel={brand.submitLabel}
                accent={brand.accent}
                accentDark={brand.accentDark}
                onSubmit={hqAuth.handleSubmit}
              />
            )}
          </div>
        </div>

        <p className="form-footer">© {new Date().getFullYear()} Itefaq Iron & Cement Store</p>
      </div>

      <style jsx global>{`
        .landing-root {
          display: flex;
          min-height: 100vh;
          width: 100%;
          font-family: 'Segoe UI', system-ui, sans-serif;
        }

        .landing-brand {
          flex: 1 1 52%;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 32px;
          background: linear-gradient(145deg, #1a237e 0%, #283593 28%, #1565c0 62%, #0288d1 100%);
        }

        .orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .orb-1 {
          width: 420px;
          height: 420px;
          top: -120px;
          right: -100px;
          background: rgba(255, 255, 255, 0.06);
          animation: floatOrb 14s ease-in-out infinite;
        }
        .orb-2 {
          width: 320px;
          height: 320px;
          bottom: -80px;
          left: -60px;
          background: rgba(255, 255, 255, 0.05);
          animation: floatOrb 18s ease-in-out infinite reverse;
        }
        .orb-3 {
          width: 180px;
          height: 180px;
          top: 40%;
          left: 15%;
          background: rgba(56, 189, 248, 0.08);
          animation: floatOrb 11s ease-in-out infinite 2s;
        }

        @keyframes floatOrb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(12px, -18px) scale(1.04); }
        }

        .brand-content {
          position: relative;
          z-index: 1;
          text-align: center;
          max-width: 400px;
          animation: brandFadeIn 0.8s ease-out;
        }

        @keyframes brandFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .brand-logo {
          width: 88px;
          height: 88px;
          margin: 0 auto 24px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.14);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.22);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
          animation: logoPulse 4s ease-in-out infinite;
        }

        @keyframes logoPulse {
          0%, 100% { box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18); }
          50% { box-shadow: 0 12px 40px rgba(255, 255, 255, 0.12); }
        }

        .brand-title {
          color: white;
          font-size: clamp(1.65rem, 3.5vw, 2rem);
          font-weight: 800;
          line-height: 1.2;
          margin: 0 0 8px;
        }

        .brand-title-ur {
          color: rgba(255, 255, 255, 0.88);
          font-size: 1.15rem;
          font-weight: 600;
          margin: 0 0 20px;
          direction: rtl;
        }

        .brand-divider {
          width: 48px;
          height: 3px;
          background: rgba(255, 255, 255, 0.4);
          border-radius: 2px;
          margin: 0 auto 20px;
        }

        .brand-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 18px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          font-size: 0.875rem;
          font-weight: 600;
          margin-bottom: 18px;
          animation: tabContentIn 0.4s ease;
        }

        .badge-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .brand-desc {
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.92rem;
          line-height: 1.55;
          margin: 0 0 8px;
          animation: tabContentIn 0.4s ease;
        }

        .brand-sub {
          color: rgba(255, 255, 255, 0.55);
          font-size: 0.82rem;
          margin: 0 0 28px;
        }

        .brand-contact {
          display: flex;
          flex-direction: column;
          gap: 8px;
          align-items: center;
        }

        .brand-contact span {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 0.82rem;
        }

        .landing-form-panel {
          flex: 1 1 48%;
          background: #f8fafc;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 32px 24px;
        }

        .form-wrap {
          width: 100%;
          max-width: 400px;
          animation: formSlideIn 0.6s ease-out 0.15s both;
        }

        @keyframes formSlideIn {
          from { opacity: 0; transform: translateX(24px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .tab-switch {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: #e2e8f0;
          border-radius: 14px;
          padding: 4px;
          margin-bottom: 28px;
        }

        .tab-btn {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 16px;
          border: none;
          background: transparent;
          border-radius: 11px;
          font-size: 0.9rem;
          font-weight: 700;
          color: #64748b;
          cursor: pointer;
          transition: color 0.25s ease;
        }

        .tab-btn.tab-active {
          color: white;
        }

        .tab-indicator {
          position: absolute;
          top: 4px;
          left: 4px;
          width: calc(50% - 4px);
          height: calc(100% - 8px);
          border-radius: 11px;
          background: linear-gradient(135deg, #0284c7, #0ea5e9);
          transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .form-header {
          margin-bottom: 22px;
        }

        .form-header h2 {
          font-size: 1.65rem;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px;
        }

        .form-header p {
          color: #64748b;
          font-size: 0.875rem;
          margin: 0;
        }

        .form-body {
          animation: tabContentIn 0.35s ease;
        }

        @keyframes tabContentIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .form-footer {
          margin-top: 32px;
          color: #94a3b8;
          font-size: 0.75rem;
          text-align: center;
        }

        @media (max-width: 900px) {
          .landing-root {
            flex-direction: column;
          }
          .landing-brand {
            flex: none;
            min-height: 42vh;
            padding: 36px 24px;
          }
          .brand-contact {
            display: none;
          }
          .landing-form-panel {
            flex: 1;
            padding: 28px 20px 40px;
          }
        }
      `}</style>
    </div>
  );
}
