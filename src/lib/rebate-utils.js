import { BRAND } from './brand-theme';

export const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatCurrency = (amount) => {
  const num = parseFloat(amount) || 0;
  return num.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  });
};

export const getCurrentMonthKey = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Karachi',
    year: 'numeric',
    month: '2-digit',
  })
    .format(new Date())
    .slice(0, 7);

export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const parseMonthKey = (monthKey) => {
  const [yearStr, monthStr] = (monthKey || '').split('-');
  return {
    year: Number(yearStr) || null,
    month: Number(monthStr) || null,
  };
};

export const buildMonthKey = (year, monthIndex) =>
  `${year}-${String(monthIndex).padStart(2, '0')}`;

export const formatMonthLabel = (monthKey) => {
  const { year, month } = parseMonthKey(monthKey);
  if (!year || !month) return monthKey || '';
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

export const getYearFromMonthKey = (monthKey) =>
  parseMonthKey(monthKey).year || Number(getCurrentMonthKey().slice(0, 4));

/** Build a month lookup from rebate monthly breakdown rows. */
export const buildRebateMonthMap = (breakdown = []) => {
  const map = {};
  breakdown.forEach((row) => {
    map[row.month] = row;
  });
  return map;
};

/** Years that appear in monthly breakdown (sorted ascending). */
export const getRebateYears = (breakdown = []) => {
  const years = new Set(
    breakdown.map((row) => parseMonthKey(row.month).year).filter(Boolean)
  );
  const currentYear = Number(getCurrentMonthKey().slice(0, 4));
  years.add(currentYear);
  return [...years].sort((a, b) => a - b);
};

/** Continuous year range from earliest activity through latest (includes current year). */
export const getRebateYearRange = (breakdown = []) => {
  const years = getRebateYears(breakdown);
  if (years.length === 0) return [Number(getCurrentMonthKey().slice(0, 4))];
  const min = years[0];
  const max = years[years.length - 1];
  const range = [];
  for (let year = min; year <= max; year += 1) range.push(year);
  return range;
};

/** Months with purchases that still need rebate payment. */
export const getUnpaidRebateMonths = (breakdown = []) =>
  breakdown.filter((row) => row.status === 'unpaid');

/** Pick the best unpaid month: preferred if unpaid, else current if unpaid, else latest unpaid. */
export const pickDefaultUnpaidMonth = (breakdown = [], preferredMonth) => {
  const unpaid = getUnpaidRebateMonths(breakdown);
  if (unpaid.length === 0) return '';
  if (preferredMonth && unpaid.some((row) => row.month === preferredMonth)) {
    return preferredMonth;
  }
  const current = getCurrentMonthKey();
  if (unpaid.some((row) => row.month === current)) return current;
  return unpaid[0].month;
};

export const customerOptionKey = (option) => String(option?.cus_id ?? '');
export const isSameCustomerOption = (a, b) => Number(a?.cus_id) === Number(b?.cus_id);

/** Stable list key for rebate ledger rows (ledger_id may repeat or be missing). */
export const rebateEntryKey = (entry, index = 0) =>
  `rebate-${entry?.ledger_id ?? 'na'}-${entry?.bill_no ?? 'bill'}-${entry?.created_at ?? 'date'}-${index}`;

export const rebateMonthOptionLabel = (row) => {
  if (row.status === 'paid') return `${row.monthLabel} — Paid`;
  if (row.status === 'unpaid') return `${row.monthLabel} — Unpaid`;
  return `${row.monthLabel} — No activity`;
};

export const isRebateMonthSelectable = (row) => row?.status === 'unpaid';

export function RebateStatusBadge({ status, size = 'sm' }) {
  const pad = size === 'lg' ? 'px-3 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';

  if (status === 'paid') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-bold border ${pad}`}
        style={{ backgroundColor: BRAND.tint.green, color: BRAND.text.green, borderColor: `${BRAND.supporting.green}40` }}
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND.supporting.green }} />
        Paid
      </span>
    );
  }
  if (status === 'unpaid') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full font-bold border ${pad}`}
        style={{ backgroundColor: BRAND.tint.pink, color: BRAND.text.pink, borderColor: `${BRAND.primary.pink}35` }}
      >
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: BRAND.primary.pink }} />
        Unpaid
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-slate-100 text-slate-600 border border-slate-200 ${pad}`}>
      <span className="w-2 h-2 rounded-full bg-slate-400" />
      No Activity
    </span>
  );
}
