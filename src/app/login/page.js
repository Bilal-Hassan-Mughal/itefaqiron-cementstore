'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy /login URL → landing page */
export default function LoginRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/');
  }, [router]);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <p style={{ color: '#64748b' }}>Redirecting…</p>
    </div>
  );
}
