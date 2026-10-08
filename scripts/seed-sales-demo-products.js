/**
 * Demo products for Sales / Product list — branch 10 (DEMO) by default.
 * Mirrors POST /api/products: category + subcategory + prices + pro_stock_qnty + store_stocks.
 *
 *   node scripts/seed-sales-demo-products.js
 *   node scripts/seed-sales-demo-products.js 1
 */
/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function setStoreStock(storeId, proId, qty, userId) {
  const sid = parseInt(storeId, 10);
  const pid = parseInt(proId, 10);
  const q = parseFloat(qty);
  await prisma.$executeRaw`
    INSERT INTO store_stocks (store_id, pro_id, stock_quantity, min_stock, max_stock, updated_by, created_at, updated_at)
    VALUES (${sid}, ${pid}, ${q}, 0, 1000, ${userId}, NOW(), NOW())
    ON DUPLICATE KEY UPDATE stock_quantity = ${q}, updated_at = NOW(), updated_by = ${userId}
  `;
}
const BRANCH_ID = parseInt(process.argv[2] || '10', 10);

async function nextId(model, field) {
  const r = await prisma[model].aggregate({ _max: { [field]: true } });
  return (r._max[field] || 0) + 1;
}

async function ensureCategory(name, code) {
  let row = await prisma.categories.findFirst({ where: { cat_code: code } });
  if (!row) {
    row = await prisma.categories.create({
      data: {
        cat_id: await nextId('categories', 'cat_id'),
        branch_id: BRANCH_ID,
        cat_name: name,
        cat_code: code,
      },
    });
    console.log('  + category:', name);
  }
  return row;
}

async function ensureSubCategory(catId, name, code) {
  let row = await prisma.subCategory.findFirst({ where: { sub_cat_code: code } });
  if (!row) {
    row = await prisma.subCategory.create({
      data: {
        sub_cat_id: await nextId('subCategory', 'sub_cat_id'),
        branch_id: BRANCH_ID,
        cat_id: catId,
        sub_cat_name: name,
        sub_cat_code: code,
      },
    });
    console.log('  + subcategory:', name);
  }
  return row;
}

async function resolveUserId() {
  const u = await prisma.users.findFirst({ where: { branch_id: BRANCH_ID } })
    || await prisma.users.findFirst();
  return u?.user_id ?? 1;
}

/**
 * @see src/app/dashboard/products/page.js — pro_crate often mirrors purchase cost; pro_baser_price = sale/base rate
 */
const PRODUCT_CATALOG = [
  {
    category: { name: 'Demo — Steel & Saria', code: `B${BRANCH_ID}_STEEL` },
    sub: { name: 'Grade 60 Saria (12mm)', code: `B${BRANCH_ID}_SARIA12` },
    title: 'Demo — Mughal Grade-60 Saria 12mm (3 Sutar)',
    description: 'Deformed bar 3/8 inch · per kg pricing',
    cost: 268,
    sale: 285,
    baser: 285,
    crate: 268,
    stock: 8500,
    unit: 'kg',
    packing: 'Bundle',
    lowStock: 500,
  },
  {
    category: { name: 'Demo — Steel & Saria', code: `B${BRANCH_ID}_STEEL` },
    sub: { name: 'Grade 60 Saria (16mm)', code: `B${BRANCH_ID}_SARIA16` },
    title: 'Demo — Ittefaq Grade-60 Saria 16mm (1/2 Sutar)',
    description: 'Deformed bar 1/2 inch',
    cost: 265,
    sale: 282,
    baser: 282,
    crate: 265,
    stock: 6200,
    unit: 'kg',
    packing: 'Bundle',
    lowStock: 400,
  },
  {
    category: { name: 'Demo — Steel & Saria', code: `B${BRANCH_ID}_STEEL` },
    sub: { name: 'Binding Wire', code: `B${BRANCH_ID}_WIRE` },
    title: 'Demo — Steel Binding Wire 16 Gauge (Roll)',
    description: 'Construction binding wire',
    cost: 4200,
    sale: 4500,
    baser: 4500,
    crate: 4200,
    stock: 45,
    unit: 'roll',
    packing: '45kg roll',
    lowStock: 5,
  },
  {
    category: { name: 'Demo — Cement & Bujri', code: `B${BRANCH_ID}_CEMENT` },
    sub: { name: 'OPC 50kg Bag', code: `B${BRANCH_ID}_OPC` },
    title: 'Demo — Bestway OPC Cement 50kg Bag',
    description: 'Ordinary Portland Cement',
    cost: 1180,
    sale: 1250,
    baser: 1250,
    crate: 1180,
    stock: 1200,
    unit: 'bag',
    packing: '50kg',
    lowStock: 100,
  },
  {
    category: { name: 'Demo — Cement & Bujri', code: `B${BRANCH_ID}_CEMENT` },
    sub: { name: 'OPC 50kg Bag', code: `B${BRANCH_ID}_OPC` },
    title: 'Demo — Lucky Supreme Cement 50kg Bag',
    description: 'OPC cement bag',
    cost: 1200,
    sale: 1275,
    baser: 1275,
    crate: 1200,
    stock: 800,
    unit: 'bag',
    packing: '50kg',
    lowStock: 80,
  },
  {
    category: { name: 'Demo — Cement & Bujri', code: `B${BRANCH_ID}_CEMENT` },
    sub: { name: 'Margalla Bajri', code: `B${BRANCH_ID}_BAJRI` },
    title: 'Demo — Margalla Crush Bajri (Tractor Trolly)',
    description: '1/2 inch crush · per trolly',
    cost: 8500,
    sale: 9200,
    baser: 9200,
    crate: 8500,
    stock: 35,
    unit: 'trolly',
    packing: 'Tractor load',
    lowStock: 3,
  },
  {
    category: { name: 'Demo — Pipes & Garder', code: `B${BRANCH_ID}_PIPE` },
    sub: { name: 'MS Square Pipe', code: `B${BRANCH_ID}_SQPIPE` },
    title: 'Demo — MS Square Pipe 1.5" x 1.5" (20ft)',
    description: '16 gauge hollow section',
    cost: 1850,
    sale: 2100,
    baser: 2100,
    crate: 1850,
    stock: 120,
    unit: 'length',
    packing: '20 feet',
    lowStock: 10,
  },
  {
    category: { name: 'Demo — Pipes & Garder', code: `B${BRANCH_ID}_PIPE` },
    sub: { name: 'TR Channel', code: `B${BRANCH_ID}_TR` },
    title: 'Demo — TR Channel 4" x 2" (16 Gauge · per ft)',
    description: 'TR section iron',
    cost: 320,
    sale: 365,
    baser: 365,
    crate: 320,
    stock: 900,
    unit: 'ft',
    packing: 'Per foot',
    lowStock: 50,
  },
  {
    category: { name: 'Demo — Pipes & Garder', code: `B${BRANCH_ID}_PIPE` },
    sub: { name: 'Heavy Girder', code: `B${BRANCH_ID}_GIRDER` },
    title: 'Demo — Heavy Girder 7" x 4" (per ft)',
    description: 'I-beam girder',
    cost: 890,
    sale: 980,
    baser: 980,
    crate: 890,
    stock: 200,
    unit: 'ft',
    packing: 'Per foot',
    lowStock: 20,
  },
];

async function upsertProduct(def, catId, subCatId, userId) {
  let row = await prisma.product.findFirst({
    where: { branch_id: BRANCH_ID, pro_title: def.title },
  });

  const data = {
    cat_id: catId,
    sub_cat_id: subCatId,
    pro_title: def.title,
    pro_description: def.description,
    pro_cost_price: def.cost,
    pro_sale_price: def.sale,
    pro_baser_price: def.baser,
    pro_crate: def.crate,
    pro_stock_qnty: def.stock,
    low_stock_quantity: def.lowStock,
    pro_unit: def.unit,
    pro_packing: def.packing,
    updated_by: userId,
  };

  if (row) {
    row = await prisma.product.update({ where: { pro_id: row.pro_id }, data });
    console.log('  ✓ updated product:', def.title, `(pro_id ${row.pro_id})`);
  } else {
    row = await prisma.product.create({
      data: {
        pro_id: await nextId('product', 'pro_id'),
        branch_id: BRANCH_ID,
        ...data,
      },
    });
    console.log('  + product:', def.title, `(pro_id ${row.pro_id})`);
  }
  return row;
}

async function main() {
  const branch = await prisma.branch.findUnique({ where: { branch_id: BRANCH_ID } });
  if (!branch) {
    console.error('Branch not found:', BRANCH_ID);
    process.exit(1);
  }

  let store = await prisma.store.findFirst({ where: { branch_id: BRANCH_ID } });
  if (!store) {
    store = await prisma.store.create({
      data: { branch_id: BRANCH_ID, store_name: 'Main Store', store_address: 'Demo store' },
    });
    console.log('Created store', store.storeid);
  }

  const userId = await resolveUserId();
  console.log(`\nSeeding products — ${branch.branch_code} (${BRANCH_ID}), store "${store.store_name}" (${store.storeid})\n`);

  const catCache = new Map();
  const subCache = new Map();
  const summary = [];

  for (const def of PRODUCT_CATALOG) {
    const catKey = def.category.code;
    if (!catCache.has(catKey)) {
      catCache.set(catKey, await ensureCategory(def.category.name, def.category.code));
    }
    const cat = catCache.get(catKey);

    const subKey = def.sub.code;
    if (!subCache.has(subKey)) {
      subCache.set(subKey, await ensureSubCategory(cat.cat_id, def.sub.name, def.sub.code));
    }
    const sub = subCache.get(subKey);

    const product = await upsertProduct(def, cat.cat_id, sub.sub_cat_id, userId);
    await setStoreStock(store.storeid, product.pro_id, def.stock, userId);

    summary.push({
      pro_id: product.pro_id,
      title: def.title,
      category: def.category.name,
      sub: def.sub.name,
      cost: def.cost,
      sale: def.sale,
      stock: def.stock,
      unit: def.unit,
    });
  }

  // Top up existing demo cement if present
  const legacy = await prisma.product.findFirst({
    where: { branch_id: BRANCH_ID, pro_title: { contains: 'PAy pak' } },
  });
  if (legacy) {
    const qty = 500;
    await prisma.product.update({
      where: { pro_id: legacy.pro_id },
      data: { pro_stock_qnty: qty, pro_cost_price: 140, pro_sale_price: 200, pro_baser_price: 200, pro_crate: 140 },
    });
    await setStoreStock(store.storeid, legacy.pro_id, qty, userId);
    console.log(`\n  ✓ stocked existing "${legacy.pro_title}" → ${qty} bags`);
  }

  console.log('\n--- Product list summary ---\n');
  console.table(summary);
  console.log('\nOpen Dashboard → Products or Sales → pick store & product.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
