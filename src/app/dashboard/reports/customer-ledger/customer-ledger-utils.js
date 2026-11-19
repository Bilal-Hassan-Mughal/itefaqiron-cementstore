import { createFilterOptions } from '@mui/material/Autocomplete';
import { formatDatePK } from '@/lib/date-helper';

export function fmtLedgerAmt(val) {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) {
    return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function parseLedgerBalance(val) {
  return parseFloat(val || 0) || 0;
}

export function balanceToneClass(balance) {
  const n = parseLedgerBalance(balance);
  if (n > 0) return 'text-red-600';
  if (n < 0) return 'text-emerald-600';
  return 'text-slate-600';
}

export function balanceBadgeClass(balance) {
  const n = parseLedgerBalance(balance);
  if (n > 0) return 'bg-red-50 text-red-700 border-red-100';
  if (n < 0) return 'bg-emerald-50 text-emerald-800 border-emerald-100';
  return 'bg-slate-50 text-slate-700 border-slate-200';
}

export function dedupeCustomersById(customers) {
  const byId = new Map();
  for (const c of customers) {
    if (c?.cus_id != null) byId.set(Number(c.cus_id), c);
  }
  return Array.from(byId.values()).sort((a, b) =>
    String(a.cus_name || '').localeCompare(String(b.cus_name || ''), undefined, { sensitivity: 'base' })
  );
}

export function filterSupplierAccounts(customers) {
  const deduped = dedupeCustomersById(customers);
  const suppliers = deduped.filter((c) =>
    String(c.customer_category?.cus_cat_title || '').toLowerCase().includes('supplier')
  );
  return suppliers.length > 0 ? suppliers : deduped;
}

/** True when cus_name is only digits / short code — prefer reference, phone, address in UI */
export function isLikelyAccountCode(name) {
  const s = String(name || '').trim();
  if (!s) return true;
  if (/^\d+$/.test(s)) return true;
  if (s.length <= 4 && /^[A-Za-z]?\d+$/.test(s)) return true;
  return false;
}

/** Main human-readable title for list, input, and report headers */
export function customerDisplayTitle(option) {
  if (!option) return '';
  const name = String(option.cus_name || '').trim();
  const urdu = String(option.name_urdu || '').trim();
  const ref = String(option.cus_reference || '').trim();
  const phone = option.cus_phone_no || option.cus_phone_no2 || '';
  const category = option.customer_category?.cus_cat_title || '';
  const city = option.city?.city_name || '';
  const address = String(option.cus_address || '').trim();

  let title = urdu ? `${name} ${urdu}`.trim() : name;

  if (isLikelyAccountCode(name)) {
    if (ref && !isLikelyAccountCode(ref)) title = ref;
    else if (address.length > 3) title = address.length > 48 ? `${address.slice(0, 48)}…` : address;
    else if (category && phone) title = `${category} — ${phone}`;
    else if (phone) title = phone;
    else if (category) title = category;
    else if (ref) title = ref;
    else if (city) title = city;
  }

  if (!title) title = `Customer #${option.cus_id}`;
  return title;
}

/** Value shown in the autocomplete text field after selection */
export function customerPrimaryLabel(option) {
  if (!option) return '';
  return customerDisplayTitle(option);
}

/** Second line in customer search dropdown */
export function customerSecondaryLine(option) {
  if (!option) return '';
  const parts = [];
  const name = String(option.cus_name || '').trim();
  const phone = option.cus_phone_no || option.cus_phone_no2;
  if (phone) parts.push(phone);
  const ref = option.cus_reference;
  if (ref && ref !== name) parts.push(ref);
  if (option.customer_category?.cus_cat_title) parts.push(option.customer_category.cus_cat_title);
  if (option.city?.city_name) parts.push(option.city.city_name);
  const addr = String(option.cus_address || '').trim();
  if (addr) parts.push(addr.length > 42 ? `${addr.slice(0, 42)}…` : addr);
  return parts.length ? parts.join(' · ') : `Account #${option.cus_id}`;
}

export function customerReportCaption(option) {
  if (!option) return '';
  const title = customerDisplayTitle(option);
  const name = String(option.cus_name || '').trim();
  if (name && name !== title && !title.includes(name)) {
    return `${title} (${name}) · #${option.cus_id}`;
  }
  return `${title} · #${option.cus_id}`;
}

export const filterCustomerLedgerOptions = createFilterOptions({
  limit: 80,
  stringify: (option) =>
    [
      customerDisplayTitle(option),
      option.cus_name,
      option.name_urdu,
      option.cus_id,
      option.cus_phone_no,
      option.cus_phone_no2,
      option.cus_reference,
      option.cus_address,
      option.customer_category?.cus_cat_title,
      option.city?.city_name,
      option.cus_balance,
    ].filter((x) => x !== '' && x != null).join(' '),
});

export function buildSupplierLedgerCsv(reportData, startDate, endDate) {
  let csv = 'Ittefaq Iron and Cement Store\n';
  csv += 'Address: Parianwali\n';
  csv += 'Phone: +92 346 7560306\n\n';
  csv += 'Supplier Ledger Report\n';
  csv += `Supplier: ${reportData.supplier?.cus_name}\n`;
  csv += `From: ${formatDatePK(startDate)} To: ${formatDatePK(endDate)}\n`;
  csv += `Generated on: ${new Date().toLocaleString()}\n\n`;
  csv += 'Date,Type,Bill No,Details,Debit,Credit,Balance,Payments,Cash,Bank\n';

  reportData.ledgerEntries.forEach((entry) => {
    csv += `${formatDatePK(entry.created_at)},${entry.trnx_type},${entry.bill_no || ''},${(entry.details || '').replace(/,/g, ' ')},${fmtLedgerAmt(entry.debit_amount)},${fmtLedgerAmt(entry.credit_amount)},${fmtLedgerAmt(entry.closing_balance)},${fmtLedgerAmt(entry.payments)},${fmtLedgerAmt(entry.cash_payment)},${fmtLedgerAmt(entry.bank_payment)}\n`;
  });

  csv += '\n';
  csv += `Opening Balance:,,,${fmtLedgerAmt(reportData.summary.openingBalance)}\n`;
  csv += `Total Debit:,,,${fmtLedgerAmt(reportData.summary.totalDebit)}\n`;
  csv += `Total Credit:,,,${fmtLedgerAmt(reportData.summary.totalCredit)}\n`;
  csv += `Closing Balance:,,,${fmtLedgerAmt(reportData.summary.closingBalance)}\n`;
  return csv;
}

export function buildCustomerLedgerCsv(reportData, startDate, endDate) {
  let csv = 'Ittefaq Iron and Cement Store\n';
  csv += 'Address: Parianwali\n';
  csv += 'Phone: +92 346 7560306\n\n';
  csv += 'Customer Ledger Report\n';
  csv += `Customer: ${reportData.customer?.cus_name}\n`;
  csv += `From: ${formatDatePK(startDate)} To: ${formatDatePK(endDate)}\n`;
  csv += `Generated on: ${new Date().toLocaleString()}\n\n`;
  csv += 'Date,Type,Bill No,Details,Debit,Credit,Balance,Payments\n';

  reportData.ledgerEntries.forEach((entry) => {
    csv += `${formatDatePK(entry.created_at)},${entry.trnx_type},${entry.bill_no || ''},${(entry.details || '').replace(/,/g, ' ')},${fmtLedgerAmt(entry.debit_amount)},${fmtLedgerAmt(entry.credit_amount)},${fmtLedgerAmt(entry.closing_balance)},${fmtLedgerAmt(entry.payments)}\n`;
  });

  csv += '\n';
  csv += `Opening Balance:,,,${fmtLedgerAmt(reportData.summary.openingBalance)}\n`;
  csv += `Total Debit:,,,${fmtLedgerAmt(reportData.summary.totalDebit)}\n`;
  csv += `Total Credit:,,,${fmtLedgerAmt(reportData.summary.totalCredit)}\n`;
  csv += `Closing Balance:,,,${fmtLedgerAmt(reportData.summary.closingBalance)}\n`;
  return csv;
}

export function ledgerRowKey(entry, index) {
  if (entry?.l_id != null) return `l-${entry.l_id}`;
  return `row-${entry?.bill_no || 'x'}-${entry?.created_at || index}-${index}`;
}

function digitsOnly(val) {
  return String(val ?? '')
    .replace(/[^\d.-]/g, '')
    .replace(/\.0+$/, '');
}

/** Client-side filter: bill #, ledger id, narration, type, amounts */
export function filterLedgerEntries(entries, query) {
  const list = entries || [];
  const raw = String(query || '').trim();
  if (!raw) return list;

  const qLower = raw.toLowerCase();
  const qDigits = digitsOnly(raw.replace(/,/g, ''));

  return list.filter((entry) => {
    const bill = String(entry.bill_no || '');
    const details = String(entry.details || '');
    const type = String(entry.trnx_type || '');
    const lid = entry.l_id != null ? String(entry.l_id) : '';

    const textBlob = [
      bill,
      details,
      type,
      lid,
      formatDatePK(entry.created_at),
      fmtLedgerAmt(entry.debit_amount),
      fmtLedgerAmt(entry.credit_amount),
      fmtLedgerAmt(entry.closing_balance),
      fmtLedgerAmt(entry.payments),
      fmtLedgerAmt(entry.cash_payment),
      fmtLedgerAmt(entry.bank_payment),
    ]
      .join(' ')
      .toLowerCase();

    if (textBlob.includes(qLower)) return true;
    if (bill && bill.includes(raw)) return true;

    if (qDigits.length >= 1) {
      const amounts = [
        entry.debit_amount,
        entry.credit_amount,
        entry.closing_balance,
        entry.payments,
        entry.cash_payment,
        entry.bank_payment,
      ]
        .map((v) => digitsOnly(v))
        .filter(Boolean);
      if (amounts.some((a) => a.includes(qDigits) || qDigits.includes(a))) return true;
    }

    return false;
  });
}