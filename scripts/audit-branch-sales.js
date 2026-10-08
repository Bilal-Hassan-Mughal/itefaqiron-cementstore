/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const j = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x), 2);

(async () => {
  for (const branchId of [8, 10]) {
    console.log('\n######## BRANCH', branchId, '########');
    const rows = await p.$queryRawUnsafe(`
      SELECT c.cus_id, c.cus_name, cat.cus_cat_title, typ.cus_type_title
      FROM customers c
      LEFT JOIN customer_categories cat ON c.cus_category = cat.cus_cat_id
      LEFT JOIN customer_types typ ON c.cus_type = typ.cus_type_id
      WHERE c.branch_id = ${branchId}
      ORDER BY c.cus_id
    `);
    console.log('accounts:', j(rows));
    const stores = await p.store.findMany({ where: { branch_id: branchId } });
    console.log('stores:', j(stores));
    const prods = await p.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM products WHERE branch_id = ${branchId}`);
    console.log('products:', Number(prods[0].n));
  }
  await p.$disconnect();
})();
