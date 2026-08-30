'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { isHqUser } from '@/lib/branch-roles';
import { isHqPosMode } from '@/lib/branch-client';

/**
 * Redirects HQ users away from POS unless they explicitly opened a branch.
 */
export default function HqPosGuard({ user, isClient }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isClient || !user || !pathname) return;
    if (!isHqUser(user)) return;
    if (pathname.startsWith('/dashboard/hq')) return;
    if (!pathname.startsWith('/dashboard')) return;

    if (!isHqPosMode()) {
      router.replace('/dashboard/hq');
    }
  }, [isClient, user, pathname, router]);

  return null;
}
