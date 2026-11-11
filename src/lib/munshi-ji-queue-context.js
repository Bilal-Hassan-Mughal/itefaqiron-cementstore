import { formatPromiseDate } from '@/lib/account-payment-promise';

const fmtAmt = (val) => {
  const n = Math.abs(parseFloat(val || 0));
  if (n % 1 === 0) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function mapRowToMunshiAccount(row, { pending = true } = {}) {
  const name = row.customer?.cus_name || row.cus_name || '—';
  const bal = parseFloat(row.customer?.cus_balance ?? row.cus_balance ?? 0);
  const wada = formatPromiseDate(row.promised_pay_date);
  const sentAt = row.whatsapp_reminder_sent_at
    ? formatPromiseDate(row.whatsapp_reminder_sent_at)
    : null;
  return {
    id: row.promise_id,
    name,
    balance: bal,
    amountLabel: `Rs. ${fmtAmt(bal)}`,
    promisedDate: wada,
    promisedDateRaw: row.promised_pay_date,
    carriedOver: Boolean(row.carried_over),
    note: row.note?.trim() || '',
    hasPhone: Boolean(row.has_phone),
    pending,
    sentAt,
  };
}

/**
 * @param {{ pendingItems: array, sentItems: array, stats: object, todayLabel: string }} input
 */
function dateKey(dateLike) {
  if (!dateLike) return '';
  return String(dateLike).slice(0, 10);
}

export function buildMunshiQueueContext({
  pendingItems = [],
  sentItems = [],
  stats = {},
  todayLabel = '',
  todayIso = '',
}) {
  const pending = (pendingItems || []).map((r) => mapRowToMunshiAccount(r, { pending: true }));
  const sent = (sentItems || []).map((r) => mapRowToMunshiAccount(r, { pending: false }));
  const totalPendingAmount = pending.reduce((s, a) => s + Math.abs(a.balance), 0);
  const anchor = todayIso ? String(todayIso).slice(0, 10) : '';
  const dueTodayAccounts = anchor
    ? pending.filter((a) => dateKey(a.promisedDateRaw) === anchor)
    : [];

  return {
    todayLabel,
    todayIso: anchor,
    readyCount: pending.length,
    dueToday: stats.dueToday ?? dueTodayAccounts.length,
    carryOver: stats.carryOver ?? 0,
    sentTodayCount: sent.length,
    totalPendingAmount,
    totalPendingAmountLabel: `Rs. ${fmtAmt(totalPendingAmount)}`,
    nextAccount: pending[0] || null,
    dueTodayAccounts,
    pending,
    sent,
  };
}
