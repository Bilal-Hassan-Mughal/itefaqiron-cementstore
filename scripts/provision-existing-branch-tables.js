/**
 * Create isolated tables for every PREFIXED branch.
 * MAIN stays on shared/unprefixed tables and keeps the imported dump data.
 *
 * Usage: node scripts/provision-existing-branch-tables.js --force
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const envPath = path.join(__dirname, '..', '.env');
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

const force = process.argv.includes('--force');

const BRANCH_PHYSICAL_TABLES = [
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

function quoteId(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

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
  const [rows] = await conn.query(`SELECT COUNT(*) AS cnt FROM ${quoteId(table)}`);
  return Number(rows[0].cnt);
}

async function provisionPrefixedTables(conn, tablePrefix) {
  const prefix = String(tablePrefix).toLowerCase().replace(/[^a-z0-9_]/g, '');
  const created = [];
  const skipped = [];
  for (const baseTable of BRANCH_PHYSICAL_TABLES) {
    const target = `${prefix}_${baseTable}`;
    if (!(await tableExists(conn, baseTable))) {
      skipped.push({ target, reason: `template ${baseTable} missing` });
      continue;
    }
    if (await tableExists(conn, target)) {
      skipped.push({ target, reason: 'already exists' });
      continue;
    }
    await conn.query(`CREATE TABLE ${quoteId(target)} LIKE ${quoteId(baseTable)}`);
    created.push(target);
  }
  return { prefix, created, skipped };
}

async function stampMainBranchId(conn, branchId) {
  const stamped = {};
  for (const table of BRANCH_ID_TABLES) {
    if (!(await tableExists(conn, table))) continue;
    const [result] = await conn.query(
      `UPDATE ${quoteId(table)} SET branch_id = ? WHERE branch_id IS NULL OR branch_id = 0`,
      [branchId]
    );
    stamped[table] = result.affectedRows;
  }
  return stamped;
}

async function main() {
  const cfg = parseDatabaseUrl(process.env.DATABASE_URL);
  const conn = await mysql.createConnection({
    ...cfg,
    multipleStatements: false,
    connectTimeout: 60000,
    charset: 'utf8mb4',
  });

  try {
    const [branches] = await conn.query(
      `SELECT branch_id, branch_code, branch_name, table_prefix, isolation_mode, tables_provisioned
       FROM branches
       ORDER BY branch_id`
    );

    console.log(`Database: ${cfg.host}:${cfg.port} / ${cfg.database}`);
    console.log('Branches:');
    branches.forEach((b) => {
      console.log(
        `  ${b.branch_id} | ${b.branch_code} | ${b.branch_name} | ${b.isolation_mode} | prefix=${b.table_prefix || '-'}`
      );
    });

    const mainBranch = branches.find((b) => String(b.branch_code).toUpperCase() === 'MAIN');
    if (!mainBranch) {
      throw new Error('MAIN branch is missing');
    }

    console.log('\nMAIN shared table counts (dump data stays here):');
    for (const table of ['sales', 'purchases', 'customers', 'products', 'ledger', 'users']) {
      console.log(`  ${table}: ${await countTable(conn, table)}`);
    }

    if (!force) {
      console.log('\nRe-run with --force to create missing branch tables.\n');
      return;
    }

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');

    const stamped = await stampMainBranchId(conn, mainBranch.branch_id);
    console.log('\nStamped MAIN branch_id on shared rows:');
    Object.entries(stamped)
      .filter(([, n]) => n > 0)
      .forEach(([table, n]) => console.log(`  ${table}: ${n}`));

    await conn.query(
      `UPDATE branches
       SET isolation_mode = 'SHARED',
           table_prefix = 'main',
           tables_provisioned = 1,
           provision_status = 'ACTIVE',
           provision_message = ?,
           db_host = ?,
           db_port = ?,
           db_name = ?,
           updated_at = NOW(3)
       WHERE branch_id = ?`,
      [
        `MAIN uses shared tables in ${cfg.database} (Hostinger dump data).`,
        cfg.host,
        cfg.port,
        cfg.database,
        mainBranch.branch_id,
      ]
    );

    for (const branch of branches) {
      if (String(branch.branch_code).toUpperCase() === 'MAIN') continue;
      const prefix = (branch.table_prefix || branch.branch_code || '')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '');
      if (!prefix) {
        console.log(`\nSkip ${branch.branch_code}: no table prefix`);
        continue;
      }

      console.log(`\nProvisioning ${branch.branch_code} tables (${prefix}_*)...`);
      const result = await provisionPrefixedTables(conn, prefix);
      console.log(`  created: ${result.created.length}`);
      if (result.created.length) {
        result.created.forEach((name) => console.log(`    + ${name}`));
      }
      const already = result.skipped.filter((s) => s.reason === 'already exists');
      const missing = result.skipped.filter((s) => s.reason !== 'already exists');
      if (already.length) console.log(`  already existed: ${already.length}`);
      if (missing.length) {
        console.log('  skipped:');
        missing.forEach((s) => console.log(`    ${s.target} (${s.reason})`));
      }

      await conn.query(
        `UPDATE branches
         SET isolation_mode = 'PREFIXED',
             table_prefix = ?,
             tables_provisioned = 1,
             provision_status = 'ACTIVE',
             provision_message = ?,
             db_host = ?,
             db_port = ?,
             db_name = ?,
             updated_at = NOW(3)
         WHERE branch_id = ?`,
        [
          prefix,
          `Created ${result.created.length + already.length} dedicated tables (${prefix}_*) in ${cfg.database}.`,
          cfg.host,
          cfg.port,
          cfg.database,
          branch.branch_id,
        ]
      );
    }

    await conn.query(
      `UPDATE users
       SET branch_id = NULL
       WHERE role IN ('SUPER_ADMIN', 'HQ_SUPER_ADMIN')`
    );

    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
       ORDER BY TABLE_NAME`
    );
    const names = tables.map((t) => t.TABLE_NAME);
    const prefixed = names.filter((n) => /^(main|50400|2001)_/.test(n));

    console.log('\nDone.');
    console.log(`Total tables: ${names.length}`);
    console.log(`Prefixed tables: ${prefixed.length}`);
    console.log(`  50400_*: ${prefixed.filter((n) => n.startsWith('50400_')).length}`);
    console.log(`  2001_*: ${prefixed.filter((n) => n.startsWith('2001_')).length}`);
    console.log(`  main_*: ${prefixed.filter((n) => n.startsWith('main_')).length}`);
    console.log(`MAIN sales still in shared sales: ${await countTable(conn, 'sales')}`);
    console.log(`50400_sales: ${await countTable(conn, '50400_sales')}`);
    console.log(`2001_sales: ${await countTable(conn, '2001_sales')}`);
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
