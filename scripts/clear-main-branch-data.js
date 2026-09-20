/**
 * Clear MAIN branch business data only. Keeps:
 *   - the MAIN branch record
 *   - all user logins (HQ + MAIN super admin and staff)
 *
 * Usage: node scripts/clear-main-branch-data.js --force
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { PrismaClient } = require('@prisma/client');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const prisma = new PrismaClient();
const force = process.argv.includes('--force');

function parseDatabaseUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: Number(u.port || 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: (u.pathname || '').replace(/^\//, ''),
    };
  } catch {
    return null;
  }
}

const CHILD_DELETES = [
  'DELETE sd FROM sale_details sd INNER JOIN sales s ON sd.sale_id = s.sale_id WHERE s.branch_id = ?',
  'DELETE sp FROM split_payments sp INNER JOIN sales s ON sp.sale_id = s.sale_id WHERE s.branch_id = ?',
  'DELETE pd FROM purchase_details pd INNER JOIN purchases p ON pd.pur_id = p.pur_id WHERE p.branch_id = ?',
  'DELETE prd FROM purchase_return_details prd INNER JOIN purchase_returns pr ON prd.return_id = pr.id WHERE pr.branch_id = ?',
  'DELETE srd FROM sale_return_details srd INNER JOIN sale_returns sr ON srd.return_id = sr.return_id WHERE sr.branch_id = ?',
  'DELETE hbd FROM hold_bill_details hbd INNER JOIN hold_bills hb ON hbd.hold_bill_id = hb.hold_bill_id WHERE hb.branch_id = ?',
  'DELETE ded FROM day_end_details ded INNER JOIN day_ends de ON ded.day_end_id = de.day_end_id WHERE de.branch_id = ?',
  'DELETE jd FROM journal_details jd INNER JOIN journals j ON jd.journal_id = j.journal_id WHERE j.branch_id = ?',
  'DELETE pd FROM payment_details pd INNER JOIN payments p ON pd.payment_id = p.payment_id WHERE p.branch_id = ?',
  'DELETE std FROM stock_transfer_details std INNER JOIN stock_transfers st ON std.transfer_id = st.transfer_id WHERE st.branch_id = ?',
  'DELETE ss FROM store_stocks ss INNER JOIN stores st ON ss.store_id = st.storeid WHERE st.branch_id = ?',
  'DELETE sa FROM stock_adjustments sa INNER JOIN stores st ON sa.store_id = st.storeid WHERE st.branch_id = ?',
  'DELETE att FROM attendance att INNER JOIN employees e ON att.emp_id = e.emp_id WHERE e.branch_id = ?',
  'DELETE pa FROM payrolls pa INNER JOIN employees e ON pa.emp_id = e.emp_id WHERE e.branch_id = ?',
  'DELETE ea FROM employee_advances ea INNER JOIN employees e ON ea.emp_id = e.emp_id WHERE e.branch_id = ?',
];

const PARENT_TABLES = [
  'sales',
  'purchases',
  'purchase_returns',
  'sale_returns',
  'hold_bills',
  'day_ends',
  'journals',
  'payments',
  'stock_transfers',
  'draft_sales',
  'super_orders',
  'ledger',
  'expenses',
  'products',
  'sub_categories',
  'categories',
  'customers',
  'cities',
  'customer_types',
  'customer_categories',
  'expense_titles',
  'stores',
  'employees',
  'vehicles',
  'loaders',
  'cargo',
  'packages',
  'subscriptions',
  'hr_settings',
];

async function main() {
  const branch = await prisma.branch.findUnique({ where: { branch_code: 'MAIN' } });
  if (!branch) {
    console.error('MAIN branch not found.');
    process.exit(1);
  }

  const users = await prisma.users.findMany({
    where: {
      OR: [
        { branch_id: branch.branch_id },
        { branch_id: null },
        { role: { in: ['HQ_SUPER_ADMIN', 'SUPER_ADMIN', 'BRANCH_SUPER_ADMIN'] } },
      ],
    },
    select: { user_id: true, email: true, role: true, branch_id: true, full_name: true, status: true },
    orderBy: { user_id: 'asc' },
  });

  console.log(`MAIN branch_id=${branch.branch_id} isolation=${branch.isolation_mode || 'SHARED'}`);
  console.log('Users that will be KEPT:');
  users.forEach((u) => {
    console.log(`  ${u.email} | ${u.role} | branch_id=${u.branch_id ?? 'HQ'} | ${u.status}`);
  });

  const counts = {
    sales: await prisma.sale.count({ where: { branch_id: branch.branch_id } }),
    purchases: await prisma.purchase.count({ where: { branch_id: branch.branch_id } }),
    ledger: await prisma.ledger.count({ where: { branch_id: branch.branch_id } }),
    customers: await prisma.customer.count({ where: { branch_id: branch.branch_id } }),
    products: await prisma.product.count({ where: { branch_id: branch.branch_id } }),
  };
  console.log('Current MAIN counts:', counts);

  if (!force) {
    console.log('\nRefusing without --force');
    console.log('  node scripts/clear-main-branch-data.js --force\n');
    return;
  }

  const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
  if (!parsed) {
    console.error('Invalid DATABASE_URL');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    multipleStatements: true,
  });

  const id = branch.branch_id;
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const sql of CHILD_DELETES) {
      await connection.query(sql, [id]);
    }
    for (const table of PARENT_TABLES) {
      await connection.query(`DELETE FROM \`${table}\` WHERE branch_id = ?`, [id]);
      console.log(`  cleared ${table}`);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await connection.end();
  }

  const keptUsers = await prisma.users.findMany({
    where: {
      OR: [
        { branch_id: branch.branch_id },
        { branch_id: null },
        { role: { in: ['HQ_SUPER_ADMIN', 'SUPER_ADMIN', 'BRANCH_SUPER_ADMIN'] } },
      ],
    },
    select: { email: true, role: true, branch_id: true },
  });
  const after = {
    sales: await prisma.sale.count({ where: { branch_id: id } }),
    purchases: await prisma.purchase.count({ where: { branch_id: id } }),
    ledger: await prisma.ledger.count({ where: { branch_id: id } }),
    customers: await prisma.customer.count({ where: { branch_id: id } }),
    products: await prisma.product.count({ where: { branch_id: id } }),
    users: keptUsers.length,
  };

  console.log('\nAfter MAIN wipe:', after);
  console.log('Logins still present:');
  keptUsers.forEach((u) => console.log(`  ${u.email} | ${u.role} | branch_id=${u.branch_id ?? 'HQ'}`));
  console.log('\nDone. MAIN branch record and admin logins were not deleted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
