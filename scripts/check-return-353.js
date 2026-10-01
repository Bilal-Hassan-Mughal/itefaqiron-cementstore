require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const sr = await prisma.saleReturn.findUnique({
    where: { return_id: 353 },
    include: { customer: { include: { customer_category: true } } },
  });
  console.log('Return 353:', {
    cus_id: sr?.cus_id,
    customer: sr?.customer?.cus_name,
    category: sr?.customer?.customer_category?.cus_cat_title,
    total: sr?.total_amount,
    shipping: sr?.shipping_amount,
    labour: sr?.labour_charges,
    payment: sr?.payment,
    sale_id: sr?.sale_id,
  });
  const led = await prisma.ledger.findMany({
    where: { bill_no: '353' },
    orderBy: { l_id: 'asc' },
  });
  for (const e of led) {
    const c = await prisma.customer.findUnique({
      where: { cus_id: e.cus_id },
      include: { customer_category: true },
    });
    console.log({
      l_id: e.l_id,
      account: c?.cus_name,
      cat: c?.customer_category?.cus_cat_title,
      d: e.debit_amount,
      c: e.credit_amount,
      details: e.details?.slice(0, 70),
    });
  }
}

main()
  .catch((e) => console.error(e.message))
  .finally(() => prisma.$disconnect());
