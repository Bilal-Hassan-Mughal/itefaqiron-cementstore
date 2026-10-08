const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const j = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x), 2);

(async () => {
  const tables = ['demo_products', 'demo_categories', 'demo_sub_categories', 'demo_store_stocks', 'demo_stores'];
  for (const t of tables) {
    try {
      const c = await p.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM \`${t}\``);
      console.log(t, 'count', Number(c[0].n));
    } catch (e) {
      console.log(t, e.message);
    }
  }
  const prods = await p.$queryRawUnsafe(`
    SELECT p.pro_id, p.pro_title, p.branch_id, p.cat_id, p.sub_cat_id,
      p.pro_cost_price, p.pro_sale_price, p.pro_baser_price, p.pro_stock_qnty, p.pro_unit,
      c.cat_name, sc.sub_cat_name
    FROM demo_products p
    LEFT JOIN demo_categories c ON p.cat_id = c.cat_id
    LEFT JOIN demo_sub_categories sc ON p.sub_cat_id = sc.sub_cat_id
    WHERE p.branch_id = 10 OR p.branch_id = 8
    ORDER BY p.pro_id
  `);
  console.log('\ndemo_products:', j(prods));
  const cats = await p.$queryRawUnsafe(`SELECT cat_id, branch_id, cat_name, cat_code FROM demo_categories ORDER BY cat_id LIMIT 20`);
  console.log('\ndemo_categories:', j(cats));
  const subs = await p.$queryRawUnsafe(`SELECT sub_cat_id, cat_id, sub_cat_name FROM demo_sub_categories LIMIT 30`);
  console.log('\ndemo_sub_categories:', j(subs));
  await p.$disconnect();
})();
