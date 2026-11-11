export const PROMISE_STATUS = {
  ACTIVE: 'ACTIVE',
  FULFILLED: 'FULFILLED',
  CANCELLED: 'CANCELLED',
};

const STORE = {
  nameUr: 'اتفاق آئرن اینڈ سیمنٹ سٹور',
  city: 'پرانیوالی',
  phone: '0346-7560306',
};

/** While ACTIVE, automated balance reminders should not be sent for this account. */
export function shouldSuppressBalanceReminder(promise) {
  return promise?.status === PROMISE_STATUS.ACTIVE;
}

export function formatPromiseDate(dateLike) {
  if (!dateLike) return '—';
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatAmount(balance) {
  const bal = parseFloat(balance) || 0;
  return Math.abs(bal).toLocaleString('en-PK', { maximumFractionDigits: 2 });
}

function respectfulNameUr(customerName) {
  const n = String(customerName || '').trim();
  if (!n) return 'محترم گاہک';
  return `محترم جناب ${n} صاحب`;
}

function balanceLinesUr(balance) {
  const bal = parseFloat(balance) || 0;
  if (bal > 0) {
    return {
      balanceLabel: 'بقایا رقم (Receivable)',
      closing:
        'براہِ کرم وعدہ کی تاریخ تک رقم ادا کر دیں تاکہ آپ کا کھاتہ باقاعدہ رہے۔ کسی بھی سوال کے لیے اسی نمبر پر رابطہ کریں۔',
    };
  }
  if (bal < 0) {
    return {
      balanceLabel: 'بیلنس (Credit)',
      closing:
        'براہِ کرم وعدہ کی تاریخ پر دفتر تشریف لائیں یا فون پر رابطہ کریں — ہم آپ کی سہولت کے لیے حاضر ہیں۔',
    };
  }
  return {
    balanceLabel: 'بیلانس',
    closing: 'براہِ کرم وعدہ کی تاریخ پر رابطہ کریں — شکریہ۔',
  };
}

const MESSAGE_RULE = '──────────────';

/**
 * Short formal Urdu reminder; English only for Rs., Credit, Receivable.
 */
export function buildPendingBalanceWhatsAppMessage({
  customerName,
  balance,
  promisedPayDate,
  note,
}) {
  const amt = formatAmount(balance);
  const dateStr = formatPromiseDate(promisedPayDate);
  const who = respectfulNameUr(customerName);
  const { balanceLabel, closing } = balanceLinesUr(balance);

  const lines = [
    `*${STORE.nameUr}*`,
    `${STORE.city} · ${STORE.phone}`,
    MESSAGE_RULE,
    '',
    'السلام علیکم ورحمۃ اللہ وبرکاتہ',
    '',
    `${who}،`,
    '',
    'امید ہے آپ خیریت سے ہوں گے۔',
    '',
    'آپ نے *ادائیگی کا وعدہ* کیا تھا — اس کی *نرمی سے یاددہانی* بھیج رہے ہیں:',
    '',
    `${balanceLabel}:  *Rs. ${amt}*`,
  ];

  if (promisedPayDate) {
    lines.push(`وعدہ کی تاریخ:  *${dateStr}*`);
  }

  if (note?.trim()) {
    lines.push('', `آپ کا نوٹ:  ${note.trim()}`);
  }

  lines.push('', closing, '', MESSAGE_RULE, 'آپ کے تعاون کا بہت شکریہ۔', `${STORE.nameUr} — انتظامیہ`);

  return lines.join('\n');
}

/** Compact Urdu preview for dashboard reminder queue (not the full WhatsApp body). */
export function buildPendingBalanceWhatsAppPreview({
  customerName,
  balance,
  promisedPayDate,
}) {
  const amt = formatAmount(balance);
  const dateStr = formatPromiseDate(promisedPayDate);
  const who = respectfulNameUr(customerName);
  const { balanceLabel, closing } = balanceLinesUr(balance);
  return [
    'السلام علیکم ورحمۃ اللہ وبرکاتہ',
    `${who}،`,
    'ادائیگی کے وعدے کی یاددہانی:',
    `${balanceLabel}: Rs. ${amt}`,
    promisedPayDate ? `وعدہ کی تاریخ: ${dateStr}` : '',
    closing,
  ]
    .filter(Boolean)
    .join('\n');
}

export function localDateInputValue(date = new Date()) {
  return date.toLocaleDateString('en-CA');
}

export function customerWhatsAppPhone(customer) {
  return (customer?.cus_phone_no || customer?.cus_phone_no2 || '').trim();
}

/** UI labels aligned with Accounts page (receivable = customer owes shop). */
export function getPromiseBalanceMeta(balance) {
  const bal = parseFloat(balance) || 0;
  if (bal > 0) {
    return {
      label: 'Receivable',
      labelUr: 'واجب الادا',
      amountClass: 'text-emerald-800',
      badgeClass: 'bg-emerald-50 text-emerald-900 border-emerald-200',
      cellClass: 'bg-emerald-50/60',
    };
  }
  if (bal < 0) {
    return {
      label: 'Payable',
      labelUr: 'قابل ادائیگی',
      amountClass: 'text-rose-800',
      badgeClass: 'bg-rose-50 text-rose-900 border-rose-200',
      cellClass: 'bg-rose-50/60',
    };
  }
  return {
    label: 'Zero',
    labelUr: 'صفر',
    amountClass: 'text-slate-600',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200',
    cellClass: '',
  };
}

/** Overdue / due today / upcoming for promise date chips */
export function getPromiseUrgency(promisedPayDate) {
  if (!promisedPayDate) return { id: 'none', label: '—', className: 'bg-slate-100 text-slate-600 border-slate-200' };
  const d = new Date(promisedPayDate);
  if (Number.isNaN(d.getTime())) return { id: 'none', label: '—', className: 'bg-slate-100 text-slate-600 border-slate-200' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target - today) / (86400000));
  if (diff < 0) {
    return {
      id: 'overdue',
      label: `Overdue ${Math.abs(diff)}d`,
      className: 'bg-rose-100 text-rose-900 border-rose-300',
    };
  }
  if (diff === 0) {
    return { id: 'today', label: 'Due today', className: 'bg-amber-100 text-amber-900 border-amber-300' };
  }
  if (diff <= 7) {
    return { id: 'soon', label: `In ${diff}d`, className: 'bg-sky-50 text-sky-900 border-sky-200' };
  }
  return { id: 'upcoming', label: `In ${diff}d`, className: 'bg-slate-50 text-slate-700 border-slate-200' };
}

export const PROMISE_PAGE_THEME = {
  pageBg: '#f1f5f9',
  headBg: '#e8effd',
  headText: '#1347c4',
  accent: '#1A55E3',
  border: '#dce3ed',
  navy: '#0f172a',
};
