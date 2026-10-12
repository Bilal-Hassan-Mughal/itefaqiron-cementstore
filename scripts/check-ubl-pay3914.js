const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const pay3914 = await p.ledger.count({ where: { bill_no: 'PAY-3914' } });
  console.log('PAY-3914 rows anywhere:', pay3914);

  const around = await p.ledger.findMany({
    where: {
      cus_id: 1650,
      created_at: {
        gte: new Date('2026-10-07T00:00:00Z'),
        lte: new Date('2026-10-09T23:59:59Z'),
      },
    },
    orderBy: { l_id: 'asc' },
    select: { l_id: true, bill_no: true, debit_amount: true, credit_amount: true, closing_balance: true, details: true },
  });
  console.log('\nUBL Oct 7-9 entries:', around.length);
  for (const e of around) {
    console.log(`l_id=${e.l_id} ${e.bill_no} D=${e.debit_amount} C=${e.credit_amount} bal=${e.closing_balance}`);
  }

  const last = await p.ledger.findFirst({
    where: { cus_id: 1650 },
    orderBy: { l_id: 'desc' },
    select: { l_id: true, closing_balance: true, bill_no: true },
  });
  console.log('\nUBL last ledger row:', last);
  const cust = await p.customer.findUnique({ where: { cus_id: 1650 } });
  console.log('UBL stored cus_balance:', cust.cus_balance);
  await p.$disconnect();
})();
