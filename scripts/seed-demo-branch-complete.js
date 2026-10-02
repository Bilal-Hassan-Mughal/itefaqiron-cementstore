/**
 * Comprehensive Realistic Seed Data for DEMO Branch (branch_id = 8)
 * Populates both demo_* prefixed tables and shared tables with branch_id = 8.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BRANCH_ID = 8;
const PREFIX = 'demo';

async function main() {
  console.log('🚀 Seeding comprehensive realistic data for DEMO Branch...\n');

  // Disable FK checks during seed
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');

  // 1. Customer Categories (Account Categories)
  const customerCategories = [
    { id: 1, title: 'Customers' },
    { id: 2, title: 'Suppliers & Mills' },
    { id: 3, title: 'Banks & Financial Institutions' },
    { id: 4, title: 'Cash & Counter Accounts' },
    { id: 5, title: 'Expense Accounts' },
    { id: 6, title: 'Staff & Employees' },
    { id: 7, title: 'Partners & Capital' },
  ];

  console.log('📦 Seeding Account Categories...');
  for (const cat of customerCategories) {
    // Shared table
    await prisma.$executeRawUnsafe(`
      INSERT INTO customer_categories (cus_cat_id, branch_id, cus_cat_title)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE cus_cat_title = VALUES(cus_cat_title)
    `, cat.id, BRANCH_ID, cat.title);

    // demo_ table
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_customer_categories\` (cus_cat_id, branch_id, cus_cat_title)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE cus_cat_title = VALUES(cus_cat_title)
    `, cat.id, BRANCH_ID, cat.title);
  }

  // 2. Customer Types (Account Sub-types)
  const customerTypes = [
    { id: 1, title: 'Retail Customer' },
    { id: 2, title: 'Wholesale & Trader' },
    { id: 3, title: 'Builder & Developer' },
    { id: 4, title: 'Contractor & Mason' },
    { id: 5, title: 'Fabricator & Welder' },
    { id: 6, title: 'Cement Manufacturer / Distributor' },
    { id: 7, title: 'Steel Mill / Re-Rolling Mill' },
    { id: 8, title: 'Hardware & Sanitary Supplier' },
    { id: 9, title: 'Commercial Islamic Bank' },
    { id: 10, title: 'Main Cash Counter' },
    { id: 11, title: 'Petty Cash Counter' },
    { id: 12, title: 'Utility & Rent Expense' },
  ];

  console.log('📦 Seeding Account Types...');
  for (const typ of customerTypes) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO customer_types (cus_type_id, branch_id, cus_type_title)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE cus_type_title = VALUES(cus_type_title)
    `, typ.id, BRANCH_ID, typ.title);

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_customer_types\` (cus_type_id, branch_id, cus_type_title)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE cus_type_title = VALUES(cus_type_title)
    `, typ.id, BRANCH_ID, typ.title);
  }

  // 3. Cities
  const cities = [
    { id: 1, name: 'Lahore' },
    { id: 2, name: 'Gujrat' },
    { id: 3, name: 'Mandi Bahauddin' },
    { id: 4, name: 'Sargodha' },
    { id: 5, name: 'Islamabad / Rawalpindi' },
    { id: 6, name: 'Faisalabad' },
    { id: 7, name: 'Pahrian Wali' },
  ];

  console.log('🌆 Seeding Cities...');
  for (const c of cities) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO cities (city_id, branch_id, city_name)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE city_name = VALUES(city_name)
    `, c.id, BRANCH_ID, c.name);

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_cities\` (city_id, branch_id, city_name)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE city_name = VALUES(city_name)
    `, c.id, BRANCH_ID, c.name);
  }

  // 4. Stores / Warehouses
  const stores = [
    { id: 1, name: 'Main Godown (Sargodha Road)', address: 'Main GT Road, Plot 14-A' },
    { id: 2, name: 'Shop Front / Retail Store', address: 'Shop # 1-3, Iron Market' },
  ];

  console.log('🏪 Seeding Stores...');
  for (const s of stores) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO stores (storeid, branch_id, store_name, store_address)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE store_name = VALUES(store_name)
    `, s.id, BRANCH_ID, s.name, s.address);

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_stores\` (storeid, branch_id, store_name, store_address)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE store_name = VALUES(store_name)
    `, s.id, BRANCH_ID, s.name, s.address);
  }

  // 5. Expense Titles
  const expenseTitles = [
    { id: 1, title: 'Electricity Bill (GEPCO / IESCO)' },
    { id: 2, title: 'Shop & Godown Rent' },
    { id: 3, title: 'Staff Tea, Food & Refreshment' },
    { id: 4, title: 'Vehicle Fuel & Maintenance' },
    { id: 5, title: 'Printing, Stationary & Office Supplies' },
    { id: 6, title: 'Generator Diesel & Repair' },
  ];

  console.log('📑 Seeding Expense Titles...');
  for (const et of expenseTitles) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO expense_titles (id, branch_id, title)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE title = VALUES(title)
    `, et.id, BRANCH_ID, et.title);

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_expense_titles\` (id, branch_id, title)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE title = VALUES(title)
    `, et.id, BRANCH_ID, et.title);
  }

  // 6. Product Categories & Subcategories
  const productCategories = [
    { id: 1, name: 'Steel & Deformed Bars', code: 'DEMO_STEEL' },
    { id: 2, name: 'Cement & Binding Materials', code: 'DEMO_CEMENT' },
    { id: 3, name: 'Garder & TR Channels', code: 'DEMO_GARDER' },
    { id: 4, name: 'MS Pipes & Hollow Sections', code: 'DEMO_PIPES' },
    { id: 5, name: 'Building Aggregates & Sand', code: 'DEMO_SAND' },
    { id: 6, name: 'Hardware & Construction Tools', code: 'DEMO_HARDWARE' },
  ];

  console.log('🏷️ Seeding Product Categories...');
  for (const pc of productCategories) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO categories (cat_id, branch_id, cat_name, cat_code)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE cat_name = VALUES(cat_name)
    `, pc.id, BRANCH_ID, pc.name, pc.code);

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_categories\` (cat_id, branch_id, cat_name, cat_code)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE cat_name = VALUES(cat_name)
    `, pc.id, BRANCH_ID, pc.name, pc.code);
  }

  const subCategories = [
    { id: 1, cat_id: 1, name: 'Grade 60 Deformed Bar (Saria)', code: 'DEMO_SARIA_G60' },
    { id: 2, cat_id: 1, name: 'Grade 40 Deformed Bar', code: 'DEMO_SARIA_G40' },
    { id: 3, cat_id: 1, name: 'Steel Binding Wire', code: 'DEMO_BIND_WIRE' },
    { id: 4, cat_id: 2, name: 'Ordinary Portland Cement (OPC)', code: 'DEMO_OPC_CEMENT' },
    { id: 5, cat_id: 2, name: 'Sulphate Resistant Cement (SRC)', code: 'DEMO_SRC_CEMENT' },
    { id: 6, cat_id: 3, name: 'Heavy Girder (I-Beam)', code: 'DEMO_HEAVY_GIRDER' },
    { id: 7, cat_id: 3, name: 'TR Channel Section', code: 'DEMO_TR_CHANNEL' },
    { id: 8, cat_id: 4, name: 'MS Square Box Pipe', code: 'DEMO_SQ_PIPE' },
    { id: 9, cat_id: 4, name: 'MS Round Pipe', code: 'DEMO_RND_PIPE' },
    { id: 10, cat_id: 5, name: 'Margalla Hill Crush (Bajri)', code: 'DEMO_CRUSH_BAJRI' },
    { id: 11, cat_id: 5, name: 'Chenab / Ravi Sand', code: 'DEMO_SAND_FINE' },
    { id: 12, cat_id: 6, name: 'Steel Nails & Fasteners', code: 'DEMO_NAILS' },
  ];

  console.log('🏷️ Seeding Product Subcategories...');
  for (const sc of subCategories) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO sub_categories (sub_cat_id, branch_id, cat_id, sub_cat_name, sub_cat_code)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE sub_cat_name = VALUES(sub_cat_name)
    `, sc.id, BRANCH_ID, sc.cat_id, sc.name, sc.code);

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_sub_categories\` (sub_cat_id, branch_id, cat_id, sub_cat_name, sub_cat_code)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE sub_cat_name = VALUES(sub_cat_name)
    `, sc.id, BRANCH_ID, sc.cat_id, sc.name, sc.code);
  }

  // 7. Realistic Products with Pricing, Cost & Initial Stock
  const products = [
    {
      id: 1,
      cat_id: 1,
      sub_cat_id: 1,
      title: 'Mughal Supreme Steel Grade-60 (1/2" - 4 Sutar)',
      description: 'Mughal Supreme ASTM A615 Grade-60 Deformed Bar 12mm',
      cost: '248.00',
      sale: '260.00',
      stock: 15500,
      unit: 'Kg',
      packing: 'Bundles',
      lowStock: 1000
    },
    {
      id: 2,
      cat_id: 1,
      sub_cat_id: 1,
      title: 'Mughal Supreme Steel Grade-60 (3/8" - 3 Sutar)',
      description: 'Mughal Supreme ASTM A615 Grade-60 Deformed Bar 10mm',
      cost: '250.00',
      sale: '262.00',
      stock: 12000,
      unit: 'Kg',
      packing: 'Bundles',
      lowStock: 1000
    },
    {
      id: 3,
      cat_id: 1,
      sub_cat_id: 1,
      title: 'Amreli Steels Xtreme G-60 (5/8" - 5 Sutar)',
      description: 'Amreli Xtreme High Tensile Grade-60 Rebar 16mm',
      cost: '252.00',
      sale: '265.00',
      stock: 8500,
      unit: 'Kg',
      packing: 'Bundles',
      lowStock: 800
    },
    {
      id: 4,
      cat_id: 1,
      sub_cat_id: 3,
      title: 'Black Annealed Binding Wire 20 Gauge',
      description: 'Soft iron binding wire for steel rebar fixation',
      cost: '270.00',
      sale: '310.00',
      stock: 650,
      unit: 'Kg',
      packing: 'Roll',
      lowStock: 50
    },
    {
      id: 5,
      cat_id: 2,
      sub_cat_id: 4,
      title: 'Bestway All-Rounder OPC Cement 50kg Bag',
      description: 'Bestway Ordinary Portland Cement 50kg Paper/Poly Bag',
      cost: '1380.00',
      sale: '1440.00',
      stock: 1200,
      unit: 'Bag',
      packing: '50kg Bag',
      lowStock: 100
    },
    {
      id: 6,
      cat_id: 2,
      sub_cat_id: 4,
      title: 'Lucky Cement Supreme OPC 50kg Bag',
      description: 'Lucky Cement Premium Grade OPC 50kg Bag',
      cost: '1390.00',
      sale: '1450.00',
      stock: 950,
      unit: 'Bag',
      packing: '50kg Bag',
      lowStock: 100
    },
    {
      id: 7,
      cat_id: 2,
      sub_cat_id: 4,
      title: 'Fauji Cement Standard OPC 50kg Bag',
      description: 'Fauji Cement High Strength 50kg Bag',
      cost: '1375.00',
      sale: '1435.00',
      stock: 800,
      unit: 'Bag',
      packing: '50kg Bag',
      lowStock: 100
    },
    {
      id: 8,
      cat_id: 3,
      sub_cat_id: 6,
      title: 'Heavy Iron Girder 7" x 4" (Per Foot)',
      description: 'Heavy Structural Steel I-Girder 7x4 for Roof Support',
      cost: '850.00',
      sale: '980.00',
      stock: 450,
      unit: 'Ft',
      packing: 'Pieces',
      lowStock: 30
    },
    {
      id: 9,
      cat_id: 3,
      sub_cat_id: 7,
      title: 'Standard TR Channel Section 4" x 2" 16-Gauge',
      description: 'TR Channel for T-Iron Ceiling Framing',
      cost: '420.00',
      sale: '490.00',
      stock: 600,
      unit: 'Ft',
      packing: 'Pieces',
      lowStock: 50
    },
    {
      id: 10,
      cat_id: 4,
      sub_cat_id: 8,
      title: 'MS Square Box Pipe 1.5" x 1.5" (16 Gauge - 20ft)',
      description: 'Square hollow tube section for gates and railings',
      cost: '1850.00',
      sale: '2150.00',
      stock: 350,
      unit: 'Length',
      packing: '20ft Length',
      lowStock: 25
    },
    {
      id: 11,
      cat_id: 4,
      sub_cat_id: 9,
      title: 'MS Round Pipe 2" Diameter (14 Gauge - 20ft)',
      description: 'Heavy round pipe for structure and scaffolding',
      cost: '2450.00',
      sale: '2800.00',
      stock: 220,
      unit: 'Length',
      packing: '20ft Length',
      lowStock: 20
    },
    {
      id: 12,
      cat_id: 5,
      sub_cat_id: 10,
      title: 'Margalla Hill Blue Stone Crush (1/2" Size)',
      description: 'Clean screened crushed stone for roof lintels & beams',
      cost: '115.00',
      sale: '135.00',
      stock: 5000,
      unit: 'Cft',
      packing: 'Loose Trolley',
      lowStock: 500
    },
    {
      id: 13,
      cat_id: 5,
      sub_cat_id: 11,
      title: 'Chenab River Coarse Sand (Screened)',
      description: 'High quality coarse sand for brick masonry & plaster',
      cost: '65.00',
      sale: '80.00',
      stock: 7500,
      unit: 'Cft',
      packing: 'Loose Trolley',
      lowStock: 800
    },
    {
      id: 14,
      cat_id: 6,
      sub_cat_id: 12,
      title: 'Hardened Steel Construction Nails 3" (Box of 5kg)',
      description: 'Heavy gauge steel nails for wooden shuttering',
      cost: '1450.00',
      sale: '1750.00',
      stock: 120,
      unit: 'Box',
      packing: '5kg Box',
      lowStock: 15
    }
  ];

  console.log('🔨 Seeding Realistic Products & Stock...');
  for (const p of products) {
    // Shared table
    await prisma.$executeRawUnsafe(`
      INSERT INTO products (
        pro_id, branch_id, cat_id, sub_cat_id, pro_title, pro_description,
        pro_cost_price, pro_sale_price, pro_baser_price, pro_stock_qnty,
        pro_unit, pro_packing, pro_low_stock
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        pro_title = VALUES(pro_title),
        pro_cost_price = VALUES(pro_cost_price),
        pro_sale_price = VALUES(pro_sale_price),
        pro_stock_qnty = VALUES(pro_stock_qnty),
        pro_low_stock = VALUES(pro_low_stock)
    `, p.id, BRANCH_ID, p.cat_id, p.sub_cat_id, p.title, p.description,
       p.cost, p.sale, p.sale, p.stock, p.unit, p.packing, p.lowStock);

    // demo_ table
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_products\` (
        pro_id, branch_id, cat_id, sub_cat_id, pro_title, pro_description,
        pro_cost_price, pro_sale_price, pro_baser_price, pro_stock_qnty,
        pro_unit, pro_packing, pro_low_stock
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        pro_title = VALUES(pro_title),
        pro_cost_price = VALUES(pro_cost_price),
        pro_sale_price = VALUES(pro_sale_price),
        pro_stock_qnty = VALUES(pro_stock_qnty),
        pro_low_stock = VALUES(pro_low_stock)
    `, p.id, BRANCH_ID, p.cat_id, p.sub_cat_id, p.title, p.description,
       p.cost, p.sale, p.sale, p.stock, p.unit, p.packing, p.lowStock);

    // Store stock allocation
    await prisma.$executeRawUnsafe(`
      INSERT INTO store_stocks (store_id, pro_id, stock_quantity, min_stock, max_stock)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE stock_quantity = VALUES(stock_quantity)
    `, 1, p.id, p.stock, p.lowStock, p.stock * 2);

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_store_stocks\` (store_id, pro_id, stock_quantity, min_stock, max_stock)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE stock_quantity = VALUES(stock_quantity)
    `, 1, p.id, p.stock, p.lowStock, p.stock * 2);
  }

  // 8. Realistic Accounts (Customers, Suppliers, Banks, Cash in Hand)
  const accounts = [
    // Cash Accounts (Cat: 4, Type: 10, 11)
    {
      id: 1,
      cat_id: 4,
      type_id: 10,
      city_id: 7,
      name: 'Cash in Hand (Counter 1)',
      phone: '0346-7560306',
      address: 'Shop Counter, Pahrian Wali',
      balance: 150000.00,
      account_info: 'Primary cash register account for daily counter sales'
    },
    {
      id: 2,
      cat_id: 4,
      type_id: 11,
      city_id: 7,
      name: 'Petty Cash Account',
      phone: '0346-7560306',
      address: 'Office Safe',
      balance: 25000.00,
      account_info: 'Daily small office operational and refreshment expenses'
    },

    // Commercial Bank Accounts (Cat: 3, Type: 9)
    {
      id: 3,
      cat_id: 3,
      type_id: 9,
      city_id: 2,
      name: 'Meezan Bank Ltd (A/C: 0102-0103456789)',
      phone: '053-3521400',
      address: 'Circular Road Branch, Gujrat',
      balance: 850000.00,
      account_info: 'IBAN: PK45MEZN0001020103456789 - Title: Ittefaq Iron & Cement'
    },
    {
      id: 4,
      cat_id: 3,
      type_id: 9,
      city_id: 2,
      name: 'Bank Alfalah Islamic (A/C: 5501-9876543210)',
      phone: '053-3518200',
      address: 'GT Road Branch, Gujrat',
      balance: 420000.00,
      account_info: 'IBAN: PK12ALFH0055019876543210 - Title: Ittefaq Store'
    },
    {
      id: 5,
      cat_id: 3,
      type_id: 9,
      city_id: 4,
      name: 'Habib Bank Limited - HBL (A/C: 0892-77441122)',
      phone: '048-3721900',
      address: 'Main Branch, Sargodha',
      balance: 310000.00,
      account_info: 'IBAN: PK89HABB0008927744112201 - Title: Zain Ul Hassan Gondal'
    },

    // Suppliers & Mills (Cat: 2, Type: 6, 7, 8)
    {
      id: 6,
      cat_id: 2,
      type_id: 7,
      city_id: 1,
      name: 'Mughal Steels & Re-Rolling Mills Ltd',
      phone: '042-35960100',
      address: 'Badami Bagh Industrial Area, Lahore',
      balance: -450000.00, // Payable
      account_info: 'Supplier Code: SPL-MUGHAL-01 (Steel rebar direct dispatch)'
    },
    {
      id: 7,
      cat_id: 2,
      type_id: 6,
      city_id: 5,
      name: 'Bestway Cement Industries Ltd (Hattar)',
      phone: '051-111119292',
      address: 'Bestway Complex, Blue Area Islamabad',
      balance: -320000.00, // Payable
      account_info: 'Dealer Code: DLR-BW-8891'
    },
    {
      id: 8,
      cat_id: 2,
      type_id: 6,
      city_id: 5,
      name: 'Lucky Cement Corporation Ltd',
      phone: '021-111786555',
      address: 'Regional Distribution Hub, Rawalpindi',
      balance: -180000.00, // Payable
      account_info: 'Direct Mill Supply Account'
    },
    {
      id: 9,
      cat_id: 2,
      type_id: 7,
      city_id: 6,
      name: 'Ittehad Steel & Pipe Industries',
      phone: '041-8724100',
      address: 'Samundri Road, Faisalabad',
      balance: -95000.00, // Payable
      account_info: 'Pipes & Girder manufacturer'
    },

    // Customers / Builders / Contractors (Cat: 1, Type: 1, 2, 3, 4, 5)
    {
      id: 10,
      cat_id: 1,
      type_id: 1,
      city_id: 7,
      name: 'Walk-in Counter Customer (General)',
      phone: '0300-0000000',
      address: 'Pahrian Wali',
      balance: 0.00,
      account_info: 'Cash walk-in retail sales'
    },
    {
      id: 11,
      cat_id: 1,
      type_id: 3,
      city_id: 2,
      name: 'Al-Rehman Builders & Developers (CEO Malik Tariq)',
      phone: '0300-6214589',
      address: 'Rehman City Phase 2, Sargodha Road, Gujrat',
      balance: 685000.00, // Receivable
      account_info: 'Credit Limit: 1.5 Million | Site: Commercial Plaza Block C'
    },
    {
      id: 12,
      cat_id: 1,
      type_id: 3,
      city_id: 3,
      name: 'Chaudhry Nadeem Construction Co.',
      phone: '0302-8419200',
      address: 'Katchery Road, Mandi Bahauddin',
      balance: 412000.00, // Receivable
      account_info: 'Credit Limit: 1.0 Million | Govt & Private Contracting'
    },
    {
      id: 13,
      cat_id: 1,
      type_id: 4,
      city_id: 7,
      name: 'Ustad Asghar Mason & Contractor',
      phone: '0345-9812450',
      address: 'Adda Pahrian Wali',
      balance: 145000.00, // Receivable
      account_info: 'Residential house construction contractor'
    },
    {
      id: 14,
      cat_id: 1,
      type_id: 5,
      city_id: 2,
      name: 'Rana Zafar Welder & Steel Fabricator',
      phone: '0313-7744110',
      address: 'Railway Road, Gujrat',
      balance: 78500.00, // Receivable
      account_info: 'Main Gate & Safety Grill fabrication works'
    },
    {
      id: 15,
      cat_id: 1,
      type_id: 2,
      city_id: 3,
      name: 'Bismillah Building Material & Hardware Store',
      phone: '0301-5522334',
      address: 'Chilka Chowk, Mandi Bahauddin',
      balance: 290000.00, // Receivable
      account_info: 'Sub-dealer & Wholesale customer'
    },
    {
      id: 16,
      cat_id: 1,
      type_id: 1,
      city_id: 7,
      name: 'Haji Muhammad Iqbal (Kot Sar)',
      phone: '0304-6129840',
      address: 'Village Kot Sar, Tehsil Phalia',
      balance: 56000.00, // Receivable
      account_info: 'Farmhouse construction project'
    },
    {
      id: 17,
      cat_id: 1,
      type_id: 1,
      city_id: 7,
      name: 'Bilal Qadri Sahib (Adda)',
      phone: '0300-7711223',
      address: 'Main Bazar, Pahrian Wali',
      balance: 38400.00, // Receivable
      account_info: 'Shop roof renovation'
    }
  ];

  console.log('👥 Seeding Realistic Accounts & Customers...');
  for (const acc of accounts) {
    // Shared table
    await prisma.$executeRawUnsafe(`
      INSERT INTO customers (
        cus_id, branch_id, cus_category, cus_type, cus_name,
        cus_phone_no, cus_address, cus_balance, cus_account_info, city_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        cus_name = VALUES(cus_name),
        cus_category = VALUES(cus_category),
        cus_type = VALUES(cus_type),
        cus_phone_no = VALUES(cus_phone_no),
        cus_address = VALUES(cus_address),
        cus_balance = VALUES(cus_balance),
        cus_account_info = VALUES(cus_account_info)
    `, acc.id, BRANCH_ID, acc.cat_id, acc.type_id, acc.name,
       acc.phone, acc.address, acc.balance, acc.account_info, acc.city_id);

    // demo_ table
    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_customers\` (
        cus_id, branch_id, cus_category, cus_type, cus_name,
        cus_phone_no, cus_address, cus_balance, cus_account_info, city_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        cus_name = VALUES(cus_name),
        cus_category = VALUES(cus_category),
        cus_type = VALUES(cus_type),
        cus_phone_no = VALUES(cus_phone_no),
        cus_address = VALUES(cus_address),
        cus_balance = VALUES(cus_balance),
        cus_account_info = VALUES(cus_account_info)
    `, acc.id, BRANCH_ID, acc.cat_id, acc.type_id, acc.name,
       acc.phone, acc.address, acc.balance, acc.account_info, acc.city_id);
  }

  // 9. Realistic Employees & Staff
  const employees = [
    {
      id: 1,
      name: 'Muhammad Zain Ul Hassan',
      phone: '0346-7560306',
      cnic: '34201-1234567-1',
      address: 'Pahrian Wali, Gujrat',
      designation: 'Branch General Manager',
      department: 'Management & Sales',
      joinDate: '2025-01-01',
      salary: '85000.00'
    },
    {
      id: 2,
      name: 'Ali Raza Mughal',
      phone: '0302-6677889',
      cnic: '34201-2345678-3',
      address: 'Civil Lines, Gujrat',
      designation: 'Senior Accountant & Ledger Officer',
      department: 'Accounts & Finance',
      joinDate: '2025-02-15',
      salary: '60000.00'
    },
    {
      id: 3,
      name: 'Usman Tariq',
      phone: '0304-9988771',
      cnic: '34201-3456789-5',
      address: 'Mandi Bahauddin Road',
      designation: 'Head Store Keeper (Godown)',
      department: 'Inventory & Logistics',
      joinDate: '2025-03-01',
      salary: '45000.00'
    },
    {
      id: 4,
      name: 'Hamza Bilal',
      phone: '0313-5544332',
      cnic: '34201-4567890-7',
      address: 'Main Bazar, Pahrian Wali',
      designation: 'Billing Cashier & POS Operator',
      department: 'Sales',
      joinDate: '2025-04-10',
      salary: '38000.00'
    },
    {
      id: 5,
      name: 'Muhammad Akram',
      phone: '0345-1122334',
      cnic: '34201-5678901-9',
      address: 'Village Kot Sar',
      designation: 'Heavy Vehicle Delivery Driver',
      department: 'Transport',
      joinDate: '2025-01-20',
      salary: '40000.00'
    }
  ];

  console.log('👔 Seeding Employees...');
  for (const emp of employees) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO employees (
        emp_id, branch_id, emp_name, emp_phone, emp_cnic, emp_address,
        designation, department, join_date, basic_salary, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      ON DUPLICATE KEY UPDATE emp_name = VALUES(emp_name)
    `, emp.id, BRANCH_ID, emp.name, emp.phone, emp.cnic, emp.address,
       emp.designation, emp.department, emp.joinDate, emp.salary);

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_employees\` (
        emp_id, branch_id, emp_name, emp_phone, emp_cnic, emp_address,
        designation, department, join_date, basic_salary, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      ON DUPLICATE KEY UPDATE emp_name = VALUES(emp_name)
    `, emp.id, BRANCH_ID, emp.name, emp.phone, emp.cnic, emp.address,
       emp.designation, emp.department, emp.joinDate, emp.salary);
  }

  // 10. Vehicles & Loaders
  const vehicles = [
    { id: 1, no: 'LES-4589', name: 'Mazda Titan 6-Wheeler 16ft', driver: 'Muhammad Akram', phone: '0345-1122334' },
    { id: 2, no: 'GA-7892', name: 'Shehzore Loader 10ft', driver: 'Rashid Mehmood', phone: '0308-4455667' },
  ];

  console.log('🚚 Seeding Vehicles & Transport...');
  for (const v of vehicles) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO vehicles (v_id, branch_id, v_vehicle_no, v_driver_name, v_driver_no)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE v_vehicle_no = VALUES(v_vehicle_no)
    `, v.id, BRANCH_ID, v.no, v.driver, v.phone);

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_vehicles\` (v_id, branch_id, v_vehicle_no, v_driver_name, v_driver_no)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE v_vehicle_no = VALUES(v_vehicle_no)
    `, v.id, BRANCH_ID, v.no, v.driver, v.phone);
  }

  const loaders = [
    { id: 1, name: 'Bashir Loader Crew (Team A)', number: 'L-01', phone: '0342-9988110' },
    { id: 2, name: 'Sajid Loading Group', number: 'L-02', phone: '0315-7766554' },
  ];

  for (const l of loaders) {
    await prisma.$executeRawUnsafe(`
      INSERT INTO loaders (loader_id, branch_id, loader_name, loader_number, loader_phone)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE loader_name = VALUES(loader_name)
    `, l.id, BRANCH_ID, l.name, l.number, l.phone);

    await prisma.$executeRawUnsafe(`
      INSERT INTO \`${PREFIX}_loaders\` (loader_id, branch_id, loader_name, loader_number, loader_phone)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE loader_name = VALUES(loader_name)
    `, l.id, BRANCH_ID, l.name, l.number, l.phone);
  }

  // 11. Initial Ledger Balances for Accounts (Opening Balances)
  console.log('📒 Seeding Opening Ledger Entries for Demo Accounts...');
  for (const acc of accounts) {
    if (acc.balance !== 0) {
      const isReceivable = acc.balance > 0;
      const debit = isReceivable ? acc.balance : 0;
      const credit = !isReceivable ? Math.abs(acc.balance) : 0;
      const desc = `Opening Balance Setup - ${acc.name}`;

      await prisma.$executeRawUnsafe(`
        INSERT INTO \`${PREFIX}_ledger\` (
          branch_id, cus_id, trnx_type, details, debit_amount, credit_amount, opening_balance, closing_balance, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, BRANCH_ID, acc.id, 'OPENING_BALANCE', desc, debit, credit, 0, acc.balance);

      await prisma.$executeRawUnsafe(`
        INSERT INTO ledger (
          branch_id, cus_id, trnx_type, details, debit_amount, credit_amount, opening_balance, closing_balance, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, BRANCH_ID, acc.id, 'OPENING_BALANCE', desc, debit, credit, 0, acc.balance);
    }
  }

  // Re-enable FK checks
  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\n🎉 DEMO Branch successfully populated with realistic master data, products, accounts, and inventory!');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Error seeding demo data:', e);
  process.exit(1);
});
