'use client';

import { Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import DashboardLayout from '../../components/dashboard-layout';
import SuperOrderEditor from '../components/super-order-editor';

function EditorFallback() {
  return (
    <DashboardLayout>
      <div className="p-20 text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#1A55E3]" />
        <p className="text-sm text-slate-600">Loading order...</p>
      </div>
    </DashboardLayout>
  );
}

function SuperOrderEditContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = params?.id ? String(params.id) : null;
  return (
    <SuperOrderEditor
      orderId={orderId}
      viewOnly={searchParams.get('view') === '1'}
      autoPrint={searchParams.get('print') === '1'}
    />
  );
}

export default function SuperOrderEditPage() {
  return (
    <Suspense fallback={<EditorFallback />}>
      <SuperOrderEditContent />
    </Suspense>
  );
}
