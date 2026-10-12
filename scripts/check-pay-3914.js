const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const pay = await p.payment.findUnique({ where: { payment_id: 3914 } });
  const rows = await p.ledger.findMany({
    where: { bill_no: 'PAY-3914' },
    include: { customer: { select: { cus_name: true } } },
    orderBy: { l_id: 'asc' },
  });
  const maple = await p.customer.findUnique({ where: { cus_id: 2580 } });
  const ubl = await p.customer.findUnique({ where: { cus_id: 1650 } });
  console.log('=== PAY-3914 payment record ===');
  console.log(pay);
  console.log('\n=== PAY-3914 ledger rows ===');
  for (const r of rows) {
    console.log(
      `l_id=${r.l_id} ${r.customer.cus_name} D=${r.debit_amount} C=${r.credit_amount} close=${r.closing_balance} bank_pay=${r.bank_payment} | ${r.details}`
    );
  }
  console.log('\n=== Balances ===');
  console.log('mapleleaf cement:', maple?.cus_balance);
  console.log('Ubl bank:', ubl?.cus_balance);
  const latestMaple = await p.ledger.findMany({
    where: { cus_id: 2580 },
    orderBy: { l_id: 'desc' },
    take: 5,
    select: { l_id: true, bill_no: true, debit_amount: true, credit_amount: true, closing_balance: true },
  });
  console.log('\n=== Latest mapleleaf ledger ===');
  console.log(latestMaple);
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
