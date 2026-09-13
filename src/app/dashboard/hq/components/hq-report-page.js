'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import { Download, Printer } from 'lucide-react';
import { branchFetch } from '@/lib/branch-client';
import { getHqReport, resolveHqPeriodRange } from '@/lib/hq-report-catalog';
import { HQ_MUI, HQ_UI } from '@/lib/brand-theme';
import HqPageHeader from './hq-page-header';
import HqBarChart, { fmtDate, fmtMoney, fmtPkr } from './hq-bar-chart';
import HqReportFilters from './hq-report-filters';
import { useHqSession } from './use-hq-session';

const COLUMNS = {
  sales: [
    { key: 'bill_no', label: 'Invoice' },
    { key: 'branch_code', label: 'Branch' },
    { key: 'date', label: 'Date', format: fmtDate },
    { key: 'customer', label: 'Customer' },
    { key: 'amount', label: 'This bill items', format: fmtMoney, money: true },
    { key: 'running', label: 'Running total', format: fmtMoney, money: true },
    { key: 'qty', label: 'Qty', format: fmtMoney },
    { key: 'extras', label: 'Excluded extras', format: fmtMoney, money: true },
  ],
  purchases: [
    { key: 'bill_no', label: 'Invoice' },
    { key: 'branch_code', label: 'Branch' },
    { key: 'date', label: 'Date', format: fmtDate },
    { key: 'customer', label: 'Supplier' },
    { key: 'purchase', label: 'Purchase (qty × crate)', format: fmtMoney, money: true },
    { key: 'cost', label: 'Cost (qty × cost rate)', format: fmtMoney, money: true },
    { key: 'sale', label: 'Sale (qty × sale rate)', format: fmtMoney, money: true },
    { key: 'running', label: 'Running purchase', format: fmtMoney, money: true },
    { key: 'qty', label: 'Qty', format: fmtMoney },
    { key: 'extras', label: 'Extras', format: fmtMoney, money: true },
  ],
  payments: [
    { key: 'branch_code', label: 'Branch' },
    { key: 'date', label: 'Date', format: fmtDate },
    { key: 'account', label: 'Account' },
    { key: 'payment_type', label: 'Type' },
    { key: 'amount', label: 'Amount', format: fmtMoney, money: true },
    { key: 'description', label: 'Detail' },
  ],
  profit: [
    { key: 'branch_code', label: 'Branch' },
    { key: 'date', label: 'Date', format: fmtDate },
    { key: 'bill_no', label: 'Invoice' },
    { key: 'customer', label: 'Customer' },
    { key: 'sales', label: 'Item sales', format: fmtMoney, money: true },
    { key: 'cost', label: 'Cost', format: fmtMoney, money: true },
    { key: 'discount', label: 'Discount', format: fmtMoney, money: true },
    { key: 'profit', label: 'Gross profit', format: fmtMoney, money: true },
  ],
  expenses: [
    { key: 'branch_code', label: 'Branch' },
    { key: 'date', label: 'Date', format: fmtDate },
    { key: 'title', label: 'Title' },
    { key: 'detail', label: 'Detail' },
    { key: 'amount', label: 'Expense', format: fmtMoney, money: true },
    { key: 'settled', label: 'Settled', format: fmtMoney, money: true },
    { key: 'paid', label: 'Status', format: (v) => (v ? 'Settled' : 'Pending') },
  ],
  'customers-balance': [
    { key: 'branch_code', label: 'Branch' },
    { key: 'customer', label: 'Customer' },
    { key: 'phone', label: 'Phone' },
    { key: 'category', label: 'Category' },
    { key: 'balance', label: 'Pending', format: fmtMoney, money: true },
  ],
  'suppliers-balance': [
    { key: 'branch_code', label: 'Branch' },
    { key: 'customer', label: 'Supplier' },
    { key: 'phone', label: 'Phone' },
    { key: 'category', label: 'Category' },
    { key: 'balance', label: 'To pay', format: fmtMoney, money: true },
  ],
  'customers-activity': [
    { key: 'branch_code', label: 'Branch' },
    { key: 'customer', label: 'Customer' },
    { key: 'bills', label: 'Invoices' },
    { key: 'purchased', label: 'Purchased', format: fmtMoney, money: true },
    { key: 'received', label: 'Received', format: fmtMoney, money: true },
    { key: 'pending', label: 'Pending', format: fmtMoney, money: true },
  ],
  'suppliers-activity': [
    { key: 'branch_code', label: 'Branch' },
    { key: 'customer', label: 'Supplier' },
    { key: 'bills', label: 'Invoices' },
    { key: 'purchased', label: 'Purchased', format: fmtMoney, money: true },
    { key: 'paid', label: 'Paid', format: fmtMoney, money: true },
    { key: 'pending', label: 'To pay', format: fmtMoney, money: true },
  ],
};

function defaultExtra(report) {
  const extra = {};
  if (report.filters.includes('payment_type')) extra.payment_type = 'ALL';
  if (report.filters.includes('metric')) extra.metric = 'qty';
  if (report.filters.includes('limit')) extra.limit = '20';
  return extra;
}

function downloadCsv(filename, columns, rows) {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [columns.map((c) => escape(c.label)).join(',')];
  rows.forEach((row) => {
    lines.push(columns.map((c) => escape(c.format ? c.format(row[c.key]) : row[c.key])).join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function HqReportPage({ slug }) {
  const router = useRouter();
  const report = useMemo(() => getHqReport(slug), [slug]);
  const { user, ready } = useHqSession();
  const [branchId, setBranchId] = useState('ALL');
  const [period, setPeriod] = useState('month');
  const [extra, setExtra] = useState(() => (report ? defaultExtra(report) : {}));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (report) setExtra(defaultExtra(report));
  }, [report]);

  const load = useCallback(async () => {
    if (!user || !report) return;
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
      if (report.filters.includes('limit')) params.set('limit', extra.limit || '20');
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
    if (ready) load();
  }, [ready, load]);

  if (!report) {
    return (
      <div className={HQ_UI.pageWrap}>
        <Alert severity="warning">Unknown report.</Alert>
      </div>
    );
  }

  const columns = COLUMNS[report.id] || COLUMNS[slug] || [];
  const rows = data?.rows || [];
  const summary = data?.summary;
  const series = data?.series || [];
  const unit = report.unit;
  const range = resolveHqPeriodRange(period);

  const kpis = [
    { label: summary?.label || 'Total', value: summary?.total, show: true },
    { label: 'Received', value: summary?.received, show: summary?.received != null && report.id !== 'suppliers-activity' },
    { label: 'Paid', value: summary?.paid, show: summary?.paid != null && report.id !== 'customers-activity' && report.id !== 'sales' },
    { label: 'Settled', value: summary?.settled, show: summary?.settled != null },
    { label: 'Pending', value: summary?.pending, show: summary?.pending != null },
    { label: 'Gross profit', value: summary?.gross, show: summary?.gross != null },
    { label: 'Discount', value: summary?.discount, show: summary?.discount != null && report.id === 'profit' },
    { label: 'Expenses', value: summary?.expenses, show: summary?.expenses != null },
    { label: 'Sales', value: summary?.sales, show: summary?.sales != null },
    { label: 'Item amount', value: summary?.items, show: summary?.items != null && report.id !== 'sales' },
    { label: 'Cost rate', value: summary?.cost, show: summary?.cost != null && report.id === 'purchases' },
    { label: 'Sale rate', value: summary?.sale, show: summary?.sale != null && report.id === 'purchases' },
    { label: report.id === 'purchases' ? 'Invoice charges' : 'Excluded extras', value: summary?.extras, show: summary?.extras != null },
    { label: 'Item qty', value: summary?.qty, show: summary?.qty != null, raw: true },
    { label: 'Records', value: summary?.count, show: summary?.count != null, raw: true },
  ].filter((k) => k.show);

  return (
    <div className={HQ_UI.pageWrap}>
      <HqPageHeader
        title={report.title}
        subtitle={`${report.description}. Defaults to all branches.`}
        action={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 bg-white hover:bg-slate-50"
            >
              <Printer size={14} /> Print
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(`hq-${report.id}.csv`, columns, rows)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
              style={{ background: report.accent }}
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        )}
      />

      <div className={`${HQ_UI.card} p-4 md:p-5 space-y-4`}>
        <HqReportFilters
          report={report}
          branchOptions={data?.branch_options || []}
          branchId={branchId}
          onBranchChange={setBranchId}
          period={period}
          onPeriodChange={setPeriod}
          extra={extra}
          onExtraChange={setExtra}
        />
        <p className="text-[11px] font-semibold text-slate-400">
          {branchId === 'ALL' ? 'All branches' : 'Selected branch'}
          {report.filters.includes('period') ? ` · ${range.from} → ${range.to}` : ' · current balances'}
        </p>
      </div>

      {error && <Alert severity="error" sx={{ borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {loading ? (
        <div className={`${HQ_UI.card} py-16 flex justify-center`}>
          <CircularProgress sx={HQ_MUI.spinner} />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map((k) => (
              <div key={k.label} className={`${HQ_UI.card} p-4`}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{k.label}</p>
                <p className="text-xl font-extrabold text-slate-900 mt-1 tabular-nums">
                  {k.raw ? Number(k.value || 0).toLocaleString('en-US') : fmtPkr(k.value)}
                </p>
              </div>
            ))}
          </div>

          {(data?.charts || []).length > 0 ? (
            <div className="grid grid-cols-1 gap-3">
              {data.charts.map((c) => (
                <div key={c.id} className={`${HQ_UI.card} overflow-hidden`}>
                  <div className="h-1.5 w-full" style={{ background: c.color || report.accent }} />
                  <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: c.color || report.accent }}>
                        {c.title}
                      </p>
                      <h4 className="text-base font-extrabold text-slate-900 mt-0.5">
                        {c.subtitle || c.title}
                      </h4>
                    </div>
                    {c.total != null && (
                      <p className="text-lg font-extrabold tabular-nums shrink-0" style={{ color: c.color || report.accent }}>
                        {fmtPkr(c.total)}
                      </p>
                    )}
                  </div>
                  <div className="p-4 md:p-5 bg-[#f8fafc]">
                    <HqBarChart
                      data={c.data || []}
                      color={c.color || report.accent}
                      preserveOrder
                      unit={unit}
                      height={300}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={`${HQ_UI.card} overflow-hidden`}>
              <div className="h-1.5 w-full" style={{ background: report.accent }} />
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: report.accent }}>
                  {report.short} chart
                </p>
                <h4 className="text-base font-extrabold text-slate-900 mt-0.5">
                  {series.length
                    ? 'Ledger comparison by account'
                    : report.id === 'payments'
                      ? 'Received and Paid — one pair of bars per branch'
                    : report.id === 'sales' || report.id === 'profit'
                      ? 'One bar per branch for the whole selected period'
                      : `Performance by ${branchId === 'ALL' ? 'branch' : 'period'}`}
                </h4>
              </div>
              <div className="p-4 md:p-5 bg-[#f8fafc]">
                <HqBarChart
                  data={data?.chart || []}
                  color={report.accent}
                  series={series.length ? series : undefined}
                  preserveOrder={
                    report.id === 'sales'
                    || report.id === 'profit'
                    || report.id === 'payments'
                    || report.id === 'suppliers-activity'
                    || report.id === 'customers-activity'
                  }
                  unit={unit}
                  height={300}
                />
              </div>
            </div>
          )}

          {report.id === 'sales' && (data?.products || []).length > 0 && (
            <div className={`${HQ_UI.card} overflow-hidden`}>
              <div className="h-1.5 w-full" style={{ background: report.accent }} />
              <div className="px-5 py-4 border-b border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: report.accent }}>
                  Items
                </p>
                <h4 className="text-base font-extrabold text-slate-900 mt-0.5">Sold item amount from invoices</h4>
              </div>
              <div className="p-4 md:p-5 bg-[#f8fafc]">
                <HqBarChart
                  data={data.products}
                  color="#1e293b"
                  unit={unit}
                  height={300}
                />
              </div>
            </div>
          )}

          <div className={`${HQ_UI.card} overflow-hidden`}>
            <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
              <h4 className="text-sm font-extrabold text-slate-900">Detail</h4>
              <button
                type="button"
                onClick={() => router.push('/dashboard/hq/reports')}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                All reports
              </button>
            </div>
            <div className="overflow-x-auto">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    {columns.map((c) => (
                      <TableCell
                        key={c.key}
                        sx={{
                          fontWeight: 800,
                          bgcolor: '#f8fafc',
                          color: '#475569',
                          fontSize: '0.68rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                        }}
                      >
                        {c.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={columns.length} align="center" sx={{ py: 6, color: '#94a3b8', fontWeight: 600 }}>
                        No records for these filters
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id} hover>
                        {columns.map((c) => (
                          <TableCell key={c.key} sx={{ fontSize: '0.8rem', fontWeight: c.money ? 700 : 500 }}>
                            {c.format ? c.format(row[c.key]) : row[c.key] ?? '—'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
