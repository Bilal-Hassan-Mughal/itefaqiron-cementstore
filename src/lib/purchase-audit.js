import { ledgerEntryAuditSnapshot } from '@/lib/ledger-edit-guard';

function n(val) {
  const x = parseFloat(val);
  return Number.isFinite(x) ? x : 0;
}

function lineQtyByProduct(details) {
  const map = new Map();
  for (const d of details || []) {
    const pid = parseInt(d.pro_id, 10);
    if (!pid) continue;
    const q = n(d.qnty ?? d.quantity);
    map.set(pid, (map.get(pid) || 0) + q);
  }
  return map;
}

/** Product qty added / removed / changed between old DB lines and new payload. */
export function summarizePurchaseLineChanges(oldDetails, newDetails) {
  const oldMap = lineQtyByProduct(oldDetails);
  const newMap = lineQtyByProduct(newDetails);
  const allIds = new Set([...oldMap.keys(), ...newMap.keys()]);

  const added = [];
  const removed = [];
  const qty_changed = [];

  for (const proId of allIds) {
    const before = oldMap.get(proId) || 0;
    const after = newMap.get(proId) || 0;
    if (before === 0 && after > 0) {
      added.push({ pro_id: proId, qty: after });
    } else if (after === 0 && before > 0) {
      removed.push({ pro_id: proId, qty: before });
    } else if (Math.abs(before - after) > 1e-9) {
      qty_changed.push({ pro_id: proId, qty_before: before, qty_after: after, delta: after - before });
    }
  }

  return {
    lines_before: (oldDetails || []).length,
    lines_after: (newDetails || []).length,
    products_added: added,
    products_removed: removed,
    products_qty_changed: qty_changed,
  };
}

const HEADER_AUDIT_FIELDS = [
  'cus_id',
  'store_id',
  'total_amount',
  'net_total',
  'discount',
  'payment',
  'cash_payment',
  'bank_payment',
  'payment_type',
  'invoice_number',
  'vehicle_no',
  'transport_amount',
  'labour_amount',
  'out_labour_amount',
  'out_delivery_amount',
];

export function summarizePurchaseHeaderChanges(before, after) {
  const changes = [];
  for (const field of HEADER_AUDIT_FIELDS) {
    const fromVal = before?.[field];
    const toVal = after?.[field];
    const fromStr = fromVal == null ? '' : String(fromVal);
    const toStr = toVal == null ? '' : String(toVal);
    if (fromStr !== toStr) {
      changes.push({ field, from: fromVal ?? null, to: toVal ?? null });
    }
  }
  return changes;
}

/** Per-account debit/credit removed vs added when a purchase ledger is reposted. */
export function summarizeLedgerRepostByAccount(removedRows = [], newRows = []) {
  const byAccount = new Map();

  const touch = (cusId) => {
    const id = parseInt(cusId, 10);
    if (!id) return null;
    if (!byAccount.has(id)) {
      byAccount.set(id, {
        cus_id: id,
        rows_removed: 0,
        rows_added: 0,
        removed_debit: 0,
        removed_credit: 0,
        added_debit: 0,
        added_credit: 0,
      });
    }
    return byAccount.get(id);
  };

  for (const row of removedRows) {
    const a = touch(row.cus_id);
    if (!a) continue;
    a.rows_removed += 1;
    a.removed_debit += n(row.debit_amount);
    a.removed_credit += n(row.credit_amount);
  }

  for (const row of newRows) {
    const snap = row.l_id != null ? row : ledgerEntryAuditSnapshot(row);
    const a = touch(snap.cus_id);
    if (!a) continue;
    a.rows_added += 1;
    a.added_debit += n(snap.debit_amount);
    a.added_credit += n(snap.credit_amount);
  }

  return [...byAccount.values()].map((a) => ({
    ...a,
    /** Receivable formula: balance change ≈ debit − credit */
    net_effect_removed: n(a.removed_debit) - n(a.removed_credit),
    net_effect_added: n(a.added_debit) - n(a.added_credit),
    net_effect_delta: (n(a.added_debit) - n(a.added_credit)) - (n(a.removed_debit) - n(a.removed_credit)),
  }));
}

export function billNoVariants(purId) {
  const s = String(purId);
  return [s, `PUR-${s}`, `PURCHASE-${s}`, `INC-${s}`, `incity-${s}`];
}

/**
 * Verify supplier (or any account) ledger rows for this bill chain opening→closing math.
 */
export function verifyLedgerRowsChain(rows) {
  if (!rows?.length) {
    return { ok: true, row_count: 0, message: 'No ledger rows for this bill on account.' };
  }
  const sorted = [...rows].sort((a, b) => {
    const t = new Date(a.created_at) - new Date(b.created_at);
    return t !== 0 ? t : (a.l_id || 0) - (b.l_id || 0);
  });

  let running = n(sorted[0].opening_balance);
  const issues = [];

  for (const row of sorted) {
    const debit = n(row.debit_amount);
    const credit = n(row.credit_amount);
    const expectedClose = running + debit - credit;
    const actualClose = n(row.closing_balance);
    if (Math.abs(expectedClose - actualClose) > 0.05) {
      issues.push({
        l_id: row.l_id,
        expected_closing: expectedClose,
        actual_closing: actualClose,
      });
    }
    running = actualClose;
  }

  const latest = sorted[sorted.length - 1];
  return {
    ok: issues.length === 0,
    row_count: sorted.length,
    latest_l_id: latest.l_id,
    latest_closing_balance: n(latest.closing_balance),
    chain_issues: issues,
  };
}

export async function fetchBillLedgerForAccount(prismaClient, purId, cusId) {
  return prismaClient.ledger.findMany({
    where: {
      cus_id: parseInt(cusId, 10),
      bill_no: { in: billNoVariants(purId) },
    },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
  });
}

export function buildPurchaseEditDescription(purId, lineSummary, headerChanges, ledgerSummary) {
  const parts = [`Purchase #${purId} updated.`];
  if (headerChanges.length) {
    parts.push(`${headerChanges.length} header field(s) changed.`);
  }
  const lineEvents =
    lineSummary.products_added.length +
    lineSummary.products_removed.length +
    lineSummary.products_qty_changed.length;
  if (lineEvents > 0) {
    parts.push(`${lineEvents} product line change(s).`);
  }
  if (ledgerSummary) {
    parts.push(
      `Ledger repost: ${ledgerSummary.rows_removed} row(s) deleted, ${ledgerSummary.rows_added} row(s) added across ${ledgerSummary.accounts_affected} account(s).`
    );
  }
  return parts.join(' ');
}

export function buildPurchaseEditAuditDetails({
  purId,
  beforePurchase,
  afterPurchase,
  lineSummary,
  headerChanges,
  removedLedgerRows,
  newLedgerRows,
  ledgerByAccount,
  supplierLedgerCheck,
  accountsRecalculated,
}) {
  return {
    pur_id: purId,
    cause: 'purchase_update_repost',
    header_changes: headerChanges,
    line_changes: lineSummary,
    ledger: {
      rows_removed: removedLedgerRows.length,
      rows_added: newLedgerRows.length,
      accounts_affected: ledgerByAccount.length,
      by_account: ledgerByAccount,
      supplier_on_bill: supplierLedgerCheck,
    },
    accounts_recalculated: accountsRecalculated,
    before_snapshot: {
      cus_id: beforePurchase?.cus_id,
      net_total: beforePurchase?.net_total,
      payment: beforePurchase?.payment,
      total_amount: beforePurchase?.total_amount,
    },
    after_snapshot: {
      cus_id: afterPurchase?.cus_id,
      net_total: afterPurchase?.net_total,
      payment: afterPurchase?.payment,
      total_amount: afterPurchase?.total_amount,
    },
  };
}
