/**
 * Itefaq Iron & Cement Store — brand palette
 * Primary: #1A55E3 (blue), #FF0854 (pink)
 * Supporting: #00D284 (green/sales), #0DCAF0 (cyan), #5E6EED (periwinkle)
 */

export const COMPANY = {
  name: 'Itefaq Iron & Cement Store',
  nameShort: 'Itefaq Iron',
  nameSub: '& Cement Store',
  nameUr: 'اتفاق آئرن اینڈ سیمنٹ سٹور',
  tagline: 'Iron, Cement & Building Materials',
  address: 'Gujrat Sargodha Road, Pahrian Wali',
  phones: ['0346-7560306', '0300-7560306'],
};

export const POWERED_BY = {
  label: 'Powered By',
  name: 'AL-JANNAT SYSTEMS',
  nameShort: 'AJ',
};

export const BRAND = {
  primary: {
    blue: '#1A55E3',
    pink: '#FF0854',
  },
  supporting: {
    green: '#00D284',
    cyan: '#0DCAF0',
    periwinkle: '#5E6EED',
  },
  tint: {
    blue: '#e8effd',
    pink: '#ffe8f0',
    green: '#e6fff4',
    cyan: '#e6faff',
    periwinkle: '#eef0fe',
  },
  text: {
    blue: '#1347c4',
    pink: '#cc0644',
    green: '#00a868',
    cyan: '#0aa3bd',
    periwinkle: '#4a57d4',
  },
};

const nav = (main, text, bg, bgHover, borderAlpha = 0.35) => ({
  main,
  text,
  bg,
  bgHover,
  bgActive: bgHover,
  border: hexToRgba(main, borderAlpha),
  glow: `0 0 14px ${hexToRgba(main, 0.2)}`,
});

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Sidebar nav accent colors per business function */
export const NAV_FN = {
  overview:  nav(BRAND.supporting.periwinkle, BRAND.text.periwinkle, BRAND.tint.periwinkle, '#e0e4fc'),
  sales:     nav(BRAND.supporting.green, BRAND.text.green, BRAND.tint.green, '#ccf7e8'),
  purchase:  nav(BRAND.primary.blue, BRAND.text.blue, BRAND.tint.blue, '#d4e2fb'),
  inventory: nav(BRAND.supporting.cyan, BRAND.text.cyan, BRAND.tint.cyan, '#ccf2fc'),
  operations:nav(BRAND.primary.pink, BRAND.text.pink, BRAND.tint.pink, '#ffd6e5'),
  finance:   nav(BRAND.primary.pink, BRAND.text.pink, BRAND.tint.pink, '#ffd6e5'),
  accounts:  nav(BRAND.supporting.periwinkle, BRAND.text.periwinkle, BRAND.tint.periwinkle, '#e0e4fc'),
  reports:   nav(BRAND.primary.blue, BRAND.text.blue, BRAND.tint.blue, '#d4e2fb'),
  hr:        nav(BRAND.supporting.cyan, BRAND.text.cyan, BRAND.tint.cyan, '#ccf2fc'),
  ledger:    nav('#64748b', '#475569', '#f8fafc', '#f1f5f9', 0.35),
  system:    nav('#64748b', '#475569', '#f8fafc', '#f1f5f9', 0.35),
};

/** Sidebar shell chrome — Plusadmin-style */
export const SIDEBAR = {
  background: '#f8f9fb',
  bgElevated: '#ffffff',
  bgHover: '#f1f3f8',
  bgActive: '#1A55E3',
  border: '#e8ecf3',
  borderStrong: '#dde3ed',
  text: '#64748b',
  textMuted: '#94a3b8',
  textActive: '#1e293b',
  textOnActive: '#ffffff',
  accent: BRAND.primary.blue,
  accentMuted: BRAND.supporting.periwinkle,
  accentSoft: BRAND.tint.blue,
  accentGlow: `0 2px 12px ${hexToRgba(BRAND.primary.blue, 0.12)}`,
  searchBg: '#ffffff',
  searchBorder: '#e8ecf3',
  badgeBg: BRAND.tint.blue,
  badgeText: BRAND.text.blue,
  drawerShadow: '2px 0 24px rgba(15, 23, 42, 0.04)',
  avatarGradient: `linear-gradient(135deg, ${BRAND.primary.blue} 0%, ${BRAND.supporting.periwinkle} 100%)`,
  collapseBtn: '#FF0854',
  sectionLabel: '#94a3b8',
};

/** Static sidebar section titles — Quick Access, Modules, System */
export const SIDEBAR_SECTION_LABELS = {
  'Quick Access': {
    color: BRAND.text.periwinkle,
    bg: BRAND.tint.periwinkle,
    accent: BRAND.supporting.periwinkle,
  },
  Modules: {
    color: BRAND.text.blue,
    bg: BRAND.tint.blue,
    accent: BRAND.primary.blue,
  },
  System: {
    color: '#475569',
    bg: '#f1f5f9',
    accent: '#64748b',
  },
};

/** Sidebar dimensions — keep in sync with dashboard-layout */
export const SIDEBAR_WIDTH = {
  collapsed: 72,
  expanded: 232,
};

/** Dashboard shortcut icon boxes */
export const SHORTCUT_PALETTE = {
  green:      { iconBg: 'bg-[#e6fff4]', icon: 'text-[#00D284]' },
  blue:       { iconBg: 'bg-[#e8effd]', icon: 'text-[#1A55E3]' },
  periwinkle: { iconBg: 'bg-[#eef0fe]', icon: 'text-[#5E6EED]' },
  pink:       { iconBg: 'bg-[#ffe8f0]', icon: 'text-[#FF0854]' },
  cyan:       { iconBg: 'bg-[#e6faff]', icon: 'text-[#0DCAF0]' },
  yellow:     { iconBg: 'bg-[#fffbeb]', icon: 'text-[#eab308]' },
  orange:     { iconBg: 'bg-[#fff4e6]', icon: 'text-[#f97316]' },
  slate:      { iconBg: 'bg-slate-100', icon: 'text-slate-600' },
};

/** KPI card icon colors */
export const KPI_PALETTE = {
  green:      { iconBg: 'bg-[#e6fff4]', icon: 'text-[#00D284]' },
  blue:       { iconBg: 'bg-[#e8effd]', icon: 'text-[#1A55E3]' },
  periwinkle: { iconBg: 'bg-[#eef0fe]', icon: 'text-[#5E6EED]' },
  pink:       { iconBg: 'bg-[#ffe8f0]', icon: 'text-[#FF0854]' },
  cyan:       { iconBg: 'bg-[#e6faff]', icon: 'text-[#0DCAF0]' },
};

/** Quick Entry primary button styles */
export const QUICK_ENTRY_TONES = {
  blue: {
    className: 'text-white border-0 shadow-[0_4px_0_#1347c4,0_8px_24px_rgba(26,85,227,0.35)] hover:shadow-[0_2px_0_#1347c4,0_12px_32px_rgba(26,85,227,0.4)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_4px_0_#1347c4,0_4px_12px_rgba(26,85,227,0.3)] bg-gradient-to-b from-[#1A55E3] to-[#1347c4]',
  },
  green: {
    className: 'text-white border-0 shadow-[0_4px_0_#00a868,0_8px_24px_rgba(0,210,132,0.35)] hover:shadow-[0_2px_0_#00a868,0_12px_32px_rgba(0,210,132,0.4)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_4px_0_#00a868,0_4px_12px_rgba(0,210,132,0.3)] bg-gradient-to-b from-[#00D284] to-[#00b872]',
  },
  neutral: {
    className: 'bg-white border border-slate-200/80 text-slate-800 shadow-[0_2px_8px_rgba(15,23,42,0.06)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.1)] hover:-translate-y-0.5 hover:border-slate-300',
  },
};

/** Chart & analytics accent colors */
export const CHART_COLORS = {
  credit:  { primary: BRAND.supporting.green, gradient: '#7ef0c4', tint: BRAND.tint.green, text: BRAND.text.green, neon: '#00ffaa' },
  debit:   { primary: BRAND.primary.pink, gradient: '#ff8cb3', tint: BRAND.tint.pink, text: BRAND.text.pink, neon: '#ff4d8d' },
  profit:  { primary: BRAND.supporting.periwinkle, gradient: '#a5aff5', tint: BRAND.tint.periwinkle, text: BRAND.text.periwinkle, neon: '#7b8cff' },
  sales:   { primary: BRAND.primary.blue, gradient: '#7ba3f0', tint: BRAND.tint.blue, text: BRAND.text.blue, neon: '#4d8bff' },
  customer:{ primary: BRAND.supporting.periwinkle, gradient: '#a5aff5', tint: BRAND.tint.periwinkle, text: BRAND.text.periwinkle, neon: '#9aa8ff' },
  supplier:{ primary: BRAND.primary.blue, gradient: '#7ba3f0', tint: BRAND.tint.blue, text: BRAND.text.blue, neon: '#5b9aff' },
  bills:   { primary: BRAND.supporting.green, gradient: '#7ef0c4', tint: BRAND.tint.green, text: BRAND.text.green, neon: '#00e896' },
  orders:  { primary: BRAND.supporting.cyan, gradient: '#8ee9fa', tint: BRAND.tint.cyan, text: BRAND.text.cyan, neon: '#3de8ff' },
  activity:{ primary: BRAND.primary.blue, gradient: '#7ba3f0', tint: BRAND.tint.blue, text: BRAND.text.blue, neon: '#4d8bff' },
  kpi:     { primary: BRAND.supporting.periwinkle, gradient: '#a5aff5', tint: BRAND.tint.periwinkle, text: BRAND.text.periwinkle, neon: '#8b98ff' },
};

/** KPI card theme → neon accent */
export const KPI_NEON = {
  green: CHART_COLORS.credit,
  blue: CHART_COLORS.sales,
  periwinkle: CHART_COLORS.profit,
  cyan: CHART_COLORS.orders,
  pink: CHART_COLORS.debit,
};

/** Solid accent borders per report (no glow / transparency) */
export function getReportNeonStyles(accent) {
  const primary = accent?.primary || BRAND.primary.blue;
  const tint = accent?.tint || BRAND.tint.blue;
  const text = accent?.text || primary;
  return {
    primary,
    text,
    card: {
      border: `1px solid ${primary}`,
      boxShadow: 'none',
    },
    divider: primary,
    filterBg: tint,
    chartBg: '#ffffff',
    chartBorder: primary,
    iconBorder: primary,
    badgeBorder: primary,
    totalColor: text,
  };
}

/** Head Office portal — executive navy/indigo + gold accent (Branch uses blue/pink) */
export const HQ_BRAND = {
  primary: '#4338ca',
  primaryMid: '#4f46e5',
  primaryDark: '#3730a3',
  navy: '#1e1b4b',
  navyMid: '#312e81',
  accent: '#6366f1',
  accentLight: '#818cf8',
  secondary: '#7c3aed',
  highlight: '#f59e0b',
  highlightDark: '#d97706',
  teal: '#0d9488',
  tealDark: '#0f766e',
  badge: '#f59e0b',
  tint: '#eef2ff',
  tintSoft: '#e0e7ff',
  tintGold: '#fffbeb',
  text: '#4338ca',
  textDark: '#312e81',
};

export const HQ_GRADIENTS = {
  header: 'linear-gradient(90deg, #1e1b4b 0%, #312e81 42%, #4338ca 100%)',
  headerAccent: 'linear-gradient(90deg, #312e81 0%, #4338ca 35%, #6366f1 68%, #f59e0b 100%)',
  activeNav: 'linear-gradient(135deg, #4338ca 0%, #6366f1 100%)',
  btnPrimary: 'linear-gradient(180deg, #4338ca 0%, #3730a3 100%)',
  btnAccent: 'linear-gradient(180deg, #7c3aed 0%, #6d28d9 100%)',
  btnTeal: 'linear-gradient(180deg, #0d9488 0%, #0f766e 100%)',
  welcome: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 55%, #fffbeb 100%)',
  cardShine: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.06), transparent)',
};

export const HQ_UI = {
  pageWrap: 'space-y-6 max-w-[1400px] mx-auto',
  card: 'relative bg-white rounded-[1.25rem] border border-slate-200/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_28px_rgba(15,23,42,0.08)]',
  cardHover: 'transition-all duration-300 ease-out hover:shadow-[0_4px_8px_rgba(15,23,42,0.05),0_16px_40px_rgba(49,46,129,0.12)] hover:-translate-y-1',
  sectionHeader: 'px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-[#eef2ff]/90 via-white to-[#fffbeb]/40',
  moduleGrid: 'p-4 md:p-5 bg-[#f9fafb]',
};

export const HQ_MUI = {
  spinner: { color: HQ_BRAND.primary },
  tabs: {
    '& .Mui-selected': { color: HQ_BRAND.primary, fontWeight: 700 },
    '& .MuiTabs-indicator': { bgcolor: HQ_BRAND.primary, height: 3, borderRadius: '3px 3px 0 0' },
  },
  btnPrimary: {
    bgcolor: HQ_BRAND.primary,
    background: HQ_GRADIENTS.btnPrimary,
    '&:hover': { bgcolor: HQ_BRAND.primaryDark, filter: 'brightness(1.05)' },
  },
  chipPrimary: { bgcolor: HQ_BRAND.tint, color: HQ_BRAND.textDark, fontWeight: 700 },
};

export const HQ_SIDEBAR = {
  background: '#f8f9fb',
  bgElevated: '#ffffff',
  bgHover: '#f1f3f8',
  bgActive: HQ_BRAND.primary,
  bgActiveGradient: HQ_GRADIENTS.activeNav,
  border: '#e8ecf3',
  borderStrong: '#dde3ed',
  text: '#64748b',
  textMuted: '#94a3b8',
  textActive: '#1e293b',
  textOnActive: '#ffffff',
  accent: HQ_BRAND.primary,
  accentMuted: HQ_BRAND.accent,
  accentSoft: HQ_BRAND.tint,
  accentGlow: `0 2px 12px ${hexToRgba(HQ_BRAND.primary, 0.14)}`,
  searchBg: '#ffffff',
  searchBorder: '#e8ecf3',
  badgeBg: HQ_BRAND.tintGold,
  badgeText: HQ_BRAND.highlightDark,
  drawerShadow: '2px 0 28px rgba(30, 27, 75, 0.08)',
  avatarGradient: `linear-gradient(135deg, ${HQ_BRAND.navyMid} 0%, ${HQ_BRAND.primary} 50%, ${HQ_BRAND.accent} 100%)`,
  collapseBtn: HQ_BRAND.highlight,
  collapseBtnHover: HQ_BRAND.highlightDark,
  sectionLabel: HQ_BRAND.text,
};

export const HQ_SIDEBAR_SECTION = {
  label: HQ_BRAND.text,
  bg: HQ_BRAND.tint,
  accent: HQ_BRAND.accent,
};

export const HQ_NAV_FN = {
  overview:  nav(HQ_BRAND.accent, HQ_BRAND.text, HQ_BRAND.tint, HQ_BRAND.tintSoft),
  branches:  nav(HQ_BRAND.primary, HQ_BRAND.textDark, HQ_BRAND.tint, '#ddd6fe'),
  users:     nav('#0891b2', '#0e7490', '#ecfeff', '#cffafe'),
  reports:   nav(HQ_BRAND.primary, HQ_BRAND.textDark, HQ_BRAND.tint, '#ddd6fe'),
  monitoring:nav('#059669', '#047857', '#ecfdf5', '#d1fae5'),
  settings:  nav('#64748b', '#475569', '#f8fafc', '#f1f5f9'),
};

export const HQ_KPI_PALETTE = {
  indigo:   { iconBg: 'bg-[#eef2ff]', icon: 'text-[#4338ca]', ring: 'ring-[#4338ca]/10' },
  violet:   { iconBg: 'bg-[#f5f3ff]', icon: 'text-[#7c3aed]', ring: 'ring-[#7c3aed]/10' },
  green:    { iconBg: 'bg-[#ecfdf5]', icon: 'text-[#059669]', ring: 'ring-[#059669]/10' },
  cyan:     { iconBg: 'bg-[#ecfeff]', icon: 'text-[#0891b2]', ring: 'ring-[#0891b2]/10' },
  gold:     { iconBg: 'bg-[#fffbeb]', icon: 'text-[#d97706]', ring: 'ring-[#f59e0b]/10' },
};

export const HQ_SHORTCUT_PALETTE = {
  indigo:   { iconBg: 'bg-[#eef2ff]', icon: 'text-[#4338ca]' },
  violet:   { iconBg: 'bg-[#f5f3ff]', icon: 'text-[#7c3aed]' },
  cyan:     { iconBg: 'bg-[#ecfeff]', icon: 'text-[#0891b2]' },
  green:    { iconBg: 'bg-[#ecfdf5]', icon: 'text-[#059669]' },
  gold:     { iconBg: 'bg-[#fffbeb]', icon: 'text-[#d97706]' },
  slate:    { iconBg: 'bg-slate-100', icon: 'text-slate-600' },
};

export const HQ_QUICK_ENTRY_TONES = {
  indigo: {
    className: 'text-white border-0 shadow-[0_4px_0_#3730a3,0_8px_24px_rgba(67,56,202,0.35)] hover:shadow-[0_2px_0_#3730a3,0_12px_32px_rgba(67,56,202,0.4)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_4px_0_#3730a3,0_4px_12px_rgba(67,56,202,0.3)] bg-gradient-to-b from-[#4338ca] to-[#3730a3]',
  },
  violet: {
    className: 'text-white border-0 shadow-[0_4px_0_#6d28d9,0_8px_24px_rgba(124,58,237,0.35)] hover:shadow-[0_2px_0_#6d28d9,0_12px_32px_rgba(124,58,237,0.4)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_4px_0_#6d28d9,0_4px_12px_rgba(124,58,237,0.3)] bg-gradient-to-b from-[#7c3aed] to-[#6d28d9]',
  },
  neutral: {
    className: 'bg-white border border-slate-200/80 text-slate-800 shadow-[0_2px_8px_rgba(15,23,42,0.06)] hover:shadow-[0_8px_24px_rgba(15,23,42,0.1)] hover:-translate-y-0.5 hover:border-slate-300',
  },
};

export const HQ_REPORT = {
  section: 'rounded-[1.35rem] bg-[#f4f6f9] border border-[#e8ecf3] p-4 md:p-5 space-y-5',
  card: 'bg-white rounded-2xl border border-[#eef1f6] shadow-[0_2px_20px_rgba(67,56,202,0.05)] overflow-hidden',
  filterHeader: 'px-5 md:px-6 py-4 bg-gradient-to-r from-[#4338ca] to-[#6366f1] flex flex-wrap items-center justify-between gap-3',
};

/** Dashboard analytics / report widgets — thin neon borders, smooth Plusadmin-style */
export const REPORT = {
  section:
    'rounded-2xl bg-white p-5 md:p-6 space-y-6',
  sectionHeader:
    'flex items-center gap-3 pb-5 mb-1',
  sectionIcon:
    'w-10 h-10 rounded-xl bg-gradient-to-br from-[#1A55E3] to-[#5E6EED] flex items-center justify-center shrink-0 border border-[#1A55E3]',
  cardBase:
    'bg-white rounded-xl overflow-hidden transition-all duration-300',
  cardInner: 'px-5 py-4 md:px-5 md:py-4',
  kpiWrap: 'overflow-hidden',
  kpiGrid: 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 p-4 md:p-5',
  kpiCardBase:
    'bg-white rounded-xl p-4 md:p-5 transition-all duration-300',
  filterBar:
    'bg-white rounded-xl border border-[#e5e7eb] shadow-[0_1px_2px_rgba(15,23,42,0.03)] overflow-hidden',
  filterHeader:
    'px-5 md:px-6 py-3.5 bg-gradient-to-r from-[#1A55E3] to-[#5E6EED] flex flex-wrap items-center justify-between gap-3',
  filterBody:
    'px-4 py-2.5 flex flex-wrap items-center gap-2 border-b',
  input:
    'text-xs font-medium text-slate-700 bg-white border border-[#e5e7eb] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1A55E3]/12 focus:border-[#1A55E3]/35 transition-all',
  datePill:
    'flex items-center gap-1.5 bg-white border border-[#e5e7eb] rounded-lg px-2.5 py-1.5',
  presetWrap:
    'flex items-center gap-0.5 bg-[#f3f4f6] p-0.5 rounded-lg border border-[#e5e7eb]',
  presetBtn:
    'px-2.5 py-1.5 text-[11px] font-semibold rounded-md text-slate-600 hover:bg-white hover:text-[#1A55E3] transition-all duration-150',
  presetBtnActive: 'bg-white text-[#1A55E3] shadow-[0_1px_2px_rgba(15,23,42,0.06)]',
  chartArea:
    'mx-4 mb-3 rounded-lg border p-3 min-h-[260px]',
  legendRow:
    'px-5 pb-3 flex flex-wrap items-center gap-4 border-b',
  footer:
    'mx-4 mb-4 px-3 py-2 border-t flex flex-wrap items-center justify-between gap-x-3 gap-y-1',
  badge:
    'text-[10px] font-semibold px-2.5 py-1 rounded-md border bg-white/80 text-slate-600',
  trendUp: 'text-[10px] font-semibold text-[#00a868] tabular-nums',
  trendDown: 'text-[10px] font-semibold text-[#FF0854] tabular-nums',
  trendMuted: 'text-[10px] text-slate-400',
};
