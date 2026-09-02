'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SampleFormat } from '@digitalpersona/devices';
import { Fingerprint, Mail } from 'lucide-react';
import { useFingerprintReader } from '@/hooks/useFingerprintReader';
import { useLoginRedirect } from './use-login';

const MODES = [
  { id: 'password', label: 'Email & Password', icon: Mail },
  { id: 'fingerprint', label: 'Fingerprint', icon: Fingerprint },
];

export function HqAuthModeSwitch({ mode, onChange, accent, bioMode = false }) {
  return (
    <div className={`hq-auth-modes ${bioMode ? 'bio-mode' : ''}`} role="tablist">
      {MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={mode === id}
          className={`hq-auth-mode-btn ${mode === id ? 'active' : ''} ${bioMode ? 'bio-tab' : ''}`}
          style={
            mode === id && !bioMode
              ? { background: `linear-gradient(135deg, ${accent}, #7c3aed)`, borderColor: accent }
              : undefined
          }
          onClick={() => onChange(id)}
        >
          <Icon size={bioMode ? 14 : 16} strokeWidth={2.25} />
          {bioMode && id === 'fingerprint' ? 'Scan' : bioMode && id === 'password' ? 'Email' : label}
        </button>
      ))}
    </div>
  );
}

/** Minimal animated fingerprint icon — decorative only, no data */
function AnimatedFingerprintIcon() {
  return (
    <svg className="fp-icon" viewBox="0 0 120 120" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="fpGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#818cf8" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#4f46e5" />
        </linearGradient>
        <linearGradient id="fpGradOk" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="#16a34a" />
        </linearGradient>
      </defs>
      {/* Fingerprint ridges */}
      <path className="fp-ridge fp-r1" d="M60 18 C42 18 28 32 28 50 C28 68 36 78 36 92" stroke="url(#fpGrad)" strokeWidth="3.5" strokeLinecap="round" />
      <path className="fp-ridge fp-r2" d="M60 24 C48 24 38 36 38 50 C38 64 44 72 44 88" stroke="url(#fpGrad)" strokeWidth="3.5" strokeLinecap="round" />
      <path className="fp-ridge fp-r3" d="M60 30 C52 30 46 40 46 50 C46 60 50 68 50 82" stroke="url(#fpGrad)" strokeWidth="3.5" strokeLinecap="round" />
      <path className="fp-ridge fp-r4" d="M60 36 C56 36 52 44 52 50 C52 56 54 62 54 74" stroke="url(#fpGrad)" strokeWidth="3.5" strokeLinecap="round" />
      <path className="fp-ridge fp-r5" d="M82 18 C100 18 114 32 114 50 C114 68 106 78 106 92" stroke="url(#fpGrad)" strokeWidth="3.5" strokeLinecap="round" />
      <path className="fp-ridge fp-r6" d="M82 24 C94 24 104 36 104 50 C104 64 98 72 98 88" stroke="url(#fpGrad)" strokeWidth="3.5" strokeLinecap="round" />
      <path className="fp-ridge fp-r7" d="M82 30 C90 30 96 40 96 50 C96 60 92 68 92 82" stroke="url(#fpGrad)" strokeWidth="3.5" strokeLinecap="round" />
      <path className="fp-ridge fp-r8" d="M82 36 C86 36 90 44 90 50 C90 56 88 62 88 74" stroke="url(#fpGrad)" strokeWidth="3.5" strokeLinecap="round" />
      {/* Success check */}
      <circle className="fp-success-ring" cx="60" cy="60" r="46" stroke="url(#fpGradOk)" strokeWidth="3" />
      <path className="fp-success-check" d="M42 60 L54 72 L78 48" stroke="url(#fpGradOk)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HqFingerprintLogin({ accent = '#5E6EED' }) {
  const redirectAfterLogin = useLoginRedirect();
  const verifyingRef = useRef(false);
  const [uiState, setUiState] = useState('idle');
  const [loginError, setLoginError] = useState('');

  async function handleIdentify(sample) {
    if (!sample?.template || verifyingRef.current) return;
    verifyingRef.current = true;
    setUiState('verifying');
    setLoginError('');

    try {
      const res = await fetch('/api/fingerprint/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: sample.template,
          format: 'PngImage',
          login_mode: 'hq',
        }),
      });
      const data = await res.json();

      if (res.ok && data.ok && data.user) {
        setUiState('success');
        localStorage.setItem('login_mode', 'hq');
        setTimeout(() => redirectAfterLogin(data.user), 900);
        return;
      }

      setLoginError('Fingerprint not recognized');
      setUiState('error');
    } catch {
      setLoginError('Unable to verify. Please try again.');
      setUiState('error');
    } finally {
      verifyingRef.current = false;
    }
  }

  const { status, error: readerError, start, stop } = useFingerprintReader({
    format: SampleFormat.PngImage,
    onSample: (sample) => void handleIdentify(sample),
  });

  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (uiState === 'success' || uiState === 'verifying') return;
    if (status === 'connected' && !autoStartedRef.current) {
      autoStartedRef.current = true;
      void start();
    }
    if (status === 'disconnected' || status === 'error') {
      autoStartedRef.current = false;
    }
  }, [status, start, uiState]);

  useEffect(() => {
    if (uiState !== 'error') return;
    const t = setTimeout(() => {
      setLoginError('');
      setUiState('idle');
      if (status === 'connected' || status === 'scanning') void start();
    }, 2800);
    return () => clearTimeout(t);
  }, [uiState, status, start]);

  const isScanning = status === 'scanning' && uiState === 'idle';
  const isVerifying = uiState === 'verifying';
  const isSuccess = uiState === 'success';
  const isError = uiState === 'error' || (!!readerError && status === 'error');
  const isWaiting = status === 'initializing' || status === 'disconnected';
  const isReady = status === 'connected' && uiState === 'idle';

  const padState = useMemo(() => {
    if (isSuccess) return 'success';
    if (isError) return 'error';
    if (isVerifying) return 'verifying';
    if (isScanning) return 'scanning';
    if (isReady) return 'ready';
    return 'waiting';
  }, [isSuccess, isError, isVerifying, isScanning, isReady]);

  const title = useMemo(() => {
    if (isSuccess) return 'Access granted';
    if (isVerifying) return 'Authenticating';
    if (isScanning) return 'Reading fingerprint';
    if (isError) return 'Scan failed';
    if (isWaiting) return 'Awaiting scanner';
    return 'Touch the sensor';
  }, [isSuccess, isVerifying, isScanning, isError, isWaiting]);

  const subtitle = useMemo(() => {
    if (isSuccess) return 'Redirecting to Head Office…';
    if (isVerifying) return 'Please wait a moment';
    if (isScanning) return 'Keep your finger still';
    if (isError) return loginError || 'Try again in a moment';
    if (readerError && isWaiting) return 'Check scanner connection';
    if (isWaiting) return 'Preparing secure reader';
    return 'Place your enrolled finger on the reader';
  }, [isSuccess, isVerifying, isScanning, isError, isWaiting, loginError, readerError]);

  return (
    <div className={`hq-bio-stage ${padState}`}>
      <div className="hq-bio-ambient" aria-hidden="true">
        <span className="hq-bio-orb hq-bio-orb-1" />
        <span className="hq-bio-orb hq-bio-orb-2" />
        <span className="hq-bio-particles">
          {[...Array(6)].map((_, i) => (
            <span key={i} className={`hq-bio-dot hq-bio-dot-${i + 1}`} />
          ))}
        </span>
      </div>

      <div className="hq-bio-core">
        <div className={`hq-bio-scanner ${padState}`}>
          <div className="hq-bio-spin-ring" aria-hidden="true" />
          <div className="hq-bio-orbit" aria-hidden="true" />
          <div className="hq-bio-scanner-glow" aria-hidden="true" />

          <div className="hq-bio-scanner-surface">
            <span className="hq-bio-ring hq-bio-ring-1" aria-hidden="true" />
            <span className="hq-bio-ring hq-bio-ring-2" aria-hidden="true" />
            <span className="hq-bio-beam" aria-hidden="true" />
            <span className="hq-bio-corner hq-bio-corner-tl" aria-hidden="true" />
            <span className="hq-bio-corner hq-bio-corner-tr" aria-hidden="true" />
            <span className="hq-bio-corner hq-bio-corner-bl" aria-hidden="true" />
            <span className="hq-bio-corner hq-bio-corner-br" aria-hidden="true" />
            <AnimatedFingerprintIcon />
          </div>
        </div>

        <p className={`hq-bio-status ${padState}`}>{title}</p>
        <p className="hq-bio-subline">{subtitle}</p>

        {isError && (
          <button
            type="button"
            className="hq-bio-retry"
            onClick={() => {
              setLoginError('');
              setUiState('idle');
              void stop().then(() => start());
            }}
          >
            Try again
          </button>
        )}
      </div>

      <style jsx>{`
        .hq-bio-stage {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          border-radius: 16px;
          background:
            radial-gradient(circle at 50% 40%, rgba(99, 102, 241, 0.09) 0%, transparent 55%),
            linear-gradient(180deg, rgba(248, 250, 252, 0.6) 0%, rgba(238, 242, 255, 0.35) 100%);
        }

        .hq-bio-ambient {
          position: absolute;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
        }

        .hq-bio-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(40px);
          animation: orbDrift 10s ease-in-out infinite alternate;
        }

        .hq-bio-orb-1 {
          width: 140px;
          height: 140px;
          top: 5%;
          left: 10%;
          background: rgba(99, 102, 241, 0.3);
        }

        .hq-bio-orb-2 {
          width: 120px;
          height: 120px;
          bottom: 8%;
          right: 8%;
          background: rgba(124, 58, 237, 0.22);
          animation-delay: -3s;
        }

        @keyframes orbDrift {
          0% { transform: translate(0, 0); }
          100% { transform: translate(12px, -10px); }
        }

        .hq-bio-particles {
          position: absolute;
          inset: 0;
        }

        .hq-bio-dot {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: rgba(99, 102, 241, 0.45);
          animation: dotFloat 4s ease-in-out infinite;
        }

        .hq-bio-dot-1 { top: 18%; left: 22%; animation-delay: 0s; }
        .hq-bio-dot-2 { top: 72%; left: 18%; animation-delay: 0.6s; }
        .hq-bio-dot-3 { top: 28%; right: 20%; animation-delay: 1.1s; }
        .hq-bio-dot-4 { bottom: 22%; right: 26%; animation-delay: 1.7s; }
        .hq-bio-dot-5 { top: 48%; left: 8%; animation-delay: 2.2s; }
        .hq-bio-dot-6 { top: 55%; right: 10%; animation-delay: 2.8s; }

        @keyframes dotFloat {
          0%, 100% { transform: translateY(0); opacity: 0.35; }
          50% { transform: translateY(-8px); opacity: 0.9; }
        }

        .hq-bio-core {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          width: 100%;
          padding: 0 8px;
        }

        .hq-bio-scanner {
          position: relative;
          width: 200px;
          height: 200px;
          margin-bottom: 14px;
          flex-shrink: 0;
        }

        .hq-bio-spin-ring {
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          background: conic-gradient(from 0deg, transparent, rgba(99,102,241,0.7), transparent 35%);
          animation: spinRing 2.8s linear infinite;
          opacity: 0.85;
        }

        .hq-bio-scanner.success .hq-bio-spin-ring {
          background: conic-gradient(from 0deg, transparent, rgba(34,197,94,0.8), transparent 35%);
        }

        .hq-bio-scanner.error .hq-bio-spin-ring {
          background: conic-gradient(from 0deg, transparent, rgba(248,113,113,0.7), transparent 35%);
          animation-duration: 1.4s;
        }

        @keyframes spinRing {
          to { transform: rotate(360deg); }
        }

        .hq-bio-orbit {
          position: absolute;
          inset: -14px;
          border-radius: 50%;
          border: 1px dashed rgba(99, 102, 241, 0.2);
          animation: orbitSpin 18s linear infinite;
        }

        @keyframes orbitSpin {
          to { transform: rotate(360deg); }
        }

        .hq-bio-scanner-glow {
          position: absolute;
          inset: 8%;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99, 102, 241, 0.22) 0%, transparent 70%);
          animation: glowBreathe 2.4s ease-in-out infinite;
        }

        .hq-bio-scanner.success .hq-bio-scanner-glow {
          background: radial-gradient(circle, rgba(34, 197, 94, 0.28) 0%, transparent 70%);
        }

        @keyframes glowBreathe {
          0%, 100% { opacity: 0.45; transform: scale(0.96); }
          50% { opacity: 1; transform: scale(1.04); }
        }

        .hq-bio-scanner-surface {
          position: relative;
          width: calc(100% - 8px);
          height: calc(100% - 8px);
          margin: 4px;
          border-radius: 50%;
          background: radial-gradient(circle at 50% 32%, #fff 0%, #eef2ff 55%, #e0e7ff 100%);
          border: 1px solid rgba(99, 102, 241, 0.18);
          box-shadow:
            inset 0 1px 12px rgba(255,255,255,0.9),
            0 12px 32px rgba(79, 70, 229, 0.12);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .hq-bio-scanner.scanning .hq-bio-scanner-surface {
          box-shadow:
            inset 0 1px 12px rgba(255,255,255,0.9),
            0 0 0 4px rgba(99, 102, 241, 0.12),
            0 16px 40px rgba(79, 70, 229, 0.2);
        }

        .hq-bio-scanner.error .hq-bio-scanner-surface {
          animation: shake 0.4s ease;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }

        .hq-bio-ring {
          position: absolute;
          inset: 50%;
          width: 50%;
          height: 50%;
          margin: -25% 0 0 -25%;
          border-radius: 50%;
          border: 1px solid rgba(99, 102, 241, 0.45);
          opacity: 0;
          pointer-events: none;
        }

        .hq-bio-scanner.scanning .hq-bio-ring,
        .hq-bio-scanner.ready .hq-bio-ring,
        .hq-bio-scanner.waiting .hq-bio-ring {
          animation: ringExpand 2s ease-out infinite;
        }

        .hq-bio-ring-2 { animation-delay: 1s !important; }

        @keyframes ringExpand {
          0% { transform: scale(0.6); opacity: 0.75; }
          100% { transform: scale(2.2); opacity: 0; }
        }

        .hq-bio-beam {
          position: absolute;
          left: 12%;
          right: 12%;
          height: 2px;
          background: linear-gradient(90deg, transparent, #818cf8, #6366f1, transparent);
          box-shadow: 0 0 14px rgba(99, 102, 241, 0.75);
          animation: beamScan 2.2s ease-in-out infinite;
          pointer-events: none;
        }

        @keyframes beamScan {
          0%, 100% { top: 20%; opacity: 0.35; }
          50% { top: 75%; opacity: 1; }
        }

        .hq-bio-corner {
          position: absolute;
          width: 16px;
          height: 16px;
          border-color: rgba(99, 102, 241, 0.55);
          border-style: solid;
          animation: cornerPulse 2s ease-in-out infinite;
        }

        .hq-bio-corner-tl { top: 22%; left: 22%; border-width: 2px 0 0 2px; }
        .hq-bio-corner-tr { top: 22%; right: 22%; border-width: 2px 2px 0 0; animation-delay: 0.3s; }
        .hq-bio-corner-bl { bottom: 22%; left: 22%; border-width: 0 0 2px 2px; animation-delay: 0.6s; }
        .hq-bio-corner-br { bottom: 22%; right: 22%; border-width: 0 2px 2px 0; animation-delay: 0.9s; }

        @keyframes cornerPulse {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }

        .hq-bio-status {
          margin: 0 0 4px;
          font-size: 0.95rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.02em;
          transition: color 0.3s ease;
        }

        .hq-bio-status.scanning { color: #4f46e5; }
        .hq-bio-status.verifying { color: #6366f1; }
        .hq-bio-status.success { color: #16a34a; }
        .hq-bio-status.error { color: #dc2626; }

        .hq-bio-subline {
          margin: 0;
          font-size: 0.78rem;
          color: #94a3b8;
          font-weight: 500;
          max-width: 260px;
          line-height: 1.4;
        }

        .hq-bio-retry {
          margin-top: 10px;
          padding: 7px 18px;
          border: 1px solid rgba(99, 102, 241, 0.22);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.75);
          color: #4f46e5;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
        }

        .hq-bio-retry:hover {
          background: white;
          box-shadow: 0 4px 16px rgba(79, 70, 229, 0.12);
        }
      `}</style>

      <style jsx global>{`
        .fp-icon {
          width: 88px;
          height: 88px;
          position: relative;
          z-index: 2;
        }

        .fp-ridge {
          opacity: 0.35;
          transition: opacity 0.4s ease;
        }

        .hq-bio-scanner.ready .fp-ridge,
        .hq-bio-scanner.scanning .fp-ridge,
        .hq-bio-scanner.waiting .fp-ridge {
          opacity: 0.85;
        }

        .hq-bio-scanner.waiting .fp-r1,
        .hq-bio-scanner.ready .fp-r1 { animation: hqFpRidgeGlow 2.2s ease infinite 0s; }
        .hq-bio-scanner.waiting .fp-r2,
        .hq-bio-scanner.ready .fp-r2 { animation: hqFpRidgeGlow 2.2s ease infinite 0.15s; }
        .hq-bio-scanner.waiting .fp-r3,
        .hq-bio-scanner.ready .fp-r3 { animation: hqFpRidgeGlow 2.2s ease infinite 0.3s; }
        .hq-bio-scanner.waiting .fp-r4,
        .hq-bio-scanner.ready .fp-r4 { animation: hqFpRidgeGlow 2.2s ease infinite 0.45s; }
        .hq-bio-scanner.waiting .fp-r5,
        .hq-bio-scanner.ready .fp-r5 { animation: hqFpRidgeGlow 2.2s ease infinite 0.2s; }
        .hq-bio-scanner.waiting .fp-r6,
        .hq-bio-scanner.ready .fp-r6 { animation: hqFpRidgeGlow 2.2s ease infinite 0.35s; }
        .hq-bio-scanner.waiting .fp-r7,
        .hq-bio-scanner.ready .fp-r7 { animation: hqFpRidgeGlow 2.2s ease infinite 0.5s; }
        .hq-bio-scanner.waiting .fp-r8,
        .hq-bio-scanner.ready .fp-r8 { animation: hqFpRidgeGlow 2.2s ease infinite 0.65s; }

        .hq-bio-scanner.scanning .fp-r1 { animation: hqFpRidgeGlow 1.8s ease infinite 0s; }
        .hq-bio-scanner.scanning .fp-r2 { animation: hqFpRidgeGlow 1.8s ease infinite 0.1s; }
        .hq-bio-scanner.scanning .fp-r3 { animation: hqFpRidgeGlow 1.8s ease infinite 0.2s; }
        .hq-bio-scanner.scanning .fp-r4 { animation: hqFpRidgeGlow 1.8s ease infinite 0.3s; }
        .hq-bio-scanner.scanning .fp-r5 { animation: hqFpRidgeGlow 1.8s ease infinite 0.15s; }
        .hq-bio-scanner.scanning .fp-r6 { animation: hqFpRidgeGlow 1.8s ease infinite 0.25s; }
        .hq-bio-scanner.scanning .fp-r7 { animation: hqFpRidgeGlow 1.8s ease infinite 0.35s; }
        .hq-bio-scanner.scanning .fp-r8 { animation: hqFpRidgeGlow 1.8s ease infinite 0.45s; }

        @keyframes hqFpRidgeGlow {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .hq-bio-scanner.verifying .fp-icon {
          animation: hqFpIconSpin 1.4s linear infinite;
        }

        @keyframes hqFpIconSpin {
          to { transform: rotate(360deg); }
        }

        .fp-success-ring,
        .fp-success-check {
          opacity: 0;
        }

        .hq-bio-scanner.success .fp-ridge {
          opacity: 0 !important;
        }

        .hq-bio-scanner.success .fp-success-ring {
          opacity: 1;
          animation: hqFpSuccessPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .hq-bio-scanner.success .fp-success-check {
          opacity: 1;
          stroke-dasharray: 60;
          stroke-dashoffset: 60;
          animation: hqFpCheckDraw 0.4s ease 0.25s forwards;
        }

        @keyframes hqFpSuccessPop {
          from { transform: scale(0.4); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        @keyframes hqFpCheckDraw {
          to { stroke-dashoffset: 0; }
        }

        .hq-bio-scanner.error .fp-ridge {
          opacity: 0.25;
          stroke: #f87171;
        }
      `}</style>
    </div>
  );
}
