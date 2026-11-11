'use client';

import { lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import DashboardLayout from '../components/dashboard-layout';

const PaymentPromisesQueueContent = lazy(() => import('./PaymentPromisesQueueContent'));

function PaymentPromisesPageFallback() {
  return (
    <DashboardLayout>
      <div className="flex min-h-[50vh] items-center justify-center gap-3 p-8 text-slate-600">
        <Loader2 className="h-8 w-8 shrink-0 animate-spin text-[#1A55E3]" aria-hidden />
        <p className="text-sm font-semibold">Payment promises load ho rahe hain…</p>
      </div>
    </DashboardLayout>
  );
}

export default function PaymentPromisesQueuePage() {
  return (
    <Suspense fallback={<PaymentPromisesPageFallback />}>
      <PaymentPromisesQueueContent />
    </Suspense>
  );
}
