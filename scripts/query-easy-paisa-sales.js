const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  for (const id of [871, 876, 4946, 8069]) {
    const s = await p.sale.findUnique({ where: { sale_id: id }, select: { sale_id: true, total_amount: true, payment: true, created_at: true } });
    console.log('sale', id, s);
  }
  await p.$disconnect();
})();
