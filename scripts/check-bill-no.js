const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLedgerBillNo() {
  const sample = await prisma.ledger.findMany({
    where: { cus_id: 2551, created_at: { gte: new Date('2026-09-23T00:00:00.000Z') } },
    take: 15,
    select: { l_id: true, bill_no: true, details: true, debit_amount: true, credit_amount: true }
  });
  console.log('Sample Cash Account ledger entries for today:');
  console.log(sample);

  // Check sale 5634
  const sale5634 = await prisma.sale.findUnique({
    where: { sale_id: 5634 }
  });
  console.log('\nSale 5634:', {
    sale_id: sale5634.sale_id,
    bill_number: sale5634.bill_number,
    total_amount: sale5634.total_amount,
    payment: sale5634.payment,
    cash_payment: sale5634.cash_payment,
    bank_payment: sale5634.bank_payment
  });

  const ledgerFor5634 = await prisma.ledger.findMany({
    where: { bill_no: '5634' }
  });
  console.log('Ledger entries where bill_no = 5634:');
  console.log(ledgerFor5634.map(l => ({
    l_id: l.l_id,
    cus_id: l.cus_id,
    bill_no: l.bill_no,
    debit: l.debit_amount,
    credit: l.credit_amount,
    details: l.details
  })));

  await prisma.$disconnect();
}

checkLedgerBillNo().catch(console.error);
