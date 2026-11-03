/** Ledger rows tied to source documents — must not use Finance direct_edit / inline amount edit */

export const NON_EDITABLE_LEDGER_TRNX_TYPES = new Set([
  'SALE',
  'SALE_RETURN',
  'PURCHASE',
  'PURCHASE_RETURN',
  'ORDER',
]);

/** Case-insensitive match on ledger_type column */
export const NON_EDITABLE_LEDGER_TYPES = new Set([
  'sale',
  'sale return',
  'purchase',
  'purchase return',
  'order',
  'expense',
]);

const SOURCE_DOCUMENT_LEDGER_MESSAGE =
  'Sale, purchase, order, and expense ledger entries cannot be edited here. Edit the source document instead.';

function normalizeLedgerType(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

/**
 * @param {{ trnx_type?: string|null, ledger_type?: string|null }} entry
 * @returns {{ allowed: boolean, reason?: string }}
 */
export function getLedgerDirectEditBlockReason(entry) {
  if (!entry) {
    return { allowed: false, reason: 'Ledger entry not found.' };
  }

  const trnx = String(entry.trnx_type || '').trim().toUpperCase();
  if (NON_EDITABLE_LEDGER_TRNX_TYPES.has(trnx)) {
    return { allowed: false, reason: SOURCE_DOCUMENT_LEDGER_MESSAGE };
  }

  const ledgerType = normalizeLedgerType(entry.ledger_type);
  if (ledgerType && NON_EDITABLE_LEDGER_TYPES.has(ledgerType)) {
    return { allowed: false, reason: SOURCE_DOCUMENT_LEDGER_MESSAGE };
  }

  return { allowed: true };
}

export function isLedgerDirectEditAllowed(entry) {
  return getLedgerDirectEditBlockReason(entry).allowed;
}

/** Snapshot for activity_logs.details */
export function ledgerEntryAuditSnapshot(entry) {
  if (!entry) return null;
  return {
    l_id: entry.l_id,
    cus_id: entry.cus_id,
    bill_no: entry.bill_no ?? null,
    ledger_type: entry.ledger_type ?? null,
    trnx_type: entry.trnx_type ?? null,
    debit_amount: entry.debit_amount,
    credit_amount: entry.credit_amount,
    opening_balance: entry.opening_balance,
    closing_balance: entry.closing_balance,
    details: entry.details ?? null,
  };
}
