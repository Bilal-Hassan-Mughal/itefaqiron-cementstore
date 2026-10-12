/** Recalculate opening/closing for one customer (batched updates). */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BATCH = 80;

async function recalcCustomer(cusId) {
  const entries = await prisma.ledger.findMany({
    where: { cus_id: cusId },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
  });
  entries.sort((a, b) => {
    const t = a.created_at.getTime() - b.created_at.getTime();
    if (t !== 0) return t;
    const billA = parseInt(String(a.bill_no || '').replace(/\D/g, '')) || 0;
    const billB = parseInt(String(b.bill_no || '').replace(/\D/g, '')) || 0;
    if (billA !== billB) return billA - billB;
    return a.l_id - b.l_id;
  });

  let running = entries.length ? parseFloat(entries[0].opening_balance || 0) : 0;
  const updates = [];

  for (const entry of entries) {
    const opening = running;
    const debit = parseFloat(entry.debit_amount || 0);
    const credit = parseFloat(entry.credit_amount || 0);
    const closing = opening + debit - credit;
    if (
      Math.abs(parseFloat(entry.opening_balance) - opening) > 0.01 ||
      Math.abs(parseFloat(entry.closing_balance) - closing) > 0.01
    ) {
      updates.push({
        l_id: entry.l_id,
        opening_balance: Number(opening.toFixed(2)),
        closing_balance: Number(closing.toFixed(2)),
      });
    }
    running = closing;
  }

  for (let i = 0; i < updates.length; i += BATCH) {
    const slice = updates.slice(i, i + BATCH);
    await prisma.$transaction(
      async (tx) => {
        for (const u of slice) {
          await tx.ledger.update({
            where: { l_id: u.l_id },
            data: {
              opening_balance: u.opening_balance,
              closing_balance: u.closing_balance,
            },
          });
        }
      },
      { timeout: 120000 }
    );
  }

  await prisma.customer.update({
    where: { cus_id: cusId },
    data: { cus_balance: Number(running.toFixed(2)) },
  });

  console.log(
    `cus_id ${cusId}: ${entries.length} rows, ${updates.length} fixed, balance ${Number(running.toFixed(2))}`
  );
}

const cusId = parseInt(process.argv[2], 10);
if (!Number.isFinite(cusId)) {
  console.error('Usage: node scripts/recalc-customer-fast.js <cus_id>');
  process.exit(1);
}

recalcCustomer(cusId)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
