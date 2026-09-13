'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, CircularProgress } from '@mui/material';
import {
  BarChart3, ShoppingCart, Wallet, TrendingUp, Users, Truck, Receipt, Package, ChevronRight,
} from 'lucide-react';
import { branchFetch } from '@/lib/branch-client';
import { HQ_REPORTS, HQ_REPORT_PERIODS, resolveHqPeriodRange } from '@/lib/hq-report-catalog';
import HqBarChart, { fmtPkr, fmtMoney } from './hq-bar-chart';
import HqReportFilters from './hq-report-filters';

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

function defaultExtra(report) {
  const extra = {};
  if (report.filters.includes('payment_type')) extra.payment_type = 'ALL';
  if (report.filters.includes('metric')) extra.metric = 'qty';
  if (report.filters.includes('limit')) extra.limit = '8';
  return extra;
}

function formatValue(value, unit) {
  if (unit === 'PKR') return fmtPkr(value);
  return `${fmtMoney(value)} ${unit}`;
}

function HqDashboardChartCard({ report, user, branchOptions }) {
  const router = useRouter();
  const Icon = ICONS[report.id] || BarChart3;
  const [branchId, setBranchId] = useState('ALL');
  const [period, setPeriod] = useState('month');
  const [extra, setExtra] = useState(() => defaultExtra(report));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const range = resolveHqPeriodRange(period);
      const params = new URLSearchParams({ type: report.id });
      if (branchId !== 'ALL') params.set('branch_id', branchId);
      if (report.filters.includes('period')) {
        params.set('fromDate', range.from);
        params.set('toDate', range.to);
      }
      if (extra.payment_type) params.set('payment_type', extra.payment_type);
      if (extra.metric) params.set('metric', extra.metric);
      if (report.filters.includes('limit')) params.set('limit', extra.limit || '8');
      params.set('detail', '0');
      const res = await branchFetch(user, `/api/branches/hq-reports?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load report');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user, report, branchId, period, extra]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.summary;
  const series = data?.series || [];
  const grouped = series.length > 0;
  const unit = report.unit;
  const range = resolveHqPeriodRange(period);
  const periodLabel = HQ_REPORT_PERIODS.find((p) => p.id === period)?.label || 'This Month';
  const chartRows = useMemo(() => {
    const rows = data?.chart || [];
    if (report.id === 'sales' || report.id === 'purchases' || report.id === 'profit' || report.id === 'payments') {
      return rows;
    }
    if (grouped) {
      return rows.filter((d) => series.some((s) => Number(d[s.key]) !== 0));
    }
    return rows
      .filter((d) => Number(d.value) !== 0)
      .sort((a, b) => Math.abs(Number(b.value)) - Math.abs(Number(a.value)));
  }, [data, grouped, series, report.id]);

  return (
    <section className="bg-white border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 flex items-center justify-center shrink-0 text-white"
            style={{ background: report.accent }}
          >
            <Icon size={18} strokeWidth={2.25} />
          </div>
          <div className="min-w-0">
            <h4 className="text-base font-bold text-slate-900 leading-tight">{report.title}</h4>
            <p className="text-xs text-slate-500 mt-0.5">{report.description}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {summary?.label || 'Total'}
          </p>
          <p className="text-xl font-bold tabular-nums text-slate-900 leading-none mt-1">
            {loading ? '—' : formatValue(summary?.total || 0, unit)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {summary?.count != null ? `${summary.count} ${report.id === 'sales' ? 'sales' : 'records'}` : ''}
          </p>
        </div>
      </div>
      {(report.id === 'sales' || report.id === 'purchases') && summary && !loading && (
        <div className="px-5 py-2.5 border-b border-slate-200 flex flex-wrap gap-4 bg-slate-50">
          <p className="text-[12px] font-semibold text-slate-700">
            Item qty: {fmtMoney(summary.qty || 0)}
          </p>
          {report.id === 'purchases' && (
            <>
              <p className="text-[12px] font-semibold text-amber-800">
                Cost rate total: {formatValue(summary.cost || 0, unit)}
              </p>
              <p className="text-[12px] font-semibold text-slate-700">
                Sale rate total: {formatValue(summary.sale || 0, unit)}
              </p>
            </>
          )}
          <p className="text-[12px] font-semibold text-slate-500">
            {report.id === 'purchases' ? 'Invoice charges: ' : 'Extras excluded: '}
            {formatValue(summary.extras || 0, unit)}
          </p>
        </div>
      )}
      {grouped && summary && (
        <div className="px-5 py-2.5 border-b border-slate-200 flex flex-wrap gap-4 bg-slate-50">
          {summary.received != null && (report.id === 'customers-activity' || report.id === 'payments') && (
            <p className="text-[12px] font-semibold text-emerald-700">
              Received {formatValue(summary.received, unit)}
            </p>
          )}
          {summary.paid != null && (report.id === 'suppliers-activity' || report.id === 'payments') && (
            <p className="text-[12px] font-semibold text-amber-700">
              Paid {formatValue(summary.paid, unit)}
            </p>
          )}
          {summary.pending != null && report.id === 'suppliers-activity' && (
            <p className="text-[12px] font-semibold text-slate-600">
              Still to pay {formatValue(summary.pending, unit)}
            </p>
          )}
          {report.id === 'profit' && (
            <>
              <p className="text-[12px] font-semibold text-indigo-700">
                Sales {formatValue(summary.sales, unit)}
              </p>
              <p className="text-[12px] font-semibold text-amber-800">
                Cost {formatValue(summary.cost, unit)}
              </p>
              <p className="text-[12px] font-semibold text-slate-600">
                Discount {formatValue(summary.discount, unit)}
              </p>
              <p className="text-[12px] font-semibold text-emerald-700">
                Gross {formatValue(summary.gross, unit)}
              </p>
              <p className="text-[12px] font-semibold text-rose-700">
                Ledger expenses {formatValue(summary.expenses, unit)}
              </p>
            </>
          )}
          {summary.settled != null && (
            <p className="text-[12px] font-semibold text-emerald-700">
              Settled {formatValue(summary.settled, unit)}
            </p>
          )}
          {summary.pending != null && (
            <p className="text-[12px] font-semibold text-slate-600">
              Pending {formatValue(summary.pending, unit)}
            </p>
          )}
        </div>
      )}

      <div className="px-5 py-3 border-b border-slate-200 bg-white">
        <HqReportFilters
          report={report}
          branchOptions={branchOptions}
          branchId={branchId}
          onBranchChange={setBranchId}
          period={period}
          onPeriodChange={setPeriod}
          extra={extra}
          onExtraChange={setExtra}
        />
      </div>

      <div className="p-5">
        {error && (
          <Alert severity="error" sx={{ borderRadius: 1, mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {loading ? (
          <div className="h-[280px] flex items-center justify-center border border-slate-200">
            <CircularProgress size={28} sx={{ color: report.accent }} />
          </div>
        ) : (
          <div className="space-y-4">
            {(data?.charts || []).length > 0 ? (
              <div className="grid grid-cols-1 gap-4">
                {data.charts.map((c) => (
                  <div key={c.id} className="border border-slate-200 px-2 pt-3 pb-1">
                    <div className="px-3 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: c.color || report.accent }}>
                          {c.title}
                        </p>
                        {c.subtitle && (
                          <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{c.subtitle}</p>
                        )}
                      </div>
                      {c.total != null && (
                        <p className="text-[13px] font-extrabold tabular-nums shrink-0" style={{ color: c.color || report.accent }}>
                          {formatValue(c.total, unit)}
                        </p>
                      )}
                    </div>
                    <HqBarChart
                      data={c.data || []}
                      color={c.color || report.accent}
                      preserveOrder
                      unit={unit}
                      height={260}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-slate-200 px-2 pt-3 pb-1">
                <HqBarChart
                  data={chartRows}
                  color={report.accent}
                  series={grouped ? series : undefined}
                  preserveOrder={
                    report.id === 'sales'
                    || report.id === 'profit'
                    || report.id === 'payments'
                    || report.id === 'suppliers-activity'
                    || report.id === 'customers-activity'
                  }
                  unit={unit}
                  height={280}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-5 py-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-slate-500">
          {branchId === 'ALL' ? 'All branches' : 'Selected branch'}
          {report.id === 'sales' || report.id === 'purchases' || report.id === 'profit' || report.id === 'payments'
            ? ' · One bar per branch for the whole period'
            : ''}
          {report.filters.includes('period') ? ` · ${periodLabel} · ${range.from} to ${range.to}` : ' · current balances'}
        </p>
        <button
          type="button"
          onClick={() => router.push(report.href)}
          className="inline-flex items-center gap-1 text-[12px] font-bold text-slate-800 hover:underline"
        >
          Open full report
          <ChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}

export default function HqReportsSection({ user }) {
  const router = useRouter();
  const [branchOptions, setBranchOptions] = useState([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await branchFetch(user, '/api/branches/hq-reports?type=sales&limit=1&detail=0');
        const json = await res.json();
        if (!cancelled && res.ok) setBranchOptions(json.branch_options || []);
      } catch {
        /* keep empty */
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-xl font-bold text-slate-900">Network Reports</h3>
          <p className="text-sm text-slate-500 mt-1">
            One report per row. Defaults to all branches. All figures come from the general ledger, not invoices.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push('/dashboard/hq/reports')}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-[#1e293b] hover:bg-[#0f172a]"
        >
          <BarChart3 size={15} />
          All reports
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5">
        {HQ_REPORTS.map((report) => (
          <HqDashboardChartCard
            key={report.id}
            report={report}
            user={user}
            branchOptions={branchOptions}
          />
        ))}
      </div>
    </div>
  );
}
