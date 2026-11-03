const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const SALE_ID = 443;
const CUS_ID = 629;

async function main() {
  const sale = await prisma.sale.findUnique({
    where: { sale_id: SALE_ID },
    include: { customer: true, sale_details: { include: { product: true } } },
  });

  const byAmount = await prisma.ledger.findMany({
    where: {
      cus_id: CUS_ID,
      OR: [
        { debit_amount: { in: [126900, 129600, 2700] } },
        { details: { contains: String(SALE_ID) } },
        { bill_no: String(SALE_ID) },
      ],
    },
    orderBy: { l_id: 'asc' },
  });

  const sr443 = await prisma.saleReturn.findUnique({
    where: { return_id: 443 },
    include: { return_details: { include: { product: true } } },
  });

  let activity = [];
  try {
    activity = await prisma.$queryRaw`
      SELECT created_at, action, module, description
      FROM activity_logs
      WHERE description LIKE ${'%443%'} OR CAST(details AS CHAR) LIKE ${'%443%'}
      ORDER BY created_at DESC
      LIMIT 25`;
  } catch (e) {
    console.log('activity query skip:', e.message);
  }

  console.log('=== SALE ROW ===');
  console.log(JSON.stringify(sale, (k, v) => (typeof v === 'bigint' ? v.toString() : v), 2));

  console.log('\n=== LEDGER cus 629 (443 / amounts / details) ===');
  console.log('count', byAmount.length);
  byAmount.forEach((r) => {
    console.log(
      `l_id ${r.l_id} | bill ${r.bill_no} | ${r.ledger_type || '-'} | D ${r.debit_amount} C ${r.credit_amount} | ${r.created_at.toISOString()}`
    );
    console.log(' ', r.details);
  });

  console.log('\n=== SALE RETURN return_id 443 ===');
  console.log(JSON.stringify(sr443, null, 2));

  console.log('\n=== ACTIVITY (443) ===');
  activity.forEach((a) => {
    const t = a.created_at instanceof Date ? a.created_at.toISOString() : String(a.created_at);
    console.log(t, a.action, a.module, String(a.description || '').slice(0, 120));
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
