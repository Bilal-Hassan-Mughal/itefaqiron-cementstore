/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const j = (v) => JSON.stringify(v, (_, x) => (typeof x === 'bigint' ? Number(x) : x), 2);

async function getSpecialAccountsLikeSalesApi() {
  const rows = await p.$queryRawUnsafe(`
    SELECT c.cus_id, c.cus_name, c.cus_category, c.cus_type, c.branch_id, cat.cus_cat_title
    FROM customers c
    JOIN customer_categories cat ON c.cus_category = cat.cus_cat_id
    WHERE LOWER(cat.cus_cat_title) LIKE '%cash%'
       OR LOWER(cat.cus_cat_title) LIKE '%bank%'
       OR LOWER(cat.cus_cat_title) LIKE '%creditor%'
       OR LOWER(cat.cus_cat_title) LIKE '%debtor%'
    ORDER BY c.cus_id ASC
  `);
  const accounts = {};
  for (const row of rows || []) {
    const lowerCat = (row.cus_cat_title || '').toLowerCase();
    const lowerName = (row.cus_name || '').toLowerCase();
    if (lowerCat.includes('cash') && (!accounts.cash || lowerName === 'cash account')) accounts.cash = row;
    else if (lowerCat.includes('bank') && !['bank account', 'bank', 'bank accounts'].includes(lowerName)) accounts.bank = row;
    else if (lowerCat.includes('creditor') && !accounts.sundryCreditors) accounts.sundryCreditors = row;
    else if (lowerCat.includes('debtor') && !accounts.sundryDebtors) accounts.sundryDebtors = row;
  }
  return { rows, accounts };
}

(async () => {
  const branchId = 1;
  console.log('=== Categories ===');
  console.log(j(await p.customerCategory.findMany({ orderBy: { cus_cat_id: 'asc' } })));
  console.log('\n=== Types (sample) ===');
  console.log(j(await p.customerType.findMany({ take: 30, orderBy: { cus_type_id: 'asc' } })));
  console.log('\n=== Customer count branch', branchId, '===');
  const cnt = await p.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM customers WHERE branch_id = ${branchId}`);
  console.log(Number(cnt[0].c));
  const { rows, accounts } = await getSpecialAccountsLikeSalesApi();
  console.log('\n=== Special account candidates ===');
  console.log(j(rows));
  console.log('\n=== Resolved specialAccounts ===');
  console.log(j(accounts));

  const cats = await p.customerCategory.findMany();
  const types = await p.customerType.findMany();
  const customers = await p.customer.findMany({
    where: { branch_id: branchId },
    include: { customer_category: true, customer_type: true },
  });

  const walk = customers.filter((c) => /walk/i.test(c.cus_name || ''));
  console.log('\n=== Walk-in style customers ===', j(walk.map((c) => ({ id: c.cus_id, name: c.cus_name }))));

  const bankUi = customers.filter((c) => {
    const cat = cats.find((x) => x.cus_cat_id === c.cus_category);
    const typ = types.find((x) => x.cus_type_id === c.cus_type);
    const hasBank = cat && cat.cus_cat_title.toLowerCase().includes('bank');
    const hasBank2 = typ && typ.cus_type_title.toLowerCase().includes('bank');
    const isNotGeneric = c.cus_name && !['Bank Account', 'Bank', 'Bank Accounts'].includes(c.cus_name.trim());
    return hasBank && hasBank2 && isNotGeneric;
  });
  console.log('\n=== Bank dropdown (sales UI filter) ===', j(bankUi.map((c) => c.cus_name)));

  const transport = customers.filter((c) => {
    const cat = (c.customer_category?.cus_cat_title || cats.find((x) => x.cus_cat_id === c.cus_category)?.cus_cat_title || '').toLowerCase();
    const typ = (c.customer_type?.cus_type_title || types.find((x) => x.cus_type_id === c.cus_type)?.cus_type_title || '').toLowerCase();
    const isT = (n) => n === 'transport' || n === 'transporter' || n === 'transporters';
    return isT(cat) || isT(typ);
  });
  console.log('\n=== Transport accounts ===', j(transport.map((c) => c.cus_name)));

  const stores = await p.store.findMany({ where: { branch_id: branchId } });
  console.log('\n=== Stores branch 1 ===', j(stores.map((s) => ({ id: s.store_id, name: s.store_name }))));

  const products = await p.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM products WHERE branch_id = ${branchId}`);
  console.log('\n=== Products branch 1 ===', Number(products[0].c));

  for (const b of [8, 10]) {
    const c = await p.$queryRawUnsafe(`SELECT COUNT(*) AS n FROM customers WHERE branch_id = ${b}`);
    console.log('\n=== Branch', b, 'customer count ===', Number(c[0].n));
  }

  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
