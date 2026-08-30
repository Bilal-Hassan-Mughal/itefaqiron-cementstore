'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { canStaffAccessPath, getFirstAllowedPathForStaff } from '@/lib/staff-access';

/**
 * Must be rendered inside <Suspense> (Next.js App Router) because usePathname
 * can suspend during static prerendering.
 */
export default function StaffPathGuard({ user, isClient }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isClient || !user || pathname == null) return;
    if (canStaffAccessPath(user, pathname)) return;

    if (pathname === '/dashboard' || pathname === '/dashboard/') {
      const firstPath = getFirstAllowedPathForStaff(user);
      if (firstPath && firstPath !== '/dashboard') {
        router.replace(firstPath);
        return;
      }
    }

    router.replace('/dashboard?access=denied');
  }, [isClient, user, pathname, router]);

  return null;
}
