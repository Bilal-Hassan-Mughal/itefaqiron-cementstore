const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const SALE_ID = 443;

async function q(sql, ...params) {
  return prisma.$queryRawUnsafe(sql, ...params);
}

async function main() {
  const sale = await prisma.sale.findUnique({ where: { sale_id: SALE_ID } });
  console.log('=== SALE 443 timestamps ===');
  console.log('created_at', sale?.created_at?.toISOString());
  console.log('updated_at', sale?.updated_at?.toISOString());
  console.log('updated_by', sale?.updated_by);

  const logRange = await q(
    `SELECT MIN(created_at) AS first_log, MAX(created_at) AS last_log, COUNT(*) AS cnt FROM activity_logs`
  );
  console.log('\n=== ACTIVITY_LOGS TABLE ===');
  console.log(logRange[0]);

  const patterns = [
    [`entity_id = ?`, String(SALE_ID)],
    [`entity_id = ?`, '443'],
    [`description LIKE ?`, `%#443%`],
    [`description LIKE ?`, `%Sale/Invoice #443%`],
    [`description LIKE ?`, `%Invoice #443%`],
    [`CAST(details AS CHAR) LIKE ?`, `%"sale_id":443%`],
    [`CAST(details AS CHAR) LIKE ?`, `%"sale_id":"443"%`],
    [`CAST(details AS CHAR) LIKE ?`, `%443%`],
  ];

  for (const [clause, val] of patterns) {
    const rows = await q(
      `SELECT log_id, created_at, user_name, action, module, entity_id, description
       FROM activity_logs WHERE ${clause} ORDER BY created_at DESC LIMIT 15`,
      val
    );
    if (rows.length) {
      console.log(`\n--- activity_logs WHERE ${clause} = ${val} (${rows.length}) ---`);
      rows.forEach((r) => {
        console.log(
          r.created_at,
          r.user_name,
          r.action,
          r.module,
          'entity',
          r.entity_id,
          String(r.description || '').slice(0, 100)
        );
      });
    }
  }

  const salesModule = await q(
    `SELECT log_id, created_at, user_name, action, entity_id, description
     FROM activity_logs
     WHERE module LIKE '%Sales%' AND (entity_id = '443' OR description LIKE '%443%')
     ORDER BY created_at DESC LIMIT 30`
  );
  console.log('\n=== Sales module + 443 ===', salesModule.length);
  salesModule.forEach((r) =>
    console.log(r.created_at, r.action, r.user_name, r.description?.slice(0, 120))
  );

  const ledgerDeletes = await q(
    `SELECT log_id, created_at, user_name, action, module, entity_id, description
     FROM activity_logs
     WHERE action = 'DELETE' AND (
       description LIKE '%ledger%' OR module LIKE '%Ledger%' OR module LIKE '%Finance%'
       OR CAST(details AS CHAR) LIKE '%443%'
     )
     ORDER BY created_at DESC LIMIT 40`
  );
  console.log('\n=== DELETE actions (ledger/finance/443 in details) ===', ledgerDeletes.length);
  ledgerDeletes.forEach((r) =>
    console.log(r.created_at, r.module, r.user_name, r.description?.slice(0, 120))
  );

  const customer629 = await q(
    `SELECT log_id, created_at, user_name, action, module, description
     FROM activity_logs
     WHERE (description LIKE '%629%' OR CAST(details AS CHAR) LIKE '%629%')
       AND (description LIKE '%443%' OR CAST(details AS CHAR) LIKE '%443%')
     ORDER BY created_at DESC LIMIT 20`
  );
  console.log('\n=== logs mentioning 629 and 443 ===', customer629.length);
  customer629.forEach((r) => console.log(r.created_at, r.action, r.description?.slice(0, 120)));

  // Neighbor sales ledger: do 442 and 444 have ledger?
  for (const sid of [442, 443, 444]) {
    const c = await prisma.ledger.count({ where: { bill_no: String(sid) } });
    const s = await prisma.sale.findUnique({ where: { sale_id: sid }, select: { created_at: true, cus_id: true } });
    console.log(`\nSale ${sid}: ledger rows bill_no=${sid}: ${c}`, s ? `cus ${s.cus_id} @ ${s.created_at.toISOString()}` : 'NO SALE');
  }

  // l_id gaps around Jun 24 2026 for cus 629 — infer deleted ids if any
  const jun629 = await prisma.ledger.findMany({
    where: {
      cus_id: 629,
      created_at: { gte: new Date('2026-06-24T00:00:00Z'), lte: new Date('2026-06-25T23:59:59Z') },
    },
    orderBy: { l_id: 'asc' },
    select: { l_id: true, bill_no: true, debit_amount: true, credit_amount: true, created_at: true, details: true },
  });
  console.log('\n=== cus 629 ledger Jun 24-25 2026 ===');
  jun629.forEach((r) =>
    console.log(r.l_id, r.bill_no, r.debit_amount, r.credit_amount, r.created_at.toISOString().slice(11, 19))
  );

  const missingBills = await q(
    `SELECT s.sale_id, s.created_at, s.cus_id, s.total_amount,
            (SELECT COUNT(*) FROM ledger l WHERE l.bill_no COLLATE utf8mb4_unicode_ci = CAST(s.sale_id AS CHAR) COLLATE utf8mb4_unicode_ci) AS lc
     FROM sales s
     WHERE s.bill_type = 'BILL' AND s.created_at >= '2026-06-24' AND s.created_at < '2026-06-25'
     HAVING lc = 0
     ORDER BY s.sale_id`
  );
  console.log('\n=== BILL sales on 2026-06-24 with ZERO ledger rows ===', missingBills.length);
  missingBills.slice(0, 25).forEach((x) =>
    console.log(x.sale_id, 'cus', x.cus_id, 'total', x.total_amount, x.created_at)
  );
  const has443 = missingBills.some((x) => Number(x.sale_id) === SALE_ID);
  console.log('Sale 443 in missing list:', has443);

  const withLedgerSameDay = await q(
    `SELECT COUNT(*) AS c FROM sales s
     WHERE s.bill_type = 'BILL' AND s.created_at >= '2026-06-24' AND s.created_at < '2026-06-25'
       AND EXISTS (SELECT 1 FROM ledger l WHERE l.bill_no COLLATE utf8mb4_unicode_ci = CAST(s.sale_id AS CHAR) COLLATE utf8mb4_unicode_ci)`
  );
  const totalBills = await q(
    `SELECT COUNT(*) AS c FROM sales s
     WHERE s.bill_type = 'BILL' AND s.created_at >= '2026-06-24' AND s.created_at < '2026-06-25'`
  );
  console.log(
    'Jun 24 BILLs with ledger:',
    Number(withLedgerSameDay[0].c),
    '/',
    Number(totalBills[0].c)
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
