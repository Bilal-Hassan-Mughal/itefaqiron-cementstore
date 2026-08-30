'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isHqUser } from '@/lib/branch-roles';

export function useHqSession() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) {
      router.replace('/?tab=hq');
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (!isHqUser(parsed)) {
        router.replace('/dashboard');
        return;
      }
      setUser(parsed);
      setReady(true);
    } catch {
      router.replace('/?tab=hq');
    }
  }, [router]);

  return { user, ready };
}
