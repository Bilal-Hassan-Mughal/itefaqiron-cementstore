/**
 * Cross-check bills vs ledger: orphans, missing ledger, delete logs, ID gaps.
 * Run: node scripts/audit-ledger-bill-gaps.js
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const COLLATE = 'utf8mb4_unicode_ci';
const OUT = path.join(__dirname, 'ledger-bill-gaps-report.json');

async function orphanLedgerByBillNo() {
  return prisma.$queryRawUnsafe(`
    SELECT l.bill_no,
           COUNT(*) AS ledger_rows,
           MIN(l.created_at) AS first_ledger_at,
           MAX(l.created_at) AS last_ledger_at,
           GROUP_CONCAT(DISTINCT l.ledger_type ORDER BY l.ledger_type SEPARATOR ', ') AS ledger_types
    FROM ledger l
    WHERE l.bill_no IS NOT NULL AND TRIM(l.bill_no) != ''
    GROUP BY l.bill_no
    HAVING (
      (bill_no REGEXP '^[0-9]+$'
        AND NOT EXISTS (SELECT 1 FROM sales s WHERE CAST(s.sale_id AS CHAR) COLLATE ${COLLATE} = bill_no COLLATE ${COLLATE})
        AND NOT EXISTS (SELECT 1 FROM purchases p WHERE CAST(p.pur_id AS CHAR) COLLATE ${COLLATE} = bill_no COLLATE ${COLLATE})
      )
      OR (bill_no REGEXP '^PAY-[0-9]+$'
        AND NOT EXISTS (
          SELECT 1 FROM payments pay
          WHERE CONCAT('PAY-', pay.payment_id) COLLATE ${COLLATE} = bill_no COLLATE ${COLLATE}
        ))
      OR (bill_no REGEXP '^EXP-[0-9]+$'
        AND NOT EXISTS (
          SELECT 1 FROM expenses e
          WHERE CONCAT('EXP-', e.exp_id) COLLATE ${COLLATE} = bill_no COLLATE ${COLLATE}
        ))
      OR (bill_no REGEXP '^SR-[0-9]+$'
        AND NOT EXISTS (
          SELECT 1 FROM sale_returns sr
          WHERE CONCAT('SR-', sr.return_id) COLLATE ${COLLATE} = bill_no COLLATE ${COLLATE}
        ))
      OR (bill_no REGEXP '^PR-[0-9]+$'
        AND EXISTS (SELECT 1 FROM information_schema.tables t
                    WHERE t.table_schema = DATABASE() AND t.table_name = 'purchase_returns')
        AND NOT EXISTS (
          SELECT 1 FROM purchase_returns pr
          WHERE CONCAT('PR-', pr.id) COLLATE ${COLLATE} = bill_no COLLATE ${COLLATE}
        ))
      OR (bill_no REGEXP '^(PUR-|PURCHASE-)[0-9]+$'
        AND NOT EXISTS (
          SELECT 1 FROM purchases p2
          WHERE (
            CONCAT('PUR-', p2.pur_id) COLLATE ${COLLATE} = bill_no COLLATE ${COLLATE}
            OR CONCAT('PURCHASE-', p2.pur_id) COLLATE ${COLLATE} = bill_no COLLATE ${COLLATE}
          )
        ))
    )
    ORDER BY ledger_rows DESC, bill_no
  `);
}

async function billsMissingLedgerCounts() {
  const [sales, saleRet, purchases, purRet, payments, expenses] = await Promise.all([
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS c FROM sales s
      WHERE s.bill_type IN ('BILL', 'DISPATCHED')
        AND NOT EXISTS (
          SELECT 1 FROM ledger l WHERE l.bill_no COLLATE ${COLLATE} = CAST(s.sale_id AS CHAR) COLLATE ${COLLATE}
        )`),
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS c FROM sale_returns sr
      WHERE NOT EXISTS (
        SELECT 1 FROM ledger l WHERE (
          l.bill_no COLLATE ${COLLATE} = CONCAT('SR-', sr.return_id) COLLATE ${COLLATE}
          OR l.bill_no COLLATE ${COLLATE} = CAST(sr.return_id AS CHAR) COLLATE ${COLLATE}
        )
      )`),
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS c FROM purchases p
      WHERE NOT EXISTS (
        SELECT 1 FROM ledger l WHERE (
          l.bill_no COLLATE ${COLLATE} = CAST(p.pur_id AS CHAR) COLLATE ${COLLATE}
          OR l.bill_no COLLATE ${COLLATE} = CONCAT('PUR-', p.pur_id) COLLATE ${COLLATE}
          OR l.bill_no COLLATE ${COLLATE} = CONCAT('PURCHASE-', p.pur_id) COLLATE ${COLLATE}
        )
      )`),
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS c FROM purchase_returns pr
      WHERE EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_schema = DATABASE() AND t.table_name = 'purchase_returns')
        AND NOT EXISTS (
          SELECT 1 FROM ledger l WHERE l.bill_no COLLATE ${COLLATE} = CONCAT('PR-', pr.id) COLLATE ${COLLATE}
        )`).catch(() => [{ c: 0n }]),
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS c FROM payments pay
      WHERE pay.status != 'CANCELLED'
        AND NOT EXISTS (
          SELECT 1 FROM ledger l WHERE l.bill_no COLLATE ${COLLATE} = CONCAT('PAY-', pay.payment_id) COLLATE ${COLLATE}
        )`),
    prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS c FROM expenses e
      WHERE NOT EXISTS (
        SELECT 1 FROM ledger l WHERE l.bill_no COLLATE ${COLLATE} = CONCAT('EXP-', e.exp_id) COLLATE ${COLLATE}
      )`),
  ]);
  const n = (x) => Number(x[0]?.c ?? 0);
  return {
    sales_bill_dispatched: n(sales),
    sale_returns: n(saleRet),
    purchases: n(purchases),
    purchase_returns: n(purRet),
    payments_active: n(payments),
    expenses: n(expenses),
  };
}

async function deleteLogSummary() {
  return prisma.$queryRawUnsafe(`
    SELECT module, action, COUNT(*) AS cnt
    FROM activity_logs
    WHERE action IN ('DELETE', 'STATUS_CHANGE')
      AND (action = 'DELETE'
           OR module = 'Payments'
           OR module = 'Ledger'
           OR description LIKE '%deleted%'
           OR description LIKE '%cancelled%')
    GROUP BY module, action
    ORDER BY cnt DESC
  `);
}

async function saleDeleteLogsWithLedgerLeft() {
  return prisma.$queryRawUnsafe(`
    SELECT al.log_id, al.entity_id AS sale_id, al.created_at, al.user_name, al.description,
           (SELECT COUNT(*) FROM ledger l
            WHERE l.bill_no COLLATE ${COLLATE} = al.entity_id COLLATE ${COLLATE}) AS ledger_rows_now
    FROM activity_logs al
    WHERE al.action = 'DELETE'
      AND al.module = 'Sales & POS'
      AND al.entity_id REGEXP '^[0-9]+$'
    HAVING ledger_rows_now > 0
    ORDER BY al.created_at DESC
  `);
}

async function ledgerDeleteLogs() {
  return prisma.$queryRawUnsafe(`
    SELECT log_id, action, module, entity_id, created_at, user_name, description
    FROM activity_logs
    WHERE module = 'Ledger'
      AND (action = 'DELETE' OR description LIKE '%deleted%' OR description LIKE '%removed%')
    ORDER BY created_at DESC
    LIMIT 500
  `);
}

async function saleIdGaps() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT sale_id FROM sales ORDER BY sale_id ASC
  `);
  const ids = rows.map((r) => Number(r.sale_id));
  const gaps = [];
  if (!ids.length) return { min: null, max: null, count: 0, missing_ids: [] };
  for (let i = 1; i < ids.length; i++) {
    const prev = ids[i - 1];
    const cur = ids[i];
    for (let m = prev + 1; m < cur; m++) gaps.push(m);
  }
  return {
    min: ids[0],
    max: ids[ids.length - 1],
    count: ids.length,
    span: ids[ids.length - 1] - ids[0] + 1,
    missing_id_count: gaps.length,
    missing_ids: gaps,
  };
}

async function missingIdsWithLedgerOrLog(gapIds) {
  if (!gapIds.length) return { with_ledger: [], with_delete_log: [] };
  const sample = gapIds.slice(0, 500);
  const inList = sample.join(',');
  const withLedger = await prisma.$queryRawUnsafe(`
    SELECT l.bill_no, COUNT(*) AS ledger_rows
    FROM ledger l
    WHERE l.bill_no COLLATE ${COLLATE} IN (${sample.map((id) => `'${id}'`).join(',')})
    GROUP BY l.bill_no
  `);
  const withLog = await prisma.$queryRawUnsafe(`
    SELECT al.entity_id, al.created_at, al.user_name, al.description
    FROM activity_logs al
    WHERE al.module = 'Sales & POS' AND al.action = 'DELETE'
      AND al.entity_id COLLATE ${COLLATE} IN (${sample.map((id) => `'${id}'`).join(',')})
  `);
  return {
    with_ledger: withLedger,
    with_delete_log: withLog,
    sampled: sample.length,
    total_gaps: gapIds.length,
  };
}

async function classifyOrphans(orphans) {
  const classified = [];
  for (const row of orphans) {
    const bill = String(row.bill_no);
    let kind = 'unknown';
    if (/^\d+$/.test(bill)) kind = 'numeric_no_sale_or_purchase';
    else if (/^PAY-/i.test(bill)) kind = 'payment_missing';
    else if (/^EXP-/i.test(bill)) kind = 'expense_missing';
    else if (/^SR-/i.test(bill)) kind = 'sale_return_missing';
    else if (/^PR-/i.test(bill)) kind = 'purchase_return_missing';
    else if (/^PUR/i.test(bill)) kind = 'purchase_missing';

    const deleteLog = await prisma.activityLog.findFirst({
      where: {
        OR: [
          { entity_id: bill.replace(/^PAY-/i, '').replace(/^EXP-/i, '').replace(/^SR-/i, '').replace(/^PR-/i, '') },
          { entity_id: bill },
          { description: { contains: bill } },
        ],
        action: 'DELETE',
      },
      orderBy: { created_at: 'desc' },
      select: { log_id: true, module: true, created_at: true, user_name: true, description: true },
    });

    classified.push({
      bill_no: bill,
      kind,
      ledger_rows: Number(row.ledger_rows),
      first_ledger_at: row.first_ledger_at,
      last_ledger_at: row.last_ledger_at,
      ledger_types: row.ledger_types,
      delete_log: deleteLog || null,
    });
  }
  return classified;
}

function summarizeOrphans(classified) {
  const byKind = {};
  let totalRows = 0;
  for (const o of classified) {
    byKind[o.kind] = (byKind[o.kind] || 0) + 1;
    totalRows += o.ledger_rows;
  }
  return { distinct_bills: classified.length, total_ledger_rows: totalRows, by_kind: byKind };
}

async function main() {
  console.log('=== LEDGER vs BILLS — FULL GAP AUDIT ===\n');

  const [orphans, missingCounts, delSummary, saleDelLedgerLeft, ledgerDelLogs, gaps] =
    await Promise.all([
      orphanLedgerByBillNo(),
      billsMissingLedgerCounts(),
      deleteLogSummary(),
      saleDeleteLogsWithLedgerLeft(),
      ledgerDeleteLogs(),
      saleIdGaps(),
    ]);

  const gapDetail = await missingIdsWithLedgerOrLog(gaps.missing_ids);
  const orphanClassified = await classifyOrphans(orphans);
  const orphanSummary = summarizeOrphans(orphanClassified);

  const deleteCounts = await prisma.$queryRawUnsafe(`
    SELECT
      SUM(CASE WHEN module = 'Sales & POS' AND action = 'DELETE' THEN 1 ELSE 0 END) AS sales_deleted_logged,
      SUM(CASE WHEN module = 'Purchases' AND action = 'DELETE' THEN 1 ELSE 0 END) AS purchases_deleted_logged,
      SUM(CASE WHEN module = 'Expenses' AND action = 'DELETE' THEN 1 ELSE 0 END) AS expenses_deleted_logged,
      SUM(CASE WHEN module = 'Payments' AND action = 'DELETE' THEN 1 ELSE 0 END) AS payments_deleted_logged,
      SUM(CASE WHEN module = 'Ledger' AND action = 'DELETE' THEN 1 ELSE 0 END) AS ledger_delete_logged,
      MIN(created_at) AS first_log_at,
      MAX(created_at) AS last_log_at
    FROM activity_logs
  `);

  console.log('--- A) Bill EXISTS, ledger MISSING (counts) ---');
  console.log(missingCounts);

  console.log('\n--- B) Ledger EXISTS, source bill MISSING (orphan bill_no) ---');
  console.log(orphanSummary);
  console.log('Top 30 orphan bills:');
  orphanClassified.slice(0, 30).forEach((o) => {
    console.log(
      `  ${o.bill_no} | ${o.kind} | ${o.ledger_rows} row(s) | log: ${o.delete_log ? o.delete_log.created_at + ' ' + o.delete_log.user_name : 'NONE'}`
    );
  });

  console.log('\n--- C) Logged sale DELETE but ledger rows STILL present ---');
  console.log(`Count: ${saleDelLedgerLeft.length}`);
  saleDelLedgerLeft.slice(0, 20).forEach((r) => console.log(r));

  console.log('\n--- D) Sale ID gaps (deleted sale with NO row in sales table) ---');
  console.log({
    sale_ids_in_db: gaps.count,
    range: `${gaps.min}–${gaps.max}`,
    missing_ids_in_range: gaps.missing_id_count,
  });
  console.log(`Missing IDs that STILL have ledger: ${gapDetail.with_ledger.length} (sampled ${gapDetail.sampled})`);
  gapDetail.with_ledger.forEach((r) => console.log('  ledger orphan sale', r));
  console.log(`Missing IDs with DELETE log in sample: ${gapDetail.with_delete_log.length}`);

  console.log('\n--- E) Activity log delete totals (all time) ---');
  console.log(deleteCounts[0]);
  console.log('By module/action (subset):');
  delSummary.forEach((r) => console.log(`  ${r.module} / ${r.action}: ${Number(r.cnt)}`));

  console.log('\n--- F) Recent Ledger-module delete/removal logs (up to 500) ---');
  console.log(`Count fetched: ${ledgerDelLogs.length}`);

  const report = {
    generated_at: new Date().toISOString(),
    missing_ledger_on_existing_bills: missingCounts,
    orphan_ledger_summary: orphanSummary,
    orphan_ledger_all: orphanClassified,
    sale_delete_log_but_ledger_remains: saleDelLedgerLeft.map((r) => ({
      ...r,
      ledger_rows_now: Number(r.ledger_rows_now),
    })),
    sale_id_gaps: {
      ...gaps,
      missing_ids: gaps.missing_ids.length > 2000 ? gaps.missing_ids.slice(0, 2000) : gaps.missing_ids,
      missing_ids_truncated: gaps.missing_ids.length > 2000,
    },
    gap_ids_with_ledger: gapDetail.with_ledger,
    gap_ids_with_delete_log_sample: gapDetail.with_delete_log,
    activity_log_delete_totals: deleteCounts[0],
    activity_log_delete_by_module: delSummary,
    ledger_module_delete_logs_sample: ledgerDelLogs,
  };

  fs.writeFileSync(OUT, JSON.stringify(report, (_, v) => (typeof v === 'bigint' ? Number(v) : v), 2));
  console.log('\nWrote', OUT);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
