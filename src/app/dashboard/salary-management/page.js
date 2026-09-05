'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SalaryManagementRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/hr?module=salary-sheet');
  }, [router]);
  return null;
}
