import { BRAND, REPORT } from './brand-theme';

/** Excel-style spreadsheet tokens */
export const EXCEL = {
  pageBg: '#ebebeb',
  workbookBg: '#ffffff',
  border: '#c6c6c6',
  borderDark: '#ababab',
  headerBg: '#f3f3f3',
  headerBorder: '#ababab',
  rowHeaderBg: '#ececec',
  rowAlt: '#fafafa',
  rowHover: '#e7f3ff',
  categoryBg: '#e2efda',
  categoryText: '#375623',
  categoryBorder: '#c5e0b4',
  qtyHeaderBg: '#fff2cc',
  qtyColBg: '#fffef8',
  qtyFocus: '#217346',
  focusRing: BRAND.primary.blue,
  gridText: '#1a1a1a',
};

export const SO_THEME = {
  pageBg: EXCEL.pageBg,
  headerGradient: `linear-gradient(135deg, ${BRAND.primary.blue} 0%, ${BRAND.supporting.periwinkle} 52%, #0f172a 100%)`,
  card: REPORT.card,
  label: 'excel-field-label',
};

/** Compact Excel-like MUI fields */
export const SO_FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '2px',
    bgcolor: '#ffffff',
    fontSize: '0.8125rem',
    minHeight: '32px',
    '& fieldset': { borderColor: EXCEL.borderDark },
    '&:hover fieldset': { borderColor: '#808080' },
    '&.Mui-focused fieldset': {
      borderColor: EXCEL.qtyFocus,
      borderWidth: '2px',
    },
  },
  '& .MuiInputBase-input': {
    py: '6px',
    px: '8px',
    fontWeight: 500,
    color: EXCEL.gridText,
  },
  '& .MuiSelect-select': { py: '6px !important' },
};

export function soBtn(className = '') {
  return `inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${className}`;
}

export function soBtnPrimary(className = '') {
  return soBtn(`border-transparent text-white shadow-sm hover:opacity-95 active:scale-[0.98] ${className}`);
}

/** Light/outline button — avoids text-white clash from soBtnPrimary */
export function soBtnOutline(className = '') {
  return soBtn(`bg-white text-[#1A55E3] border-[#1A55E3]/40 hover:bg-[#e8effd] hover:border-[#1A55E3] shadow-sm ${className}`);
}
