const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectSept22() {
  const cashCust = await prisma.customer.findFirst({ where: { cus_name: 'Cash Account' } });
  const entries = await prisma.ledger.findMany({
    where: {
      cus_id: cashCust.cus_id,
      created_at: {
        gte: new Date('2026-09-22T00:00:00.000Z'),
        lte: new Date('2026-09-22T23:59:59.999Z')
      }
    },
    orderBy: [
      { created_at: 'asc' },
      { l_id: 'asc' }
    ]
  });

  console.log(`Sept 22 entries: ${entries.length}`);
  console.log('l_id  | created_at           | bill_no   | opening       | debit       | credit      | closing       | details');
  console.log('----------------------------------------------------------------------------------------------------------------------');
  for (const e of entries) {
    const time = e.created_at.toISOString().slice(11, 19);
    const bill = (e.bill_no || '').padEnd(9);
    const op = String(e.opening_balance.toFixed(2)).padStart(13);
    const deb = String(e.debit_amount.toFixed(2)).padStart(11);
    const cr = String(e.credit_amount.toFixed(2)).padStart(11);
    const cl = String(e.closing_balance.toFixed(2)).padStart(13);
    const det = (e.details || '').slice(0, 40);
    console.log(`${e.l_id} | ${time} | ${bill} | ${op} | ${deb} | ${cr} | ${cl} | ${det}`);
  }

  await prisma.$disconnect();
}

inspectSept22().catch(console.error);
