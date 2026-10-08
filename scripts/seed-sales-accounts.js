/**
 * Ensures accounts required by the Sales page + POST /api/sales ledger posting.
 *
 * Usage:
 *   node scripts/seed-sales-accounts.js           # branch 10 (DEMO)
 *   node scripts/seed-sales-accounts.js 1         # MAIN
 */
/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BRANCH_ID = parseInt(process.argv[2] || '10', 10);

async function nextId(model, field) {
  const r = await prisma[model].aggregate({ _max: { [field]: true } });
  return (r._max[field] || 0) + 1;
}

async function findCategory(title) {
  return prisma.customerCategory.findFirst({
    where: { cus_cat_title: title },
    orderBy: { cus_cat_id: 'asc' },
  });
}

async function findType(title) {
  return prisma.customerType.findFirst({
    where: { cus_type_title: title },
    orderBy: { cus_type_id: 'asc' },
  });
}

async function ensureCategory(title) {
  let cat = await findCategory(title);
  if (cat) return cat;
  const id = await nextId('customerCategory', 'cus_cat_id');
  cat = await prisma.customerCategory.create({
    data: { cus_cat_id: id, branch_id: BRANCH_ID, cus_cat_title: title },
  });
  console.log('  + category:', title, 'id', id);
  return cat;
}

async function ensureType(title) {
  let typ = await findType(title);
  if (typ) return typ;
  const id = await nextId('customerType', 'cus_type_id');
  typ = await prisma.customerType.create({
    data: { cus_type_id: id, branch_id: BRANCH_ID, cus_type_title: title },
  });
  console.log('  + type:', title, 'id', id);
  return typ;
}

async function findCustomer(branchId, name) {
  return prisma.customer.findFirst({
    where: { branch_id: branchId, cus_name: name },
  });
}

async function ensureCustomer({
  name,
  categoryTitle,
  typeTitle,
  phone = '03000000000',
  address = 'Main Office',
  balance = 0,
}) {
  const existing = await findCustomer(BRANCH_ID, name);
  if (existing) {
    console.log('  ✓ exists:', name, `(cus_id ${existing.cus_id})`);
    return existing;
  }
  const cat = await ensureCategory(categoryTitle);
  const typ = await ensureType(typeTitle);
  const city = await prisma.city.findFirst({ where: { branch_id: BRANCH_ID } })
    || await prisma.city.findFirst();
  const cusId = await nextId('customer', 'cus_id');
  const row = await prisma.customer.create({
    data: {
      cus_id: cusId,
      branch_id: BRANCH_ID,
      cus_name: name,
      cus_phone_no: phone,
      cus_address: address,
      cus_balance: balance,
      cus_category: cat.cus_cat_id,
      cus_type: typ.cus_type_id,
      city_id: city?.city_id ?? null,
    },
  });
  console.log('  + created:', name, `(cus_id ${row.cus_id})`);
  return row;
}

/** Accounts the sales UI + sales API expect (see src/app/dashboard/sales/page.js, src/app/api/sales/route.js). */
const SALES_ACCOUNT_DEFS = [
  {
    name: 'Cash Account',
    categoryTitle: 'Cash Account',
    typeTitle: 'Main Cash Counter',
    phone: '0000000000',
    address: 'Main Office — cash received on sales',
    note: 'Ledger: cash payments debit this account (getSpecialAccounts / findOrCreateCashAccount).',
  },
  {
    name: 'Cash in Hand (Counter 1)',
    categoryTitle: 'Cash & Counter Accounts',
    typeTitle: 'Main Cash Counter',
    address: 'Billing counter',
    note: 'Optional second cash drawer; category matches legacy setup.',
  },
  {
    name: 'Walk-in Counter Customer (General)',
    categoryTitle: 'Customers',
    typeTitle: 'Retail Customer',
    phone: '0300-0000000',
    address: 'Walk-in retail',
    note: 'Default buyer on sales page (isWalkinCustomer / customer picker).',
  },
  {
    name: 'Meezan Bank Ltd (Demo Sales)',
    categoryTitle: 'Banks & Financial Institutions',
    typeTitle: 'Commercial Islamic Bank',
    phone: '053-0000000',
    address: 'Gujrat — demo bank for sales bank payment dropdown',
    note: 'Sales UI: category AND type must contain "bank"; name must not be generic "Bank Account".',
  },
  {
    name: 'Local Transport (Demo)',
    categoryTitle: 'Transport',
    typeTitle: 'Transport',
    phone: '0300-1111111',
    address: 'Local delivery',
    note: 'Sales transport dropdown: Transport/Transporter on category or type.',
  },
  {
    name: 'Sundry Debtors (Receivable)',
    categoryTitle: 'Sundry Debtors',
    typeTitle: 'Adjustment',
    address: 'System — loader/shipping receivable',
    note: 'Optional: sales API uses first debtor category for loader/shipping ledger.',
  },
  {
    name: 'Sundry Creditors (Payable)',
    categoryTitle: 'Sundry Creditors',
    typeTitle: 'Adjustment',
    address: 'System — sundry payable',
    note: 'Optional: sale returns / split payments.',
  },
];

async function main() {
  const branch = await prisma.branch.findUnique({ where: { branch_id: BRANCH_ID } });
  if (!branch) {
    console.error(`Branch ${BRANCH_ID} does not exist. Available:`, (await prisma.branch.findMany({ select: { branch_id: true, branch_code: true } })));
    process.exit(1);
  }
  console.log(`\nSeeding sales accounts for branch ${branch.branch_code} (id=${BRANCH_ID})\n`);

  for (const def of SALES_ACCOUNT_DEFS) {
    console.log(`— ${def.name}`);
    if (def.note) console.log(`    ${def.note}`);
    await ensureCustomer(def);
  }

  console.log('\nDone. Re-open Sales page and refresh customers (or reload app).\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
