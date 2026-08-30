'use client';

import Link from 'next/link';
import { Building2, Store, ArrowRight, Shield, MapPin, Phone } from 'lucide-react';

export default function LoginShell({
  children,
  badge,
  badgeColor = '#1d4ed8',
  title,
  subtitle,
  backHref = '/',
  backLabel = 'Back to home',
}) {
  return (
    <div className="login-shell" style={{ display: 'flex', minHeight: '100vh', width: '100%', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      {/* Brand panel */}
      <div
        style={{
          flex: '1 1 50%',
          background: 'linear-gradient(135deg, #1a237e 0%, #283593 30%, #1565c0 65%, #0288d1 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px',
          position: 'relative',
          overflow: 'hidden',
        }}
        className="login-brand-panel"
      >
        <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '320px', height: '320px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', bottom: '-100px', left: '-60px', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <div
          style={{
            width: '96px',
            height: '96px',
            borderRadius: '24px',
            background: 'rgba(255,255,255,0.15)',
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '28px',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          }}
        >
          <Store size={52} color="white" strokeWidth={1.5} />
        </div>

        <h1 style={{ color: 'white', fontSize: '2rem', fontWeight: 800, textAlign: 'center', marginBottom: '8px', lineHeight: 1.2 }}>
          Itefaq Iron &amp;<br />Cement Store
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: '1.2rem', fontWeight: 600, textAlign: 'center', marginBottom: '20px', direction: 'rtl' }}>
          اتفاق آئرن اینڈ سیمنٹ سٹور
        </p>
        <div style={{ width: '48px', height: '3px', background: 'rgba(255,255,255,0.4)', borderRadius: '2px', marginBottom: '20px' }} />

        {badge && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 999,
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.22)',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              marginBottom: 20,
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: badgeColor }} />
            {badge}
          </span>
        )}

        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.95rem', textAlign: 'center', lineHeight: 1.6, maxWidth: '340px' }}>
          {title}
        </p>
        {subtitle && (
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', textAlign: 'center', marginTop: 10, maxWidth: '340px' }}>
            {subtitle}
          </p>
        )}

        <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
            <MapPin size={14} /> Gujrat Sargodha Road, Pahrian Wali
          </p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
            <Phone size={14} /> 0346-7560306 · 0300-7560306
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div
        style={{
          flex: '1 1 50%',
          background: '#f8fafc',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 24px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <Link
            href={backHref}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              color: '#64748b',
              fontSize: '0.875rem',
              fontWeight: 500,
              textDecoration: 'none',
              marginBottom: 24,
            }}
          >
            ← {backLabel}
          </Link>
          {children}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .login-shell { flex-direction: column !important; }
          .login-brand-panel { min-height: 280px; flex: none !important; padding: 32px 24px !important; }
        }
      `}</style>
    </div>
  );
}

export function LoginFormFields({
  email,
  setEmail,
  password,
  setPassword,
  showPassword,
  setShowPassword,
  branchCode,
  setBranchCode,
  showBranchCode = false,
  branchOptions = null,
  branchesLoading = false,
  error,
  loading,
  submitLabel = 'Sign In',
  accent = '#1d4ed8',
  accentDark = '#1e40af',
  onSubmit,
}) {
  const selectedBranch = branchOptions?.find((b) => b.branch_code === branchCode);

  return (
    <form onSubmit={onSubmit}>
      {showBranchCode && (
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            Select Branch
          </label>
          {branchesLoading ? (
            <div
              style={{
                ...inputStyle,
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#f8fafc',
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  border: '2px solid #cbd5e1',
                  borderTopColor: accent,
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  flexShrink: 0,
                }}
              />
              Loading branches…
            </div>
          ) : branchOptions && branchOptions.length > 0 ? (
            <>
              <select
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                required
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  appearance: 'auto',
                }}
                onFocus={(e) => { e.target.style.borderColor = accent; }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
              >
                <option value="" disabled>
                  Choose your branch…
                </option>
                {branchOptions.map((b) => (
                  <option key={b.branch_id || b.branch_code} value={b.branch_code}>
                    {b.branch_code} — {b.branch_name}
                  </option>
                ))}
              </select>
              {selectedBranch && (
                <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 6, marginBottom: 0 }}>
                  Signing in to <strong>{selectedBranch.branch_name}</strong> ({selectedBranch.branch_code})
                </p>
              )}
            </>
          ) : (
            <>
              <input
                type="text"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value.toUpperCase())}
                placeholder="e.g. MAIN, LHR"
                autoComplete="off"
                required
                style={inputStyle}
                onFocus={(e) => { e.target.style.borderColor = accent; }}
                onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
              />
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 6, marginBottom: 0 }}>
                No branches loaded — enter the code from Head Office.
              </p>
            </>
          )}
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>
          Email Address
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus={!showBranchCode}
          style={inputStyle}
          onFocus={(e) => { e.target.style.borderColor = accent; }}
          onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: 8 }}>
          Password
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            autoComplete="current-password"
            style={{ ...inputStyle, paddingRight: 44 }}
            onFocus={(e) => { e.target.style.borderColor = accent; }}
            onBlur={(e) => { e.target.style.borderColor = '#e2e8f0'; }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            style={{
              position: 'absolute',
              right: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: 4,
            }}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? '🙈' : '👁'}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 18,
            color: '#dc2626',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        style={{
          width: '100%',
          padding: 14,
          background: loading ? '#93c5fd' : `linear-gradient(135deg, ${accent}, ${accentDark})`,
          color: 'white',
          border: 'none',
          borderRadius: 12,
          fontSize: '1rem',
          fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: loading ? 'none' : `0 4px 14px ${accent}59`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
        }}
      >
        {loading ? 'Signing in…' : submitLabel}
      </button>
    </form>
  );
}

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  border: '2px solid #e2e8f0',
  borderRadius: 12,
  fontSize: '0.9375rem',
  color: '#0f172a',
  background: 'white',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.2s',
};

export { Building2, Store, ArrowRight, Shield };
