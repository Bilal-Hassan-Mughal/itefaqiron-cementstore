const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectPay3339() {
  const ledgers = await prisma.ledger.findMany({ where: { bill_no: 'PAY-3339' } });
  console.log('Ledgers for PAY-3339:');
  for (const l of ledgers) {
    console.log({
      l_id: l.l_id,
      cus_id: l.cus_id,
      debit: l.debit_amount,
      credit: l.credit_amount,
      details: l.details
    });
  }

  // Also check all discounts booked today
  const discountEntries = await prisma.ledger.findMany({
    where: {
      created_at: { gte: new Date('2026-09-22T19:00:00.000Z') },
      details: { contains: 'Discount' }
    }
  });
  console.log('\nDiscount entries today:');
  for (const d of discountEntries) {
    console.log({
      l_id: d.l_id,
      cus_id: d.cus_id,
      bill_no: d.bill_no,
      debit: d.debit_amount,
      credit: d.credit_amount,
      details: d.details
    });
  }

  await prisma.$disconnect();
}

inspectPay3339().catch(console.error);
