import { logActivity, AUDIT_ACTIONS, AUDIT_MODULES } from '@/lib/audit-logger';
import { ledgerEntryAuditSnapshot } from '@/lib/ledger-edit-guard';

/** Why ledger rows changed — filter Activity Logs → Ledger → details.cause */
export const LEDGER_AUDIT_CAUSE = {
  FINANCE_MANUAL_CREATE: 'finance_manual_create',
  FINANCE_DIRECT_EDIT: 'finance_direct_edit',
  FINANCE_ADJUSTMENT_EDIT: 'finance_adjustment_edit',
  FINANCE_DELETE_ROW: 'finance_delete_row',
  FINANCE_DELETE_BULK: 'finance_delete_bulk',
  PAYMENT_CREATE: 'payment_create',
  /** Finance → Pay Amount button (POST /api/payments PAY) */
  PAYMENT_CREATE_PAY: 'finance_pay_button',
  /** Finance → Receive Amount button (POST /api/payments RECEIVE) */
  PAYMENT_CREATE_RECEIVE: 'finance_receive_button',
  PAYMENT_UPDATE_REPOST: 'payment_update_repost',
  PAYMENT_UPDATE_PAY: 'finance_pay_button_edit',
  PAYMENT_UPDATE_RECEIVE: 'finance_receive_button_edit',
  PAYMENT_CANCEL: 'finance_payment_cancel',
  SALE_CREATE: 'sale_create',
  SALE_UPDATE_REPOST: 'sale_update_repost',
  SALE_DELETE: 'sale_delete',
  PURCHASE_CREATE: 'purchase_create',
  PURCHASE_UPDATE_REPOST: 'purchase_update_repost',
  PURCHASE_DELETE: 'purchase_delete',
  EXPENSE_CREATE: 'expense_create',
  EXPENSE_UPDATE_REPOST: 'expense_update_repost',
  EXPENSE_DELETE: 'expense_delete',
  SALE_RETURN_CREATE: 'sale_return_create',
  SALE_RETURN_UPDATE_REPOST: 'sale_return_update_repost',
  SALE_RETURN_DELETE: 'sale_return_delete',
  PURCHASE_RETURN_UPDATE_REPOST: 'purchase_return_update_repost',
  PURCHASE_RETURN_DELETE: 'purchase_return_delete',
  INTERNAL_TRANSFER_UPDATE: 'internal_transfer_update',
};

const SNAPSHOT_LIMIT = 300;

export function snapshotLedgerRows(entries, limit = SNAPSHOT_LIMIT) {
  const list = entries || [];
  const sliced = list.slice(0, limit);
  return {
    rows: sliced.map(ledgerEntryAuditSnapshot),
    total: list.length,
    truncated: list.length > limit,
  };
}

/**
 * Core ledger activity log. Log timestamp = when the change was saved.
 */
export function logLedgerAudit({
  request = null,
  branchId = null,
  action,
  cause,
  description,
  entityId = null,
  details = {},
}) {
  return logActivity({
    request,
    branchId,
    action,
    module: AUDIT_MODULES.LEDGER,
    entityId: entityId != null ? String(entityId) : null,
    description,
    details: {
      cause,
      ...details,
    },
  }).catch(() => {});
}

export function logLedgerRowsDeleted({
  request,
  branchId,
  cause,
  sourceModule,
  sourceEntityId = null,
  billNo = null,
  rows = [],
  extra = {},
}) {
  const { rows: snapshots, total, truncated } = snapshotLedgerRows(rows);
  const billLabel = billNo || snapshots[0]?.bill_no || '—';
  return logLedgerAudit({
    request,
    branchId,
    action: AUDIT_ACTIONS.DELETE,
    cause,
    entityId: billNo || sourceEntityId || snapshots[0]?.l_id,
    description: `Ledger delete (${cause}): ${total} row(s) removed for bill ${billLabel}. Source: ${sourceModule}${sourceEntityId != null ? ` #${sourceEntityId}` : ''}.`,
    details: {
      source_module: sourceModule,
      source_entity_id: sourceEntityId,
      bill_no: billNo ?? snapshots[0]?.bill_no ?? null,
      rows_deleted: total,
      rows_truncated: truncated,
      deleted_rows: snapshots,
      ...extra,
    },
  });
}

export function logLedgerRowsCreatedOrUpdated({
  request,
  branchId,
  action = AUDIT_ACTIONS.CREATE,
  cause,
  sourceModule,
  sourceEntityId = null,
  billNo = null,
  rows = [],
  extra = {},
}) {
  const { rows: snapshots, total, truncated } = snapshotLedgerRows(rows);
  const billLabel = billNo || snapshots[0]?.bill_no || '—';
  const verb = action === AUDIT_ACTIONS.UPDATE ? 'updated/reposted' : 'created';
  return logLedgerAudit({
    request,
    branchId,
    action,
    cause,
    entityId: billNo || sourceEntityId || snapshots[0]?.l_id,
    description: `Ledger ${verb} (${cause}): ${total} row(s) for bill ${billLabel}. Source: ${sourceModule}${sourceEntityId != null ? ` #${sourceEntityId}` : ''}.`,
    details: {
      source_module: sourceModule,
      source_entity_id: sourceEntityId,
      bill_no: billNo ?? snapshots[0]?.bill_no ?? null,
      rows_count: total,
      rows_truncated: truncated,
      ledger_rows: snapshots,
      ...extra,
    },
  });
}

/** Fetch rows before delete (call outside or inside tx with same client). */
/** Ledger rows created from Finance Pay / Receive (POST /api/payments). */
export function logFinancePaymentLedgerCreate({ request, branchId, paymentRecord }) {
  const isReceive = paymentRecord.payment_type === 'RECEIVE';
  const cause = isReceive
    ? LEDGER_AUDIT_CAUSE.PAYMENT_CREATE_RECEIVE
    : LEDGER_AUDIT_CAUSE.PAYMENT_CREATE_PAY;
  const uiLabel = isReceive ? 'Receive Amount button' : 'Pay Amount button';
  const party = paymentRecord.account?.cus_name || `Account #${paymentRecord.account_id}`;

  return logLedgerRowsCreatedOrUpdated({
    request,
    branchId,
    cause,
    sourceModule: 'Finance Pay/Receive',
    sourceEntityId: paymentRecord.payment_id,
    billNo: `PAY-${paymentRecord.payment_id}`,
    rows: paymentRecord.ledger_entries || [],
    extra: {
      payment_type: paymentRecord.payment_type,
      ui_action: uiLabel,
      account_id: paymentRecord.account_id,
      account_name: party,
      net_amount: paymentRecord.net_amount,
      cash_amount: paymentRecord.cash_amount,
      bank_amount: paymentRecord.bank_amount,
      description: paymentRecord.description,
    },
  });
}

/** Ledger repost after editing Pay/Receive from Finance. */
export function logFinancePaymentLedgerUpdate({
  request,
  branchId,
  paymentRecord,
  rowsDeleted = [],
}) {
  const isReceive = paymentRecord.payment_type === 'RECEIVE';
  const cause = isReceive
    ? LEDGER_AUDIT_CAUSE.PAYMENT_UPDATE_RECEIVE
    : LEDGER_AUDIT_CAUSE.PAYMENT_UPDATE_PAY;
  const billRef = `PAY-${paymentRecord.payment_id}`;

  logLedgerRowsDeleted({
    request,
    branchId,
    cause,
    sourceModule: 'Finance Pay/Receive',
    sourceEntityId: paymentRecord.payment_id,
    billNo: billRef,
    rows: rowsDeleted,
    extra: { payment_type: paymentRecord.payment_type, ui_action: 'edit save' },
  });

  return logLedgerRowsCreatedOrUpdated({
    request,
    branchId,
    action: AUDIT_ACTIONS.UPDATE,
    cause,
    sourceModule: 'Finance Pay/Receive',
    sourceEntityId: paymentRecord.payment_id,
    billNo: billRef,
    rows: paymentRecord.ledger_entries || [],
    extra: {
      payment_type: paymentRecord.payment_type,
      ui_action: 'edit save',
      account_id: paymentRecord.account_id,
      account_name: paymentRecord.account?.cus_name,
    },
  });
}

export async function fetchLedgerRowsForAudit(client, where, limit = SNAPSHOT_LIMIT) {
  const rows = await client.ledger.findMany({
    where,
    orderBy: { l_id: 'asc' },
    take: limit,
  });
  const total = await client.ledger.count({ where });
  return { rows, total, truncated: total > limit };
}
