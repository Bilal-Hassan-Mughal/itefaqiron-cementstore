import { BRAND } from './brand-theme';

/** Shared layout + color tokens for Rebate Report & Rebate History pages */
export const REBATE_THEME = {
  pageBg: '#f4f6fb',
  headerGradient: `linear-gradient(135deg, ${BRAND.primary.blue} 0%, ${BRAND.supporting.periwinkle} 55%, #0f172a 100%)`,
  historyHeaderGradient: `linear-gradient(135deg, ${BRAND.supporting.periwinkle} 0%, ${BRAND.primary.blue} 50%, #0f172a 100%)`,
  card: 'bg-white border border-[#e2e8f0] rounded-2xl shadow-sm',
  cardAccent: `border-[${BRAND.primary.blue}33]`,
  label: 'block text-[11px] font-bold uppercase tracking-wider text-[#64748b] mb-1.5',
  tableHead: 'bg-[#1A55E3] text-white',
  tableHeadCell: 'px-5 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider',
  tableFoot: 'bg-[#0f172a] text-white font-bold',
  qtyText: `text-[${BRAND.primary.blue}]`,
  amountText: `text-[${BRAND.text.green}]`,
  rebateText: `text-[${BRAND.text.periwinkle}]`,
};

export const REBATE_GRID = {
  filterBar: 'grid grid-cols-1 md:grid-cols-12 gap-4 items-end max-w-[1280px] mx-auto',
  filterMonth: 'md:col-span-3',
  filterSupplier: 'md:col-span-4',
  filterBalance: 'md:col-span-2 rounded-xl border border-[#e2e8f0] bg-gradient-to-br from-[#e6fff4]/50 to-white px-4 py-3 min-h-[56px] flex flex-col justify-center',
  filterAction: 'md:col-span-3 flex md:justify-end items-end',
  filterPanel: 'max-w-[1280px] mx-auto',
  content: 'max-w-[1280px] mx-auto space-y-4',
  kpi: 'grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-12 gap-4',
  kpiSupplier: 'col-span-2 lg:col-span-4 xl:col-span-4',
  kpiStat: 'col-span-1 lg:col-span-2 xl:col-span-2',
  kpiWide: 'col-span-2 lg:col-span-4 xl:col-span-4',
  historyKpi: 'grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4',
};

export const REBATE_FIELD_SX = {
  bgcolor: 'white',
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    bgcolor: '#ffffff',
    '& fieldset': { borderColor: '#e2e8f0' },
    '&:hover fieldset': { borderColor: '#93c5fd' },
    '&.Mui-focused fieldset': {
      borderColor: BRAND.primary.blue,
      borderWidth: '1.5px',
    },
  },
  '& .MuiInputBase-input': { fontWeight: 600, color: '#0f172a' },
};

export const REBATE_INPUT_CLASS =
  'w-full px-3 py-2.5 bg-white border border-[#e2e8f0] rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-[#1A55E3]/25 focus:border-[#1A55E3] disabled:bg-slate-100 disabled:text-slate-400 transition-colors';

export function rebateKpiCard(accent = 'default') {
  const accents = {
    supplier: 'border-[#1A55E3]/20 bg-gradient-to-br from-[#e8effd] to-white',
    qty: 'border-[#1A55E3]/20 bg-gradient-to-br from-[#e8effd]/80 to-white',
    amount: 'border-[#00D284]/25 bg-gradient-to-br from-[#e6fff4]/80 to-white',
    rebate: 'border-[#5E6EED]/25 bg-gradient-to-br from-[#eef0fe]/80 to-white',
    default: 'border-[#e2e8f0] bg-white',
    paid: 'border-[#00D284]/25 bg-gradient-to-br from-[#e6fff4] to-white',
    unpaid: 'border-[#FF0854]/20 bg-gradient-to-br from-[#ffe8f0]/60 to-white',
  };
  return `rounded-2xl border p-4 ${accents[accent] || accents.default}`;
}

export function rebateBtnPrimary(className = '') {
  return `inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white shadow-sm transition-all hover:opacity-95 active:scale-[0.98] ${className}`;
}
