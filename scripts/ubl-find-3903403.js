const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const TARGET = 3903403;

async function main() {
  const hits = await prisma.ledger.findMany({
    where: {
      cus_id: 1650,
      closing_balance: { gte: TARGET - 100, lte: TARGET + 100 },
    },
    select: { l_id: true, bill_no: true, closing_balance: true, created_at: true, debit_amount: true, credit_amount: true },
    orderBy: { l_id: 'asc' },
    take: 20,
  });
  console.log('Ledger rows with closing ~3903403:', hits.length);
  for (const h of hits) console.log(h);

  const custHits = await prisma.customer.findMany({
    where: { cus_balance: { gte: TARGET - 100, lte: TARGET + 100 } },
    select: { cus_id: true, cus_name: true, cus_balance: true },
  });
  console.log('\nCustomers with balance ~3903403:', custHits);

  const oct11Debit = await prisma.ledger.aggregate({
    where: { cus_id: 1650, created_at: { gte: new Date('2026-10-11T00:00:00Z'), lte: new Date('2026-10-11T23:59:59Z') } },
    _sum: { debit_amount: true, credit_amount: true },
  });
  console.log('\nOct 11 UBL sum D/C:', oct11Debit._sum);

  const oct10Close = await prisma.ledger.findMany({
    where: { cus_id: 1650, created_at: { lte: new Date('2026-10-10T23:59:59Z') } },
    orderBy: { l_id: 'desc' },
    take: 1,
    select: { l_id: true, closing_balance: true, created_at: true },
  });
  console.log('Last UBL row on/before Oct 10:', oct10Close[0]);
  console.log('Oct 11 net + Oct10 close =', parseFloat(oct10Close[0]?.closing_balance || 0) + parseFloat(oct11Debit._sum.debit_amount || 0) - parseFloat(oct11Debit._sum.credit_amount || 0));
}

main().finally(() => prisma.$disconnect());
