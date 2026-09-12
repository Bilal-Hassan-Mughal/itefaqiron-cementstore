'use client';

import { HQ_REPORT_PERIODS } from '@/lib/hq-report-catalog';

const selectClass =
  'h-9 rounded-md border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-800 focus:outline-none focus:border-slate-500';

export default function HqReportFilters({
  report,
  branchOptions = [],
  branchId,
  onBranchChange,
  period,
  onPeriodChange,
  extra = {},
  onExtraChange,
}) {
  const filters = report?.filters || [];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.includes('branch') && (
        <select
          value={branchId}
          onChange={(e) => onBranchChange(e.target.value)}
          className={`${selectClass} min-w-[200px]`}
          aria-label="Branch filter"
        >
          <option value="ALL">All Branches</option>
          {branchOptions.map((b) => (
            <option key={b.branch_id} value={String(b.branch_id)}>
              {b.branch_name || b.branch_code}
            </option>
          ))}
        </select>
      )}

      {filters.includes('period') && (
        <div className="inline-flex rounded-md border border-slate-300 overflow-hidden">
          {HQ_REPORT_PERIODS.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onPeriodChange(p.id)}
              className={`px-3 h-9 text-[12px] font-semibold ${
                i > 0 ? 'border-l border-slate-300' : ''
              } ${
                period === p.id
                  ? 'bg-[#1e293b] text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}

      {filters.includes('payment_type') && (
        <select
          value={extra.payment_type || 'ALL'}
          onChange={(e) => onExtraChange({ ...extra, payment_type: e.target.value })}
          className={selectClass}
          aria-label="Payment type"
        >
          <option value="ALL">Received + Paid</option>
          <option value="RECEIVE">Received</option>
          <option value="PAY">Paid</option>
        </select>
      )}

      {filters.includes('metric') && (
        <select
          value={extra.metric || 'qty'}
          onChange={(e) => onExtraChange({ ...extra, metric: e.target.value })}
          className={selectClass}
          aria-label="Supply metric"
        >
          <option value="qty">By quantity</option>
          <option value="amount">By amount</option>
        </select>
      )}

      {filters.includes('limit') && (
        <select
          value={extra.limit || '10'}
          onChange={(e) => onExtraChange({ ...extra, limit: e.target.value })}
          className={selectClass}
          aria-label="Top count"
        >
          <option value="8">Top 8</option>
          <option value="10">Top 10</option>
          <option value="20">Top 20</option>
          <option value="50">Top 50</option>
        </select>
      )}
    </div>
  );
}
