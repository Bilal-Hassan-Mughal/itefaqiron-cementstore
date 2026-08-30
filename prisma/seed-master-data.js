const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function nextId(modelName, idField) {
  const result = await prisma[modelName].aggregate({ _max: { [idField]: true } });
  return (result._max[idField] || 0) + 1;
}

async function ensureCategory(title) {
  const existing = await prisma.customerCategory.findFirst({
    where: { cus_cat_title: { equals: title } },
  });
  if (existing) return existing;
  const row = await prisma.customerCategory.create({
    data: { cus_cat_id: await nextId('customerCategory', 'cus_cat_id'), cus_cat_title: title },
  });
  console.log(`  + category: ${title}`);
  return row;
}

async function ensureType(title) {
  const existing = await prisma.customerType.findFirst({
    where: { cus_type_title: { equals: title } },
  });
  if (existing) return existing;
  const row = await prisma.customerType.create({
    data: { cus_type_id: await nextId('customerType', 'cus_type_id'), cus_type_title: title },
  });
  console.log(`  + type: ${title}`);
  return row;
}

async function ensureCity(name) {
  const existing = await prisma.city.findFirst({ where: { city_name: { equals: name } } });
  if (existing) return existing;
  const row = await prisma.city.create({
    data: { city_id: await nextId('city', 'city_id'), city_name: name },
  });
  console.log(`  + city: ${name}`);
  return row;
}

async function ensureCustomer({ name, categoryTitle, typeTitle, cityName, phone, address, balance = 0, accountInfo }) {
  const existing = await prisma.customer.findFirst({ where: { cus_name: { equals: name } } });
  if (existing) {
    console.log(`  = account exists: ${name}`);
    return existing;
  }

  const category = await prisma.customerCategory.findFirst({
    where: { cus_cat_title: { equals: categoryTitle } },
  });
  const type = await prisma.customerType.findFirst({
    where: { cus_type_title: { equals: typeTitle } },
  });
  const city = cityName
    ? await prisma.city.findFirst({ where: { city_name: { equals: cityName } } })
    : null;

  if (!category || !type) {
    throw new Error(`Missing category/type for account "${name}" (${categoryTitle} / ${typeTitle})`);
  }

  const row = await prisma.customer.create({
    data: {
      cus_id: await nextId('customer', 'cus_id'),
      cus_name: name,
      cus_category: category.cus_cat_id,
      cus_type: type.cus_type_id,
      cus_phone_no: phone || '03000000000',
      cus_address: address || 'Ittefaq Iron Store',
      cus_balance: balance,
      cus_account_info: accountInfo || null,
      city_id: city?.city_id ?? null,
    },
  });
  console.log(`  + account: ${name}`);
  return row;
}

async function ensureStore(name, address) {
  const existing = await prisma.store.findFirst({ where: { store_name: { equals: name } } });
  if (existing) return existing;
  const row = await prisma.store.create({
    data: { store_name: name, store_address: address },
  });
  console.log(`  + store: ${name}`);
  return row;
}

async function ensureExpenseTitle(title) {
  const existing = await prisma.expenseTitle.findFirst({ where: { title: { equals: title } } });
  if (existing) return existing;
  const row = await prisma.expenseTitle.create({
    data: { id: await nextId('expenseTitle', 'id'), title },
  });
  console.log(`  + expense title: ${title}`);
  return row;
}

async function ensureProductCategory(name, code) {
  const existing = await prisma.categories.findFirst({ where: { cat_code: { equals: code } } });
  if (existing) return existing;
  const row = await prisma.categories.create({
    data: { cat_id: await nextId('categories', 'cat_id'), cat_name: name, cat_code: code },
  });
  console.log(`  + product category: ${name}`);
  return row;
}

async function ensureSubCategory(catId, name, code) {
  const existing = await prisma.subCategory.findFirst({ where: { sub_cat_code: { equals: code } } });
  if (existing) return existing;
  const row = await prisma.subCategory.create({
    data: {
      sub_cat_id: await nextId('subCategory', 'sub_cat_id'),
      cat_id: catId,
      sub_cat_name: name,
      sub_cat_code: code,
    },
  });
  console.log(`  + subcategory: ${name}`);
  return row;
}

async function ensureProduct(data) {
  const existing = await prisma.product.findFirst({ where: { pro_title: { equals: data.title } } });
  if (existing) return existing;
  const row = await prisma.product.create({
    data: {
      pro_id: await nextId('product', 'pro_id'),
      cat_id: data.catId,
      sub_cat_id: data.subCatId,
      pro_title: data.title,
      pro_description: data.description || data.title,
      pro_cost_price: data.cost,
      pro_sale_price: data.sale,
      pro_baser_price: data.sale,
      pro_stock_qnty: data.stock ?? 0,
      pro_unit: data.unit,
      pro_packing: data.packing || '',
      low_stock_quantity: data.lowStock ?? 10,
    },
  });
  console.log(`  + product: ${data.title}`);
  return row;
}

async function ensureLoader(name, number, phone) {
  const existing = await prisma.loader.findFirst({ where: { loader_number: { equals: number } } });
  if (existing) return existing;
  const row = await prisma.loader.create({
    data: { loader_name: name, loader_number: number, loader_phone: phone || null },
  });
  console.log(`  + loader: ${name}`);
  return row;
}

async function main() {
  console.log('Seeding master data for Ittefaq POS...\n');

  console.log('Account categories');
  const CATEGORY_TITLES = [
    'Cash Account',
    'Bank Account',
    'Sundry Debtors',
    'Sundry Creditors',
    'Customer',
    'Supplier',
    'Expense Account',
    'Loader',
    'Transport',
    'Capital Account',
    'Employee',
  ];
  for (const title of CATEGORY_TITLES) await ensureCategory(title);

  console.log('\nAccount types');
  const TYPE_TITLES = [
    'Cash',
    'Bank',
    'Customer',
    'Supplier',
    'Walk-in Customer',
    'Creditor',
    'Debtor',
    'Expense',
    'Loader',
    'Transport',
    'Employee',
    'Capital',
  ];
  for (const title of TYPE_TITLES) await ensureType(title);

  console.log('\nCities');
  for (const city of ['Lahore', 'Faisalabad', 'Rawalpindi', 'Gujranwala', 'Multan', 'Sialkot']) {
    await ensureCity(city);
  }

  console.log('\nChart of accounts (sample customers / ledger accounts)');
  const accounts = [
    { name: 'Cash Account', categoryTitle: 'Cash Account', typeTitle: 'Cash', cityName: 'Lahore', phone: '0420000000', address: 'Main Counter - Cash' },
    { name: 'Sundry Debtors', categoryTitle: 'Sundry Debtors', typeTitle: 'Debtor', cityName: 'Lahore', phone: '0420000001', address: 'System Control Account' },
    { name: 'Sundry Creditors', categoryTitle: 'Sundry Creditors', typeTitle: 'Creditor', cityName: 'Lahore', phone: '0420000002', address: 'System Control Account' },
    { name: 'HBL - Main Account', categoryTitle: 'Bank Account', typeTitle: 'Bank', cityName: 'Lahore', phone: '0420000003', address: 'Habib Bank Limited', accountInfo: 'IBAN: PK00HABB0000000000000000' },
    { name: 'Meezan Bank', categoryTitle: 'Bank Account', typeTitle: 'Bank', cityName: 'Lahore', phone: '0420000004', address: 'Meezan Bank Branch', accountInfo: 'IBAN: PK00MEZN0000000000000000' },
    { name: 'UBL - Current Account', categoryTitle: 'Bank Account', typeTitle: 'Bank', cityName: 'Lahore', phone: '0420000005', address: 'United Bank Limited' },
    { name: 'Walk-in Customer', categoryTitle: 'Customer', typeTitle: 'Walk-in Customer', cityName: 'Lahore', phone: '03000000001', address: 'Walk-in Sales' },
    { name: 'Ali Construction Company', categoryTitle: 'Customer', typeTitle: 'Customer', cityName: 'Lahore', phone: '03001234567', address: 'Model Town, Lahore' },
    { name: 'Hassan Builders', categoryTitle: 'Customer', typeTitle: 'Customer', cityName: 'Faisalabad', phone: '03007654321', address: 'Susan Road, Faisalabad' },
    { name: 'Rehman & Sons Traders', categoryTitle: 'Customer', typeTitle: 'Customer', cityName: 'Rawalpindi', phone: '03009876543', address: 'Raja Bazaar, Rawalpindi' },
    { name: 'Lucky Cement (Supplier)', categoryTitle: 'Supplier', typeTitle: 'Supplier', cityName: 'Lahore', phone: '0421111111', address: 'Pezu Plant Supply' },
    { name: 'Mughal Steel (Supplier)', categoryTitle: 'Supplier', typeTitle: 'Supplier', cityName: 'Lahore', phone: '0422222222', address: 'Steel Supply Account' },
    { name: 'Bestway Cement (Supplier)', categoryTitle: 'Supplier', typeTitle: 'Supplier', cityName: 'Multan', phone: '0613333333', address: 'Cement Supplier' },
    { name: 'Ittefaq Transport', categoryTitle: 'Transport', typeTitle: 'Transport', cityName: 'Lahore', phone: '03005555555', address: 'Delivery & Transport' },
    { name: 'Loader - Main Yard', categoryTitle: 'Loader', typeTitle: 'Loader', cityName: 'Lahore', phone: '03006666666', address: 'Loading Services' },
    { name: 'Shop Rent Expense', categoryTitle: 'Expense Account', typeTitle: 'Expense', cityName: 'Lahore', phone: '0420000006', address: 'Monthly Rent' },
    { name: 'Utility Bills', categoryTitle: 'Expense Account', typeTitle: 'Expense', cityName: 'Lahore', phone: '0420000007', address: 'Electricity / Gas / Water' },
    { name: 'Owner Capital Account', categoryTitle: 'Capital Account', typeTitle: 'Capital', cityName: 'Lahore', phone: '0420000008', address: 'Proprietor Capital' },
  ];
  for (const acc of accounts) await ensureCustomer(acc);

  console.log('\nStores');
  await ensureStore('Main Store', 'Ittefaq Iron & Cement Store - Main Branch');
  await ensureStore('Yard Store', 'Open Yard / Loading Area');

  console.log('\nExpense titles');
  for (const title of ['Rent', 'Salary', 'Utilities', 'Transport', 'Maintenance', 'Office Expense', 'Loading Charges']) {
    await ensureExpenseTitle(title);
  }

  console.log('\nLoaders');
  await ensureLoader('Main Loader', 'LD-001', '03001111001');
  await ensureLoader('Yard Loader', 'LD-002', '03001111002');

  console.log('\nProduct categories & sample products');
  const iron = await ensureProductCategory('Iron & Steel', 'IRON');
  const cement = await ensureProductCategory('Cement', 'CEMENT');
  const building = await ensureProductCategory('Building Material', 'BUILD');

  const ironBars = await ensureSubCategory(iron.cat_id, 'Iron Bars', 'IRON-BAR');
  const steelGirder = await ensureSubCategory(iron.cat_id, 'Steel Girders', 'IRON-GIR');
  const cementBag = await ensureSubCategory(cement.cat_id, 'Cement Bags', 'CEM-BAG');
  const bricks = await ensureSubCategory(building.cat_id, 'Bricks', 'BLD-BRK');

  await ensureProduct({ title: '60 Grade Steel Bar 3/8', catId: iron.cat_id, subCatId: ironBars.sub_cat_id, cost: 185000, sale: 190000, stock: 500, unit: 'Ton', packing: 'Per Ton' });
  await ensureProduct({ title: '60 Grade Steel Bar 1/2', catId: iron.cat_id, subCatId: ironBars.sub_cat_id, cost: 188000, sale: 193000, stock: 300, unit: 'Ton', packing: 'Per Ton' });
  await ensureProduct({ title: 'Lucky Cement 50kg', catId: cement.cat_id, subCatId: cementBag.sub_cat_id, cost: 1180, sale: 1250, stock: 2000, unit: 'Bag', packing: '50kg Bag' });
  await ensureProduct({ title: 'Maple Leaf Cement 50kg', catId: cement.cat_id, subCatId: cementBag.sub_cat_id, cost: 1200, sale: 1270, stock: 1500, unit: 'Bag', packing: '50kg Bag' });
  await ensureProduct({ title: 'A-Class Bricks', catId: building.cat_id, subCatId: bricks.sub_cat_id, cost: 16, sale: 18, stock: 50000, unit: 'Piece', packing: 'Per Piece' });

  console.log('\nDone. Master data seed completed.');
  console.log('\nKey system accounts for sales/purchases:');
  console.log('  Cash Account, Sundry Debtors, Sundry Creditors, Bank accounts');
  console.log('  Walk-in Customer + sample customers & suppliers');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
