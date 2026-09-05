'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AttendanceRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/hr?module=attendance');
  }, [router]);
  return null;
}
