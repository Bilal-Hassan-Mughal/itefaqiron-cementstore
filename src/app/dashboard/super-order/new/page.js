'use client';

import { Suspense } from 'react';
import { RefreshCw } from 'lucide-react';
import DashboardLayout from '../../components/dashboard-layout';
import SuperOrderEditor from '../components/super-order-editor';

function EditorFallback() {
  return (
    <DashboardLayout>
      <div className="p-20 text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-[#1A55E3]" />
        <p className="text-sm text-slate-600">Loading order sheet...</p>
      </div>
    </DashboardLayout>
  );
}

export default function NewSuperOrderPage() {
  return (
    <Suspense fallback={<EditorFallback />}>
      <SuperOrderEditor />
    </Suspense>
  );
}
