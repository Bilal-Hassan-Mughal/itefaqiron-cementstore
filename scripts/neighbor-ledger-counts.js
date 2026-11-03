const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  for (const id of [441, 442, 443, 444, 445]) {
    const c = await p.ledger.count({ where: { bill_no: String(id) } });
    const cust = await p.ledger.count({ where: { bill_no: String(id), cus_id: (await p.sale.findUnique({ where: { sale_id: id }, select: { cus_id: true } }))?.cus_id } });
    console.log('sale', id, 'ledger rows', c, 'on customer', cust);
  }
  const u = await p.users.findUnique({ where: { user_id: 6 }, select: { full_name: true, email: true } });
  console.log('created by user 6:', u);
})()
  .finally(() => p.$disconnect());
