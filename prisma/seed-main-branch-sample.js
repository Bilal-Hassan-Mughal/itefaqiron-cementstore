/**
 * Sample master data for MAIN branch only (accounts, products, stores, etc.)
 * Does NOT touch other branches.
 *
 * Usage:
 *   node scripts/setup-branches.js
 *   node prisma/seed-main-branch-sample.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function nextId(modelName, idField) {
  const result = await prisma[modelName].aggregate({ _max: { [idField]: true } });
  return (result._max[idField] || 0) + 1;
}

async function resolveMainBranch() {
  let branch = await prisma.branch.findUnique({ where: { branch_code: 'MAIN' } });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        branch_code: 'MAIN',
        branch_name: 'Main Branch',
        address: 'Gujrat Sargodha Road, Pahrian Wali',
        phone: '0346-7560306',
        status: 'ACTIVE',
        isolation_mode: 'SHARED',
        table_prefix: 'main',
        tables_provisioned: true,
        provision_status: 'ACTIVE',
        provision_message: 'Main branch — shared tables',
      },
    });
    console.log(`Created MAIN branch (id=${branch.branch_id})`);
  }
  return branch;
}

function scoped(branchId) {
  return {
    async ensureCategory(title) {
      const existing = await prisma.customerCategory.findFirst({
        where: { branch_id: branchId, cus_cat_title: title },
      });
      if (existing) return existing;
      const row = await prisma.customerCategory.create({
        data: {
          cus_cat_id: await nextId('customerCategory', 'cus_cat_id'),
          branch_id: branchId,
          cus_cat_title: title,
        },
      });
      console.log(`  + category: ${title}`);
      return row;
    },

    async ensureType(title) {
      const existing = await prisma.customerType.findFirst({
        where: { branch_id: branchId, cus_type_title: title },
      });
      if (existing) return existing;
      const row = await prisma.customerType.create({
        data: {
          cus_type_id: await nextId('customerType', 'cus_type_id'),
          branch_id: branchId,
          cus_type_title: title,
        },
      });
      console.log(`  + type: ${title}`);
      return row;
    },

    async ensureCity(name) {
      const existing = await prisma.city.findFirst({
        where: { branch_id: branchId, city_name: name },
      });
      if (existing) return existing;
      const row = await prisma.city.create({
        data: {
          city_id: await nextId('city', 'city_id'),
          branch_id: branchId,
          city_name: name,
        },
      });
      console.log(`  + city: ${name}`);
      return row;
    },

    async ensureCustomer(payload) {
      const existing = await prisma.customer.findFirst({
        where: { branch_id: branchId, cus_name: payload.name },
      });
      if (existing) {
        console.log(`  = account exists: ${payload.name}`);
        return existing;
      }

      const category = await prisma.customerCategory.findFirst({
        where: { branch_id: branchId, cus_cat_title: payload.categoryTitle },
      });
      const type = await prisma.customerType.findFirst({
        where: { branch_id: branchId, cus_type_title: payload.typeTitle },
      });
      const city = payload.cityName
        ? await prisma.city.findFirst({
            where: { branch_id: branchId, city_name: payload.cityName },
          })
        : null;

      if (!category || !type) {
        throw new Error(
          `Missing category/type for "${payload.name}" (${payload.categoryTitle} / ${payload.typeTitle})`
        );
      }

      const row = await prisma.customer.create({
        data: {
          cus_id: await nextId('customer', 'cus_id'),
          branch_id: branchId,
          cus_name: payload.name,
          cus_category: category.cus_cat_id,
          cus_type: type.cus_type_id,
          cus_phone_no: payload.phone || '03000000000',
          cus_address: payload.address || 'Main Branch',
          cus_balance: payload.balance ?? 0,
          cus_account_info: payload.accountInfo || null,
          city_id: city?.city_id ?? null,
        },
      });
      console.log(`  + account: ${payload.name}`);
      return row;
    },

    async ensureStore(name, address) {
      const existing = await prisma.store.findFirst({
        where: { branch_id: branchId, store_name: name },
      });
      if (existing) return existing;
      const row = await prisma.store.create({
        data: { branch_id: branchId, store_name: name, store_address: address },
      });
      console.log(`  + store: ${name}`);
      return row;
    },

    async ensureExpenseTitle(title) {
      const existing = await prisma.expenseTitle.findFirst({
        where: { branch_id: branchId, title },
      });
      if (existing) return existing;
      const row = await prisma.expenseTitle.create({
        data: {
          id: await nextId('expenseTitle', 'id'),
          branch_id: branchId,
          title,
        },
      });
      console.log(`  + expense title: ${title}`);
      return row;
    },

    async ensureProductCategory(name, code) {
      const existing = await prisma.categories.findFirst({
        where: { branch_id: branchId, cat_code: code },
      });
      if (existing) return existing;
      const row = await prisma.categories.create({
        data: {
          cat_id: await nextId('categories', 'cat_id'),
          branch_id: branchId,
          cat_name: name,
          cat_code: code,
        },
      });
      console.log(`  + product category: ${name}`);
      return row;
    },

    async ensureSubCategory(catId, name, code) {
      const existing = await prisma.subCategory.findFirst({
        where: { branch_id: branchId, sub_cat_code: code },
      });
      if (existing) return existing;
      const row = await prisma.subCategory.create({
        data: {
          sub_cat_id: await nextId('subCategory', 'sub_cat_id'),
          branch_id: branchId,
          cat_id: catId,
          sub_cat_name: name,
          sub_cat_code: code,
        },
      });
      console.log(`  + subcategory: ${name}`);
      return row;
    },

    async ensureProduct(data) {
      const existing = await prisma.product.findFirst({
        where: { branch_id: branchId, pro_title: data.title },
      });
      if (existing) return existing;
      const row = await prisma.product.create({
        data: {
          pro_id: await nextId('product', 'pro_id'),
          branch_id: branchId,
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
    },

    async ensureStoreStock(storeId, proId, qty) {
      const existing = await prisma.storeStock.findFirst({
        where: { store_id: storeId, pro_id: proId },
      });
      if (existing) {
        await prisma.storeStock.update({
          where: { store_stock_id: existing.store_stock_id },
          data: { stock_quantity: qty },
        });
        return existing;
      }
      return prisma.storeStock.create({
        data: {
          store_id: storeId,
          pro_id: proId,
          stock_quantity: qty,
          min_stock: 10,
          max_stock: qty * 2,
        },
      });
    },

    async ensureLoader(name, number, phone) {
      const existing = await prisma.loader.findFirst({
        where: { branch_id: branchId, loader_number: number },
      });
      if (existing) return existing;
      const row = await prisma.loader.create({
        data: {
          branch_id: branchId,
          loader_name: name,
          loader_number: number,
          loader_phone: phone || null,
        },
      });
      console.log(`  + loader: ${name}`);
      return row;
    },

    async ensureVehicle(vehicleNo, driverName, driverPhone) {
      const existing = await prisma.vehicle.findFirst({
        where: { branch_id: branchId, v_vehicle_no: vehicleNo },
      });
      if (existing) return existing;
      const row = await prisma.vehicle.create({
        data: {
          branch_id: branchId,
          v_vehicle_no: vehicleNo,
          v_driver_name: driverName,
          v_driver_no: driverPhone,
        },
      });
      console.log(`  + vehicle: ${vehicleNo}`);
      return row;
    },

    async ensureEmployee(data) {
      const existing = await prisma.employee.findFirst({
        where: { branch_id: branchId, emp_name: data.name },
      });
      if (existing) return existing;
      const row = await prisma.employee.create({
        data: {
          branch_id: branchId,
          emp_name: data.name,
          emp_phone: data.phone,
          emp_cnic: data.cnic,
          emp_address: data.address,
          designation: data.designation,
          department: data.department,
          join_date: data.joinDate,
          basic_salary: data.salary,
          status: 'ACTIVE',
        },
      });
      console.log(`  + employee: ${data.name}`);
      return row;
    },
  };
}

async function main() {
  const branch = await resolveMainBranch();
  const branchId = branch.branch_id;
  const codePrefix = `M${branchId}`;

  console.log(`\nSeeding sample data for MAIN branch only (id=${branchId}, code=${branch.branch_code})\n`);

  const s = scoped(branchId);

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
  for (const title of CATEGORY_TITLES) await s.ensureCategory(title);

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
  for (const title of TYPE_TITLES) await s.ensureType(title);

  console.log('\nCities');
  for (const city of ['Pahrian Wali', 'Gujrat', 'Lahore', 'Gujranwala', 'Sialkot']) {
    await s.ensureCity(city);
  }

  console.log('\nChart of accounts');
  const accounts = [
    { name: 'Cash Account', categoryTitle: 'Cash Account', typeTitle: 'Cash', cityName: 'Pahrian Wali', phone: '03467560306', address: 'Main Counter — Cash' },
    { name: 'Sundry Debtors', categoryTitle: 'Sundry Debtors', typeTitle: 'Debtor', cityName: 'Pahrian Wali', phone: '03467560307', address: 'Control Account' },
    { name: 'Sundry Creditors', categoryTitle: 'Sundry Creditors', typeTitle: 'Creditor', cityName: 'Pahrian Wali', phone: '03467560308', address: 'Control Account' },
    { name: 'HBL Main Account', categoryTitle: 'Bank Account', typeTitle: 'Bank', cityName: 'Gujrat', phone: '03467560309', address: 'Habib Bank Gujrat', accountInfo: 'A/C: 12345678901' },
    { name: 'Meezan Bank', categoryTitle: 'Bank Account', typeTitle: 'Bank', cityName: 'Gujrat', phone: '03467560310', address: 'Meezan Bank Branch' },
    { name: 'Walk-in Customer', categoryTitle: 'Customer', typeTitle: 'Walk-in Customer', cityName: 'Pahrian Wali', phone: '03000000001', address: 'Counter Sales' },
    { name: 'Ali Construction Co.', categoryTitle: 'Customer', typeTitle: 'Customer', cityName: 'Gujrat', phone: '03001234567', address: 'G.T. Road, Gujrat', balance: 125000 },
    { name: 'Hassan Builders', categoryTitle: 'Customer', typeTitle: 'Customer', cityName: 'Lahore', phone: '03007654321', address: 'Model Town, Lahore', balance: 85000 },
    { name: 'Rehman Traders', categoryTitle: 'Customer', typeTitle: 'Customer', cityName: 'Gujranwala', phone: '03009876543', address: 'GT Road Gujranwala' },
    { name: 'Kamran Cement Depot', categoryTitle: 'Customer', typeTitle: 'Customer', cityName: 'Sialkot', phone: '03005551234', address: 'Sialkot' },
    { name: 'Lucky Cement (Supplier)', categoryTitle: 'Supplier', typeTitle: 'Supplier', cityName: 'Lahore', phone: '0421111111', address: 'Pezu Plant Supply', balance: -450000 },
    { name: 'Mughal Steel (Supplier)', categoryTitle: 'Supplier', typeTitle: 'Supplier', cityName: 'Lahore', phone: '0422222222', address: 'Steel Mill Supply', balance: -320000 },
    { name: 'Bestway Cement (Supplier)', categoryTitle: 'Supplier', typeTitle: 'Supplier', cityName: 'Gujrat', phone: '0533333333', address: 'Cement Supplier' },
    { name: 'Ittefaq Transport', categoryTitle: 'Transport', typeTitle: 'Transport', cityName: 'Pahrian Wali', phone: '03005555555', address: 'Delivery Fleet' },
    { name: 'Loader Main Yard', categoryTitle: 'Loader', typeTitle: 'Loader', cityName: 'Pahrian Wali', phone: '03006666666', address: 'Loading Services' },
    { name: 'Shop Rent Expense', categoryTitle: 'Expense Account', typeTitle: 'Expense', cityName: 'Pahrian Wali', phone: '03467560311', address: 'Monthly Rent' },
    { name: 'Utility Bills', categoryTitle: 'Expense Account', typeTitle: 'Expense', cityName: 'Pahrian Wali', phone: '03467560312', address: 'Electricity / Gas' },
    { name: 'Owner Capital', categoryTitle: 'Capital Account', typeTitle: 'Capital', cityName: 'Pahrian Wali', phone: '03467560313', address: 'Proprietor Capital' },
  ];
  for (const acc of accounts) await s.ensureCustomer(acc);

  console.log('\nStores');
  const mainStore = await s.ensureStore('Main Store', 'Ittefaq Iron & Cement — Main Branch');
  const yardStore = await s.ensureStore('Yard Store', 'Open Yard / Loading Area');

  console.log('\nExpense titles');
  for (const title of ['Rent', 'Salary', 'Utilities', 'Transport', 'Maintenance', 'Loading Charges', 'Office Expense']) {
    await s.ensureExpenseTitle(title);
  }

  console.log('\nLoaders & vehicles');
  await s.ensureLoader('Main Yard Loader', 'LD-MAIN-001', '03001111001');
  await s.ensureLoader('Counter Loader', 'LD-MAIN-002', '03001111002');
  await s.ensureVehicle('GLT-1234', 'Ahmed Khan', '03002222001');
  await s.ensureVehicle('GLT-5678', 'Bilal Hussain', '03002222002');

  console.log('\nEmployees (sample)');
  await s.ensureEmployee({
    name: 'Usman Ali',
    phone: '03003333001',
    cnic: `${codePrefix}-EMP-001`,
    address: 'Pahrian Wali',
    designation: 'Store Manager',
    department: 'Operations',
    joinDate: new Date('2022-01-15'),
    salary: 65000,
  });
  await s.ensureEmployee({
    name: 'Imran Saleem',
    phone: '03003333002',
    cnic: `${codePrefix}-EMP-002`,
    address: 'Gujrat',
    designation: 'Salesman',
    department: 'Sales',
    joinDate: new Date('2023-06-01'),
    salary: 45000,
  });

  console.log('\nProduct categories & products');
  const iron = await s.ensureProductCategory('Iron & Steel', `${codePrefix}-IRON`);
  const cement = await s.ensureProductCategory('Cement', `${codePrefix}-CEMENT`);
  const building = await s.ensureProductCategory('Building Material', `${codePrefix}-BUILD`);
  const pipes = await s.ensureProductCategory('Pipes & Fittings', `${codePrefix}-PIPE`);

  const ironBars = await s.ensureSubCategory(iron.cat_id, 'Steel Bars', `${codePrefix}-IRON-BAR`);
  const ironSheet = await s.ensureSubCategory(iron.cat_id, 'Steel Sheets', `${codePrefix}-IRON-SHT`);
  const cementBag = await s.ensureSubCategory(cement.cat_id, 'Cement Bags', `${codePrefix}-CEM-BAG`);
  const bricks = await s.ensureSubCategory(building.cat_id, 'Bricks & Blocks', `${codePrefix}-BLD-BRK`);
  const sandCat = await s.ensureSubCategory(building.cat_id, 'Sand & Crush', `${codePrefix}-BLD-SAND`);
  const pipePvc = await s.ensureSubCategory(pipes.cat_id, 'PVC Pipes', `${codePrefix}-PIPE-PVC`);

  const products = [
    { title: '60 Grade Steel Bar 3/8"', catId: iron.cat_id, subCatId: ironBars.sub_cat_id, cost: 185000, sale: 192000, stock: 45, unit: 'Ton', packing: 'Per Ton' },
    { title: '60 Grade Steel Bar 1/2"', catId: iron.cat_id, subCatId: ironBars.sub_cat_id, cost: 188000, sale: 195000, stock: 38, unit: 'Ton', packing: 'Per Ton' },
    { title: '40 Grade Steel Bar 3/8"', catId: iron.cat_id, subCatId: ironBars.sub_cat_id, cost: 175000, sale: 181000, stock: 25, unit: 'Ton', packing: 'Per Ton' },
    { title: 'MS Sheet 4x8 (1.6mm)', catId: iron.cat_id, subCatId: ironSheet.sub_cat_id, cost: 8500, sale: 9200, stock: 120, unit: 'Sheet', packing: 'Per Sheet' },
    { title: 'Lucky Cement 50kg', catId: cement.cat_id, subCatId: cementBag.sub_cat_id, cost: 1180, sale: 1250, stock: 2500, unit: 'Bag', packing: '50kg Bag' },
    { title: 'Maple Leaf Cement 50kg', catId: cement.cat_id, subCatId: cementBag.sub_cat_id, cost: 1200, sale: 1270, stock: 1800, unit: 'Bag', packing: '50kg Bag' },
    { title: 'Bestway Cement 50kg', catId: cement.cat_id, subCatId: cementBag.sub_cat_id, cost: 1170, sale: 1240, stock: 1500, unit: 'Bag', packing: '50kg Bag' },
    { title: 'DG Cement 50kg', catId: cement.cat_id, subCatId: cementBag.sub_cat_id, cost: 1190, sale: 1260, stock: 900, unit: 'Bag', packing: '50kg Bag' },
    { title: 'A-Class Bricks', catId: building.cat_id, subCatId: bricks.sub_cat_id, cost: 16, sale: 18, stock: 50000, unit: 'Piece', packing: 'Per Piece' },
    { title: 'Solid Blocks 6"', catId: building.cat_id, subCatId: bricks.sub_cat_id, cost: 85, sale: 95, stock: 8000, unit: 'Piece', packing: 'Per Piece' },
    { title: 'Sand (Ravi) per Truck', catId: building.cat_id, subCatId: sandCat.sub_cat_id, cost: 45000, sale: 48000, stock: 12, unit: 'Truck', packing: 'Truck Load' },
    { title: 'Crush (Sargodha) per Truck', catId: building.cat_id, subCatId: sandCat.sub_cat_id, cost: 52000, sale: 55000, stock: 8, unit: 'Truck', packing: 'Truck Load' },
    { title: 'PVC Pipe 4" Class B', catId: pipes.cat_id, subCatId: pipePvc.sub_cat_id, cost: 850, sale: 950, stock: 400, unit: 'Length', packing: '10 ft' },
    { title: 'PVC Pipe 2" Class B', catId: pipes.cat_id, subCatId: pipePvc.sub_cat_id, cost: 420, sale: 480, stock: 600, unit: 'Length', packing: '10 ft' },
  ];

  const createdProducts = [];
  for (const p of products) {
    createdProducts.push(await s.ensureProduct(p));
  }

  console.log('\nStore stock (Main Store)');
  for (const pro of createdProducts) {
    const src = products.find((p) => p.title === pro.pro_title);
    if (src) await s.ensureStoreStock(mainStore.storeid, pro.pro_id, src.stock);
  }

  console.log('\nStore stock (Yard Store — partial)');
  const yardProducts = createdProducts.filter((p) =>
    ['60 Grade Steel Bar 3/8"', '60 Grade Steel Bar 1/2"', 'Sand (Ravi) per Truck', 'Crush (Sargodha) per Truck'].includes(p.pro_title)
  );
  for (const pro of yardProducts) {
    const src = products.find((p) => p.title === pro.pro_title);
    if (src) await s.ensureStoreStock(yardStore.storeid, pro.pro_id, Math.floor(src.stock * 0.4));
  }

  const counts = await Promise.all([
    prisma.customer.count({ where: { branch_id: branchId } }),
    prisma.product.count({ where: { branch_id: branchId } }),
    prisma.categories.count({ where: { branch_id: branchId } }),
    prisma.store.count({ where: { branch_id: branchId } }),
  ]);

  console.log('\nDone — MAIN branch sample data ready.');
  console.log(`  Branch: ${branch.branch_name} (${branch.branch_code}) id=${branchId}`);
  console.log(`  Accounts: ${counts[0]}  |  Products: ${counts[1]}  |  Categories: ${counts[2]}  |  Stores: ${counts[3]}`);
  console.log('\nTest with branch login: MAIN + your branch user (e.g. main@gmail.com)');
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
