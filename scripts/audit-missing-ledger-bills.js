/**
 * Lists sales, sale returns, and purchases with no matching ledger rows.
 * Run: node scripts/audit-missing-ledger-bills.js
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

const COLLATE = 'utf8mb4_unicode_ci';

async function salesMissingLedger() {
  return prisma.$queryRawUnsafe(`
    SELECT s.sale_id, s.bill_type, s.bill_number, s.total_amount, s.payment, s.created_at,
           c.cus_id, c.cus_name,
           (SELECT COUNT(*) FROM ledger l
            WHERE l.bill_no COLLATE ${COLLATE} = CAST(s.sale_id AS CHAR) COLLATE ${COLLATE}) AS ledger_count
    FROM sales s
    INNER JOIN customers c ON c.cus_id = s.cus_id
    WHERE s.bill_type IN ('BILL', 'DISPATCHED')
    HAVING ledger_count = 0
    ORDER BY s.created_at DESC, s.sale_id DESC
  `);
}

async function saleReturnsMissingLedger() {
  return prisma.$queryRawUnsafe(`
    SELECT sr.return_id, sr.sale_id, sr.total_amount, sr.payment, sr.created_at, sr.reason,
           c.cus_id, c.cus_name,
           (SELECT COUNT(*) FROM ledger l
            WHERE l.bill_no COLLATE ${COLLATE} = CONCAT('SR-', sr.return_id) COLLATE ${COLLATE}
               OR l.bill_no COLLATE ${COLLATE} = CAST(sr.return_id AS CHAR) COLLATE ${COLLATE}) AS ledger_count
    FROM sale_returns sr
    INNER JOIN customers c ON c.cus_id = sr.cus_id
    HAVING ledger_count = 0
    ORDER BY sr.created_at DESC, sr.return_id DESC
  `);
}

async function purchasesMissingLedger() {
  return prisma.$queryRawUnsafe(`
    SELECT p.pur_id, p.net_total, p.total_amount, p.payment, p.created_at, p.invoice_number,
           c.cus_id, c.cus_name,
           (SELECT COUNT(*) FROM ledger l WHERE (
              l.bill_no COLLATE ${COLLATE} = CAST(p.pur_id AS CHAR) COLLATE ${COLLATE}
              OR l.bill_no COLLATE ${COLLATE} = CONCAT('PUR-', p.pur_id) COLLATE ${COLLATE}
              OR l.bill_no COLLATE ${COLLATE} = CONCAT('PURCHASE-', p.pur_id) COLLATE ${COLLATE}
              OR l.details LIKE CONCAT('%Purchase #', p.pur_id, '%')
              OR l.details LIKE CONCAT('%Purchase Update #', p.pur_id, '%')
           )) AS ledger_count
    FROM purchases p
    INNER JOIN customers c ON c.cus_id = p.cus_id
    HAVING ledger_count = 0
    ORDER BY p.created_at DESC, p.pur_id DESC
  `);
}

async function purchaseReturnsMissingLedger() {
  const hasTable = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*) AS c FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_name = 'purchase_returns'
  `);
  if (!Number(hasTable[0]?.c)) return [];

  return prisma.$queryRawUnsafe(`
    SELECT pr.id AS return_id, pr.purchase_id AS pur_id, pr.total_return_amount, pr.created_at,
           c.cus_id, c.cus_name,
           (SELECT COUNT(*) FROM ledger l WHERE (
              l.bill_no COLLATE ${COLLATE} = CONCAT('PR-', pr.id) COLLATE ${COLLATE}
              OR l.details LIKE CONCAT('%Purchase Return #', pr.id, '%')
           )) AS ledger_count
    FROM purchase_returns pr
    INNER JOIN purchases pu ON pu.pur_id = pr.purchase_id
    INNER JOIN customers c ON c.cus_id = pu.cus_id
    HAVING ledger_count = 0
    ORDER BY pr.created_at DESC, pr.id DESC
  `).catch(() => []);
}

function fmtDate(d) {
  if (!d) return '';
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().slice(0, 10);
}

function printSection(title, rows, mapRow) {
  console.log(`\n${'='.repeat(72)}`);
  console.log(title);
  console.log(`Count: ${rows.length}`);
  console.log('='.repeat(72));
  if (!rows.length) {
    console.log('(none)');
    return;
  }
  rows.slice(0, 200).forEach((r, i) => console.log(`${i + 1}. ${mapRow(r)}`));
  if (rows.length > 200) console.log(`... and ${rows.length - 200} more (see JSON report)`);
}

async function main() {
  console.log('Scanning for bills without ledger entries...\n');

  const [sales, returns, purchases, purReturns] = await Promise.all([
    salesMissingLedger(),
    saleReturnsMissingLedger(),
    purchasesMissingLedger(),
    purchaseReturnsMissingLedger(),
  ]);

  printSection('SALES (BILL / DISPATCHED) — NO LEDGER ROWS', sales, (r) =>
    `Sale #${r.sale_id} | Bill #${r.bill_number ?? '—'} | ${r.cus_name} (cus ${r.cus_id}) | ` +
      `Total ${Number(r.total_amount)} | Paid ${Number(r.payment)} | ${fmtDate(r.created_at)}`
  );

  printSection('SALE RETURNS — NO LEDGER ROWS (bill SR-{id})', returns, (r) =>
    `Return #${r.return_id} | Linked sale ${r.sale_id ?? '—'} | ${r.cus_name} (cus ${r.cus_id}) | ` +
      `Total ${Number(r.total_amount)} | ${fmtDate(r.created_at)} | ${(r.reason || '').slice(0, 40)}`
  );

  printSection('PURCHASES — NO LEDGER ROWS', purchases, (r) =>
    `Purchase #${r.pur_id} | Inv ${r.invoice_number ?? '—'} | ${r.cus_name} (cus ${r.cus_id}) | ` +
      `Net ${Number(r.net_total)} | Total ${Number(r.total_amount)} | Paid ${Number(r.payment)} | ${fmtDate(r.created_at)}`
  );

  printSection('PURCHASE RETURNS — NO LEDGER ROWS', purReturns, (r) =>
    `PR #${r.return_id} | Purchase ${r.pur_id ?? '—'} | ${r.cus_name} (cus ${r.cus_id}) | ` +
      `Total ${Number(r.total_return_amount)} | ${fmtDate(r.created_at)}`
  );

  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      sales_missing: sales.length,
      sale_returns_missing: returns.length,
      purchases_missing: purchases.length,
      purchase_returns_missing: purReturns.length,
    },
    sales: sales.map((r) => ({
      sale_id: Number(r.sale_id),
      bill_number: r.bill_number != null ? Number(r.bill_number) : null,
      bill_type: r.bill_type,
      account: r.cus_name,
      cus_id: Number(r.cus_id),
      total_amount: Number(r.total_amount),
      payment: Number(r.payment),
      date: fmtDate(r.created_at),
    })),
    sale_returns: returns.map((r) => ({
      return_id: Number(r.return_id),
      bill_no: `SR-${r.return_id}`,
      linked_sale_id: r.sale_id != null ? Number(r.sale_id) : null,
      account: r.cus_name,
      cus_id: Number(r.cus_id),
      total_amount: Number(r.total_amount),
      date: fmtDate(r.created_at),
      reason: r.reason,
    })),
    purchases: purchases.map((r) => ({
      pur_id: Number(r.pur_id),
      invoice_number: r.invoice_number,
      account: r.cus_name,
      cus_id: Number(r.cus_id),
      net_total: Number(r.net_total),
      total_amount: Number(r.total_amount),
      payment: Number(r.payment),
      date: fmtDate(r.created_at),
    })),
    purchase_returns: purReturns.map((r) => ({
      return_id: Number(r.return_id),
      bill_no: `PR-${r.return_id}`,
      pur_id: r.pur_id != null ? Number(r.pur_id) : null,
      account: r.cus_name,
      cus_id: Number(r.cus_id),
      total_return_amount: Number(r.total_return_amount),
      date: fmtDate(r.created_at),
    })),
  };

  const outPath = path.join(__dirname, 'missing-ledger-bills-report.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nFull report written to: ${outPath}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
