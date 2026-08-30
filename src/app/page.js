'use client';

import { Suspense } from 'react';
import LandingLogin from './login/components/landing-login';

function LandingFallback() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(145deg, #1a237e, #0288d1)',
        color: 'white',
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      Loading…
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<LandingFallback />}>
      <LandingLogin />
    </Suspense>
  );
}
