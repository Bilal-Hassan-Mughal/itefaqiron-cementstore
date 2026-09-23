const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testQuery() {
  console.log('Testing Prisma queries against restored database...');
  const users = await prisma.users.count();
  const customers = await prisma.customer.count();
  const sales = await prisma.sale.count();
  const ledger = await prisma.ledger.count();
  const products = await prisma.product.count();
  const recentSales = await prisma.sale.findMany({
    take: 3,
    orderBy: { sale_id: 'desc' },
    select: { sale_id: true, bill_number: true, total_amount: true, created_at: true },
  });

  console.log({
    users,
    customers,
    sales,
    ledger,
    products,
    recentSales,
  });

  await prisma.$disconnect();
}

testQuery().catch((err) => {
  console.error('Prisma query test failed:', err);
  process.exit(1);
});
