/**
 * Three sample BUYER accounts for the Sales page — each uses a different
 * Customer Type filter (category is always "Customers" for sale customers).
 *
 *   node scripts/seed-sales-demo-buyers.js      → branch 10 (DEMO)
 *   node scripts/seed-sales-demo-buyers.js 1    → MAIN
 */
/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const BRANCH_ID = parseInt(process.argv[2] || '10', 10);

async function nextId(model, field) {
  const r = await prisma[model].aggregate({ _max: { [field]: true } });
  return (r._max[field] || 0) + 1;
}

async function ensureCategory(title) {
  let cat = await prisma.customerCategory.findFirst({ where: { cus_cat_title: title } });
  if (!cat) {
    const id = await nextId('customerCategory', 'cus_cat_id');
    cat = await prisma.customerCategory.create({
      data: { cus_cat_id: id, branch_id: BRANCH_ID, cus_cat_title: title },
    });
  }
  return cat;
}

async function ensureType(title) {
  let typ = await prisma.customerType.findFirst({ where: { cus_type_title: title } });
  if (!typ) {
    const id = await nextId('customerType', 'cus_type_id');
    typ = await prisma.customerType.create({
      data: { cus_type_id: id, branch_id: BRANCH_ID, cus_type_title: title },
    });
    console.log('  + customer type:', title);
  }
  return typ;
}

/** Matches src/app/dashboard/sales/components/sale-utils.js SALE_PAGE_CUSTOMER_TYPE_RULES */
const DEMO_BUYERS = [
  {
    name: 'Demo — Walk-in Buyer',
    categoryTitle: 'Customers',
    typeTitle: 'Walkin Customer',
    phone: '0300-1000001',
    address: 'Counter sale / no credit',
    note: 'Sales filter: "Walk in Customer" · isWalkinCustomer ≈ true',
  },
  {
    name: 'Demo — Cement Shop (Sargodha)',
    categoryTitle: 'Customers',
    typeTitle: 'Cement',
    phone: '0300-1000002',
    address: 'GT Road, Sargodha',
    note: 'Sales filter: "Cement" · credit customer (shows balance on bill)',
  },
  {
    name: 'Demo — Home Construction (Pahrian Wali)',
    categoryTitle: 'Customers',
    typeTitle: 'Homes',
    phone: '0300-1000003',
    address: 'Mohalla Islamabad, Pahrian Wali',
    note: 'Sales filter: "Homes" · credit customer',
  },
];

async function main() {
  const branch = await prisma.branch.findUnique({ where: { branch_id: BRANCH_ID } });
  if (!branch) {
    console.error('Branch not found:', BRANCH_ID);
    process.exit(1);
  }
  console.log(`\nSales demo buyers — branch ${branch.branch_code} (${BRANCH_ID})\n`);
  console.log('Category for all sale customers: Customers (not Bank / Transport / Supplier)\n');

  const city =
    (await prisma.city.findFirst({ where: { branch_id: BRANCH_ID } }))
    || (await prisma.city.findFirst());

  const results = [];

  for (const def of DEMO_BUYERS) {
    console.log(`— ${def.name}`);
    console.log(`    ${def.note}`);
    const cat = await ensureCategory(def.categoryTitle);
    const typ = await ensureType(def.typeTitle);

    let row = await prisma.customer.findFirst({
      where: { branch_id: BRANCH_ID, cus_name: def.name },
    });
    if (!row) {
      const cusId = await nextId('customer', 'cus_id');
      row = await prisma.customer.create({
        data: {
          cus_id: cusId,
          branch_id: BRANCH_ID,
          cus_name: def.name,
          cus_phone_no: def.phone,
          cus_address: def.address,
          cus_balance: 0,
          cus_category: cat.cus_cat_id,
          cus_type: typ.cus_type_id,
          city_id: city?.city_id ?? null,
        },
      });
      console.log(`    + created cus_id ${row.cus_id}`);
    } else {
      await prisma.customer.update({
        where: { cus_id: row.cus_id },
        data: {
          cus_category: cat.cus_cat_id,
          cus_type: typ.cus_type_id,
          cus_phone_no: def.phone,
          cus_address: def.address,
        },
      });
      console.log(`    ✓ updated cus_id ${row.cus_id}`);
    }
    results.push({
      name: def.name,
      cus_id: row.cus_id,
      category: def.categoryTitle,
      cus_cat_id: cat.cus_cat_id,
      type: def.typeTitle,
      cus_type_id: typ.cus_type_id,
    });
  }

  console.log('\n--- Summary (use on Sales → Customer picker / Type filter) ---\n');
  console.table(results);
  console.log('\nOn Sales page: open Customer Type filter to switch Walk in / Cement / Homes.\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
