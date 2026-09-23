const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectSale5601() {
  const s = await prisma.sale.findUnique({
    where: { sale_id: 5601 },
    include: { customer: true, sale_details: true }
  });
  console.log('Sale 5601:', {
    sale_id: s.sale_id,
    bill_number: s.bill_number,
    bill_type: s.bill_type,
    total_amount: s.total_amount,
    payment: s.payment,
    cash_payment: s.cash_payment,
    bank_payment: s.bank_payment,
    advance_payment: s.advance_payment,
    customer: s.customer?.cus_name,
    created_at: s.created_at
  });

  const ledgers = await prisma.ledger.findMany({
    where: { bill_no: '5601' }
  });
  console.log('Ledgers with bill_no 5601:', ledgers);

  const ledgers201 = await prisma.ledger.findMany({
    where: { bill_no: '201' }
  });
  console.log('Ledgers with bill_no 201:', ledgers201);

  await prisma.$disconnect();
}

inspectSale5601().catch(console.error);
