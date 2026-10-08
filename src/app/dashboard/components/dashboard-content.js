'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  hasDashboardWidgetAccess,
  canViewAnyDashboardAnalytics,
  filterDashboardShortcuts,
  canViewDashboardLowStock,
} from '@/lib/staff-access';
import {
  eachPkWeekInRange,
  formatDatePK,
  formatPkWeekLabel,
  getPkDateString,
  lastNCalendarMonthsFilter,
  lastNPkDaysInclusive,
} from '@/lib/date-helper';
import { useRouter } from 'next/navigation';
import {
  DollarSign,
  ShoppingCart,
  Users,
  TrendingUp,
  Package,
  Eye,
  EyeOff,
  ShoppingBag,
  FileText,
  ArrowLeftRight,
  Warehouse,
  Receipt,
  ClipboardList,
  RotateCcw,
  ScrollText,
  ListOrdered,
  TrendingDown,
  BookOpen,
  Clock,
  Calendar,
  Filter,
  CreditCard,
  Banknote,
  PieChart,
  BarChart3,
  AlertTriangle,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import {
  SHORTCUT_PALETTE,
  KPI_PALETTE,
  QUICK_ENTRY_TONES,
  CHART_COLORS,
  KPI_NEON,
  REPORT,
  getReportNeonStyles,
} from '@/lib/brand-theme';

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatQty = (val) => {
  const n = parseFloat(String(val ?? 0));
  if (!Number.isFinite(n)) return '0';
  const r = Math.round(n * 10000) / 10000;
  return r.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 4 });
};

const stockStatusLabel = (status) => {
  if (status === 'OUT') return 'Out of Stock';
  if (status === 'LOW') return 'Low Stock';
  return status;
};

const formatMonthLabel = (mStr) => {
  if (!mStr) return '';
  const parts = mStr.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (parts.length === 3) {
    const d = parseInt(parts[2], 10);
    const mIndex = parseInt(parts[1], 10) - 1;
    return `${d} ${monthNames[mIndex] || parts[1]}`;
  }
  if (parts.length < 2) return mStr;
  const mIndex = parseInt(parts[1], 10) - 1;
  return `${monthNames[mIndex] || parts[1]} '${parts[0].slice(2)}`;
};

const fmtK = v => {
  const abs = Math.abs(v);
  if (abs >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${(v / 1000).toFixed(0)}K`;
  return v.toFixed(0);
};

const CARD = 'relative bg-white rounded-[1.25rem] border border-slate-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_28px_rgba(15,23,42,0.08)]';
const CARD_HOVER = 'transition-all duration-300 ease-out hover:shadow-[0_4px_8px_rgba(15,23,42,0.05),0_16px_40px_rgba(15,23,42,0.11)] hover:-translate-y-1';

const EMPTY_DATE_FILTER = { fromDate: '', toDate: '' };

function last30DaysFilter() {
  return lastNPkDaysInclusive(30);
}

const ReportViewContext = createContext(null);

function ReportFullscreenExpandButton() {
  const ctx = useContext(ReportViewContext);
  if (!ctx || ctx.isFullscreen) return null;
  const neon = getReportNeonStyles(ctx.accent);
  return (
    <button
      type="button"
      onClick={ctx.expand}
      title="Full screen"
      aria-label="Open full screen"
      className="inline-flex items-center justify-center w-8 h-8 rounded-lg border transition-colors hover:bg-white shrink-0"
      style={{ borderColor: neon.chartBorder, color: neon.primary }}
    >
      <Maximize2 className="w-4 h-4" strokeWidth={2.25} />
    </button>
  );
}

function buildDatePreset(days) {
  if (days === 'year') {
    const today = getPkDateString();
    return { fromDate: `${today.slice(0, 4)}-01-01`, toDate: today };
  }
  return lastNPkDaysInclusive(Number(days) || 30);
}

function buildWeeklyChartData(salesList, days) {
  const range = lastNPkDaysInclusive(days);
  const slots = eachPkWeekInRange(range.fromDate, range.toDate).map((week) => ({
    from: week.from,
    to: week.to,
    dateStr: week.label || formatPkWeekLabel(week.from, week.to),
    billAmt: 0,
    orderAmt: 0,
    totalCount: 0,
    orderCount: 0,
  }));
  (salesList || []).forEach((sale) => {
    const day = getPkDateString(sale.created_at);
    const slot = slots.find((item) => day >= item.from && day <= item.to);
    if (!slot) return;
    const amt = parseFloat(sale.total_amount || 0);
    slot.totalCount += 1;
    if (sale.bill_type === 'ORDER') {
      slot.orderAmt += amt;
      slot.orderCount += 1;
    } else if (sale.bill_type !== 'QUOTATION') {
      slot.billAmt += amt;
    }
  });
  return {
    labels: slots.map((d) => d.dateStr),
    billAmounts: slots.map((d) => d.billAmt),
    orderAmounts: slots.map((d) => d.orderAmt),
    totalCounts: slots.map((d) => d.totalCount),
    orderCounts: slots.map((d) => d.orderCount),
  };
}

function ReportWidgetShell({ accent, title = 'Report', children, className = '' }) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const neon = getReportNeonStyles(accent);

  const viewCtx = useMemo(
    () => ({
      isFullscreen,
      expand: () => setIsFullscreen(true),
      collapse: () => setIsFullscreen(false),
      accent,
      title,
    }),
    [isFullscreen, accent, title]
  );

  useEffect(() => {
    if (!isFullscreen) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setIsFullscreen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.body.classList.add('report-fullscreen-open');
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.classList.remove('report-fullscreen-open');
      window.removeEventListener('keydown', onKey);
    };
  }, [isFullscreen]);

  const card = (
    <ReportViewContext.Provider value={viewCtx}>
      <div
        className={`${REPORT.cardBase} ${className} ${isFullscreen ? 'h-full flex flex-col min-h-0' : ''}`}
        style={isFullscreen ? { border: 'none', boxShadow: 'none' } : neon.card}
      >
        {children}
      </div>
    </ReportViewContext.Provider>
  );

  if (isFullscreen && typeof document !== 'undefined') {
    return createPortal(
      <div
        className="fixed inset-0 flex flex-col bg-slate-50"
        style={{ zIndex: 9999, width: '100vw', height: '100vh', maxWidth: '100vw' }}
        role="dialog"
        aria-modal="true"
        aria-label={`${title} full screen`}
      >
        <div
          className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 bg-white border-b shrink-0"
          style={{ borderColor: neon.divider }}
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: neon.text }}>
              {title}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">Full screen report view · Esc to close</p>
          </div>
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors hover:bg-slate-50 shrink-0"
            style={{ borderColor: neon.primary, color: neon.text }}
          >
            <Minimize2 className="w-4 h-4" strokeWidth={2.25} />
            Exit full screen
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4 md:p-6 min-h-0">{card}</div>
      </div>,
      document.body
    );
  }

  return card;
}

function WidgetDateFilter({ filters, onChange, loading = false, accent }) {
  const neon = getReportNeonStyles(accent);
  return (
    <div
      className={REPORT.filterBody}
      style={{ background: neon.filterBg, borderColor: neon.divider }}
    >
      <Filter className="w-3.5 h-3.5 shrink-0" style={{ color: neon.primary }} />
      <div className={REPORT.datePill} style={{ borderColor: neon.chartBorder }}>
        <Calendar className="w-3.5 h-3.5" style={{ color: neon.primary }} />
        <span className="text-[10px] font-semibold text-slate-500">From</span>
        <input type="date" lang="en-GB"
          value={filters.fromDate}
          onChange={(e) => onChange({ ...filters, fromDate: e.target.value })}
          className="text-[11px] font-medium text-slate-800 bg-transparent focus:outline-none"
        />
      </div>
      <div className={REPORT.datePill} style={{ borderColor: neon.chartBorder }}>
        <Calendar className="w-3.5 h-3.5" style={{ color: neon.primary }} />
        <span className="text-[10px] font-semibold text-slate-500">To</span>
        <input type="date" lang="en-GB"
          value={filters.toDate}
          onChange={(e) => onChange({ ...filters, toDate: e.target.value })}
          className="text-[11px] font-medium text-slate-800 bg-transparent focus:outline-none"
        />
      </div>
      <div className={REPORT.presetWrap} style={{ borderColor: neon.chartBorder }}>
        {[
          { label: '30D', days: 30 },
          { label: '3M', days: 90 },
          { label: '6M', days: 180 },
          { label: 'Year', days: 'year' },
        ].map(({ label, days }) => {
          const preset = buildDatePreset(days);
          const active = filters.fromDate === preset.fromDate && filters.toDate === preset.toDate;
          return (
          <button
            key={label}
            type="button"
            onClick={() => onChange(preset)}
            className={`${REPORT.presetBtn}${active ? ` ${REPORT.presetBtnActive}` : ''}`}
            style={active ? { color: neon.primary } : { ['--neon-accent']: neon.primary }}
          >
            {label}
          </button>
          );
        })}
      </div>
      {(filters.fromDate || filters.toDate) && (
        <button
          type="button"
          onClick={() => onChange(EMPTY_DATE_FILTER)}
          className="text-[10px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
          style={{ color: CHART_COLORS.debit.primary }}
        >
          Clear
        </button>
      )}
      <div className="flex items-center gap-2 ml-auto shrink-0">
        {loading && (
          <div
            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: `${neon.primary}33`, borderTopColor: 'transparent', borderRightColor: neon.primary, borderBottomColor: neon.primary, borderLeftColor: neon.primary }}
          />
        )}
        <ReportFullscreenExpandButton />
      </div>
    </div>
  );
}

function WidgetDayFilter({ days, onChange, loading = false, accent }) {
  const neon = getReportNeonStyles(accent);
  return (
    <div
      className={REPORT.filterBody}
      style={{ background: neon.filterBg, borderColor: neon.divider }}
    >
      <Filter className="w-3.5 h-3.5 shrink-0" style={{ color: neon.primary }} />
      <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Period</span>
      <div className={REPORT.presetWrap} style={{ borderColor: neon.chartBorder }}>
        {[7, 14, 30].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onChange(d)}
            className={`${REPORT.presetBtn}${days === d ? ` ${REPORT.presetBtnActive}` : ''}`}
            style={days === d ? { color: neon.primary } : undefined}
          >
            {d}D
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 ml-auto shrink-0">
        {loading && (
          <div
            className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: `${neon.primary}33`, borderTopColor: 'transparent', borderRightColor: neon.primary, borderBottomColor: neon.primary, borderLeftColor: neon.primary }}
          />
        )}
        <ReportFullscreenExpandButton />
      </div>
    </div>
  );
}

function ReportChartArea({ accent, children }) {
  const ctx = useContext(ReportViewContext);
  const neon = getReportNeonStyles(accent);
  return (
    <div
      className={`${REPORT.chartArea}${ctx?.isFullscreen ? ' flex-1 min-h-[calc(100vh-220px)] !mx-4 md:!mx-6 !mb-4 [&_svg]:!min-h-[min(560px,calc(100vh-280px))]' : ''}`}
      style={{ background: neon.chartBg, borderColor: neon.chartBorder }}
    >
      {children}
    </div>
  );
}

function ChartEmptyState() {
  return (
    <div className="h-[240px] flex flex-col items-center justify-center text-slate-400">
      <div className="w-14 h-14 rounded-2xl bg-slate-100/80 flex items-center justify-center mb-3">
        <BarChart3 className="w-7 h-7 text-slate-300" strokeWidth={1.75} />
      </div>
      <p className="text-sm font-medium text-slate-500">No bar data for this range</p>
      <p className="text-xs text-slate-400 mt-0.5">Try adjusting the date filter</p>
    </div>
  );
}

function ReportWidgetHeader({ title, subtitle, icon: Icon, tint, primary, accent }) {
  const neon = getReportNeonStyles(accent || { primary, tint });
  return (
    <div
      className={`${REPORT.cardInner} flex items-start justify-between gap-4 border-b`}
      style={{ borderColor: neon.divider }}
    >
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: neon.text }}>
          {title}
        </p>
        {subtitle && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{subtitle}</p>}
      </div>
      {Icon && (
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border"
          style={{ background: tint, borderColor: neon.iconBorder }}
        >
          <Icon className="w-[18px] h-[18px]" style={{ color: primary }} strokeWidth={2.25} />
        </div>
      )}
    </div>
  );
}

/** Thin footer row: formula (gray) + total (accent neon) */
function ReportWidgetFooter({ formula, total, totalLabel = 'Total', accent }) {
  if (total == null && !formula) return null;
  const neon = getReportNeonStyles(accent);
  return (
    <div className={REPORT.footer} style={{ borderColor: neon.divider }}>
      {formula && (
        <span className={`${REPORT.trendMuted} leading-snug`}>{formula}</span>
      )}
      {total != null && (
        <span className="text-[10px] font-bold tabular-nums whitespace-nowrap ml-auto" style={{ color: neon.totalColor }}>
          {totalLabel}: {total}
        </span>
      )}
    </div>
  );
}

function ReportLegendRow({ accent, children }) {
  const neon = getReportNeonStyles(accent);
  return (
    <div className={REPORT.legendRow} style={{ borderColor: neon.divider }}>
      {children}
    </div>
  );
}

function renderSmoothBarChart({
  data,
  getValue,
  colorPrimary,
  colorGradientStop,
  barId,
  labelKey = 'period',
  hoverUnit = 'PKR',
  formatLabel = formatMonthLabel,
}) {
  if (!data?.length) return <ChartEmptyState />;

  const pL = 54;
  const pR = 16;
  const pT = 28;
  const pB = 42;
  const W = 640;
  const H = 240;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const n = data.length;
  const grpW = cW / n;
  const barW = Math.min(grpW * 0.52, 40);
  const values = data.map(getValue);
  const maxV = Math.max(...values.map((v) => Math.abs(v)), 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" className="min-h-[240px]">
      <defs>
        <linearGradient id={barId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colorPrimary} />
          <stop offset="100%" stopColor={colorGradientStop} stopOpacity="0.55" />
        </linearGradient>
        <filter id={`${barId}-shadow`} x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={colorPrimary} floodOpacity="0.18" />
        </filter>
      </defs>
      <rect x={pL} y={pT} width={cW} height={cH} rx="8" fill="#f3f4f6" opacity="0.5" />
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = pT + cH * (1 - f);
        return (
          <g key={f}>
            <line x1={pL} y1={y} x2={W - pR} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 6" opacity="0.85" />
            <text x={pL - 8} y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">
              {fmtK(maxV * f)}
            </text>
          </g>
        );
      })}
      <line x1={pL} y1={pT + cH} x2={W - pR} y2={pT + cH} stroke="#cbd5e1" strokeWidth="1" />
      {data.map((item, i) => {
        const val = getValue(item);
        const cx = pL + grpW * i + grpW / 2;
        const bx = cx - barW / 2;
        const bH = Math.max((Math.abs(val) / maxV) * cH, val !== 0 ? 4 : 0);
        const lbl = item.label || formatLabel(item[labelKey]);
        return (
          <g key={i} className="cursor-pointer">
            <rect
              x={bx}
              y={pT + cH - bH}
              width={barW}
              height={bH}
              rx="8"
              fill={`url(#${barId})`}
              filter={`url(#${barId}-shadow)`}
            >
              <title>{`${lbl}: ${hoverUnit} ${val.toLocaleString()}`}</title>
            </rect>
            {val !== 0 && (
              <text x={cx} y={pT + cH - bH - 6} fontSize="10" fill={colorPrimary} textAnchor="middle" fontWeight="700">
                {fmtK(val)}
              </text>
            )}
            <text x={cx} y={H - 10} fontSize="10" fill="#64748b" textAnchor="middle" fontWeight="500">
              {lbl}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function renderGroupedBarChart({ chartId, labels, series, formatValue = fmtK }) {
  if (!labels?.length) return <ChartEmptyState />;

  const pL = 54;
  const pR = 12;
  const pT = 28;
  const pB = 40;
  const W = 640;
  const H = 240;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const n = labels.length;
  const grpW = cW / n;
  const barW = Math.min(grpW / (series.length + 1), 22);
  const maxV = Math.max(...series.flatMap((s) => s.values), 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" className="min-h-[240px]">
      <defs>
        {series.map((s) => (
          <linearGradient key={s.key} id={`${chartId}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.primary} />
            <stop offset="100%" stopColor={s.gradient} stopOpacity="0.5" />
          </linearGradient>
        ))}
      </defs>
      <rect x={pL} y={pT} width={cW} height={cH} rx="8" fill="#f3f4f6" opacity="0.5" />
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = pT + cH * (1 - f);
        return (
          <g key={f}>
            <line x1={pL} y1={y} x2={W - pR} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 6" />
            <text x={pL - 8} y={y + 4} fontSize="10" fill="#94a3b8" textAnchor="end">
              {formatValue(maxV * f)}
            </text>
          </g>
        );
      })}
      <line x1={pL} y1={pT + cH} x2={W - pR} y2={pT + cH} stroke="#cbd5e1" strokeWidth="1" />
      {labels.map((lbl, i) => {
        const cx = pL + grpW * i + grpW / 2;
        const groupW = series.length * barW + (series.length - 1) * 4;
        let x = cx - groupW / 2;
        return (
          <g key={lbl}>
            {series.map((s) => {
              const val = s.values[i] || 0;
              const bH = Math.max((val / maxV) * cH, val > 0 ? 4 : 0);
              const rect = (
                <rect
                  key={s.key}
                  x={x}
                  y={pT + cH - bH}
                  width={barW}
                  height={bH}
                  rx="6"
                  fill={`url(#${chartId}-${s.key})`}
                >
                  <title>{`${s.name} ${lbl}: ${formatValue(val)}`}</title>
                </rect>
              );
              x += barW + 4;
              return rect;
            })}
            <text x={cx} y={H - 10} fontSize="10" fill="#64748b" textAnchor="middle" fontWeight="500">
              {lbl}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function renderRankingBarChart({ rows, color, gradient, gradId, loading, emptyLabel = 'No data available' }) {
  const n = Math.min(rows.length, 15);
  if (n === 0) {
    return (
      <div className="h-[260px] flex items-center justify-center text-slate-400 text-sm">
        {loading ? (
          <div className="w-8 h-8 border-2 border-[#1A55E3] border-t-transparent rounded-full animate-spin" />
        ) : (
          emptyLabel
        )}
      </div>
    );
  }

  const pL = 52;
  const pR = 16;
  const pT = 24;
  const pB = 90;
  const W = 1200;
  const H = 280;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const grpW = cW / n;
  const barW = Math.min(grpW * 0.55, 56);
  const maxV = Math.max(...rows.slice(0, n).map((r) => r.balance), 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" className="min-h-[260px]">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor={gradient} stopOpacity="0.35" />
        </linearGradient>
        <filter id={`${gradId}-shadow`} x="-15%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={color} floodOpacity="0.15" />
        </filter>
      </defs>
      <rect x={pL} y={pT} width={cW} height={cH} rx="8" fill="#f3f4f6" opacity="0.5" />
      {[0.25, 0.5, 0.75, 1].map((f) => {
        const y = pT + cH * (1 - f);
        return (
          <g key={f}>
            <line x1={pL} y1={y} x2={W - pR} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4 6" />
            <text x={pL - 8} y={y + 4} fontSize="11" fill="#94a3b8" textAnchor="end">
              {fmtK(maxV * f)}
            </text>
          </g>
        );
      })}
      {rows.slice(0, n).map((r, i) => {
        const cx = pL + grpW * i + grpW / 2;
        const bH = Math.max((r.balance / maxV) * cH, 2);
        const bx = cx - barW / 2;
        const shortName = r.name.length > 14 ? `${r.name.slice(0, 13)}…` : r.name;
        return (
          <g key={i}>
            <rect
              x={bx}
              y={pT + cH - bH}
              width={barW}
              height={bH}
              rx="8"
              fill={`url(#${gradId})`}
              filter={`url(#${gradId}-shadow)`}
            >
              <title>{`${r.name}: PKR ${Number(r.balance || 0).toLocaleString()}${r.qty != null ? ` · Qty ${formatQty(r.qty)}` : ''}${r.invoices != null ? ` · ${r.invoices} bills` : ''}`}</title>
            </rect>
            <text x={bx + barW / 2} y={pT + cH - bH - 6} fontSize="10" fill={color} textAnchor="middle" fontWeight="700">
              {fmtK(r.balance)}
            </text>
            <text
              x={cx}
              y={pT + cH + 12}
              fontSize="11"
              fill="#64748b"
              textAnchor="end"
              transform={`rotate(-38,${cx},${pT + cH + 12})`}
            >
              {shortName}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Responsive grid: 1 = full width, 2 = half/half, 3+ = pairs with last row full width when odd */
function renderAnalyticsGrid(items) {
  const list = items.filter(Boolean);
  const count = list.length;
  if (count === 0) return null;
  const gridClass = count <= 1 ? 'grid grid-cols-1 gap-4' : 'grid grid-cols-1 lg:grid-cols-2 gap-4';
  const lastSpansFull = count > 1 && count % 2 === 1;
  return (
    <div className={gridClass}>
      {list.map((item, i) => (
        <div key={item.key} className={lastSpansFull && i === count - 1 ? 'lg:col-span-2' : undefined}>
          {item.node}
        </div>
      ))}
    </div>
  );
}

const ALL_QUICK_ACTIONS = [
  { title: 'New Sale', icon: ShoppingCart, palette: 'green', path: '/dashboard/sales?view=create' },
  { title: 'New Purchase', icon: ShoppingBag, palette: 'blue', path: '/dashboard/purchases' },
  { title: 'Orders List', icon: ListOrdered, palette: 'yellow', path: '/dashboard/orders' },
  { title: 'Add Product', icon: Package, palette: 'cyan', path: '/dashboard/products' },
  { title: 'Add Customer', icon: Users, palette: 'periwinkle', path: '/dashboard/customers' },
  { title: 'Hold Bills', icon: ClipboardList, palette: 'orange', path: '/dashboard/hold-bills' },
  { title: 'Stock Transfer', icon: ArrowLeftRight, palette: 'cyan', path: '/dashboard/stock-transfer' },
  { title: 'Store Stock', icon: Warehouse, palette: 'slate', path: '/dashboard/store-stock' },
  { title: 'Expenses', icon: DollarSign, palette: 'pink', path: '/dashboard/expenses' },
  { title: 'Ledger', icon: FileText, palette: 'periwinkle', path: '/dashboard/finance' },
  { title: 'View Reports', icon: TrendingUp, palette: 'pink', path: '/dashboard/reports' },
  { title: 'Sale Return', icon: RotateCcw, palette: 'green', path: '/dashboard/sales?view=create&type=return' },
  { title: 'Purchase Return', icon: TrendingDown, palette: 'blue', path: '/dashboard/purchases?view=create&type=return' },
  { title: 'Quotations', icon: ScrollText, palette: 'blue', path: '/dashboard/quotations' },
  { title: 'Sales List', icon: Receipt, palette: 'green', path: '/dashboard/sales' },
  { title: 'Journal', icon: BookOpen, palette: 'periwinkle', path: '/dashboard/journal' },
  { title: 'Day End', icon: Clock, palette: 'cyan', path: '/dashboard/day-end' },
];

const ALL_QUICK_ENTRY_ACTIONS = [
  { title: 'New Purchase Bill', subtitle: 'Record supplier purchase', icon: ShoppingBag, tone: 'blue', path: '/dashboard/purchases' },
  { title: 'Direct Sale Invoice', subtitle: 'Create customer sale', icon: ShoppingCart, tone: 'green', path: '/dashboard/sales?view=create' },
  { title: 'Day End / Closing', subtitle: 'Close business day', icon: Clock, tone: 'neutral', path: '/dashboard/day-end' },
  { title: 'Inventory Check', subtitle: 'View store stock levels', icon: Warehouse, tone: 'neutral', path: '/dashboard/store-stock' },
];

function readDashboardUser() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function DashboardContent({ activeTab }) {
  const router = useRouter();
  const [dashboardUser, setDashboardUser] = useState(null);
  const [permVersion, setPermVersion] = useState(0);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentActivityData, setRecentActivityData] = useState([]);
  const [profitData, setProfitData] = useState([]);
  const [allCategories, setAllCategories] = useState([]);

  const [kpiFilters, setKpiFilters] = useState(last30DaysFilter);

  const [monthEndFilters, setMonthEndFilters] = useState(() => lastNCalendarMonthsFilter(6));
  const [monthlyProfitFilters, setMonthlyProfitFilters] = useState(last30DaysFilter);
  const [monthlySalesFilters, setMonthlySalesFilters] = useState(last30DaysFilter);
  const [monthlyCreditData, setMonthlyCreditData] = useState([]);
  const [monthlyDebitData, setMonthlyDebitData] = useState([]);
  const [monthlyProfitData, setMonthlyProfitData] = useState([]);
  const [monthlySalesData, setMonthlySalesData] = useState([]);
  const [monthEndLoading, setMonthEndLoading] = useState(false);
  const [monthlyProfitLoading, setMonthlyProfitLoading] = useState(false);
  const [monthlySalesLoading, setMonthlySalesLoading] = useState(false);

  const [customerBalanceFilters, setCustomerBalanceFilters] = useState({ ...last30DaysFilter(), cusCatId: '' });
  const [supplierBalanceFilters, setSupplierBalanceFilters] = useState({ ...last30DaysFilter(), supCatId: '' });
  const [customerBalanceData, setCustomerBalanceData] = useState([]);
  const [supplierBalanceData, setSupplierBalanceData] = useState([]);
  const [customerBalanceLoading, setCustomerBalanceLoading] = useState(false);
  const [supplierBalanceLoading, setSupplierBalanceLoading] = useState(false);

  const [topCustomersSaleFilters, setTopCustomersSaleFilters] = useState(last30DaysFilter);
  const [topProductsSaleFilters, setTopProductsSaleFilters] = useState(last30DaysFilter);
  const [topCustomersSaleData, setTopCustomersSaleData] = useState([]);
  const [topProductsSaleData, setTopProductsSaleData] = useState([]);
  const [topCustomersSaleLoading, setTopCustomersSaleLoading] = useState(false);
  const [topProductsSaleLoading, setTopProductsSaleLoading] = useState(false);

  const [rawSalesList, setRawSalesList] = useState([]);
  const [weeklyDataLoading, setWeeklyDataLoading] = useState(false);
  const [salesOverviewDays, setSalesOverviewDays] = useState(30);
  const [transactionsOverviewDays, setTransactionsOverviewDays] = useState(30);

  const [recentActivityLimit, setRecentActivityLimit] = useState(5);
  const [lowStockData, setLowStockData] = useState({
    items: [],
    count: 0,
    out_of_stock: 0,
    low_stock: 0,
  });
  const [lowStockLoading, setLowStockLoading] = useState(true);

  useEffect(() => {
    setDashboardUser(readDashboardUser());
    const onUserUpdated = () => setDashboardUser(readDashboardUser());
    const onPermissionsUpdated = (e) => {
      const next = e?.detail || readDashboardUser();
      if (next?.user_id) setDashboardUser(next);
      setPermVersion((v) => v + 1);
    };
    const onRoleMapUpdated = () => {
      setDashboardUser(readDashboardUser());
      setPermVersion((v) => v + 1);
    };
    window.addEventListener('storage', onUserUpdated);
    window.addEventListener('branch-changed', onUserUpdated);
    window.addEventListener('user-permissions-updated', onPermissionsUpdated);
    window.addEventListener('role-permissions-updated', onRoleMapUpdated);
    return () => {
      window.removeEventListener('storage', onUserUpdated);
      window.removeEventListener('branch-changed', onUserUpdated);
      window.removeEventListener('user-permissions-updated', onPermissionsUpdated);
      window.removeEventListener('role-permissions-updated', onRoleMapUpdated);
    };
  }, []);

  const analyticsWidgets = useMemo(() => {
    if (!dashboardUser) {
      return {
        kpi: false,
        monthlyCredit: false,
        monthlyDebit: false,
        monthlyProfit: false,
        monthlySales: false,
        salesOverview: false,
        transactionsOverview: false,
        customerBalance: false,
        supplierBalance: false,
        topCustomersSale: false,
        topProductsSale: false,
        recentActivity: false,
        any: false,
        anyMonthlyChart: false,
        anyWeeklyChart: false,
        anyBalanceChart: false,
        anyTopSaleChart: false,
      };
    }
    const w = (id) => hasDashboardWidgetAccess(dashboardUser, id);
    const monthlyCredit = w('dashboard-monthly-credit');
    const monthlyDebit = w('dashboard-monthly-debit');
    const monthlyProfit = w('dashboard-monthly-profit');
    const monthlySales = w('dashboard-monthly-sales');
    const salesOverview = w('dashboard-sales-overview');
    const transactionsOverview = w('dashboard-transactions-overview');
    const customerBalance = w('dashboard-customer-balance');
    const supplierBalance = w('dashboard-supplier-balance');
    const topCustomersSale = w('dashboard-top-customers-sale');
    const topProductsSale = w('dashboard-top-products-sale');
    const recentActivity = w('dashboard-recent-activity');
    const kpi = w('dashboard-kpi');
    return {
      kpi,
      monthlyCredit,
      monthlyDebit,
      monthlyProfit,
      monthlySales,
      salesOverview,
      transactionsOverview,
      customerBalance,
      supplierBalance,
      topCustomersSale,
      topProductsSale,
      recentActivity,
      any: canViewAnyDashboardAnalytics(dashboardUser),
      anyMonthlyChart: monthlyCredit || monthlyDebit || monthlyProfit || monthlySales,
      anyWeeklyChart: salesOverview || transactionsOverview,
      anyBalanceChart: customerBalance || supplierBalance,
      anyTopSaleChart: topCustomersSale || topProductsSale,
    };
  }, [dashboardUser, permVersion]);

  const showLowStockSection = useMemo(
    () => canViewDashboardLowStock(dashboardUser),
    [dashboardUser, permVersion]
  );

  const quickActions = useMemo(
    () => filterDashboardShortcuts(dashboardUser, ALL_QUICK_ACTIONS),
    [dashboardUser, permVersion]
  );

  const quickEntryActions = useMemo(
    () => filterDashboardShortcuts(dashboardUser, ALL_QUICK_ENTRY_ACTIONS),
    [dashboardUser, permVersion]
  );

  const fetchMonthlyWidget = async (filters, setRows, setLoading, key) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.fromDate) params.set('fromDate', filters.fromDate);
      if (filters.toDate) params.set('toDate', filters.toDate);
      if (key === 'monthlyCredit' || key === 'monthlyDebit') {
        params.set('ledgerGrain', 'month');
        params.set('ledgerSeries', 'outstanding');
      }
      const res = await fetch(`/api/dashboard/monthly-analytics?${params}`);
      const text = await res.text();
      if (!text?.trim()) {
        console.error(`Error fetching ${key}: empty response (HTTP ${res.status})`);
        return;
      }
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        console.error(`Error fetching ${key}: invalid JSON (HTTP ${res.status})`, text.slice(0, 120));
        return;
      }
      if (!res.ok || !json?.success) {
        console.error(`Error fetching ${key}:`, json?.error || `HTTP ${res.status}`);
        return;
      }
      setRows(json.data?.[key] || []);
    } catch (err) {
      console.error(`Error fetching ${key}:`, err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch KPI summary cards (own date filter)
  useEffect(() => {
    if (activeTab !== 'dashboard' || !analyticsWidgets.kpi) return;
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (kpiFilters.fromDate) params.set('fromDate', kpiFilters.fromDate);
        if (kpiFilters.toDate) params.set('toDate', kpiFilters.toDate);
        const qs = params.toString();
        const response = await fetch(`/api/dashboard${qs ? `?${qs}` : ''}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) setAnalyticsData(result.data);
        }
      } catch (error) {
        console.error('Error fetching dashboard analytics:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchAnalytics();
  }, [activeTab, analyticsWidgets.kpi, kpiFilters]);

  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    if (!analyticsWidgets.monthlyCredit && !analyticsWidgets.monthlyDebit) return;

    const loadMonthEndClosing = async () => {
      setMonthEndLoading(true);
      try {
        const params = new URLSearchParams();
        if (monthEndFilters.fromDate) params.set('fromDate', monthEndFilters.fromDate);
        if (monthEndFilters.toDate) params.set('toDate', monthEndFilters.toDate);
        params.set('ledgerGrain', 'month');
        params.set('ledgerSeries', 'outstanding');
        const res = await fetch(`/api/dashboard/monthly-analytics?${params}`);
        const json = res.ok ? await res.json() : null;
        if (json?.success) {
          setMonthlyCreditData(json.data?.monthEndToReceive || json.data?.monthlyCredit || []);
          setMonthlyDebitData(json.data?.monthEndToPay || json.data?.monthlyDebit || []);
        }
      } catch (err) {
        console.error('Error fetching month-end closing:', err);
      } finally {
        setMonthEndLoading(false);
      }
    };

    loadMonthEndClosing();
  }, [activeTab, analyticsWidgets.monthlyCredit, analyticsWidgets.monthlyDebit, monthEndFilters]);

  useEffect(() => {
    if (activeTab !== 'dashboard' || !analyticsWidgets.monthlyProfit) return;
    fetchMonthlyWidget(monthlyProfitFilters, setMonthlyProfitData, setMonthlyProfitLoading, 'monthlyProfit');
  }, [activeTab, analyticsWidgets.monthlyProfit, monthlyProfitFilters]);

  useEffect(() => {
    if (activeTab !== 'dashboard' || !analyticsWidgets.monthlySales) return;
    fetchMonthlyWidget(monthlySalesFilters, setMonthlySalesData, setMonthlySalesLoading, 'monthlySales');
  }, [activeTab, analyticsWidgets.monthlySales, monthlySalesFilters]);

  // Fetch low stock alerts
  useEffect(() => {
    if (activeTab !== 'dashboard' || !showLowStockSection) return;

    const fetchLowStock = async () => {
      try {
        setLowStockLoading(true);
        const res = await fetch('/api/dashboard/low-stock', { cache: 'no-store' });
        const json = res.ok ? await res.json() : null;
        if (json?.success) {
          setLowStockData({
            items: json.items || [],
            count: json.count || 0,
            out_of_stock: json.out_of_stock || 0,
            low_stock: json.low_stock || 0,
          });
        }
      } catch (err) {
        console.error('Error fetching low stock alerts:', err);
      } finally {
        setLowStockLoading(false);
      }
    };

    fetchLowStock();
    const interval = setInterval(fetchLowStock, 60000);
    return () => clearInterval(interval);
  }, [activeTab, showLowStockSection]);

  // Fetch sales for weekly charts + recent activity
  useEffect(() => {
    if (activeTab !== 'dashboard') return;
    if (!analyticsWidgets.recentActivity && !analyticsWidgets.anyWeeklyChart) return;

    const fetchRecentData = async () => {
      setWeeklyDataLoading(true);
      try {
        const salesRes = await fetch('/api/sales?list=true&slim=true&limit=3000');
        const salesDataRaw = salesRes.ok ? await salesRes.json() : [];
        const salesList = Array.isArray(salesDataRaw) ? salesDataRaw : (salesDataRaw.data || []);
        setRawSalesList(salesList);

        if (analyticsWidgets.recentActivity) {
          const purchasesRes = await fetch('/api/purchases?limit=20');
          const purchasesData = purchasesRes.ok ? await purchasesRes.json() : [];
          const activities = [];

          salesList.slice(0, Math.ceil(recentActivityLimit * 0.6)).forEach((sale) => {
            activities.push({
              id: `sale-${sale.sale_id}`,
              action: `Sale #${sale.sale_id}`,
              customer: sale.customer?.cus_name || 'Customer',
              amount: fmtAmt(sale.total_amount),
              time: formatDatePK(sale.created_at),
              status: 'success',
              ts: new Date(sale.created_at).getTime(),
            });
          });

          const purchases = Array.isArray(purchasesData) ? purchasesData : (purchasesData.data || []);
          purchases.slice(0, Math.ceil(recentActivityLimit * 0.4)).forEach((purchase) => {
            activities.push({
              id: `purchase-${purchase.pur_id}`,
              action: `Purchase #${purchase.pur_id}`,
              customer: purchase.customer?.cus_name || 'Supplier',
              amount: fmtAmt(purchase.total_amount),
              time: formatDatePK(purchase.created_at),
              status: 'info',
              ts: new Date(purchase.created_at).getTime(),
            });
          });

          activities.sort((a, b) => b.ts - a.ts);
          setRecentActivityData(activities.slice(0, recentActivityLimit));
        }
      } catch (error) {
        console.error('Error fetching recent data:', error);
      } finally {
        setWeeklyDataLoading(false);
      }
    };

    fetchRecentData();
    const interval = setInterval(fetchRecentData, 60000);
    return () => clearInterval(interval);
  }, [
    activeTab,
    analyticsWidgets.recentActivity,
    analyticsWidgets.anyWeeklyChart,
    analyticsWidgets.salesOverview,
    analyticsWidgets.transactionsOverview,
    recentActivityLimit,
    salesOverviewDays,
    transactionsOverviewDays,
  ]);

  const salesOverviewChart = useMemo(
    () => buildWeeklyChartData(rawSalesList, salesOverviewDays),
    [rawSalesList, salesOverviewDays]
  );

  const transactionsOverviewChart = useMemo(
    () => buildWeeklyChartData(rawSalesList, transactionsOverviewDays),
    [rawSalesList, transactionsOverviewDays]
  );

  useEffect(() => {
    if (activeTab !== 'dashboard' || !analyticsWidgets.anyBalanceChart) return;
    fetch('/api/customer-category')
      .then(r => r.ok ? r.json() : [])
      .then(cats => setAllCategories(Array.isArray(cats) ? cats : []))
      .catch(() => {});
  }, [activeTab, analyticsWidgets.anyBalanceChart]);

  useEffect(() => {
    if (activeTab !== 'dashboard' || !analyticsWidgets.customerBalance) return;
    const fetchCustomerBalance = async () => {
      setCustomerBalanceLoading(true);
      try {
        const params = new URLSearchParams();
        if (customerBalanceFilters.fromDate) params.set('fromDate', customerBalanceFilters.fromDate);
        if (customerBalanceFilters.toDate) params.set('toDate', customerBalanceFilters.toDate);
        if (customerBalanceFilters.cusCatId) params.set('cusCatId', customerBalanceFilters.cusCatId);
        const res = await fetch(`/api/dashboard/balance-chart?${params}`);
        const json = res.ok ? await res.json() : null;
        if (json?.success) setCustomerBalanceData(json.customers || []);
      } catch (err) {
        console.error('Error fetching customer balance:', err);
      } finally {
        setCustomerBalanceLoading(false);
      }
    };
    fetchCustomerBalance();
  }, [activeTab, analyticsWidgets.customerBalance, customerBalanceFilters]);

  useEffect(() => {
    if (activeTab !== 'dashboard' || !analyticsWidgets.supplierBalance) return;
    const fetchSupplierBalance = async () => {
      setSupplierBalanceLoading(true);
      try {
        const params = new URLSearchParams();
        if (supplierBalanceFilters.fromDate) params.set('fromDate', supplierBalanceFilters.fromDate);
        if (supplierBalanceFilters.toDate) params.set('toDate', supplierBalanceFilters.toDate);
        if (supplierBalanceFilters.supCatId) params.set('supCatId', supplierBalanceFilters.supCatId);
        const res = await fetch(`/api/dashboard/balance-chart?${params}`);
        const json = res.ok ? await res.json() : null;
        if (json?.success) setSupplierBalanceData(json.suppliers || []);
      } catch (err) {
        console.error('Error fetching supplier balance:', err);
      } finally {
        setSupplierBalanceLoading(false);
      }
    };
    fetchSupplierBalance();
  }, [activeTab, analyticsWidgets.supplierBalance, supplierBalanceFilters]);

  useEffect(() => {
    if (activeTab !== 'dashboard' || !analyticsWidgets.topCustomersSale) return;
    const fetchTopCustomers = async () => {
      setTopCustomersSaleLoading(true);
      try {
        const params = new URLSearchParams();
        if (topCustomersSaleFilters.fromDate) params.set('fromDate', topCustomersSaleFilters.fromDate);
        if (topCustomersSaleFilters.toDate) params.set('toDate', topCustomersSaleFilters.toDate);
        const res = await fetch(`/api/dashboard/top-sales?${params}`);
        const json = res.ok ? await res.json() : null;
        if (json?.success) setTopCustomersSaleData(json.customers || []);
      } catch (err) {
        console.error('Error fetching top customers by sale:', err);
      } finally {
        setTopCustomersSaleLoading(false);
      }
    };
    fetchTopCustomers();
  }, [activeTab, analyticsWidgets.topCustomersSale, topCustomersSaleFilters]);

  useEffect(() => {
    if (activeTab !== 'dashboard' || !analyticsWidgets.topProductsSale) return;
    const fetchTopProducts = async () => {
      setTopProductsSaleLoading(true);
      try {
        const params = new URLSearchParams();
        if (topProductsSaleFilters.fromDate) params.set('fromDate', topProductsSaleFilters.fromDate);
        if (topProductsSaleFilters.toDate) params.set('toDate', topProductsSaleFilters.toDate);
        const res = await fetch(`/api/dashboard/top-sales?${params}`);
        const json = res.ok ? await res.json() : null;
        if (json?.success) setTopProductsSaleData(json.products || []);
      } catch (err) {
        console.error('Error fetching top products by sale:', err);
      } finally {
        setTopProductsSaleLoading(false);
      }
    };
    fetchTopProducts();
  }, [activeTab, analyticsWidgets.topProductsSale, topProductsSaleFilters]);

  useEffect(() => {
    if (activeTab !== 'dashboard' || !analyticsWidgets.monthlyProfit) return;
    fetch('/api/dashboard/profit')
      .then(r => r.ok ? r.json() : { success: false })
      .then(json => { if (json.success) setProfitData(json.data); })
      .catch(err => console.error('Profit fetch error:', err));
  }, [activeTab, analyticsWidgets.monthlyProfit]);

  useEffect(() => {
    if (activeTab === 'usermanagement') {
      router.push('/dashboard/usermanagement');
    } else if (activeTab === 'customercategory') {
      router.push('/dashboard/customercategory');
    }
  }, [activeTab, router]);

  if (activeTab === 'usermanagement' || activeTab === 'customercategory') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const formatNumber = (num) => {
    if (!num && num !== 0) return '0';
    return fmtAmt(num);
  };

  const kpiData = analyticsData ? [
    {
      title: 'Total Sales',
      value: formatNumber(analyticsData.totalSales.value),
      change: `${analyticsData.totalSales.changeType === 'positive' ? '+' : ''}${analyticsData.totalSales.change}%`,
      changeType: analyticsData.totalSales.changeType,
      icon: DollarSign,
      theme: 'green',
    },
    {
      title: 'Total Orders',
      value: analyticsData.totalOrders.value,
      change: `${analyticsData.totalOrders.changeType === 'positive' ? '+' : ''}${analyticsData.totalOrders.change}%`,
      changeType: analyticsData.totalOrders.changeType,
      icon: ShoppingCart,
      theme: 'blue',
    },
    {
      title: 'Active Customers',
      value: analyticsData.activeCustomers.value,
      change: `${analyticsData.activeCustomers.changeType === 'positive' ? '+' : ''}${analyticsData.activeCustomers.change}%`,
      changeType: analyticsData.activeCustomers.changeType,
      icon: Users,
      theme: 'periwinkle',
    },
    {
      title: 'Total Products',
      value: analyticsData.totalProducts.value,
      change: `${analyticsData.totalProducts.changeType === 'positive' ? '+' : ''}${analyticsData.totalProducts.change}%`,
      changeType: analyticsData.totalProducts.changeType,
      icon: Package,
      theme: 'cyan',
    }
  ] : [
    {
      title: 'Total Sales',
      value: '0.00',
      change: '0.0%',
      changeType: 'positive',
      icon: DollarSign,
      theme: 'green',
    },
    {
      title: 'Total Orders',
      value: '0',
      change: '0.0%',
      changeType: 'positive',
      icon: ShoppingCart,
      theme: 'blue',
    },
    {
      title: 'Active Customers',
      value: '0',
      change: '0.0%',
      changeType: 'positive',
      icon: Users,
      theme: 'periwinkle',
    },
    {
      title: 'Total Products',
      value: '0',
      change: '0.0%',
      changeType: 'positive',
      icon: Package,
      theme: 'cyan',
    }
  ];

  const handleQuickActionClick = (path) => {
    if (!path) return;
    try {
      router.push(path);
    } catch (error) {
      window.location.href = path;
    }
  };

  const monthEndClosingRows = useMemo(() => {
    const payByPeriod = new Map(monthlyDebitData.map((row) => [row.period, row]));
    return monthlyCreditData.map((recv) => {
      const pay = payByPeriod.get(recv.period) || {};
      return {
        period: recv.period,
        label: recv.label || recv.period,
        asOfDate: recv.asOfDate || pay.asOfDate || '',
        toReceive: recv.amount ?? recv.toReceive ?? 0,
        toPay: pay.amount ?? pay.toPay ?? 0,
      };
    });
  }, [monthlyCreditData, monthlyDebitData]);

  if (activeTab === 'dashboard') {
    const monthlySalesList = monthlySalesData;
    const monthlyProfitList = monthlyProfitData;

    const latestClosingRow = monthEndClosingRows[monthEndClosingRows.length - 1];
    const totalCreditVal = latestClosingRow?.toReceive ?? 0;
    const totalDebitVal = latestClosingRow?.toPay ?? 0;
    const totalSalesVal = monthlySalesList.reduce((s, i) => s + i.amount, 0);
    const totalProfitVal = monthlyProfitList.reduce((s, i) => s + i.profit, 0);
    const totalBillsOverview = salesOverviewChart.billAmounts.reduce((s, v) => s + v, 0);
    const totalOrdersOverview = salesOverviewChart.orderAmounts.reduce((s, v) => s + v, 0);
    const totalTxCount = transactionsOverviewChart.totalCounts.reduce((s, v) => s + v, 0);
    const totalOrderTxCount = transactionsOverviewChart.orderCounts.reduce((s, v) => s + v, 0);
    const customerBalanceTotal = customerBalanceData.slice(0, 15).reduce((s, r) => s + r.balance, 0);
    const supplierBalanceTotal = supplierBalanceData.slice(0, 15).reduce((s, r) => s + r.balance, 0);
    const topCustomersSaleTotal = topCustomersSaleData.slice(0, 15).reduce((s, r) => s + Number(r.amount || r.balance || 0), 0);
    const topProductsSaleTotal = topProductsSaleData.slice(0, 15).reduce((s, r) => s + Number(r.amount || r.balance || 0), 0);

    return (
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {!analyticsWidgets.any && !analyticsWidgets.kpi && (
          <div className={`${CARD} p-5 md:p-6`}>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Welcome</h3>
            <p className="text-sm text-slate-500 mt-1">
              Use the shortcuts below for your assigned modules. Analytics widgets are assigned in User Management.
            </p>
          </div>
        )}

        {/* Modules + Quick Entry */}
        <div className={`grid grid-cols-1 gap-5 ${quickEntryActions.length > 0 ? 'xl:grid-cols-[1fr_300px]' : ''}`}>
          {/* Business Modules */}
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Business Modules</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Shortcuts allowed for your role</p>
            </div>
            <div className="p-4 md:p-5 bg-[#f9fafb]">
              {quickActions.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-sm text-slate-500">No modules assigned to your account.</p>
                  <p className="text-xs text-slate-400 mt-1">Contact your administrator for access.</p>
                </div>
              ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 md:gap-3">
                {quickActions.map((action, index) => {
                  const p = SHORTCUT_PALETTE[action.palette] || SHORTCUT_PALETTE.blue;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleQuickActionClick(action.path)}
                      className="group flex flex-col items-center justify-center gap-2 py-4 px-2 min-h-[96px] rounded-xl bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 active:scale-[0.98] transition-all duration-200 cursor-pointer"
                    >
                      <div className={`w-10 h-10 rounded-xl ${p.iconBg} flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}>
                        <action.icon className={`w-[18px] h-[18px] ${p.icon}`} strokeWidth={2} />
                      </div>
                      <p className="text-[11px] md:text-xs font-semibold text-gray-700 text-center leading-snug px-0.5">
                        {action.title}
                      </p>
                    </button>
                  );
                })}
              </div>
              )}
            </div>
          </div>

          {/* Quick Entry Panel */}
          {quickEntryActions.length > 0 && (
          <div className={`${CARD} overflow-hidden`}>
            <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 to-white">
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Quick Entry</h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">High-priority actions</p>
            </div>
            <div className="p-4 space-y-3 bg-gradient-to-b from-white to-slate-50/50">
              {quickEntryActions.map((action, index) => {
                const isPrimary = action.tone === 'blue' || action.tone === 'green';
                const toneStyle = QUICK_ENTRY_TONES[action.tone] || QUICK_ENTRY_TONES.neutral;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleQuickActionClick(action.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all duration-200 ${toneStyle.className}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isPrimary ? 'bg-white/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]' : 'bg-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]'}`}>
                      <action.icon className={`w-4 h-4 ${isPrimary ? 'text-white' : 'text-slate-600'}`} strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold leading-tight ${isPrimary ? 'text-white' : 'text-slate-900'}`}>{action.title}</p>
                      <p className={`text-[11px] mt-0.5 truncate ${isPrimary ? 'text-white/85' : 'text-slate-500'}`}>{action.subtitle}</p>
                    </div>
                    {!isPrimary && (
                      <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          )}
        </div>

        {/* Low stock alert — below shortcuts */}
        {showLowStockSection && lowStockLoading ? (
          <div className={`${CARD} overflow-hidden border-l-2 border-l-amber-400`}>
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="h-4 w-36 bg-slate-100 rounded animate-pulse" />
            </div>
            <div className="p-3 space-y-2 animate-pulse">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 bg-slate-50 border border-slate-100 rounded" />
              ))}
            </div>
          </div>
        ) : showLowStockSection && lowStockData.count > 0 ? (
          <div className={`${CARD} overflow-hidden border-l-2 border-l-amber-400`}>
            <div className="px-4 py-3 border-b border-slate-100">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" strokeWidth={2.25} />
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">Low Stock Items</h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {lowStockData.count} item{lowStockData.count !== 1 ? 's' : ''} need attention
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {lowStockData.low_stock > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-amber-700 px-2 py-1 rounded border border-amber-200/80 bg-amber-50/50">
                      Low <strong className="tabular-nums">{lowStockData.low_stock}</strong>
                    </span>
                  )}
                  {lowStockData.out_of_stock > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-red-700 px-2 py-1 rounded border border-red-200/80 bg-red-50/50">
                      Out <strong className="tabular-nums">{lowStockData.out_of_stock}</strong>
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleQuickActionClick('/dashboard/reports/stock-report')}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#1A55E3] hover:text-[#1347c4] px-2 py-1 rounded border border-[#1A55E3]/25 hover:bg-[#1A55E3]/5 transition-colors"
                  >
                    <Package className="w-3 h-3" strokeWidth={2.25} />
                    Stock Report
                  </button>
                </div>
              </div>
            </div>

            <div className="p-3">
              <div className="border border-slate-200 rounded-md overflow-hidden">
                <div className="max-h-[8rem] overflow-auto">
                  <table className="w-full min-w-[720px] text-xs border-collapse table-fixed">
                    <colgroup>
                      <col style={{ width: '40px' }} />
                      <col style={{ width: '120px' }} />
                      <col style={{ width: '28%' }} />
                      <col style={{ width: '56px' }} />
                      <col style={{ width: '88px' }} />
                      <col style={{ width: '88px' }} />
                      <col style={{ width: '100px' }} />
                      <col />
                    </colgroup>
                    <thead className="sticky top-0 z-10">
                      <tr className="bg-[#eef2f7] text-slate-700">
                        <th className="border-b border-r border-slate-200 px-1.5 py-1 text-center font-semibold">S#</th>
                        <th className="border-b border-r border-slate-200 px-1.5 py-1 text-left font-semibold">Category</th>
                        <th className="border-b border-r border-slate-200 px-1.5 py-1 text-left font-semibold">Item Name</th>
                        <th className="border-b border-r border-slate-200 px-1.5 py-1 text-center font-semibold">Unit</th>
                        <th className="border-b border-r border-slate-200 px-1.5 py-1 text-right font-semibold">Current Qty</th>
                        <th className="border-b border-r border-slate-200 px-1.5 py-1 text-right font-semibold">Threshold</th>
                        <th className="border-b border-r border-slate-200 px-1.5 py-1 text-center font-semibold">Status</th>
                        <th className="border-b border-slate-200 px-1.5 py-1 text-left font-semibold">Store Breakdown</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockData.items.map((item, index) => (
                        <tr
                          key={item.pro_id}
                          className={index % 2 === 0 ? 'bg-white hover:bg-slate-50/80' : 'bg-slate-50/40 hover:bg-slate-50/80'}
                        >
                          <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center text-slate-500 tabular-nums">
                            {index + 1}
                          </td>
                          <td className="border-b border-r border-slate-200 px-1.5 py-1 text-slate-600 truncate" title={item.category}>
                            {item.category || '—'}
                          </td>
                          <td className="border-b border-r border-slate-200 px-1.5 py-1 font-medium text-slate-900 truncate" title={item.pro_title}>
                            {item.pro_title}
                          </td>
                          <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center text-slate-600">
                            {item.pro_unit}
                          </td>
                          <td
                            className={`border-b border-r border-slate-200 px-1.5 py-1 text-right tabular-nums ${
                              item.status === 'OUT'
                                ? 'text-red-600 font-semibold'
                                : 'text-amber-700 font-semibold'
                            }`}
                          >
                            {formatQty(item.total_qty)}
                          </td>
                          <td className="border-b border-r border-slate-200 px-1.5 py-1 text-right text-slate-600 tabular-nums">
                            {formatQty(item.threshold)}
                          </td>
                          <td className="border-b border-r border-slate-200 px-1.5 py-1 text-center">
                            <span
                              className={`inline-block px-1 py-0.5 rounded-sm text-[10px] font-semibold leading-none whitespace-nowrap ${
                                item.status === 'OUT'
                                  ? 'text-red-700 bg-red-50'
                                  : 'text-amber-800 bg-amber-50'
                              }`}
                            >
                              {stockStatusLabel(item.status)}
                            </span>
                          </td>
                          <td className="border-b border-slate-200 px-1.5 py-1 text-slate-600 truncate" title={item.store_breakdown}>
                            {item.store_breakdown || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {lowStockData.count > 3 && (
              <div className="px-4 py-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500">
                  Showing 3 of {lowStockData.count} · scroll for more
                </span>
                <button
                  type="button"
                  onClick={() => handleQuickActionClick('/dashboard/reports/stock-report')}
                  className="text-[11px] font-semibold text-[#1A55E3] hover:underline"
                >
                  Full report →
                </button>
              </div>
            )}
          </div>
        ) : null}

        {/* Monthly Analytics & Financial Performance — per-widget access */}
        {(analyticsWidgets.any || analyticsWidgets.kpi) && (() => {
          const sectionAccent = CHART_COLORS.kpi;
          const sectionNeon = getReportNeonStyles(sectionAccent);
          return (
        <div className={REPORT.section} style={sectionNeon.card}>
          <div className={REPORT.sectionHeader} style={{ borderBottom: `1px solid ${sectionNeon.divider}` }}>
            <div className={REPORT.sectionIcon}>
              <BarChart3 className="w-5 h-5 text-white" strokeWidth={2.25} />
            </div>
            <div>
              <h3 className="text-base md:text-[1.05rem] font-bold text-slate-900 tracking-tight">
                Monthly Analytics & Financial Performance
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">Bar charts with individual filters per report</p>
            </div>
          </div>

          {/* KPI Summary Cards */}
          {analyticsWidgets.kpi && (
          <ReportWidgetShell accent={sectionAccent} title="KPI Summary" className={REPORT.kpiWrap}>
            <WidgetDateFilter filters={kpiFilters} onChange={setKpiFilters} loading={loading} accent={sectionAccent} />
          {loading ? (
            <div className={REPORT.kpiGrid}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`${REPORT.kpiCardBase} animate-pulse`} style={sectionNeon.card}>
                  <div className="h-[72px] bg-slate-100/80 rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <div className={REPORT.kpiGrid}>
              {kpiData.map((kpi, index) => {
                const p = KPI_PALETTE[kpi.theme] || KPI_PALETTE.blue;
                const accent = KPI_NEON[kpi.theme] || CHART_COLORS.sales;
                const kpiNeon = getReportNeonStyles(accent);
                return (
                  <div key={index} className={REPORT.kpiCardBase} style={kpiNeon.card}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1.5" style={{ color: kpiNeon.text }}>
                          {kpi.title}
                        </p>
                        <p className="text-[1.55rem] font-extrabold text-slate-900 tracking-tight leading-none tabular-nums">
                          {kpi.value}
                        </p>
                        <div className="flex items-center mt-2 gap-1">
                          <span className={kpi.changeType === 'positive' ? REPORT.trendUp : REPORT.trendDown}>
                            {kpi.change}
                          </span>
                          <span className={REPORT.trendMuted}>vs prior period</span>
                        </div>
                      </div>
                      <div
                        className={`w-11 h-11 rounded-lg ${p.iconBg} flex items-center justify-center flex-shrink-0 border`}
                        style={{ borderColor: kpiNeon.iconBorder }}
                      >
                        <kpi.icon className={`w-[18px] h-[18px] ${p.icon}`} strokeWidth={2.25} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </ReportWidgetShell>
          )}

          {/* Monthly charts grid */}
          {analyticsWidgets.anyMonthlyChart && renderAnalyticsGrid([
            (analyticsWidgets.monthlyCredit || analyticsWidgets.monthlyDebit) && {
              key: 'month-end-closing',
              node: (
            <ReportWidgetShell accent={CHART_COLORS.credit} title="Month-end closing balances">
              <WidgetDateFilter filters={monthEndFilters} onChange={setMonthEndFilters} loading={monthEndLoading} accent={CHART_COLORS.credit} />
              <ReportWidgetHeader
                title="To receive & to pay by month"
                subtitle="After each month’s transactions — closing balance totals (party accounts, excl. cash/bank)"
                icon={BarChart3}
                tint={CHART_COLORS.credit.tint}
                primary={CHART_COLORS.credit.primary}
                accent={CHART_COLORS.credit}
              />
              <ReportChartArea accent={CHART_COLORS.credit}>
                {monthEndClosingRows.length === 0 && !monthEndLoading ? (
                  <ChartEmptyState />
                ) : (
                  renderGroupedBarChart({
                    chartId: 'monthEndClosing',
                    labels: monthEndClosingRows.map((r) => r.label),
                    series: [
                      {
                        key: 'receive',
                        name: 'To receive',
                        primary: CHART_COLORS.credit.primary,
                        gradient: CHART_COLORS.credit.gradient,
                        values: monthEndClosingRows.map((r) => r.toReceive),
                      },
                      {
                        key: 'pay',
                        name: 'To pay',
                        primary: CHART_COLORS.debit.primary,
                        gradient: CHART_COLORS.debit.gradient,
                        values: monthEndClosingRows.map((r) => r.toPay),
                      },
                    ],
                    formatValue: fmtK,
                  })
                )}
              </ReportChartArea>
              <ReportLegendRow accent={CHART_COLORS.credit}>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: CHART_COLORS.credit.primary }}>
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.credit.primary }} />
                  To receive
                </span>
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold" style={{ color: CHART_COLORS.debit.primary }}>
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ background: CHART_COLORS.debit.primary }} />
                  To pay
                </span>
              </ReportLegendRow>
              <div className="px-4 pb-4 overflow-x-auto">
                <table className="w-full text-sm border border-slate-200 rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-2.5 font-bold">Month</th>
                      <th className="px-4 py-2.5 font-bold">As of</th>
                      <th className="px-4 py-2.5 font-bold text-right">To receive (PKR)</th>
                      <th className="px-4 py-2.5 font-bold text-right">To pay (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {monthEndClosingRows.map((row) => (
                      <tr key={row.period} className="hover:bg-slate-50/80">
                        <td className="px-4 py-2.5 font-semibold text-slate-800">{row.label}</td>
                        <td className="px-4 py-2.5 text-slate-600">{row.asOfDate ? formatDatePK(row.asOfDate) : '—'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: CHART_COLORS.credit.primary }}>
                          {fmtAmt(row.toReceive)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums" style={{ color: CHART_COLORS.debit.primary }}>
                          {fmtAmt(row.toPay)}
                        </td>
                      </tr>
                    ))}
                    {monthEndClosingRows.length === 0 && !monthEndLoading && (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                          No months in selected range
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <ReportWidgetFooter
                accent={CHART_COLORS.credit}
                formula={
                  latestClosingRow
                    ? `Latest month (${latestClosingRow.label}) after all transactions in that month`
                    : `${monthEndClosingRows.length} month(s) in range`
                }
                total={`Receive PKR ${fmtAmt(totalCreditVal)} · Pay PKR ${fmtAmt(totalDebitVal)}`}
              />
            </ReportWidgetShell>
              ),
            },
            analyticsWidgets.monthlyProfit && {
              key: 'monthly-profit',
              node: (
            <ReportWidgetShell accent={CHART_COLORS.profit} title="Monthly Profit">
              <WidgetDateFilter filters={monthlyProfitFilters} onChange={setMonthlyProfitFilters} loading={monthlyProfitLoading} accent={CHART_COLORS.profit} />
              <ReportWidgetHeader
                title="Monthly Profit"
                subtitle="Net profit · week by week"
                icon={TrendingUp}
                tint={CHART_COLORS.profit.tint}
                primary={CHART_COLORS.profit.primary}
                accent={CHART_COLORS.profit}
              />
              <ReportChartArea accent={CHART_COLORS.profit}>
                {renderSmoothBarChart({
                  data: monthlyProfitList,
                  getValue: d => d.profit,
                  colorPrimary: CHART_COLORS.profit.primary,
                  colorGradientStop: CHART_COLORS.profit.gradient,
                  barId: 'gMonthlyProfit'
                })}
              </ReportChartArea>
              <ReportWidgetFooter
                accent={CHART_COLORS.profit}
                formula={`Revenue − cost − expenses · ${monthlyProfitList.length} week(s)`}
                total={`PKR ${fmtAmt(totalProfitVal)}`}
              />
            </ReportWidgetShell>
              ),
            },
            analyticsWidgets.monthlySales && {
              key: 'monthly-sales',
              node: (
            <ReportWidgetShell accent={CHART_COLORS.sales} title="Monthly Sales">
              <WidgetDateFilter filters={monthlySalesFilters} onChange={setMonthlySalesFilters} loading={monthlySalesLoading} accent={CHART_COLORS.sales} />
              <ReportWidgetHeader
                title="Monthly Sales"
                subtitle="Total sales volume · week by week"
                icon={ShoppingCart}
                tint={CHART_COLORS.sales.tint}
                primary={CHART_COLORS.sales.primary}
                accent={CHART_COLORS.sales}
              />
              <ReportChartArea accent={CHART_COLORS.sales}>
                {renderSmoothBarChart({
                  data: monthlySalesList,
                  getValue: d => d.amount,
                  colorPrimary: CHART_COLORS.sales.primary,
                  colorGradientStop: CHART_COLORS.sales.gradient,
                  barId: 'gMonthlySale'
                })}
              </ReportChartArea>
              <ReportWidgetFooter
                accent={CHART_COLORS.sales}
                formula={`Sale totals excluding quotations · ${monthlySalesList.length} week(s)`}
                total={`PKR ${fmtAmt(totalSalesVal)}`}
              />
            </ReportWidgetShell>
              ),
            },
          ])}

        {analyticsWidgets.anyTopSaleChart && renderAnalyticsGrid([
          analyticsWidgets.topCustomersSale && {
            key: 'top-customers-sale',
            node: (() => {
              const rows = topCustomersSaleData;
              const color = CHART_COLORS.bills.primary;
              const n = Math.min(rows.length, 15);
              const neon = getReportNeonStyles(CHART_COLORS.bills);
              return (
                <ReportWidgetShell accent={CHART_COLORS.bills} title="Top Customers by Sale">
                  <WidgetDateFilter
                    filters={topCustomersSaleFilters}
                    onChange={(f) => setTopCustomersSaleFilters((prev) => ({ ...prev, ...f }))}
                    loading={topCustomersSaleLoading}
                    accent={CHART_COLORS.bills}
                  />
                  <div className={`${REPORT.cardInner} flex flex-wrap items-center gap-3 border-b`} style={{ borderColor: neon.divider }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: neon.text }}>Top Customers by Sale</p>
                      <p className="text-xs text-slate-500 mt-1">Confirmed bills · each item qty × sale rate · minus returns</p>
                    </div>
                    <span className={REPORT.badge} style={{ color, background: CHART_COLORS.bills.tint, borderColor: neon.badgeBorder }}>
                      Top {n}
                    </span>
                  </div>
                  <ReportChartArea accent={CHART_COLORS.bills}>
                    {renderRankingBarChart({
                      rows,
                      color,
                      gradient: CHART_COLORS.bills.gradient,
                      gradId: 'topCustSaleG',
                      loading: topCustomersSaleLoading,
                      emptyLabel: 'No confirmed bill sales in this period',
                    })}
                  </ReportChartArea>
                  <ReportWidgetFooter
                    accent={CHART_COLORS.bills}
                    formula={`BILL invoices only · item qty × rate, then minus sale-return qty × rate · top ${n} customers`}
                    total={`PKR ${fmtAmt(topCustomersSaleTotal)}`}
                  />
                </ReportWidgetShell>
              );
            })(),
          },
          analyticsWidgets.topProductsSale && {
            key: 'top-products-sale',
            node: (() => {
              const rows = topProductsSaleData;
              const color = CHART_COLORS.sales.primary;
              const n = Math.min(rows.length, 15);
              const neon = getReportNeonStyles(CHART_COLORS.sales);
              return (
                <ReportWidgetShell accent={CHART_COLORS.sales} title="Top Products by Sale">
                  <WidgetDateFilter
                    filters={topProductsSaleFilters}
                    onChange={(f) => setTopProductsSaleFilters((prev) => ({ ...prev, ...f }))}
                    loading={topProductsSaleLoading}
                    accent={CHART_COLORS.sales}
                  />
                  <div className={`${REPORT.cardInner} flex flex-wrap items-center gap-3 border-b`} style={{ borderColor: neon.divider }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: neon.text }}>Top Products by Sale</p>
                      <p className="text-xs text-slate-500 mt-1">Confirmed bills · each item qty × sale rate · minus returns</p>
                    </div>
                    <span className={REPORT.badge} style={{ color, background: CHART_COLORS.sales.tint, borderColor: neon.badgeBorder }}>
                      Top {n}
                    </span>
                  </div>
                  <ReportChartArea accent={CHART_COLORS.sales}>
                    {renderRankingBarChart({
                      rows,
                      color,
                      gradient: CHART_COLORS.sales.gradient,
                      gradId: 'topProdSaleG',
                      loading: topProductsSaleLoading,
                      emptyLabel: 'No confirmed bill product sales in this period',
                    })}
                  </ReportChartArea>
                  <ReportWidgetFooter
                    accent={CHART_COLORS.sales}
                    formula={`BILL invoices only · item qty × rate, then minus sale-return qty × rate · top ${n} products`}
                    total={`PKR ${fmtAmt(topProductsSaleTotal)}`}
                  />
                </ReportWidgetShell>
              );
            })(),
          },
        ])}

        {/* Weekly Overview Charts */}
        {analyticsWidgets.anyWeeklyChart && renderAnalyticsGrid([
          analyticsWidgets.salesOverview && {
            key: 'sales-overview',
            node: (
          <ReportWidgetShell accent={CHART_COLORS.sales} title="Sales Overview">
            <WidgetDayFilter days={salesOverviewDays} onChange={setSalesOverviewDays} loading={weeklyDataLoading} accent={CHART_COLORS.sales} />
            <ReportWidgetHeader
              title="Sales Overview"
              subtitle={`Bills vs Orders · week by week · last ${salesOverviewDays} days`}
              icon={TrendingUp}
              tint={CHART_COLORS.sales.tint}
              primary={CHART_COLORS.sales.primary}
              accent={CHART_COLORS.sales}
            />
            <ReportLegendRow accent={CHART_COLORS.sales}>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border" style={{ background: CHART_COLORS.bills.primary, borderColor: CHART_COLORS.bills.primary }} /><span className="text-[11px] text-slate-500 font-medium">Bills</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border" style={{ background: CHART_COLORS.orders.primary, borderColor: CHART_COLORS.orders.primary }} /><span className="text-[11px] text-slate-500 font-medium">Orders</span></div>
            </ReportLegendRow>
            <ReportChartArea accent={CHART_COLORS.sales}>
              {renderGroupedBarChart({
                chartId: 'salesOverview',
                labels: salesOverviewChart.labels,
                series: [
                  { key: 'bills', name: 'Bills', values: salesOverviewChart.billAmounts, primary: CHART_COLORS.bills.primary, gradient: CHART_COLORS.bills.gradient },
                  { key: 'orders', name: 'Orders', values: salesOverviewChart.orderAmounts, primary: CHART_COLORS.orders.primary, gradient: CHART_COLORS.orders.gradient },
                ],
              })}
            </ReportChartArea>
            <ReportWidgetFooter
              accent={CHART_COLORS.sales}
              formula={`Bills PKR ${fmtAmt(totalBillsOverview)} + Orders PKR ${fmtAmt(totalOrdersOverview)} · weekly totals · last ${salesOverviewDays} days`}
              total={`PKR ${fmtAmt(totalBillsOverview + totalOrdersOverview)}`}
            />
          </ReportWidgetShell>
            ),
          },
          analyticsWidgets.transactionsOverview && {
            key: 'transactions-overview',
            node: (
          <ReportWidgetShell accent={CHART_COLORS.profit} title="Transactions Overview">
            <WidgetDayFilter days={transactionsOverviewDays} onChange={setTransactionsOverviewDays} loading={weeklyDataLoading} accent={CHART_COLORS.profit} />
            <ReportWidgetHeader
              title="Transactions Overview"
              subtitle={`All transactions vs Orders · week by week · last ${transactionsOverviewDays} days`}
              icon={ShoppingCart}
              tint={CHART_COLORS.profit.tint}
              primary={CHART_COLORS.profit.primary}
              accent={CHART_COLORS.profit}
            />
            <ReportLegendRow accent={CHART_COLORS.profit}>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border" style={{ background: CHART_COLORS.sales.primary, borderColor: CHART_COLORS.sales.primary }} /><span className="text-[11px] text-slate-500 font-medium">Total</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm border" style={{ background: CHART_COLORS.profit.primary, borderColor: CHART_COLORS.profit.primary }} /><span className="text-[11px] text-slate-500 font-medium">Orders</span></div>
            </ReportLegendRow>
            <ReportChartArea accent={CHART_COLORS.profit}>
              {renderGroupedBarChart({
                chartId: 'transactionsOverview',
                labels: transactionsOverviewChart.labels,
                formatValue: (v) => (v > 0 ? String(Math.round(v)) : '0'),
                series: [
                  { key: 'total', name: 'Total', values: transactionsOverviewChart.totalCounts, primary: CHART_COLORS.sales.primary, gradient: CHART_COLORS.sales.gradient },
                  { key: 'orders', name: 'Orders', values: transactionsOverviewChart.orderCounts, primary: CHART_COLORS.profit.primary, gradient: CHART_COLORS.profit.gradient },
                ],
              })}
            </ReportChartArea>
            <ReportWidgetFooter
              accent={CHART_COLORS.profit}
              formula={`All sales count + order count · last ${transactionsOverviewDays} days`}
              total={`${totalTxCount} transactions · ${totalOrderTxCount} orders`}
              totalLabel="Sum"
            />
          </ReportWidgetShell>
            ),
          },
        ])}

        {/* Customer & Supplier Balance Charts */}
        {analyticsWidgets.anyBalanceChart && renderAnalyticsGrid([
          analyticsWidgets.customerBalance && {
            key: 'customer-balance',
            node: (() => {
            const rows = customerBalanceData;
            const color = CHART_COLORS.customer.primary;
            const n = Math.min(rows.length, 15);
            const custCats = allCategories.filter(c =>
              !c.cus_cat_title.toLowerCase().includes('supplier') &&
              !c.cus_cat_title.toLowerCase().includes('cash') &&
              !c.cus_cat_title.toLowerCase().includes('bank')
            );
            const custNeon = getReportNeonStyles(CHART_COLORS.customer);
            return (
              <ReportWidgetShell accent={CHART_COLORS.customer} title="Top Customers by Balance">
                <WidgetDateFilter
                  filters={customerBalanceFilters}
                  onChange={(f) => setCustomerBalanceFilters((prev) => ({ ...prev, ...f }))}
                  loading={customerBalanceLoading}
                  accent={CHART_COLORS.customer}
                />
                <div className={`${REPORT.cardInner} flex flex-wrap items-center gap-3 border-b`} style={{ borderColor: custNeon.divider }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: custNeon.text }}>Top Customers by Balance</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {customerBalanceFilters.fromDate || customerBalanceFilters.toDate ? 'Net activity in selected period' : 'Outstanding balance'}
                    </p>
                  </div>
                  <select
                    value={customerBalanceFilters.cusCatId}
                    onChange={e => setCustomerBalanceFilters(f => ({ ...f, cusCatId: e.target.value }))}
                    className={`${REPORT.input} min-w-[180px] py-2`}
                    style={{ borderColor: custNeon.chartBorder }}
                  >
                    <option value="">All Customer Categories</option>
                    {custCats.map(c => (
                      <option key={c.cus_cat_id} value={c.cus_cat_id}>{c.cus_cat_title}</option>
                    ))}
                  </select>
                  <span className={REPORT.badge} style={{ color, background: CHART_COLORS.customer.tint, borderColor: custNeon.badgeBorder }}>
                    Top {n}
                  </span>
                </div>
                <ReportChartArea accent={CHART_COLORS.customer}>
                  {renderRankingBarChart({
                    rows,
                    color,
                    gradient: CHART_COLORS.customer.gradient,
                    gradId: 'balCustG',
                    loading: customerBalanceLoading,
                  })}
                </ReportChartArea>
                <ReportWidgetFooter
                  accent={CHART_COLORS.customer}
                  formula={
                    customerBalanceFilters.fromDate || customerBalanceFilters.toDate
                      ? `Combined net activity for top ${n} customers in selected period`
                      : `Combined outstanding balance for top ${n} customers`
                  }
                  total={`PKR ${fmtAmt(customerBalanceTotal)}`}
                />
              </ReportWidgetShell>
            );
          })(),
          },
          analyticsWidgets.supplierBalance && {
            key: 'supplier-balance',
            node: (() => {
            const rows = supplierBalanceData;
            const color = CHART_COLORS.supplier.primary;
            const n = Math.min(rows.length, 15);
            const supCats = allCategories.filter(c => c.cus_cat_title.toLowerCase().includes('supplier'));
            const suppNeon = getReportNeonStyles(CHART_COLORS.supplier);
            return (
              <ReportWidgetShell accent={CHART_COLORS.supplier} title="Top Suppliers by Balance">
                <WidgetDateFilter
                  filters={supplierBalanceFilters}
                  onChange={(f) => setSupplierBalanceFilters((prev) => ({ ...prev, ...f }))}
                  loading={supplierBalanceLoading}
                  accent={CHART_COLORS.supplier}
                />
                <div className={`${REPORT.cardInner} flex flex-wrap items-center gap-3 border-b`} style={{ borderColor: suppNeon.divider }}>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: suppNeon.text }}>Top Suppliers by Balance</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {supplierBalanceFilters.fromDate || supplierBalanceFilters.toDate ? 'Net activity in selected period' : 'Outstanding balance'}
                    </p>
                  </div>
                  <select
                    value={supplierBalanceFilters.supCatId}
                    onChange={e => setSupplierBalanceFilters(f => ({ ...f, supCatId: e.target.value }))}
                    className={`${REPORT.input} min-w-[180px] py-2`}
                    style={{ borderColor: suppNeon.chartBorder }}
                  >
                    <option value="">All Supplier Categories</option>
                    {supCats.map(c => (
                      <option key={c.cus_cat_id} value={c.cus_cat_id}>{c.cus_cat_title}</option>
                    ))}
                  </select>
                  <span className={REPORT.badge} style={{ color, background: CHART_COLORS.supplier.tint, borderColor: suppNeon.badgeBorder }}>
                    Top {n}
                  </span>
                </div>
                <ReportChartArea accent={CHART_COLORS.supplier}>
                  {renderRankingBarChart({
                    rows,
                    color,
                    gradient: CHART_COLORS.supplier.gradient,
                    gradId: 'balSuppG',
                    loading: supplierBalanceLoading,
                  })}
                </ReportChartArea>
                <ReportWidgetFooter
                  accent={CHART_COLORS.supplier}
                  formula={
                    supplierBalanceFilters.fromDate || supplierBalanceFilters.toDate
                      ? `Combined net activity for top ${n} suppliers in selected period`
                      : `Combined outstanding balance for top ${n} suppliers`
                  }
                  total={`PKR ${fmtAmt(supplierBalanceTotal)}`}
                />
              </ReportWidgetShell>
            );
          })(),
          },
        ])}

        {/* Recent Activity */}
        {analyticsWidgets.recentActivity && (() => {
          const actNeon = getReportNeonStyles(CHART_COLORS.activity);
          return (
        <ReportWidgetShell accent={CHART_COLORS.activity} title="Recent Activity">
          <div className={REPORT.filterBody} style={{ background: actNeon.filterBg, borderColor: actNeon.divider }}>
            <Filter className="w-3.5 h-3.5 shrink-0" style={{ color: actNeon.primary }} />
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Show</span>
            <div className={REPORT.presetWrap} style={{ borderColor: actNeon.chartBorder }}>
              {[5, 10, 20].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRecentActivityLimit(n)}
                  className={`${REPORT.presetBtn}${recentActivityLimit === n ? ` ${REPORT.presetBtnActive}` : ''}`}
                  style={recentActivityLimit === n ? { color: actNeon.primary } : undefined}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {weeklyDataLoading && (
                <div
                  className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                  style={{ borderColor: `${actNeon.primary}33`, borderTopColor: 'transparent', borderRightColor: actNeon.primary, borderBottomColor: actNeon.primary, borderLeftColor: actNeon.primary }}
                />
              )}
              <ReportFullscreenExpandButton />
            </div>
          </div>
          <ReportWidgetHeader
            title="Recent Activity"
            subtitle={`Latest ${recentActivityLimit} sales & purchases`}
            icon={Clock}
            tint={CHART_COLORS.activity.tint}
            primary={CHART_COLORS.activity.primary}
            accent={CHART_COLORS.activity}
          />
          <div className="p-4 md:p-5">
            <div className="space-y-2">
              {recentActivityData && recentActivityData.length > 0 ? (
                recentActivityData.map((activity) => (
                  <div
                    key={activity.id}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-white transition-colors duration-150 border"
                    style={{ borderColor: actNeon.chartBorder }}
                  >
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background: activity.status === 'success' ? CHART_COLORS.credit.primary
                          : activity.status === 'warning' ? CHART_COLORS.orders.primary
                          : CHART_COLORS.sales.primary,
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{activity.action}</p>
                      <p className="text-xs text-slate-500">{activity.time}</p>
                    </div>
                    {(activity.amount || activity.customer) && (
                      <div className="text-right flex-shrink-0">
                        {activity.amount && <p className="text-sm font-semibold text-slate-900">PKR {activity.amount}</p>}
                        {activity.customer && <p className="text-xs text-slate-500">{activity.customer}</p>}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-10">
                  <p className="text-sm text-slate-500">No recent activities</p>
                </div>
              )}
            </div>
          </div>
        </ReportWidgetShell>
          );
        })()}
        </div>
          );
        })()}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100/50 p-12 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-24 h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="w-12 h-12 text-white" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-4">
            {activeTab.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </h3>
          <p className="text-gray-600 mb-8">
            This page is under development. More features will be added soon.
          </p>
          <div className="flex items-center justify-center space-x-2 text-blue-600">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
