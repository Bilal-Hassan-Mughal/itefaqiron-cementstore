'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy HQ login URL → landing with HQ tab */
export default function HqLoginRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/?tab=hq');
  }, [router]);
  return null;
}
