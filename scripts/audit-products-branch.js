/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const BR = parseInt(process.argv[2] || '10', 10);
const j = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x), 2);

(async () => {
  const branch = await p.branch.findUnique({ where: { branch_id: BR } });
  console.log('Branch:', branch?.branch_code, BR, branch?.isolation_mode, branch?.table_prefix);

  const cats = await p.categories.findMany({ where: { branch_id: BR }, take: 20 });
  console.log('\nCategories branch', BR, ':', cats.length ? j(cats) : '(none — may use shared cat ids)');

  const catsAll = await p.categories.findMany({ take: 15, orderBy: { cat_id: 'asc' } });
  console.log('\nSample global categories:', j(catsAll.map((c) => ({ cat_id: c.cat_id, name: c.cat_name, branch_id: c.branch_id }))));

  const prods = await p.product.findMany({
    where: { branch_id: BR },
    include: { category: true, sub_category: true, store_stocks: true },
    take: 10,
  });
  console.log('\nProducts on branch', BR, ':', prods.length, 'shown:', j(prods.map((pr) => ({
    pro_id: pr.pro_id,
    title: pr.pro_title,
    cat: pr.category?.cat_name,
    sub: pr.sub_category?.sub_cat_name,
    cost: pr.pro_cost_price,
    sale: pr.pro_sale_price,
    baser: pr.pro_baser_price,
    stock: pr.pro_stock_qnty,
    store_stocks: pr.store_stocks,
  }))));

  const stores = await p.store.findMany({ where: { branch_id: BR } });
  console.log('\nStores:', j(stores));

  if (branch?.table_prefix) {
    const physical = `${branch.table_prefix}_products`;
    try {
      const demo = await p.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM \`${physical}\``);
      console.log(`\nPrefixed table ${physical} count:`, Number(demo[0].n));
    } catch (e) {
      console.log('Prefixed products:', e.message);
    }
  }

  await p.$disconnect();
})();
