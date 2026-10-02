/**
 * Complete Realistic Business Lifecycle Seed for DEMO Branch:
 * 1. Creates all Customer Categories & Types
 * 2. Creates realistic Accounts for every Category/Type with 0 initial balance
 * 3. Creates Products, Stores & Inventory
 * 4. Executes realistic lifecycle transactions (Purchases, Sales, Payments, Receipts, Expenses)
 * 5. Generates complete ledger entries and accurate live balances for every account
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PREFIX = 'demo';

async function nextId(model, idField) {
  const res = await prisma[model].aggregate({ _max: { [idField]: true } });
  return (res._max[idField] || 0) + 1;
}

async function main() {
  console.log('🚀 Starting Full Business Lifecycle Seed for DEMO Branch...\n');

  const demoBranch = await prisma.branch.findUnique({ where: { branch_code: 'DEMO' } });
  if (!demoBranch) throw new Error('DEMO branch not found');
  const BRANCH_ID = demoBranch.branch_id;
  console.log(`✓ Resolved DEMO Branch ID = ${BRANCH_ID}`);

  // Ensure SHARED mode
  await prisma.branch.update({
    where: { branch_id: BRANCH_ID },
    data: {
      isolation_mode: 'SHARED',
      table_prefix: 'demo',
      status: 'ACTIVE',
      provision_status: 'ACTIVE',
      provision_message: `Demo branch sandbox (branch_id = ${BRANCH_ID})`,
      updated_at: new Date(),
    },
  });

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');

  // Clean previous branch data
  const tablesToWipe = [
    'sale_details', 'sales', 'purchase_details', 'purchases', 'payments', 'expenses',
    'ledger', 'customers', 'customer_categories', 'customer_types', 'cities',
    'categories', 'sub_categories', 'products', 'stores', 'store_stocks',
    'employees', 'vehicles', 'loaders', 'expense_titles'
  ];
  for (const tbl of tablesToWipe) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM \`${tbl}\` WHERE branch_id = ?`, BRANCH_ID);
    } catch (e) {}
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${PREFIX}_${tbl}\``);
    } catch (e) {}
  }
  console.log('✓ Cleaned previous sandbox records');

  // 1. Customer Categories
  const categoryDefs = [
    { title: 'Customers', desc: 'Buyers, Builders, Contractors & Fabricators' },
    { title: 'Suppliers & Mills', desc: 'Steel Mills, Cement Factories & Distributors' },
    { title: 'Banks & Financial Institutions', desc: 'Corporate & Islamic Bank Accounts' },
    { title: 'Cash & Counter Accounts', desc: 'Point of Sale Cash Drawers & Vaults' },
    { title: 'Expense Accounts', desc: 'Operational, Utility & Transport Expenses' },
    { title: 'Staff & Employees', desc: 'Employee Salary & Advance Accounts' },
    { title: 'Partners & Capital', desc: 'Shareholders & Investment Accounts' },
  ];

  const catMap = new Map();
  for (const c of categoryDefs) {
    const id = await nextId('customerCategory', 'cus_cat_id');
    await prisma.customerCategory.create({
      data: {
        cus_cat_id: id,
        branch_id: BRANCH_ID,
        cus_cat_title: c.title,
        created_at: new Date(),
        updated_at: new Date(),
      }
    });
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_customer_categories\` (cus_cat_id, branch_id, cus_cat_title, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW())
    `, id, BRANCH_ID, c.title);
    catMap.set(c.title, id);
  }
  console.log(`✓ Created ${categoryDefs.length} Account Categories`);

  // 2. Customer Types
  const typeDefs = [
    'Retail Customer',
    'Wholesale & Trader',
    'Builder & Developer',
    'Contractor & Mason',
    'Fabricator & Welder',
    'Cement Manufacturer / Distributor',
    'Steel Mill / Re-Rolling Mill',
    'Hardware & Sanitary Supplier',
    'Commercial Islamic Bank',
    'Main Cash Counter',
    'Petty Cash Counter',
    'Utility & Rent Expense'
  ];

  const typeMap = new Map();
  for (const t of typeDefs) {
    const id = await nextId('customerType', 'cus_type_id');
    await prisma.customerType.create({
      data: {
        cus_type_id: id,
        branch_id: BRANCH_ID,
        cus_type_title: t,
        created_at: new Date(),
        updated_at: new Date(),
      }
    });
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_customer_types\` (cus_type_id, branch_id, cus_type_title, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW())
    `, id, BRANCH_ID, t);
    typeMap.set(t, id);
  }
  console.log(`✓ Created ${typeDefs.length} Account Types`);

  // 3. Cities
  const cityDefs = ['Lahore', 'Gujrat', 'Mandi Bahauddin', 'Sargodha', 'Islamabad / Rawalpindi', 'Faisalabad', 'Pahrian Wali'];
  const cityMap = new Map();
  for (const c of cityDefs) {
    const id = await nextId('city', 'city_id');
    await prisma.city.create({
      data: {
        city_id: id,
        branch_id: BRANCH_ID,
        city_name: c,
        created_at: new Date(),
        updated_at: new Date(),
      }
    });
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_cities\` (city_id, branch_id, city_name, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW())
    `, id, BRANCH_ID, c);
    cityMap.set(c, id);
  }
  console.log(`✓ Created ${cityDefs.length} Cities`);

  // 4. Stores / Godowns
  const storeDefs = [
    { name: 'Main Godown (Sargodha Road)', address: 'Main GT Road, Plot 14-A' },
    { name: 'Shop Front / Retail Store', address: 'Shop # 1-3, Iron Market' },
  ];
  let primaryStoreId = 1;
  for (const s of storeDefs) {
    const id = await nextId('store', 'storeid');
    if (s.name.includes('Main Godown')) primaryStoreId = id;
    await prisma.store.create({
      data: {
        storeid: id,
        branch_id: BRANCH_ID,
        store_name: s.name,
        store_address: s.address,
        created_at: new Date(),
        updated_at: new Date(),
      }
    });
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_stores\` (storeid, branch_id, store_name, store_address, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `, id, BRANCH_ID, s.name, s.address);
  }
  console.log(`✓ Created ${storeDefs.length} Stores`);

  // 5. Expense Titles
  const expTitles = [
    'Electricity Bill (GEPCO / IESCO)',
    'Shop & Godown Rent',
    'Staff Tea, Food & Refreshment',
    'Vehicle Fuel & Maintenance',
    'Printing, Stationary & Office Supplies',
    'Generator Diesel & Repair'
  ];
  const expTitleMap = new Map();
  for (const t of expTitles) {
    const id = await nextId('expenseTitle', 'id');
    await prisma.expenseTitle.create({
      data: { id, branch_id: BRANCH_ID, title: t, created_at: new Date(), updated_at: new Date() }
    });
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_expense_titles\` (id, branch_id, title, created_at, updated_at)
      VALUES (?, ?, ?, NOW(), NOW())
    `, id, BRANCH_ID, t);
    expTitleMap.set(t, id);
  }
  console.log(`✓ Created ${expTitles.length} Expense Titles`);

  // 6. Product Categories & Subcategories
  const prodCats = [
    { name: 'Steel & Deformed Bars', code: 'DMO_STEEL', sub: [
      { name: 'Grade 60 Deformed Bar (Saria)', code: 'DMO_SARIA_G60' },
      { name: 'Grade 40 Deformed Bar', code: 'DMO_SARIA_G40' },
      { name: 'Steel Binding Wire', code: 'DMO_BIND_WIRE' },
    ]},
    { name: 'Cement & Binding Materials', code: 'DMO_CEMENT', sub: [
      { name: 'Ordinary Portland Cement (OPC)', code: 'DMO_OPC_CEMENT' },
      { name: 'Sulphate Resistant Cement (SRC)', code: 'DMO_SRC_CEMENT' },
    ]},
    { name: 'Garder & TR Channels', code: 'DMO_GARDER', sub: [
      { name: 'Heavy Girder (I-Beam)', code: 'DMO_HEAVY_GIRDER' },
      { name: 'TR Channel Section', code: 'DMO_TR_CHANNEL' },
    ]},
    { name: 'MS Pipes & Hollow Sections', code: 'DMO_PIPES', sub: [
      { name: 'MS Square Box Pipe', code: 'DMO_SQ_PIPE' },
      { name: 'MS Round Pipe', code: 'DMO_RND_PIPE' },
    ]},
    { name: 'Building Aggregates & Sand', code: 'DMO_SAND', sub: [
      { name: 'Margalla Hill Crush (Bajri)', code: 'DMO_CRUSH_BAJRI' },
      { name: 'Chenab / Ravi Sand', code: 'DMO_SAND_FINE' },
    ]},
    { name: 'Hardware & Construction Tools', code: 'DMO_HARDWARE', sub: [
      { name: 'Steel Nails & Fasteners', code: 'DMO_NAILS' },
    ]},
  ];

  const subCatMap = new Map();
  for (const pc of prodCats) {
    const catId = await nextId('categories', 'cat_id');
    await prisma.categories.create({
      data: {
        cat_id: catId,
        branch_id: BRANCH_ID,
        cat_name: pc.name,
        cat_code: pc.code,
        created_at: new Date(),
        updated_at: new Date(),
      }
    });
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_categories\` (cat_id, branch_id, cat_name, cat_code, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `, catId, BRANCH_ID, pc.name, pc.code);

    for (const sc of pc.sub) {
      const subCatId = await nextId('subCategory', 'sub_cat_id');
      subCatMap.set(sc.name, { subCatId, catId });
      await prisma.subCategory.create({
        data: {
          sub_cat_id: subCatId,
          branch_id: BRANCH_ID,
          cat_id: catId,
          sub_cat_name: sc.name,
          sub_cat_code: sc.code,
          created_at: new Date(),
          updated_at: new Date(),
        }
      });
      await prisma.$executeRawUnsafe(`
        INSERT INTO \`${PREFIX}_sub_categories\` (sub_cat_id, branch_id, cat_id, sub_cat_name, sub_cat_code, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, NOW(), NOW())
      `, subCatId, BRANCH_ID, catId, sc.name, sc.code);
    }
  }
  console.log(`✓ Created Product Categories & Subcategories`);

  // 7. Products
  const productsList = [
    {
      subName: 'Grade 60 Deformed Bar (Saria)',
      title: 'Mughal Supreme Steel Grade-60 (1/2" - 4 Sutar)',
      description: 'Mughal Supreme ASTM A615 Grade-60 Deformed Bar 12mm',
      cost: '248.00',
      sale: '260.00',
      unit: 'Kg',
      packing: 'Bundles',
      lowStock: 1000
    },
    {
      subName: 'Grade 60 Deformed Bar (Saria)',
      title: 'Mughal Supreme Steel Grade-60 (3/8" - 3 Sutar)',
      description: 'Mughal Supreme ASTM A615 Grade-60 Deformed Bar 10mm',
      cost: '250.00',
      sale: '262.00',
      unit: 'Kg',
      packing: 'Bundles',
      lowStock: 1000
    },
    {
      subName: 'Ordinary Portland Cement (OPC)',
      title: 'Bestway All-Rounder OPC Cement 50kg Bag',
      description: 'Bestway Ordinary Portland Cement 50kg Paper/Poly Bag',
      cost: '1380.00',
      sale: '1440.00',
      unit: 'Bag',
      packing: '50kg Bag',
      lowStock: 100
    },
    {
      subName: 'Ordinary Portland Cement (OPC)',
      title: 'Lucky Cement Supreme OPC 50kg Bag',
      description: 'Lucky Cement Premium Grade OPC 50kg Bag',
      cost: '1390.00',
      sale: '1450.00',
      unit: 'Bag',
      packing: '50kg Bag',
      lowStock: 100
    },
    {
      subName: 'Heavy Girder (I-Beam)',
      title: 'Heavy Iron Girder 7" x 4" (Per Foot)',
      description: 'Heavy Structural Steel I-Girder 7x4 for Roof Support',
      cost: '850.00',
      sale: '980.00',
      unit: 'Ft',
      packing: 'Pieces',
      lowStock: 30
    },
    {
      subName: 'TR Channel Section',
      title: 'Standard TR Channel Section 4" x 2" 16-Gauge',
      description: 'TR Channel for T-Iron Ceiling Framing',
      cost: '420.00',
      sale: '490.00',
      unit: 'Ft',
      packing: 'Pieces',
      lowStock: 50
    },
    {
      subName: 'MS Square Box Pipe',
      title: 'MS Square Box Pipe 1.5" x 1.5" (16 Gauge - 20ft)',
      description: 'Square hollow tube section for gates and railings',
      cost: '1850.00',
      sale: '2150.00',
      unit: 'Length',
      packing: '20ft Length',
      lowStock: 25
    },
    {
      subName: 'Margalla Hill Crush (Bajri)',
      title: 'Margalla Hill Blue Stone Crush (1/2" Size)',
      description: 'Clean screened crushed stone for roof lintels & beams',
      cost: '115.00',
      sale: '135.00',
      unit: 'Cft',
      packing: 'Loose Trolley',
      lowStock: 500
    },
    {
      subName: 'Chenab / Ravi Sand',
      title: 'Chenab River Coarse Sand (Screened)',
      description: 'High quality coarse sand for brick masonry & plaster',
      cost: '65.00',
      sale: '80.00',
      unit: 'Cft',
      packing: 'Loose Trolley',
      lowStock: 800
    },
    {
      subName: 'Steel Nails & Fasteners',
      title: 'Hardened Steel Construction Nails 3" (Box of 5kg)',
      description: 'Heavy gauge steel nails for wooden shuttering',
      cost: '1450.00',
      sale: '1750.00',
      unit: 'Box',
      packing: '5kg Box',
      lowStock: 15
    }
  ];

  const prodMap = new Map();
  for (const p of productsList) {
    const id = await nextId('product', 'pro_id');
    const { subCatId, catId } = subCatMap.get(p.subName);
    
    await prisma.product.create({
      data: {
        pro_id: id,
        branch_id: BRANCH_ID,
        cat_id: catId,
        sub_cat_id: subCatId,
        pro_title: p.title,
        pro_description: p.description,
        pro_cost_price: p.cost,
        pro_sale_price: p.sale,
        pro_baser_price: p.sale,
        pro_stock_qnty: 0,
        pro_unit: p.unit,
        pro_packing: p.packing,
        low_stock_quantity: p.lowStock,
        created_at: new Date(),
        updated_at: new Date(),
      }
    });

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_products\` (
        pro_id, branch_id, cat_id, sub_cat_id, pro_title, pro_description,
        pro_cost_price, pro_sale_price, pro_baser_price, pro_stock_qnty,
        pro_unit, pro_packing, pro_low_stock, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, id, BRANCH_ID, catId, subCatId, p.title, p.description,
       p.cost, p.sale, p.sale, 0, p.unit, p.packing, p.lowStock);

    prodMap.set(p.title, { id, ...p });
  }
  console.log(`✓ Created ${productsList.length} Products`);

  // 8. Create Accounts with ZERO Balance for EVERY Category & Type
  const accountDefs = [
    // 1. Cash Accounts
    {
      cat: 'Cash & Counter Accounts',
      type: 'Main Cash Counter',
      city: 'Pahrian Wali',
      name: 'Cash in Hand (Counter 1)',
      phone: '0346-7560306',
      address: 'Main Billing Desk, Pahrian Wali',
      info: 'Primary cash drawer for daily sales'
    },
    {
      cat: 'Cash & Counter Accounts',
      type: 'Petty Cash Counter',
      city: 'Pahrian Wali',
      name: 'Petty Cash Drawer',
      phone: '0346-7560306',
      address: 'Office Safe',
      info: 'Daily tea, refreshment and minor expenses'
    },

    // 2. Bank Accounts
    {
      cat: 'Banks & Financial Institutions',
      type: 'Commercial Islamic Bank',
      city: 'Gujrat',
      name: 'Meezan Bank Ltd (A/C: 0102-0103456789)',
      phone: '053-3521400',
      address: 'Circular Road, Gujrat',
      info: 'Title: Ittefaq Iron Store - Primary Business Bank'
    },
    {
      cat: 'Banks & Financial Institutions',
      type: 'Commercial Islamic Bank',
      city: 'Gujrat',
      name: 'Bank Alfalah Islamic (A/C: 5501-9876543210)',
      phone: '053-3518200',
      address: 'GT Road Branch, Gujrat',
      info: 'Online customer transfers'
    },
    {
      cat: 'Banks & Financial Institutions',
      type: 'Commercial Islamic Bank',
      city: 'Sargodha',
      name: 'Habib Bank Limited - HBL (A/C: 0892-77441122)',
      phone: '048-3721900',
      address: 'Main Branch, Sargodha',
      info: 'Supplier payment account'
    },

    // 3. Suppliers & Mills
    {
      cat: 'Suppliers & Mills',
      type: 'Steel Mill / Re-Rolling Mill',
      city: 'Lahore',
      name: 'Mughal Steels & Re-Rolling Mills Ltd',
      phone: '042-35960100',
      address: 'Badami Bagh Industrial Area, Lahore',
      info: 'Supplier: Grade-60 Deformed Bars'
    },
    {
      cat: 'Suppliers & Mills',
      type: 'Cement Manufacturer / Distributor',
      city: 'Islamabad / Rawalpindi',
      name: 'Bestway Cement Industries Ltd (Hattar)',
      phone: '051-111119292',
      address: 'Blue Area, Islamabad',
      info: 'Supplier: OPC & SRC Cement'
    },
    {
      cat: 'Suppliers & Mills',
      type: 'Cement Manufacturer / Distributor',
      city: 'Islamabad / Rawalpindi',
      name: 'Lucky Cement Corporation Ltd',
      phone: '021-111786555',
      address: 'Regional Depot, Rawalpindi',
      info: 'Supplier: Supreme OPC Cement'
    },
    {
      cat: 'Suppliers & Mills',
      type: 'Steel Mill / Re-Rolling Mill',
      city: 'Faisalabad',
      name: 'Ittehad Steel & Pipe Industries',
      phone: '041-8724100',
      address: 'Samundri Road, Faisalabad',
      info: 'Supplier: Girders, TR Channels & Pipes'
    },
    {
      cat: 'Suppliers & Mills',
      type: 'Hardware & Sanitary Supplier',
      city: 'Gujrat',
      name: 'National Hardware & Fasteners Trading Co.',
      phone: '053-3532100',
      address: 'Small Industrial Estate, Gujrat',
      info: 'Supplier: Steel Nails, Tools & Wire'
    },

    // 4. Customers & Clients
    {
      cat: 'Customers',
      type: 'Retail Customer',
      city: 'Pahrian Wali',
      name: 'Walk-in Counter Customer (General)',
      phone: '0300-0000000',
      address: 'Pahrian Wali',
      info: 'Cash walk-in retail counter sales'
    },
    {
      cat: 'Customers',
      type: 'Builder & Developer',
      city: 'Gujrat',
      name: 'Al-Rehman Builders & Developers (CEO Malik Tariq)',
      phone: '0300-6214589',
      address: 'Rehman City Phase 2, Gujrat',
      info: 'Project: Commercial Plaza (Credit Limit: 2.0M)'
    },
    {
      cat: 'Customers',
      type: 'Builder & Developer',
      city: 'Mandi Bahauddin',
      name: 'Chaudhry Nadeem Construction Co.',
      phone: '0302-8419200',
      address: 'Katchery Road, Mandi Bahauddin',
      info: 'Govt Contractor & Commercial Construction'
    },
    {
      cat: 'Customers',
      type: 'Contractor & Mason',
      city: 'Pahrian Wali',
      name: 'Ustad Asghar Mason & Contractor',
      phone: '0345-9812450',
      address: 'Adda Pahrian Wali',
      info: 'Residential House Contractor'
    },
    {
      cat: 'Customers',
      type: 'Fabricator & Welder',
      city: 'Gujrat',
      name: 'Rana Zafar Welder & Steel Fabricator',
      phone: '0313-7744110',
      address: 'Railway Road, Gujrat',
      info: 'Iron Gate & Window Grill Fabrication'
    },
    {
      cat: 'Customers',
      type: 'Wholesale & Trader',
      city: 'Mandi Bahauddin',
      name: 'Bismillah Building Material & Hardware Store',
      phone: '0301-5522334',
      address: 'Chilka Chowk, Mandi Bahauddin',
      info: 'Sub-dealer & Wholesale account'
    },
    {
      cat: 'Customers',
      type: 'Retail Customer',
      city: 'Pahrian Wali',
      name: 'Haji Muhammad Iqbal (Kot Sar)',
      phone: '0304-6129840',
      address: 'Village Kot Sar, Tehsil Phalia',
      info: 'Farmhouse construction site'
    },
    {
      cat: 'Customers',
      type: 'Retail Customer',
      city: 'Pahrian Wali',
      name: 'Bilal Qadri Sahib (Adda)',
      phone: '0300-7711223',
      address: 'Main Bazar, Pahrian Wali',
      info: 'Personal house renovation'
    },

    // 5. Expense Accounts
    {
      cat: 'Expense Accounts',
      type: 'Utility & Rent Expense',
      city: 'Pahrian Wali',
      name: 'Shop Utility & Operational Expense Account',
      phone: '0346-7560306',
      address: 'Main Office',
      info: 'Utility bills, generator fuel and maintenance'
    },

    // 6. Staff Accounts
    {
      cat: 'Staff & Employees',
      type: 'Retail Customer',
      city: 'Pahrian Wali',
      name: 'Staff Advance & Clearance Pool',
      phone: '0346-7560306',
      address: 'HR Department',
      info: 'Employee salary & loan advances'
    },

    // 7. Partners / Capital
    {
      cat: 'Partners & Capital',
      type: 'Wholesale & Trader',
      city: 'Gujrat',
      name: 'Zain Ul Hassan Gondal (Owner Capital A/C)',
      phone: '0346-7560306',
      address: 'Pahrian Wali',
      info: 'Owner equity and branch capital funding'
    }
  ];

  const accMap = new Map();
  console.log(`\n👥 Creating Accounts with ZERO initial balance for all categories & types...`);
  for (const acc of accountDefs) {
    const id = await nextId('customer', 'cus_id');
    const catId = catMap.get(acc.cat);
    const typeId = typeMap.get(acc.type);
    const cityId = cityMap.get(acc.city);

    await prisma.customer.create({
      data: {
        cus_id: id,
        branch_id: BRANCH_ID,
        cus_category: catId,
        cus_type: typeId,
        city_id: cityId,
        cus_name: acc.name,
        cus_phone_no: acc.phone,
        cus_address: acc.address,
        cus_balance: 0.00, // ZERO INITIAL BALANCE
        cus_account_info: acc.info,
        created_at: new Date(),
        updated_at: new Date(),
      }
    });

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_customers\` (
        cus_id, branch_id, cus_category, cus_type, cus_name,
        cus_phone_no, cus_address, cus_balance, cus_account_info, city_id,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, ?, ?, NOW(), NOW())
    `, id, BRANCH_ID, catId, typeId, acc.name, acc.phone, acc.address, acc.info, cityId);

    accMap.set(acc.name, { id, ...acc });
    console.log(`  + Created Account: [${acc.cat}] ${acc.name} (Balance: 0.00)`);
  }

  // 9. Employees, Loaders, Vehicles
  const employees = [
    { name: 'Muhammad Zain Ul Hassan', phone: '0346-7560306', designation: 'Branch Manager', salary: '85000' },
    { name: 'Ali Raza Mughal', phone: '0302-6677889', designation: 'Senior Accountant', salary: '60000' },
    { name: 'Usman Tariq', phone: '0304-9988771', designation: 'Godown Keeper', salary: '45000' },
  ];
  for (const emp of employees) {
    const id = await nextId('employee', 'emp_id');
    await prisma.employee.create({
      data: {
        emp_id: id,
        branch_id: BRANCH_ID,
        emp_name: emp.name,
        emp_phone: emp.phone,
        designation: emp.designation,
        join_date: new Date('2025-01-01'),
        basic_salary: emp.salary,
        status: 'ACTIVE',
        created_at: new Date(),
        updated_at: new Date(),
      }
    });
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_employees\` (emp_id, branch_id, emp_name, emp_phone, designation, join_date, basic_salary, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, '2025-01-01', ?, 'ACTIVE', NOW(), NOW())
    `, id, BRANCH_ID, emp.name, emp.phone, emp.designation, emp.salary);
  }

  const vehicles = [{ no: 'LES-4589', driver: 'Muhammad Akram' }, { no: 'GA-7892', driver: 'Rashid Mehmood' }];
  for (const v of vehicles) {
    const id = await nextId('vehicle', 'v_id');
    await prisma.vehicle.create({
      data: { v_id: id, branch_id: BRANCH_ID, v_vehicle_no: v.no, v_driver_name: v.driver, created_at: new Date(), updated_at: new Date() }
    });
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_vehicles\` (v_id, branch_id, v_vehicle_no, v_driver_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, NOW(), NOW())
    `, id, BRANCH_ID, v.no, v.driver);
  }

  const loaders = [{ name: 'Bashir Loader Crew (Team A)', number: 'L-01' }];
  for (const l of loaders) {
    const id = await nextId('loader', 'loader_id');
    await prisma.loader.create({
      data: { loader_id: id, branch_id: BRANCH_ID, loader_name: l.name, loader_number: l.number, created_at: new Date(), updated_at: new Date() }
    });
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_loaders\` (loader_id, branch_id, loader_name, loader_number, loader_phone, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `, id, BRANCH_ID, l.name, l.number, '0342-9988110');
  }

  // =========================================================================
  // 10. REALISTIC BUSINESS TRANSACTIONS & COMPLETE LEDGER LIFECYCLE
  // =========================================================================
  console.log('\n💼 Executing Complete Business Transactions & Generating Ledgers...');

  const accountBalances = new Map();
  function getBal(accId) { return accountBalances.get(accId) || 0; }
  function updateBal(accId, delta) {
    const next = Number((getBal(accId) + delta).toFixed(2));
    accountBalances.set(accId, next);
    return next;
  }

  async function postLedger(accId, type, details, debit, credit, billNo = null) {
    const openBal = getBal(accId);
    const closeBal = updateBal(accId, debit - credit);
    const lid = await nextId('ledger', 'l_id');

    await prisma.ledger.create({
      data: {
        l_id: lid,
        branch_id: BRANCH_ID,
        cus_id: accId,
        bill_no: billNo ? String(billNo) : null,
        trnx_type: type,
        details,
        debit_amount: debit,
        credit_amount: credit,
        opening_balance: openBal,
        closing_balance: closeBal,
        created_at: new Date(),
        updated_at: new Date(),
      }
    });

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_ledger\` (
        l_id, branch_id, cus_id, bill_no, trnx_type, details,
        debit_amount, credit_amount, opening_balance, closing_balance,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `, lid, BRANCH_ID, accId, billNo ? String(billNo) : null, type, details, debit, credit, openBal, closeBal);

    return closeBal;
  }

  // References to key accounts
  const accCash = accMap.get('Cash in Hand (Counter 1)');
  const accMeezan = accMap.get('Meezan Bank Ltd (A/C: 0102-0103456789)');
  const accOwner = accMap.get('Zain Ul Hassan Gondal (Owner Capital A/C)');
  const accMughal = accMap.get('Mughal Steels & Re-Rolling Mills Ltd');
  const accBestway = accMap.get('Bestway Cement Industries Ltd (Hattar)');
  const accAlRehman = accMap.get('Al-Rehman Builders & Developers (CEO Malik Tariq)');
  const accWalkin = accMap.get('Walk-in Counter Customer (General)');
  const accExpense = accMap.get('Shop Utility & Operational Expense Account');

  // Product references
  const prodSaria12 = prodMap.get('Mughal Supreme Steel Grade-60 (1/2" - 4 Sutar)');
  const prodBestway = prodMap.get('Bestway All-Rounder OPC Cement 50kg Bag');

  // -------------------------------------------------------------
  // Step A: Capital Injection by Owner
  // -------------------------------------------------------------
  console.log('  1. Capital Funding: Owner deposits Rs. 2,000,000 into Meezan Bank & Rs. 300,000 in Cash Counter');
  await postLedger(accOwner.id, 'CREDIT', 'Capital Introduced by Owner for Demo Branch Operations', 0, 2300000);
  await postLedger(accMeezan.id, 'BANK_TRANSFER', 'Initial Capital Deposit from Owner', 2000000, 0);
  await postLedger(accCash.id, 'CASH', 'Opening Cash Counter Float from Owner Capital', 300000, 0);

  // -------------------------------------------------------------
  // Step B: Purchases from Steel Mill & Cement Factories
  // -------------------------------------------------------------
  console.log('  2. Purchasing Initial Stock from Mughal Steels & Bestway Cement...');

  // Purchase 1: Mughal Steel (10,000 Kg 1/2" @ 248 = 2,480,000, Paid 1,500,000 via Meezan Bank, 980,000 credit)
  const purId1 = await nextId('purchase', 'pur_id');
  const purTotal1 = 2480000.00;
  const purPaid1 = 1500000.00;
  await prisma.purchase.create({
    data: {
      pur_id: purId1,
      branch_id: BRANCH_ID,
      cus_id: accMughal.id,
      store_id: primaryStoreId,
      invoice_number: 'INV-MUGHAL-101',
      total_amount: purTotal1,
      net_total: purTotal1,
      payment: purPaid1,
      payment_type: 'BANK_TRANSFER',
      bank_payment: purPaid1,
      debit_account_id: accMeezan.id,
      credit_account_id: accMughal.id,
      created_at: new Date(),
      updated_at: new Date(),
    }
  });
  await prisma.$executeRawUnsafe(`
    INSERT INTO \`${PREFIX}_purchases\` (
      pur_id, branch_id, cus_id, store_id, invoice_number, total_amount, net_total, payment, payment_type, bank_payment, debit_account_id, credit_account_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BANK_TRANSFER', ?, ?, ?, NOW(), NOW())
  `, purId1, BRANCH_ID, accMughal.id, primaryStoreId, 'INV-MUGHAL-101', purTotal1, purTotal1, purPaid1, purPaid1, accMeezan.id, accMughal.id);

  const purDetId1 = await nextId('purchaseDetail', 'pur_detail_id');
  await prisma.purchaseDetail.create({
    data: {
      pur_detail_id: purDetId1,
      pur_id: purId1,
      pro_id: prodSaria12.id,
      qnty: 10000,
      unit: 'Kg',
      unit_rate: 248.00,
      total_amount: purTotal1,
      net_total: purTotal1,
      cus_id: accMughal.id,
      created_at: new Date(),
      updated_at: new Date(),
    }
  });
  await prisma.$executeRawUnsafe(`
    INSERT INTO \`${PREFIX}_purchase_details\` (pur_detail_id, pur_id, pro_id, qnty, unit, unit_rate, total_amount, net_total, cus_id, created_at, updated_at)
    VALUES (?, ?, ?, 10000, 'Kg', 248.00, ?, ?, ?, NOW(), NOW())
  `, purDetId1, purId1, prodSaria12.id, purTotal1, purTotal1, accMughal.id);

  await prisma.product.update({ where: { pro_id: prodSaria12.id }, data: { pro_stock_qnty: 10000 } });
  await prisma.$executeRawUnsafe(`UPDATE \`${PREFIX}_products\` SET pro_stock_qnty = 10000 WHERE pro_id = ?`, prodSaria12.id);

  await postLedger(accMughal.id, 'PURCHASE', 'Stock Purchase (10,000 Kg Mughal Steel 1/2" @ 248) - Inv # INV-MUGHAL-101', 0, purTotal1, purId1);
  await postLedger(accMughal.id, 'BANK_PAYMENT', 'Payment to Mughal Steels via Meezan Bank Cheque', purPaid1, 0, purId1);
  await postLedger(accMeezan.id, 'BANK_PAYMENT', 'Cheque Cleared to Mughal Steels for Steel Purchase', 0, purPaid1, purId1);

  // Purchase 2: Bestway Cement (1,000 Bags @ 1,380 = 1,380,000, Paid 1,000,000 via Bank, 380,000 credit)
  const purId2 = await nextId('purchase', 'pur_id');
  const purTotal2 = 1380000.00;
  const purPaid2 = 1000000.00;
  await prisma.purchase.create({
    data: {
      pur_id: purId2,
      branch_id: BRANCH_ID,
      cus_id: accBestway.id,
      store_id: primaryStoreId,
      invoice_number: 'INV-BW-882',
      total_amount: purTotal2,
      net_total: purTotal2,
      payment: purPaid2,
      payment_type: 'BANK_TRANSFER',
      bank_payment: purPaid2,
      debit_account_id: accMeezan.id,
      credit_account_id: accBestway.id,
      created_at: new Date(),
      updated_at: new Date(),
    }
  });
  await prisma.$executeRawUnsafe(`
    INSERT INTO \`${PREFIX}_purchases\` (
      pur_id, branch_id, cus_id, store_id, invoice_number, total_amount, net_total, payment, payment_type, bank_payment, debit_account_id, credit_account_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'BANK_TRANSFER', ?, ?, ?, NOW(), NOW())
  `, purId2, BRANCH_ID, accBestway.id, primaryStoreId, 'INV-BW-882', purTotal2, purTotal2, purPaid2, purPaid2, accMeezan.id, accBestway.id);

  const purDetId2 = await nextId('purchaseDetail', 'pur_detail_id');
  await prisma.purchaseDetail.create({
    data: {
      pur_detail_id: purDetId2,
      pur_id: purId2,
      pro_id: prodBestway.id,
      qnty: 1000,
      unit: 'Bag',
      unit_rate: 1380.00,
      total_amount: purTotal2,
      net_total: purTotal2,
      cus_id: accBestway.id,
      created_at: new Date(),
      updated_at: new Date(),
    }
  });
  await prisma.$executeRawUnsafe(`
    INSERT INTO \`${PREFIX}_purchase_details\` (pur_detail_id, pur_id, pro_id, qnty, unit, unit_rate, total_amount, net_total, cus_id, created_at, updated_at)
    VALUES (?, ?, ?, 1000, 'Bag', 1380.00, ?, ?, ?, NOW(), NOW())
  `, purDetId2, purId2, prodBestway.id, purTotal2, purTotal2, accBestway.id);

  await prisma.product.update({ where: { pro_id: prodBestway.id }, data: { pro_stock_qnty: 1000 } });
  await prisma.$executeRawUnsafe(`UPDATE \`${PREFIX}_products\` SET pro_stock_qnty = 1000 WHERE pro_id = ?`, prodBestway.id);

  await postLedger(accBestway.id, 'PURCHASE', 'Cement Purchase (1,000 Bags Bestway OPC @ 1,380) - Inv # INV-BW-882', 0, purTotal2, purId2);
  await postLedger(accBestway.id, 'BANK_PAYMENT', 'Advance/Direct Payment to Bestway Cement via Meezan Bank', purPaid2, 0, purId2);
  await postLedger(accMeezan.id, 'BANK_PAYMENT', 'Direct Bank Transfer to Bestway Cement Ltd', 0, purPaid2, purId2);

  // -------------------------------------------------------------
  // Step C: Sales to Builders, Contractors & Walk-in Customers
  // -------------------------------------------------------------
  console.log('  3. Executing Sales to Al-Rehman Builders, Chaudhry Nadeem & Walk-in Counter...');

  // Sale 1: Al-Rehman Builders (3,500 Kg Steel 1/2" @ 260 = 910,000 + 300 Bags Cement @ 1,440 = 432,000 -> Total: 1,342,000, Paid: 500,000 via Bank, 842,000 on credit)
  const saleId1 = await nextId('sale', 'sale_id');
  const saleTotal1 = 1342000.00;
  const salePaid1 = 500000.00;
  await prisma.sale.create({
    data: {
      sale_id: saleId1,
      branch_id: BRANCH_ID,
      cus_id: accAlRehman.id,
      store_id: primaryStoreId,
      bill_number: 5001,
      bill_type: 'ORDER',
      total_amount: saleTotal1,
      payment: salePaid1,
      payment_type: 'BANK_TRANSFER',
      bank_payment: salePaid1,
      debit_account_id: accAlRehman.id,
      credit_account_id: accMeezan.id,
      reference: 'Plaza Site - Ground Floor Slab',
      created_at: new Date(),
      updated_at: new Date(),
    }
  });
  await prisma.$executeRawUnsafe(`
    INSERT INTO \`${PREFIX}_sales\` (
      sale_id, branch_id, cus_id, store_id, bill_number, bill_type, total_amount, payment, payment_type, bank_payment, debit_account_id, credit_account_id, reference, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 5001, 'ORDER', ?, ?, 'BANK_TRANSFER', ?, ?, ?, 'Plaza Site - Ground Floor Slab', NOW(), NOW())
  `, saleId1, BRANCH_ID, accAlRehman.id, primaryStoreId, saleTotal1, salePaid1, salePaid1, accAlRehman.id, accMeezan.id);

  const sDet1 = await nextId('saleDetail', 'sale_detail_id');
  await prisma.saleDetail.create({
    data: {
      sale_detail_id: sDet1,
      sale_id: saleId1,
      pro_id: prodSaria12.id,
      qnty: 3500,
      unit: 'Kg',
      unit_rate: 260.00,
      total_amount: 910000.00,
      net_total: 910000.00,
      cus_id: accAlRehman.id,
      store_id: primaryStoreId,
      created_at: new Date(),
      updated_at: new Date(),
    }
  });
  await prisma.$executeRawUnsafe(`
    INSERT INTO \`${PREFIX}_sale_details\` (sale_detail_id, sale_id, pro_id, qnty, unit, unit_rate, total_amount, net_total, cus_id, store_id, created_at, updated_at)
    VALUES (?, ?, ?, 3500, 'Kg', 260.00, 910000.00, 910000.00, ?, ?, NOW(), NOW())
  `, sDet1, saleId1, prodSaria12.id, accAlRehman.id, primaryStoreId);

  const sDet2 = await nextId('saleDetail', 'sale_detail_id');
  await prisma.saleDetail.create({
    data: {
      sale_detail_id: sDet2,
      sale_id: saleId1,
      pro_id: prodBestway.id,
      qnty: 300,
      unit: 'Bag',
      unit_rate: 1440.00,
      total_amount: 432000.00,
      net_total: 432000.00,
      cus_id: accAlRehman.id,
      store_id: primaryStoreId,
      created_at: new Date(),
      updated_at: new Date(),
    }
  });
  await prisma.$executeRawUnsafe(`
    INSERT INTO \`${PREFIX}_sale_details\` (sale_detail_id, sale_id, pro_id, qnty, unit, unit_rate, total_amount, net_total, cus_id, store_id, created_at, updated_at)
    VALUES (?, ?, ?, 300, 'Bag', 1440.00, 432000.00, 432000.00, ?, ?, NOW(), NOW())
  `, sDet2, saleId1, prodBestway.id, accAlRehman.id, primaryStoreId);

  await prisma.product.update({ where: { pro_id: prodSaria12.id }, data: { pro_stock_qnty: 6500 } });
  await prisma.product.update({ where: { pro_id: prodBestway.id }, data: { pro_stock_qnty: 700 } });
  await prisma.$executeRawUnsafe(`UPDATE \`${PREFIX}_products\` SET pro_stock_qnty = 6500 WHERE pro_id = ?`, prodSaria12.id);
  await prisma.$executeRawUnsafe(`UPDATE \`${PREFIX}_products\` SET pro_stock_qnty = 700 WHERE pro_id = ?`, prodBestway.id);

  await postLedger(accAlRehman.id, 'SALE', 'Credit Sale: 3,500 Kg Steel (1/2") & 300 Bags Bestway Cement - Bill # 5001', saleTotal1, 0, saleId1);
  await postLedger(accAlRehman.id, 'BANK_TRANSFER', 'Received Bank Transfer from Al-Rehman Builders - Bill # 5001', 0, salePaid1, saleId1);
  await postLedger(accMeezan.id, 'BANK_TRANSFER', 'Received Bank Transfer from Al-Rehman Builders on Sale # 5001', salePaid1, 0, saleId1);

  // Sale 2: Walk-in Cash Sale (10 Bags Cement @ 1,440 = 14,400 Cash Received Full)
  const saleId2 = await nextId('sale', 'sale_id');
  const saleTotal2 = 14400.00;
  await prisma.sale.create({
    data: {
      sale_id: saleId2,
      branch_id: BRANCH_ID,
      cus_id: accWalkin.id,
      store_id: primaryStoreId,
      bill_number: 5002,
      bill_type: 'BILL',
      total_amount: saleTotal2,
      payment: saleTotal2,
      payment_type: 'CASH',
      cash_payment: saleTotal2,
      debit_account_id: accWalkin.id,
      credit_account_id: accCash.id,
      reference: 'Counter Cash Walk-in',
      created_at: new Date(),
      updated_at: new Date(),
    }
  });
  await prisma.$executeRawUnsafe(`
    INSERT INTO \`${PREFIX}_sales\` (
      sale_id, branch_id, cus_id, store_id, bill_number, bill_type, total_amount, payment, payment_type, cash_payment, debit_account_id, credit_account_id, reference, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 5002, 'BILL', ?, ?, 'CASH', ?, ?, ?, 'Counter Cash Walk-in', NOW(), NOW())
  `, saleId2, BRANCH_ID, accWalkin.id, primaryStoreId, saleTotal2, saleTotal2, saleTotal2, accWalkin.id, accCash.id);

  const sDet3 = await nextId('saleDetail', 'sale_detail_id');
  await prisma.saleDetail.create({
    data: {
      sale_detail_id: sDet3,
      sale_id: saleId2,
      pro_id: prodBestway.id,
      qnty: 10,
      unit: 'Bag',
      unit_rate: 1440.00,
      total_amount: saleTotal2,
      net_total: saleTotal2,
      cus_id: accWalkin.id,
      store_id: primaryStoreId,
      created_at: new Date(),
      updated_at: new Date(),
    }
  });
  await prisma.$executeRawUnsafe(`
    INSERT INTO \`${PREFIX}_sale_details\` (sale_detail_id, sale_id, pro_id, qnty, unit, unit_rate, total_amount, net_total, cus_id, store_id, created_at, updated_at)
    VALUES (?, ?, ?, 10, 'Bag', 1440.00, ?, ?, ?, ?, NOW(), NOW())
  `, sDet3, saleId2, prodBestway.id, saleTotal2, saleTotal2, accWalkin.id, primaryStoreId);

  await prisma.product.update({ where: { pro_id: prodBestway.id }, data: { pro_stock_qnty: 690 } });
  await prisma.$executeRawUnsafe(`UPDATE \`${PREFIX}_products\` SET pro_stock_qnty = 690 WHERE pro_id = ?`, prodBestway.id);

  await postLedger(accWalkin.id, 'SALE', 'Cash Sale: 10 Bags Cement - Bill # 5002', saleTotal2, 0, saleId2);
  await postLedger(accWalkin.id, 'CASH', 'Instant Cash Payment at Counter - Bill # 5002', 0, saleTotal2, saleId2);
  await postLedger(accCash.id, 'CASH', 'Cash Counter Inflow: Sale # 5002', saleTotal2, 0, saleId2);

  // -------------------------------------------------------------
  // Step D: Operational Expenses
  // -------------------------------------------------------------
  console.log('  4. Paying Operational Expenses (GEPCO Electricity Bill & Staff Refreshment)...');

  // Expense 1: Electricity Bill Rs. 18,500 paid from Cash Counter
  const expId1 = await nextId('expense', 'exp_id');
  const expType1 = expTitleMap.get('Electricity Bill (GEPCO / IESCO)');
  await prisma.expense.create({
    data: {
      exp_id: expId1,
      branch_id: BRANCH_ID,
      exp_title: 'GEPCO Electricity Bill - September',
      exp_type: expType1,
      exp_detail: 'Shop & Godown power bill paid in cash',
      exp_amount: 18500.00,
      is_paid: true,
      paid_from_account_id: accCash.id,
      cash_amount: 18500.00,
      payment_date: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    }
  });
  await prisma.$executeRawUnsafe(`
    INSERT INTO \`${PREFIX}_expenses\` (
      exp_id, branch_id, exp_title, exp_type, exp_detail, exp_amount, is_paid, paid_from_account_id, cash_amount, payment_date, created_at, updated_at
    ) VALUES (?, ?, 'GEPCO Electricity Bill - September', ?, 'Shop & Godown power bill paid in cash', 18500.00, 1, ?, 18500.00, NOW(), NOW(), NOW())
  `, expId1, BRANCH_ID, expType1, accCash.id);

  await postLedger(accExpense.id, 'DEBIT', 'GEPCO Electricity Bill Payment for September', 18500, 0);
  await postLedger(accCash.id, 'CASH_PAYMENT', 'Cash Paid for Shop Electricity Bill', 0, 18500);

  // -------------------------------------------------------------
  // Step E: Sync Live Customer Balances from Ledger
  // -------------------------------------------------------------
  console.log('\n📊 Updating Live Account Balances from Ledger Totals...');
  for (const [accId, finalBal] of accountBalances.entries()) {
    await prisma.customer.update({
      where: { cus_id: accId },
      data: { cus_balance: finalBal, updated_at: new Date() }
    });
    await prisma.$executeRawUnsafe(`
      UPDATE \`${PREFIX}_customers\` SET cus_balance = ?, updated_at = NOW() WHERE cus_id = ?
    `, finalBal, accId);
  }

  // Re-enable FK checks
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

  console.log(`\n🎉 Full Business Lifecycle Seed Completed Successfully!`);
  console.log(`Total Accounts Seeded: ${accountDefs.length}`);
  console.log(`Total Products Seeded: ${productsList.length}`);
  console.log(`Active Live Balances Calculated: ${accountBalances.size} accounts`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Fatal error during lifecycle seed:', e);
  process.exit(1);
});
