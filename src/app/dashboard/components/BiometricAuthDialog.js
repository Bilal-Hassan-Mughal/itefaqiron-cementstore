'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { SampleFormat } from '@digitalpersona/devices';

// Only load the reader stack when the user opens the Fingerprint tab (avoids
// "Cannot reach … Agent" on every confirm dialog for PIN-only users).
const FingerprintScanner = dynamic(() => import('@/components/FingerprintScanner'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        padding: 16,
        textAlign: 'center',
        color: '#64748b',
        fontSize: 13,
        border: '1px solid #e2e8f0',
        borderRadius: 12,
        background: '#f8fafc',
      }}
    >
      Preparing reader…
    </div>
  ),
});

export default function BiometricAuthDialog({ open, onSuccess, onClose }) {
  function getCurrentUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  }

  const [authMode, setAuthMode] = useState('fp');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinLoading, setPinLoading] = useState(false);

  const [fpError, setFpError] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [lastSample, setLastSample] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  const showFingerprint = currentUser ? (currentUser.fingerprint_enrolled !== false) : true;

  useEffect(() => {
    if (!open) return;
    const user = getCurrentUser();
    setCurrentUser(user);
    setPin('');
    setPinError('');
    setPinLoading(false);

    // Primary mode is Fingerprint if enrolled/available, otherwise fallback to PIN
    const isFpEnrolled = user ? (user.fingerprint_enrolled !== false) : true;
    setAuthMode(isFpEnrolled ? 'fp' : 'pin');

    setFpError('');
    setFpLoading(false);
    setLastSample(null);

    // Refresh enrollment status from server to avoid stale localStorage.
    (async () => {
      if (!user?.user_id) return;
      try {
        const res = await fetch('/api/auth/user-list', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const serverUser = Array.isArray(data?.users)
          ? data.users.find((u) => u.user_id === user.user_id)
          : null;
        if (!serverUser) return;

        const enrolled = serverUser.fingerprint_enrolled !== false;
        const mergedUser = { ...user, fingerprint_enrolled: enrolled };
        setCurrentUser(mergedUser);
        localStorage.setItem('user', JSON.stringify(mergedUser));
        if (enrolled) {
          setAuthMode('fp');
        }
      } catch {
        // keep local user fallback
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!showFingerprint && currentUser) {
      setAuthMode('pin');
    }
  }, [open, showFingerprint, currentUser]);

  function addDigit(digit) {
    if (pin.length < 6) setPin((prev) => prev + digit);
  }

  function backspace() {
    setPin((prev) => prev.slice(0, -1));
  }

  async function submitPin() {
    if (pin.length !== 6) {
      setPinError('Enter all 6 digits.');
      return;
    }

    const user = getCurrentUser();
    if (!user) {
      setPinError('Session expired.');
      return;
    }

    setPinLoading(true);
    setPinError('');

    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.user_id, pin }),
      });
      const data = await res.json();

      if (data.valid) {
        onSuccess();
      } else {
        setPinError(data.error || 'Incorrect PIN. Try again.');
        setPin('');
      }
    } catch {
      setPinError('Network error. Try again.');
      setPin('');
    } finally {
      setPinLoading(false);
    }
  }

  async function submitFingerprint(sampleOverride) {
    const sample = sampleOverride || lastSample;
    const user = getCurrentUser();
    if (!user) {
      setFpError('Session expired.');
      return;
    }
    if (!user.fingerprint_enrolled) {
      setFpError('No fingerprint enrolled for this user. Ask an admin to enroll in Settings.');
      return;
    }
    if (!sample?.template) {
      setFpError('Scan your fingerprint first (wait for a fresh capture).');
      return;
    }

    setFpLoading(true);
    setFpError('');
    try {
      const res = await fetch('/api/fingerprint/verify-self', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.user_id,
          template: sample.template,
          format: 'PngImage',
        }),
      });
      const data = await res.json();
      if (data.valid) {
        onSuccess();
      } else {
        setFpError(data.error || 'Fingerprint not recognized. Please scan again.');
      }
    } catch {
      setFpError('Network error. Try again.');
    } finally {
      setFpLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'white',
          borderRadius: '20px',
          padding: '28px',
          width: authMode === 'fp' ? '520px' : '380px',
          maxWidth: '95vw',
          boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
          fontFamily: "'Segoe UI', system-ui, sans-serif",
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '800', color: '#0f172a' }}>Confirm Identity</h3>
            <p style={{ margin: '2px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
              {showFingerprint
                ? 'Use your PIN, or fingerprint if the reader is available on this PC.'
                : 'Enter your PIN to continue.'}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              cursor: 'pointer',
              fontSize: '1rem',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        {showFingerprint ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
            marginBottom: 14,
          }}
        >
          <button
            type="button"
            onClick={() => setAuthMode('fp')}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: `2px solid ${authMode === 'fp' ? '#1d4ed8' : '#e2e8f0'}`,
              background: authMode === 'fp' ? '#eff6ff' : 'white',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            Fingerprint
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('pin')}
            style={{
              padding: '10px 12px',
              borderRadius: 12,
              border: `2px solid ${authMode === 'pin' ? '#1d4ed8' : '#e2e8f0'}`,
              background: authMode === 'pin' ? '#eff6ff' : 'white',
              fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            PIN
          </button>
        </div>
        ) : null}

        {authMode === 'pin' && (
          <>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '16px' }}>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  style={{
                    width: '42px',
                    height: '48px',
                    borderRadius: '10px',
                    border: `2px solid ${i < pin.length ? '#1d4ed8' : '#e2e8f0'}`,
                    background: i < pin.length ? '#eff6ff' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.3rem',
                    color: '#1d4ed8',
                  }}
                >
                  {i < pin.length ? '●' : ''}
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '14px' }}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  onClick={() => addDigit(String(n))}
                  style={{
                    padding: '13px',
                    fontSize: '1.15rem',
                    fontWeight: '700',
                    background: 'white',
                    border: '2px solid #e2e8f0',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    color: '#0f172a',
                  }}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={backspace}
                style={{
                  padding: '13px',
                  fontSize: '1rem',
                  background: '#fef2f2',
                  border: '2px solid #fecaca',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: '#dc2626',
                  fontWeight: '700',
                }}
              >
                ⌫
              </button>
              <button
                onClick={() => addDigit('0')}
                style={{
                  padding: '13px',
                  fontSize: '1.15rem',
                  fontWeight: '700',
                  background: 'white',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: '#0f172a',
                }}
              >
                0
              </button>
              <button
                onClick={() => setPin('')}
                style={{
                  padding: '13px',
                  fontSize: '0.7rem',
                  fontWeight: '600',
                  background: '#f8fafc',
                  border: '2px solid #e2e8f0',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                CLR
              </button>
            </div>
          </>
        )}

        {authMode === 'fp' && (
          <div style={{ width: '100%' }}>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>
              Requires the HID <strong>DigitalPersona Lite Client / Agent</strong> on this machine (it exposes{' '}
              <code style={{ fontSize: 11 }}>ws://127.0.0.1:9001</code>
              ) and a supported USB reader.
            </p>
            <FingerprintScanner
              format={SampleFormat.PngImage}
              autoStart
              disabled={fpLoading}
              onSample={(s) => {
                if (fpLoading) return;
                setLastSample(s);
                setFpError('');
                submitFingerprint(s);
              }}
              hint={
                fpLoading
                  ? '🔄 Matching fingerprint automatically...'
                  : 'Place your finger on the reader to auto-verify.'
              }
            />

            <button
              type="button"
              onClick={() => setAuthMode('pin')}
              style={{
                marginTop: '14px',
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                border: '2px solid #3b82f6',
                background: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: '800',
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 2px 4px rgba(29,78,216,0.1)'
              }}
            >
              🔑 Switch to PIN Authentication
            </button>
          </div>
        )}

        {authMode === 'pin' && pinError && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              padding: '10px 14px',
              marginBottom: '12px',
              fontSize: '0.82rem',
              color: '#dc2626',
            }}
          >
            ⚠️ {pinError}
          </div>
        )}

        {authMode === 'fp' && fpError && (
          <div
            style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              padding: '10px 14px',
              marginTop: '12px',
              fontSize: '0.82rem',
              color: '#dc2626',
              textAlign: 'center',
            }}
          >
            ⚠️ {fpError}
          </div>
        )}

        {authMode === 'pin' && (
        <button
          onClick={submitPin}
          disabled={pinLoading || pin.length !== 6}
          style={{
            width: '100%',
            padding: '12px',
            background: pin.length !== 6 || pinLoading ? '#93c5fd' : 'linear-gradient(135deg, #1d4ed8, #1e40af)',
            color: 'white',
            border: 'none',
            borderRadius: '10px',
            fontWeight: '700',
            fontSize: '0.875rem',
            cursor: pin.length !== 6 || pinLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {pinLoading ? 'Verifying...' : '🔓 Confirm with PIN'}
        </button>
        )}
      </div>
    </div>
  );
}
