const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listTodayCashEntries() {
  const todayStart = new Date('2026-09-22T19:00:00.000Z');
  const todayEnd = new Date('2026-09-23T18:59:59.999Z');

  const entries = await prisma.ledger.findMany({
    where: {
      cus_id: 2551,
      created_at: { gte: todayStart, lte: todayEnd }
    },
    orderBy: [
      { created_at: 'asc' },
      { l_id: 'asc' }
    ]
  });

  console.log(`=== ALL TODAY CASH ACCOUNT TRANSACTIONS (${entries.length}) ===\n`);
  console.log('l_id  | time     | bill_no   | type   | amount      | running_bal | details');
  console.log('-------------------------------------------------------------------------------------------------------------');

  let running = 23275.10;
  for (const e of entries) {
    const time = e.created_at.toISOString().slice(11, 19);
    const bill = (e.bill_no || '').padEnd(9);
    const isDebit = Number(e.debit_amount) > 0;
    const type = isDebit ? 'IN (+)' : 'OUT(-)';
    const amt = isDebit ? Number(e.debit_amount) : Number(e.credit_amount);
    running = isDebit ? running + amt : running - amt;
    const det = (e.details || '').slice(0, 50);
    console.log(`${e.l_id} | ${time} | ${bill} | ${type} | ${amt.toFixed(2).padStart(11)} | ${running.toFixed(2).padStart(11)} | ${det}`);
  }

  await prisma.$disconnect();
}

listTodayCashEntries().catch(console.error);
