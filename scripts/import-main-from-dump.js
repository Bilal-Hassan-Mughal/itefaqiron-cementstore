#!/usr/bin/env node
/**
 * Import Ittefaqiron phpMyAdmin dump into MAIN branch only.
 *
 * - Does NOT delete HQ / MAIN admin logins
 * - Does NOT import dump users/fingerprints/system_branding
 * - Inserts missing MAIN staff from the dump (same user_ids for FKs)
 * - Writes into shared tables with branch_id = MAIN
 *
 * Usage:
 *   node scripts/import-main-from-dump.js --check --sql "Ittefaqiron (4).sql"
 *   node scripts/import-main-from-dump.js --force --sql "Ittefaqiron (4).sql"
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
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

const force = process.argv.includes('--force');
const checkOnly = process.argv.includes('--check');
const sqlArgIdx = process.argv.findIndex((a) => a === '--sql');
const sqlFile = sqlArgIdx >= 0
  ? path.resolve(process.argv[sqlArgIdx + 1])
  : path.join(__dirname, '..', 'Ittefaqiron (4).sql');

const SKIP_TABLES = new Set(['users', 'fingerprints', 'system_branding', 'branches']);

const BRANCH_ID_TABLES = [
  'customer_categories',
  'customer_types',
  'cities',
  'customers',
  'categories',
  'sub_categories',
  'products',
  'ledger',
  'expense_titles',
  'expenses',
  'sales',
  'purchases',
  'purchase_returns',
  'sale_returns',
  'hold_bills',
  'day_ends',
  'journals',
  'payments',
  'stores',
  'stock_transfers',
  'draft_sales',
  'vehicles',
  'loaders',
  'cargo',
  'packages',
  'subscriptions',
  'employees',
  'hr_settings',
];

const PREFIXED_COPY_TABLES = [
  'customer_categories',
  'customer_types',
  'cities',
  'customers',
  'categories',
  'sub_categories',
  'products',
  'ledger',
  'expense_titles',
  'expenses',
  'sales',
  'sale_details',
  'split_payments',
  'purchases',
  'purchase_details',
  'purchase_returns',
  'purchase_return_details',
  'sale_returns',
  'sale_return_details',
  'hold_bills',
  'hold_bill_details',
  'day_ends',
  'day_end_details',
  'journals',
  'journal_details',
  'payments',
  'payment_details',
  'stores',
  'store_stocks',
  'stock_adjustments',
  'stock_transfers',
  'stock_transfer_details',
  'draft_sales',
  'vehicles',
  'loaders',
  'cargo',
  'packages',
  'subscriptions',
  'employees',
  'attendance',
  'payrolls',
  'employee_advances',
  'hr_settings',
];

const MAIN_STAFF_FROM_DUMP = [
  {
    user_id: 6,
    role: 'ADMIN',
    full_name: 'System Administrator',
    email: 'admin@example.com',
    password: 'Admin@123',
    is_verified: 1,
    status: 'ACTIVE',
  },
  {
    user_id: 12,
    role: 'SALESMAN',
    full_name: 'abdul rafee',
    email: 'abdulrafaylukjutt@gmail.com',
    password: 'abdulrafay',
    is_verified: 1,
    status: 'ACTIVE',
  },
  {
    user_id: 14,
    role: 'ADMIN',
    full_name: 'ateeb ashraf sb',
    email: 'ateebashraf3344@gmail.com',
    password: 'redcap',
    is_verified: 1,
    status: 'ACTIVE',
  },
  {
    user_id: 15,
    role: 'SALESMAN',
    full_name: 'Muhammad ibrahim',
    email: 'ibraheemmirza@gmail.com',
    password: 'ibrahim@2014',
    is_verified: 0,
    status: 'ACTIVE',
  },
  {
    user_id: 17,
    role: 'ADMIN',
    full_name: 'ibrar hussain',
    email: 'ibrarhussain@gmail.com',
    password: '5766112',
    is_verified: 0,
    status: 'ACTIVE',
  },
  {
    user_id: 18,
    role: 'ADMIN',
    full_name: 'ali mirza',
    email: 'alimirza@gmail.com',
    password: '2645371',
    is_verified: 0,
    status: 'ACTIVE',
  },
  {
    user_id: 19,
    role: 'SALESMAN',
    full_name: 'usman sarwar',
    email: 'usmansarwar@gmail.com',
    password: 'usman@1122',
    is_verified: 0,
    status: 'ACTIVE',
  },
];

function parseDatabaseUrl(url) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

async function tableExists(conn, table) {
  const [rows] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return Number(rows[0].cnt) > 0;
}

async function countTable(conn, table) {
  if (!(await tableExists(conn, table))) return null;
  const [rows] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${table}\``);
  return Number(rows[0].cnt);
}

function tableFromInsert(stmt) {
  const m = stmt.match(/^INSERT INTO `([^`]+)`/i);
  return m ? m[1] : null;
}

async function* extractImportStatements(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let mode = null;
  let buffer = '';

  for await (const line of rl) {
    if (!mode) {
      if (/^\s*INSERT\s+INTO\s+/i.test(line)) {
        mode = 'insert';
        buffer = `${line}\n`;
      }
      continue;
    }

    buffer += `${line}\n`;
    if (!buffer.trimEnd().endsWith(';')) continue;

    const stmt = buffer.trim();
    buffer = '';
    mode = null;
    if (stmt.toUpperCase().startsWith('INSERT INTO')) yield stmt;
  }
}

async function ensureMainStaff(conn, branchId) {
  console.log('\nEnsuring MAIN staff accounts from dump (HQ emails skipped)...');
  for (const u of MAIN_STAFF_FROM_DUMP) {
    const [byId] = await conn.query('SELECT user_id, email FROM users WHERE user_id = ?', [u.user_id]);
    const [byEmail] = await conn.query('SELECT user_id, email, role FROM users WHERE email = ?', [u.email]);
    if (byEmail.length) {
      console.log(`  keep existing ${byEmail[0].email} (user_id=${byEmail[0].user_id}, role=${byEmail[0].role})`);
      continue;
    }
    if (byId.length) {
      console.log(`  skip id ${u.user_id} already used by ${byId[0].email}`);
      continue;
    }
    await conn.query(
      `INSERT INTO users
        (user_id, role, full_name, email, password, is_verified, status, branch_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(3), NOW(3))`,
      [u.user_id, u.role, u.full_name, u.email, u.password, u.is_verified, u.status, branchId]
    );
    console.log(`  created MAIN staff ${u.email} (user_id=${u.user_id})`);
  }
}

async function stampBranchId(conn, branchId) {
  console.log('\nStamping imported rows with MAIN branch_id...');
  for (const table of BRANCH_ID_TABLES) {
    if (!(await tableExists(conn, table))) continue;
    const [result] = await conn.query(
      `UPDATE \`${table}\` SET branch_id = ? WHERE branch_id IS NULL OR branch_id = 0 OR branch_id = 1`,
      [branchId]
    );
    console.log(`  ${table}: ${result.affectedRows} row(s)`);
  }
}

async function copyToPrefixedTables(conn, prefix) {
  if (!prefix) return;
  const pfx = String(prefix).toLowerCase().replace(/[^a-z0-9_]/g, '');
  console.log(`\nCopying imported rows into ${pfx}_* tables...`);
  for (const table of PREFIXED_COPY_TABLES) {
    const target = `${pfx}_${table}`;
    if (!(await tableExists(conn, table)) || !(await tableExists(conn, target))) {
      continue;
    }
    await conn.query(`TRUNCATE TABLE \`${target}\``);
    const [result] = await conn.query(`INSERT INTO \`${target}\` SELECT * FROM \`${table}\``);
    console.log(`  ${target}: ${result.affectedRows} row(s)`);
  }
}

async function resetAutoIncrement(conn, tables) {
  console.log('\nResetting AUTO_INCREMENT from imported max IDs...');
  for (const table of tables) {
    if (!(await tableExists(conn, table))) continue;
    const [pkCols] = await conn.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND EXTRA LIKE '%auto_increment%'`,
      [table]
    );
    if (!pkCols.length) continue;
    const col = pkCols[0].COLUMN_NAME;
    const [maxRows] = await conn.query(`SELECT COALESCE(MAX(\`${col}\`), 0) + 1 AS next_id FROM \`${table}\``);
    const nextId = Number(maxRows[0].next_id) || 1;
    await conn.query(`ALTER TABLE \`${table}\` AUTO_INCREMENT = ${nextId}`);
  }
}

async function main() {
  if (!fs.existsSync(sqlFile)) {
    console.error(`SQL file not found: ${sqlFile}`);
    process.exit(1);
  }

  const cfg = parseDatabaseUrl(process.env.DATABASE_URL);
  console.log('\n========================================');
  console.log('  MAIN branch import from dump');
  console.log('========================================');
  console.log(`Database: ${cfg.host}:${cfg.port} / ${cfg.database}`);
  console.log(`SQL file: ${sqlFile}`);
  console.log(`File size: ${(fs.statSync(sqlFile).size / 1024 / 1024).toFixed(2)} MB`);

  const conn = await mysql.createConnection({
    ...cfg,
    multipleStatements: false,
    connectTimeout: 60000,
    charset: 'utf8mb4',
  });
  const prisma = new PrismaClient();

  try {
    const mainBranch = await prisma.branch.findUnique({ where: { branch_code: 'MAIN' } });
    if (!mainBranch) {
      console.error('MAIN branch not found.');
      process.exit(1);
    }
    const branchId = mainBranch.branch_id;
    console.log(`MAIN branch_id=${branchId} isolation=${mainBranch.isolation_mode} prefix=${mainBranch.table_prefix}`);

    const before = {
      sales: await countTable(conn, 'sales'),
      purchases: await countTable(conn, 'purchases'),
      customers: await countTable(conn, 'customers'),
      ledger: await countTable(conn, 'ledger'),
      products: await countTable(conn, 'products'),
      users: await countTable(conn, 'users'),
    };
    console.log('\nCurrent counts:', before);

    const [hqUsers] = await conn.query(
      `SELECT user_id, email, role, branch_id FROM users
       WHERE role IN ('SUPER_ADMIN','HQ_SUPER_ADMIN') OR branch_id IS NULL
       ORDER BY user_id`
    );
    console.log('HQ logins that will be kept:');
    hqUsers.forEach((u) => console.log(`  ${u.email} | ${u.role} | branch_id=${u.branch_id ?? 'HQ'}`));

    if (checkOnly) {
      console.log('\n(--check only — no changes made)\n');
      return;
    }
    if (!force) {
      console.log('\nRe-run with --force to import.\n');
      process.exit(1);
    }

    try {
      await conn.query('SET SESSION max_allowed_packet = 67108864');
    } catch {
      /* hosted MySQL may forbid this */
    }
    try {
      await conn.query('SET SESSION wait_timeout = 28800');
      await conn.query('SET SESSION net_read_timeout = 600');
      await conn.query('SET SESSION net_write_timeout = 600');
    } catch {
      /* optional */
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('SET UNIQUE_CHECKS = 0');
    await conn.query("SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO'");

    await ensureMainStaff(conn, branchId);

    console.log('\nImporting INSERT statements (skipping users/fingerprints/branding)...');
    let inserts = 0;
    let skipped = 0;
    let failed = 0;
    const importedTables = new Set();
    const errors = [];
    const tableExistsCache = new Map();
    const cachedTableExists = async (table) => {
      if (tableExistsCache.has(table)) return tableExistsCache.get(table);
      const exists = await tableExists(conn, table);
      tableExistsCache.set(table, exists);
      return exists;
    };

    for await (const stmt of extractImportStatements(sqlFile)) {
      const table = tableFromInsert(stmt);
      if (!table || SKIP_TABLES.has(table)) {
        skipped += 1;
        continue;
      }
      if (!(await cachedTableExists(table))) {
        console.log(`  skip missing table ${table}`);
        skipped += 1;
        continue;
      }
      try {
        await conn.query(stmt);
        inserts += 1;
        importedTables.add(table);
        if (inserts % 10 === 0) {
          process.stdout.write(`  ... ${inserts} INSERT blocks\r`);
        }
      } catch (err) {
        failed += 1;
        const preview = stmt.slice(0, 140).replace(/\s+/g, ' ');
        errors.push(`${table}: ${err.message} :: ${preview}`);
        console.log(`\n  FAIL ${table}: ${err.message}`);
        if (failed >= 8) {
          throw new Error(`Too many INSERT failures (${failed}). First: ${errors[0]}`);
        }
      }
    }

    console.log(`\n  Imported ${inserts} INSERT block(s), skipped ${skipped}, failed ${failed}`);
    if (errors.length) {
      console.log('Failures:');
      errors.forEach((e) => console.log(`  - ${e}`));
    }

    await stampBranchId(conn, branchId);
    await copyToPrefixedTables(conn, mainBranch.table_prefix || 'main');
    await resetAutoIncrement(conn, [...importedTables, 'users']);

    await prisma.users.updateMany({
      where: { role: { in: ['SUPER_ADMIN', 'HQ_SUPER_ADMIN'] } },
      data: { branch_id: null },
    });
    await prisma.branch.update({
      where: { branch_id: branchId },
      data: {
        tables_provisioned: true,
        provision_status: 'ACTIVE',
        provision_message: 'MAIN seeded from Ittefaqiron (4).sql',
      },
    });

    await conn.query('SET UNIQUE_CHECKS = 1');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    const after = {
      sales: await countTable(conn, 'sales'),
      sale_details: await countTable(conn, 'sale_details'),
      purchases: await countTable(conn, 'purchases'),
      purchase_details: await countTable(conn, 'purchase_details'),
      customers: await countTable(conn, 'customers'),
      ledger: await countTable(conn, 'ledger'),
      products: await countTable(conn, 'products'),
      payments: await countTable(conn, 'payments'),
      expenses: await countTable(conn, 'expenses'),
      employees: await countTable(conn, 'employees'),
      stores: await countTable(conn, 'stores'),
      users: await countTable(conn, 'users'),
      main_sales: await countTable(conn, 'main_sales'),
      main_customers: await countTable(conn, 'main_customers'),
      main_products: await countTable(conn, 'main_products'),
      main_ledger: await countTable(conn, 'main_ledger'),
    };

    const [users] = await conn.query(
      'SELECT user_id, email, role, branch_id, status FROM users ORDER BY user_id'
    );
    const [branchCounts] = await conn.query(
      `SELECT
         (SELECT COUNT(*) FROM sales WHERE branch_id = ?) AS sales,
         (SELECT COUNT(*) FROM purchases WHERE branch_id = ?) AS purchases,
         (SELECT COUNT(*) FROM customers WHERE branch_id = ?) AS customers,
         (SELECT COUNT(*) FROM products WHERE branch_id = ?) AS products,
         (SELECT COUNT(*) FROM ledger WHERE branch_id = ?) AS ledger`,
      [branchId, branchId, branchId, branchId, branchId]
    );

    console.log('\n========================================');
    console.log('  Import complete');
    console.log('========================================');
    console.log('Row counts:', after);
    console.log('MAIN-scoped counts:', branchCounts[0]);
    console.log('\nUsers after import:');
    users.forEach((u) => {
      console.log(`  ${u.user_id} | ${u.email} | ${u.role} | branch_id=${u.branch_id ?? 'HQ'} | ${u.status}`);
    });
  } finally {
    await conn.end();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nImport failed:', err.message);
  process.exit(1);
});
