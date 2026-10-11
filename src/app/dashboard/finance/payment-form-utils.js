/** Ledger rows that must be edited at source document, not inline */
export const NON_EDITABLE_LEDGER_TRNX_TYPES = new Set([
  'SALE',
  'SALE_RETURN',
  'PURCHASE',
  'PURCHASE_RETURN',
  'ORDER',
]);

export function canEditLedgerEntry(entry) {
  return Boolean(entry) && !NON_EDITABLE_LEDGER_TRNX_TYPES.has(entry?.trnx_type);
}

/** Group key for linked ledger rows (PAY-1, JRN-2, shared bill_no, or single row) */
export function getLedgerTransactionKey(entry) {
  if (!entry) return '';
  const ref = String(entry.bill_no || '').trim();
  if (/^PAY-\d+$/i.test(ref)) return ref.toUpperCase();
  if (/^JRN-\d+$/i.test(ref)) return ref.toUpperCase();
  if (ref) return ref;
  return `ENTRY-${entry.l_id}`;
}

export function groupLedgerEntriesByTransaction(entries) {
  const groups = new Map();
  for (const entry of entries || []) {
    const key = getLedgerTransactionKey(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  }
  return groups;
}

export function getTransactionMaxLId(entries) {
  if (!entries?.length) return 0;
  return Math.max(...entries.map((e) => e.l_id || 0));
}

/** Representative row for a transaction group (prefer main payment/receiving line) */
export function pickTransactionRepresentativeEntry(groupEntries) {
  if (!groupEntries?.length) return null;
  const paymentLine = groupEntries.find((e) =>
    /^(Payment|Receiving)$/i.test(String(e.ledger_type || ''))
  );
  if (paymentLine) return paymentLine;
  return groupEntries.reduce(
    (best, e) => (!best || (e.l_id || 0) > (best.l_id || 0) ? e : best),
    null
  );
}

export function getTransactionGroupForEntry(entry, allEntries) {
  if (!entry) return [];
  const key = getLedgerTransactionKey(entry);
  return (allEntries || []).filter((e) => getLedgerTransactionKey(e) === key);
}

export function findLatestEditableTransactionGroup(entries, canEdit = canEditLedgerEntry) {
  const editable = (entries || []).filter(canEdit);
  if (!editable.length) return null;

  const groups = groupLedgerEntriesByTransaction(editable);
  let bestGroup = null;
  let bestMaxId = 0;

  for (const groupEntries of groups.values()) {
    const maxId = getTransactionMaxLId(groupEntries);
    if (maxId > bestMaxId) {
      bestMaxId = maxId;
      bestGroup = groupEntries;
    }
  }

  return bestGroup;
}

export const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function getTransactionEditCaption(entry, draft) {
  const name = entry?.customer?.cus_name || 'Account';
  const debit = parseFloat(draft?.debit || 0);
  const credit = parseFloat(draft?.credit || 0);
  if (debit > 0) return `Editing · ${name} · Debit PKR ${fmtAmt(debit)}`;
  if (credit > 0) return `Editing · ${name} · Credit PKR ${fmtAmt(credit)}`;
  return `Editing · ${name}`;
}

export function isLedgerBankOrCashEntry(entry) {
  const title = (entry?.customer?.customer_category?.cus_cat_title || '').toLowerCase();
  return title.includes('bank') || title.includes('cash');
}

export function draftLegAmount(draft) {
  return Math.max(parseFloat(draft?.debit || 0) || 0, parseFloat(draft?.credit || 0) || 0);
}

/** Build PUT /api/payments body when editing a PAY-* group in the finance ledger. */
export function buildPaymentUpdatePayloadFromTransactionEdit(entries, drafts, existingPayment) {
  if (!existingPayment || !entries?.length) return null;

  const accountId = Number(existingPayment.account_id);
  const cashId = existingPayment.cash_account_id ? Number(existingPayment.cash_account_id) : null;
  const bankId = existingPayment.bank_account_id ? Number(existingPayment.bank_account_id) : null;
  const byCus = new Map(entries.map((e) => [Number(e.cus_id), e]));
  const mainEntry = byCus.get(accountId);
  if (!mainEntry) return null;

  let mainAmt = draftLegAmount(drafts[mainEntry.l_id]);
  let cashAmt = cashId && byCus.get(cashId) ? draftLegAmount(drafts[byCus.get(cashId).l_id]) : 0;
  let bankAmt = bankId && byCus.get(bankId) ? draftLegAmount(drafts[byCus.get(bankId).l_id]) : 0;
  const discount = parseFloat(existingPayment.discount_amount || 0);

  if (mainAmt <= 0) {
    mainAmt = 0;
    cashAmt = 0;
    bankAmt = 0;
  } else if (bankId && Math.abs(cashAmt + bankAmt + discount - mainAmt) > 0.02) {
    bankAmt = Math.max(0, mainAmt - discount - cashAmt);
  }

  const paymentDateRaw = existingPayment.payment_date;
  const payment_date = paymentDateRaw
    ? String(paymentDateRaw).slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const mainDraft = drafts[mainEntry.l_id];
  const description =
    buildLiveEditParticulars(mainEntry, mainDraft) || existingPayment.description || '';

  return {
    id: existingPayment.payment_id,
    payment_date,
    payment_type: existingPayment.payment_type,
    account_id: accountId,
    total_amount: mainAmt,
    discount_amount: discount,
    cash_account_id: cashId,
    cash_amount: cashAmt,
    bank_account_id: bankId,
    bank_amount: bankAmt,
    description,
  };
}

/** Update particulars text from debit/credit draft (PAY-* saves sync all legs via payments API). */
export function buildLiveEditParticulars(entry, draft) {
  const raw = String(entry?.details || '').trim();
  const base = raw.replace(/\{.*?\}/g, '').replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
  const debit = parseFloat(draft?.debit || 0);
  const credit = parseFloat(draft?.credit || 0);
  const origDebit = parseFloat(entry?.debit_amount || 0) > 0;
  const origCredit = parseFloat(entry?.credit_amount || 0) > 0;

  if (!base) {
    const amt = origDebit ? debit : credit;
    return amt > 0 ? `PKR ${fmtAmt(amt)}` : '';
  }

  if (origCredit) {
    if (/\(Credit/i.test(base)) {
      return base.replace(/\(Credit(?:\s*PKR\s*[\d,.]+)?\)/i, `(Credit PKR ${fmtAmt(credit)})`);
    }
    return credit > 0 ? `${base} (Credit PKR ${fmtAmt(credit)})` : base;
  }

  if (origDebit) {
    if (/\(Debit/i.test(base)) {
      return base.replace(/\(Debit(?:\s*PKR\s*[\d,.]+)?\)/i, `(Debit PKR ${fmtAmt(debit)})`);
    }
    if (/PKR\s*[\d,.]+/i.test(base)) {
      return base.replace(/PKR\s*[\d,.]+/i, `PKR ${fmtAmt(debit)}`);
    }
    return debit > 0 ? `${base} · PKR ${fmtAmt(debit)}` : base;
  }

  return base;
}

export const buildFinancePaymentDescription = (
  mode,
  accountName,
  cashAmount,
  bankAmount,
  bankAccountId,
  bankAccountsList,
  discountAmount
) => {
  const bits = [];
  const cash = parseFloat(cashAmount || 0);
  const bank = parseFloat(bankAmount || 0);
  const disc = parseFloat(discountAmount || 0);
  if (cash > 0) bits.push(`Cash PKR ${fmtAmt(cash)}`);
  if (bank > 0 && bankAccountId) {
    const bankName =
      bankAccountsList.find((b) => String(b.cus_id) === String(bankAccountId))?.cus_name || 'Bank';
    bits.push(`${bankName} PKR ${fmtAmt(bank)}`);
  } else if (bank > 0) {
    bits.push(`Bank PKR ${fmtAmt(bank)}`);
  }
  if (disc > 0) bits.push(`Discount PKR ${fmtAmt(disc)}`);

  const prefix = mode === 'PAY' ? 'Payment ' : mode === 'RECEIVE' ? 'Receiving ' : '';
  const content = bits.join(' | ');
  if (accountName && content) {
    return `${prefix}${accountName} - ${content}`;
  }
  return prefix ? `${prefix}${content}` : content;
};

export const numberToUrduWords = (amount) => {
  const num = Math.round(parseFloat(amount));
  if (isNaN(num) || num <= 0) return '';

  const urduNumbers = [
    '', 'ایک', 'دو', 'تین', 'چار', 'پانچ', 'چھ', 'سات', 'آٹھ', 'نو', 'دس',
    'گیارہ', 'بارہ', 'تیرہ', 'چودہ', 'پندرہ', 'سولہ', 'سترہ', 'اٹھارہ', 'انیس', 'بیس',
    'اکیس', 'بائیس', 'تیئیس', 'چوبیس', 'پچیس', 'چھبیس', 'ستائیس', 'اٹھائیس', 'انتیس', 'تیس',
    'اکتیس', 'بتیس', 'تینتیس', 'چونتیس', 'پینتیس', 'چھتیس', 'سینتیس', 'اٹھتیس', 'انتالیس', 'چالیس',
    'اکتالیس', 'بیالیس', 'تینتالیس', 'چوالیس', 'پینتالیس', 'چھیالیس', 'سینتالیس', 'اٹھتالیس', 'انچاس', 'پچاس',
    'اکیاون', 'باون', 'تریپن', 'چون', 'پچپن', 'چھپن', 'ستاون', 'اٹھاون', 'انسٹھ', 'ساٹھ',
    'اکسٹھ', 'باسٹھ', 'تریسٹھ', 'چونسٹھ', 'پینسٹھ', 'چھیاسٹھ', 'سڑسٹھ', 'اٹھسٹھ', 'انہتر', 'ستر',
    'اکہتر', 'بہتر', 'تہتر', 'چوہتر', 'پچہتر', 'چھیہتر', 'ستتر', 'اٹھہتر', 'انیاسی', 'اسی',
    'اکیاسی', 'بیاسی', 'تیاسی', 'چوراسی', 'پچاسی', 'چھیاسی', 'ستاسی', 'اٹھاسی', 'نواسی', 'نوے',
    'اکیانوے', 'بانوے', 'ترانوے', 'چورانوے', 'پچانوے', 'چھیانوے', 'ستانوے', 'اٹھانوے', 'ننانوے',
  ];

  const convert = (n) => {
    if (n < 100) return urduNumbers[n];

    const parts = [];

    if (n >= 10000000) {
      parts.push(`${convert(Math.floor(n / 10000000))} کروڑ`);
      n %= 10000000;
    }
    if (n >= 100000) {
      parts.push(`${convert(Math.floor(n / 100000))} لاکھ`);
      n %= 100000;
    }
    if (n >= 1000) {
      parts.push(`${convert(Math.floor(n / 1000))} ہزار`);
      n %= 1000;
    }
    if (n >= 100) {
      parts.push(`${urduNumbers[Math.floor(n / 100)]} سو`);
      n %= 100;
    }
    if (n > 0) {
      parts.push(urduNumbers[n]);
    }

    return parts.filter(Boolean).join(' ');
  };

  const words = convert(num);
  return words ? `${words} روپے فقط` : '';
};
