import { BRAND } from '@/lib/brand-theme';

/** Shared HR surface styles — use across register, ledger, advances, receive. */
export const HR_CARD_SX = {
  borderRadius: '14px',
  border: '1px solid #dce3ed',
  boxShadow: '0 1px 4px rgba(15, 23, 42, 0.06)',
  bgcolor: '#ffffff',
};

export const HR_FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    fontSize: '0.875rem',
    bgcolor: '#fff',
    '& fieldset': { borderColor: '#cbd5e1' },
    '&:hover fieldset': { borderColor: '#94a3b8' },
    '&.Mui-focused fieldset': {
      borderColor: BRAND.supporting.periwinkle,
      borderWidth: '2px',
    },
  },
  '& .MuiInputLabel-root': { fontSize: '0.8125rem', fontWeight: 600 },
};

export const HR_TABLE_HEAD_SX = {
  fontWeight: 800,
  fontSize: '0.68rem',
  letterSpacing: '0.05em',
  textTransform: 'uppercase',
  color: '#1347c4',
  bgcolor: '#e8effd',
  borderColor: '#cbd5e1',
  py: 1.25,
};

export function hrFmtAmt(v) {
  const n = parseFloat(v || 0);
  return n.toLocaleString('en-PK', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Employee ledger balance semantics (+ employee owes, − company owes). */
export function employeeBalanceMeta(balance) {
  const n = parseFloat(balance ?? 0);
  if (n > 0.009) {
    return { label: 'Employee owes', color: '#b91c1c', bg: '#fef2f2' };
  }
  if (n < -0.009) {
    return { label: 'Company owes', color: '#15803d', bg: '#f0fdf4' };
  }
  return { label: 'Settled', color: '#64748b', bg: '#f1f5f9' };
}
