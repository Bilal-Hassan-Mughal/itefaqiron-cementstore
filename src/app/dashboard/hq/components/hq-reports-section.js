'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Alert, Box, Chip, CircularProgress, MenuItem, Select, FormControl,
  Table, TableBody, TableCell, TableHead, TableRow,
} from '@mui/material';
import {
  BarChart3, ShoppingCart, ShoppingBag, Warehouse, ChevronRight,
  Calendar, Building2, TrendingUp,
} from 'lucide-react';
import { branchFetch } from '@/lib/branch-client';
import { HQ_BRAND, HQ_GRADIENTS, HQ_MUI, HQ_REPORT, HQ_UI } from '@/lib/brand-theme';

const PERIOD_PRESETS = [
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'week', label: 'Last 7 Days' },
  { id: 'year', label: 'This Year' },
];

function fmtMoney(n) {
  const v = Number(n || 0);
  if (v % 1 === 0) return v.toLocaleString('en-US');
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtK(v) {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toFixed(0);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function resolvePeriodRange(periodId) {
  const today = new Date();
  const toStr = today.toISOString().split('T')[0];
  let from = new Date(today);

  switch (periodId) {
    case 'last_month':
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return {
        from: from.toISOString().split('T')[0],
        to: new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0],
      };
    case 'week':
      from.setDate(today.getDate() - 6);
      return { from: from.toISOString().split('T')[0], to: toStr };
    case 'year':
      from = new Date(today.getFullYear(), 0, 1);
      return { from: from.toISOString().split('T')[0], to: toStr };
    case 'month':
    default:
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: from.toISOString().split('T')[0], to: toStr };
  }
}

/** Smooth single-series bar chart */
function SmoothBarChart({ data, getValue, getLabel, gradientId, colorPrimary, colorStop, unit = 'PKR', height = 220 }) {
  if (!data?.length) {
    return (
      <div className="h-52 flex flex-col items-center justify-center text-slate-400 text-sm rounded-xl bg-slate-50/80 border border-dashed border-slate-200">
        <BarChart3 className="w-9 h-9 mb-2 opacity-25" />
        No data for selected period
      </div>
    );
  }

  const pL = 52;
  const pR = 16;
  const pT = 20;
  const pB = 36;
  const W = 560;
  const H = height;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const n = data.length;
  const grpW = cW / Math.max(n, 1);
  const barW = Math.min(grpW * 0.52, 40);
  const values = data.map(getValue);
  const maxV = Math.max(...values.map((v) => Math.abs(v)), 1);

  return (
    <div className="w-full overflow-x-auto hq-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} className="min-w-[320px]">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorPrimary} />
            <stop offset="100%" stopColor={colorStop} stopOpacity="0.35" />
          </linearGradient>
          <filter id={`${gradientId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={colorPrimary} floodOpacity="0.15" />
          </filter>
        </defs>

        <line x1={pL} y1={pT} x2={pL} y2={pT + cH} stroke="#e2e8f0" strokeWidth="1" />
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = pT + cH * (1 - f);
          return (
            <g key={f}>
              <line
                x1={pL}
                y1={y}
                x2={W - pR}
                y2={y}
                stroke={f === 0 ? '#e2e8f0' : '#f1f5f9'}
                strokeWidth="1"
                strokeDasharray={f === 0 ? '' : '4 4'}
              />
              <text x={pL - 6} y={y + 3} fontSize="8.5" fill="#94a3b8" textAnchor="end" fontWeight="500">
                {fmtK(maxV * f)}
              </text>
            </g>
          );
        })}

        {data.map((item, i) => {
          const val = getValue(item);
          const cx = pL + grpW * i + grpW / 2;
          const bx = cx - barW / 2;
          const bH = Math.max((Math.abs(val) / maxV) * cH, val ? 5 : 0);
          const lbl = getLabel(item);

          return (
            <g key={i} className="hq-bar-group">
              <rect
                x={bx}
                y={pT + cH - bH}
                width={barW}
                height={bH}
                rx="7"
                fill={`url(#${gradientId})`}
                filter={`url(#${gradientId}-shadow)`}
                className="hq-bar-rect"
                style={{ transformOrigin: `${cx}px ${pT + cH}px` }}
              >
                <title>{`${lbl}: ${unit} ${fmtMoney(val)}`}</title>
              </rect>
              {val !== 0 && (
                <text x={cx} y={pT + cH - bH - 6} fontSize="8" fill={colorPrimary} textAnchor="middle" fontWeight="700">
                  {fmtK(val)}
                </text>
              )}
              <text x={cx} y={H - 6} fontSize="8.5" fill="#64748b" textAnchor="middle" fontWeight="600">
                {lbl.length > 7 ? `${lbl.slice(0, 6)}…` : lbl}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** Grouped sales + purchase bars */
function GroupedOverviewChart({ data }) {
  if (!data?.length) {
    return (
      <div className="h-56 flex flex-col items-center justify-center text-slate-400 text-sm rounded-xl bg-slate-50/80">
        <BarChart3 className="w-10 h-10 mb-2 opacity-30" />
        No branch data for selected filters
      </div>
    );
  }

  const pL = 56;
  const pR = 20;
  const pT = 24;
  const pB = 40;
  const W = 720;
  const H = 240;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const n = data.length;
  const grpW = cW / n;
  const barW = Math.min(grpW * 0.2, 20);
  const gap = 3;
  const maxV = Math.max(1, ...data.flatMap((d) => [d.sales_amount || 0, d.purchase_amount || 0]));

  return (
    <div className="w-full overflow-x-auto hq-chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" className="min-w-[480px]">
        <defs>
          <linearGradient id="hqOvSales" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={HQ_BRAND.primary} />
            <stop offset="100%" stopColor={HQ_BRAND.accent} stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="hqOvPurchase" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={HQ_BRAND.teal} />
            <stop offset="100%" stopColor="#5eead4" stopOpacity="0.4" />
          </linearGradient>
        </defs>
        <line x1={pL} y1={pT} x2={pL} y2={pT + cH} stroke="#e2e8f0" strokeWidth="1" />
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = pT + cH * (1 - f);
          return (
            <g key={f}>
              <line x1={pL} y1={y} x2={W - pR} y2={y} stroke={f === 0 ? '#e2e8f0' : '#f1f5f9'} strokeWidth="1" strokeDasharray={f === 0 ? '' : '3 3'} />
              <text x={pL - 8} y={y + 4} fontSize="9" fill="#94a3b8" textAnchor="end">{fmtK(maxV * f)}</text>
            </g>
          );
        })}
        {data.map((item, i) => {
          const cx = pL + grpW * i + grpW / 2;
          const salesVal = item.sales_amount || 0;
          const purchaseVal = item.purchase_amount || 0;
          const salesH = Math.max((salesVal / maxV) * cH, salesVal ? 4 : 0);
          const purchaseH = Math.max((purchaseVal / maxV) * cH, purchaseVal ? 4 : 0);
          const label = item.branch_code || `#${item.branch_id}`;
          return (
            <g key={item.branch_id} className="hq-bar-group">
              <rect x={cx - barW - gap / 2} y={pT + cH - salesH} width={barW} height={salesH} rx="6" fill="url(#hqOvSales)" className="hq-bar-rect">
                <title>{`${label} Sales: PKR ${fmtMoney(salesVal)}`}</title>
              </rect>
              <rect x={cx + gap / 2} y={pT + cH - purchaseH} width={barW} height={purchaseH} rx="6" fill="url(#hqOvPurchase)" className="hq-bar-rect">
                <title>{`${label} Purchases: PKR ${fmtMoney(purchaseVal)}`}</title>
              </rect>
              <text x={cx} y={H - 8} fontSize="9" fill="#64748b" textAnchor="middle" fontWeight="600">{label}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap justify-center gap-5 mt-1 pb-1">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
          <span className="w-3 h-3 rounded-md" style={{ background: HQ_GRADIENTS.activeNav }} /> Sales
        </span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
          <span className="w-3 h-3 rounded-md bg-[#0d9488]" /> Purchases
        </span>
      </div>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value, sub, color }) {
  return (
    <div className={`${HQ_UI.card} p-4 flex items-center gap-3`}>
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${color}14`, color }}>
        <Icon size={20} strokeWidth={2.25} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
        <p className="text-lg font-extrabold text-slate-900 leading-tight">{value}</p>
        {sub && <p className="text-[11px] text-slate-400 font-medium mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function ReportBlock({ icon: Icon, title, subtitle, count, accent, children }) {
  return (
    <section className={`${HQ_UI.card} overflow-hidden`}>
      <div
        className="px-5 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100"
        style={{ background: `linear-gradient(135deg, ${accent}08 0%, #ffffff 70%)` }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{ background: `${accent}18`, color: accent }}
          >
            <Icon size={20} strokeWidth={2.25} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-sm font-extrabold text-slate-900 tracking-tight">{title}</h4>
              {count != null && (
                <span
                  className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                  style={{ background: `${accent}15`, color: accent }}
                >
                  {count} records
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 font-medium">{subtitle}</p>}
          </div>
        </div>
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </section>
  );
}

const tableHeadSx = {
  fontWeight: 800,
  bgcolor: '#f8fafc',
  color: '#475569',
  fontSize: '0.68rem',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  py: 1.25,
  borderBottom: '2px solid #e8ecf3',
};

function DataTable({ columns, rows, emptyMsg }) {
  return (
    <div className="rounded-xl border border-slate-200/80 overflow-hidden bg-white shadow-sm">
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((h) => (
              <TableCell key={h} sx={tableHeadSx}>{h}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} align="center" sx={{ py: 5, color: '#94a3b8', fontWeight: 600, fontSize: '0.85rem' }}>
                {emptyMsg}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((cells, idx) => (
              <TableRow
                key={idx}
                hover
                sx={{
                  '&:nth-of-type(even)': { bgcolor: '#fafbfc' },
                  '&:last-child td': { borderBottom: 0 },
                  transition: 'background 0.15s ease',
                }}
              >
                {cells.map((cell, ci) => (
                  <TableCell key={ci} sx={{ fontSize: '0.8rem', py: 1.1, borderColor: '#f1f5f9' }}>
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

export default function HqReportsSection({ user }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [branchId, setBranchId] = useState('ALL');
  const [period, setPeriod] = useState('month');
  const [dateRange, setDateRange] = useState(() => resolvePeriodRange('month'));

  const loadReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (branchId && branchId !== 'ALL') params.set('branch_id', branchId);
      if (dateRange.from) params.set('fromDate', dateRange.from);
      if (dateRange.to) params.set('toDate', dateRange.to);
      const res = await branchFetch(user, `/api/branches/hq-reports?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load reports');
      setReport(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user, branchId, dateRange]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const handlePeriodChange = (id) => {
    setPeriod(id);
    setDateRange(resolvePeriodRange(id));
  };

  const byBranch = report?.by_branch || [];
  const summary = report?.summary;
  const branchOptions = report?.branch_options || [];

  const periodLabel = useMemo(
    () => PERIOD_PRESETS.find((p) => p.id === period)?.label || 'This Month',
    [period]
  );

  const filterHint = branchId === 'ALL' ? 'All branches' : 'Selected branch';

  const salesRows = (report?.sales || []).slice(0, 12).map((r) => [
    <span key="b" className="font-bold text-slate-800">{r.branch_code}</span>,
    fmtDate(r.date),
    r.customer,
    r.bill_type,
    <span key="a" className="font-extrabold" style={{ color: HQ_BRAND.primary }}>{fmtMoney(r.amount)}</span>,
    fmtMoney(r.payment),
  ]);

  const purchaseRows = (report?.purchases || []).slice(0, 12).map((r) => [
    <span key="b" className="font-bold text-slate-800">{r.branch_code}</span>,
    fmtDate(r.date),
    r.supplier,
    r.invoice_number,
    <span key="a" className="font-extrabold text-[#0f766e]">{fmtMoney(r.net_total)}</span>,
    fmtMoney(r.payment),
  ]);

  const stockRows = (report?.stock || []).slice(0, 12).map((r) => [
    <span key="b" className="font-bold text-slate-800">{r.branch_code}</span>,
    r.store_name,
    r.product_name,
    <span key="q" className="font-bold">{fmtMoney(r.quantity)}</span>,
    fmtMoney(r.min_stock),
    <Chip
      key="s"
      size="small"
      label={r.status}
      color={r.status === 'OK' ? 'success' : r.status === 'LOW' ? 'warning' : 'error'}
      sx={{ fontWeight: 700, fontSize: '0.62rem', height: 20 }}
    />,
  ]);

  return (
    <div className="space-y-5">
      <div className={`${HQ_REPORT.card} overflow-hidden`}>
        <div className={HQ_REPORT.filterHeader}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white tracking-tight">Branch Reports</h3>
              <p className="text-xs text-white/75 font-medium">All reports shown · monthly by default</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => router.push('/dashboard/hq/monitoring')}
            className="inline-flex items-center gap-1 text-xs font-bold text-white/90 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg border border-white/20 transition-colors"
          >
            Export & detail
            <ChevronRight size={14} />
          </button>
        </div>

        <div className="px-4 md:px-5 py-4 bg-white border-b border-slate-100 flex flex-wrap items-end gap-3">
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <Select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              sx={{ borderRadius: 2, bgcolor: '#f8fafc', fontWeight: 600, fontSize: '0.85rem' }}
            >
              <MenuItem value="ALL">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Building2 size={14} /> All Branches
                </Box>
              </MenuItem>
              {branchOptions.map((b) => (
                <MenuItem key={b.branch_id} value={String(b.branch_id)}>
                  {b.branch_code} — {b.branch_name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-slate-100 border border-slate-200/80">
            {PERIOD_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePeriodChange(p.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  period === p.id ? 'bg-white text-[#4338ca] shadow-sm ring-1 ring-indigo-100' : 'text-slate-600 hover:bg-white/60'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          <Chip
            size="small"
            icon={<Calendar size={12} />}
            label={`${periodLabel} · ${dateRange.from} → ${dateRange.to}`}
            sx={{ fontWeight: 700, bgcolor: HQ_BRAND.tint, color: HQ_BRAND.textDark }}
          />
        </div>

        {error && <Alert severity="error" sx={{ m: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {loading ? (
          <Box sx={{ py: 10, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress sx={HQ_MUI.spinner} />
          </Box>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 md:p-5 bg-[#f9fafb]">
            <SummaryTile icon={ShoppingCart} label="Sales" value={`PKR ${fmtMoney(summary?.sales_amount)}`} sub={`${summary?.sales_total_records ?? 0} txns`} color={HQ_BRAND.primary} />
            <SummaryTile icon={ShoppingBag} label="Purchases" value={`PKR ${fmtMoney(summary?.purchase_amount)}`} sub={`${summary?.purchase_total_records ?? 0} txns`} color={HQ_BRAND.teal} />
            <SummaryTile icon={Warehouse} label="Stock Qty" value={fmtMoney(summary?.stock_qty)} sub={`${summary?.stock_items ?? 0} items`} color={HQ_BRAND.secondary} />
            <SummaryTile icon={TrendingUp} label="Low Stock" value={summary?.low_stock_items ?? 0} sub={`${summary?.branches ?? 0} branches`} color={HQ_BRAND.highlightDark} />
          </div>
        )}
      </div>

      {!loading && (
        <div className="space-y-5">
          {/* Overview */}
          <ReportBlock
            icon={BarChart3}
            title="Overview — Sales vs Purchases"
            subtitle={`${filterHint} · ${periodLabel}`}
            accent={HQ_BRAND.primary}
          >
            <GroupedOverviewChart data={byBranch} />
          </ReportBlock>

          {/* Sales */}
          <ReportBlock
            icon={ShoppingCart}
            title="Sales Report"
            subtitle={`Amount by branch · ${filterHint}`}
            count={report?.sales?.length ?? 0}
            accent={HQ_BRAND.primary}
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="rounded-xl bg-gradient-to-b from-[#eef2ff]/50 to-white p-4 border border-indigo-100/60">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Sales amount by branch</p>
                <SmoothBarChart
                  data={byBranch}
                  getValue={(d) => d.sales_amount || 0}
                  getLabel={(d) => d.branch_code}
                  gradientId="hqSalesSolo"
                  colorPrimary={HQ_BRAND.primary}
                  colorStop={HQ_BRAND.accent}
                />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Latest transactions</p>
                <DataTable
                  columns={['Branch', 'Date', 'Customer', 'Bill', 'Amount', 'Paid']}
                  rows={salesRows}
                  emptyMsg="No sales in this period"
                />
              </div>
            </div>
          </ReportBlock>

          {/* Purchases */}
          <ReportBlock
            icon={ShoppingBag}
            title="Purchase Report"
            subtitle={`Supplier purchases by branch · ${filterHint}`}
            count={report?.purchases?.length ?? 0}
            accent={HQ_BRAND.teal}
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="rounded-xl bg-gradient-to-b from-[#ecfdf5]/60 to-white p-4 border border-teal-100/60">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Purchase amount by branch</p>
                <SmoothBarChart
                  data={byBranch}
                  getValue={(d) => d.purchase_amount || 0}
                  getLabel={(d) => d.branch_code}
                  gradientId="hqPurchaseSolo"
                  colorPrimary={HQ_BRAND.teal}
                  colorStop="#5eead4"
                />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Latest purchases</p>
                <DataTable
                  columns={['Branch', 'Date', 'Supplier', 'Invoice', 'Net', 'Paid']}
                  rows={purchaseRows}
                  emptyMsg="No purchases in this period"
                />
              </div>
            </div>
          </ReportBlock>

          {/* Stock */}
          <ReportBlock
            icon={Warehouse}
            title="Stock Report"
            subtitle={`Inventory levels across branches · ${filterHint}`}
            count={report?.stock?.length ?? 0}
            accent={HQ_BRAND.secondary}
          >
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div className="rounded-xl bg-gradient-to-b from-[#f5f3ff]/60 to-white p-4 border border-violet-100/60">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Stock quantity by branch</p>
                <SmoothBarChart
                  data={byBranch}
                  getValue={(d) => d.stock_qty || 0}
                  getLabel={(d) => d.branch_code}
                  gradientId="hqStockSolo"
                  colorPrimary={HQ_BRAND.secondary}
                  colorStop="#a78bfa"
                  unit="Qty"
                />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">Stock lines</p>
                <DataTable
                  columns={['Branch', 'Store', 'Product', 'Qty', 'Min', 'Status']}
                  rows={stockRows}
                  emptyMsg="No stock records"
                />
              </div>
            </div>
          </ReportBlock>

          <p className="text-center text-xs text-slate-400 pb-2">
            Showing latest 12 rows per report ·{' '}
            <button type="button" className="font-bold hover:underline" style={{ color: HQ_BRAND.primary }} onClick={() => router.push('/dashboard/hq/monitoring')}>
              Open full monitoring page
            </button>
          </p>
        </div>
      )}

      <style jsx global>{`
        .hq-bar-rect {
          transition: opacity 0.2s ease, filter 0.2s ease;
        }
        .hq-bar-group:hover .hq-bar-rect {
          opacity: 0.88;
          filter: brightness(1.06);
        }
        .hq-chart-wrap {
          animation: hqChartIn 0.45s ease-out;
        }
        @keyframes hqChartIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
