const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectPay3332() {
  const p = await prisma.payment.findUnique({ where: { payment_id: 3332 } });
  console.log('Payment 3332 in payments table:', p);
  const ledgers = await prisma.ledger.findMany({ where: { bill_no: 'PAY-3332' } });
  console.log('Ledgers for PAY-3332:');
  for (const l of ledgers) {
    console.log({
      l_id: l.l_id,
      cus_id: l.cus_id,
      debit: l.debit_amount,
      credit: l.credit_amount,
      details: l.details,
      created_at: l.created_at
    });
  }

  // Also check all payments and receipts for "govt girls high school santhal" today
  const customer = await prisma.customer.findFirst({
    where: { cus_name: { contains: 'govt girls high school santhal' } }
  });
  console.log('\nCustomer:', customer ? { id: customer.cus_id, name: customer.cus_name, balance: customer.cus_balance } : 'Not found');

  if (customer) {
    const custLedgers = await prisma.ledger.findMany({
      where: { cus_id: customer.cus_id },
      orderBy: { l_id: 'desc' },
      take: 5
    });
    console.log('\nCustomer ledger entries (last 5):', custLedgers.map(l => ({
      l_id: l.l_id,
      bill_no: l.bill_no,
      debit: l.debit_amount,
      credit: l.credit_amount,
      opening: l.opening_balance,
      closing: l.closing_balance,
      details: l.details,
      date: l.created_at
    })));
  }

  await prisma.$disconnect();
}

inspectPay3332().catch(console.error);
