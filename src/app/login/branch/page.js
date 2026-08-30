'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy branch login URL → landing with branch tab */
export default function BranchLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, [router]);
  return null;
}
