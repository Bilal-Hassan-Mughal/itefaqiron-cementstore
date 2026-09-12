'use client';

import { useRouter } from 'next/navigation';
import {
  BarChart3, ShoppingCart, Wallet, TrendingUp, Users, Truck, Receipt, Package, ChevronRight,
} from 'lucide-react';
import { HQ_REPORTS } from '@/lib/hq-report-catalog';
import { HQ_UI } from '@/lib/brand-theme';
import HqPageHeader from '../components/hq-page-header';

const ICONS = {
  sales: ShoppingCart,
  purchases: Package,
  payments: Wallet,
  profit: TrendingUp,
  'customers-balance': Users,
  'suppliers-balance': Truck,
  'customers-activity': Users,
  'suppliers-activity': Truck,
  expenses: Receipt,
};

export default function HqReportsHubPage() {
  const router = useRouter();

  return (
    <div className={HQ_UI.pageWrap}>
      <HqPageHeader
        title="HQ Reports"
        subtitle="All reports default to every branch. Open a report to apply its own filters and see the full bar chart."
        icon={BarChart3}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {HQ_REPORTS.map((report) => {
          const Icon = ICONS[report.id] || BarChart3;
          return (
            <button
              key={report.id}
              type="button"
              onClick={() => router.push(report.href)}
              className={`${HQ_UI.card} ${HQ_UI.cardHover} p-5 text-left flex flex-col gap-4`}
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{ background: report.accentSoft, color: report.accent }}
                >
                  <Icon size={22} strokeWidth={2.25} />
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 mt-1" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight">{report.title}</h3>
                <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">{report.description}</p>
              </div>
              <p className="text-[11px] font-bold" style={{ color: report.accent }}>
                Open with filters
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
