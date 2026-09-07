#!/usr/bin/env node
/**
 * Clear Main Branch business data and import from a phpMyAdmin SQL dump.
 *
 * Keeps the `branches` table. Imports INSERT + AUTO_INCREMENT from the dump,
 * then assigns branch_id = MAIN to all branch-scoped tables.
 *
 * Usage:
 *   node scripts/import-main-branch-from-sql.js --check
 *   node scripts/import-main-branch-from-sql.js --force
 *   node scripts/import-main-branch-from-sql.js --force --sql "Ittefaqiron (3).sql"
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
const { PrismaClient } = require('@prisma/client');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
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
  : path.join(__dirname, '..', 'Ittefaqiron (3).sql');

const TRUNCATE_TABLES = [
  'payment_details',
  'payments',
  'split_payments',
  'sale_return_details',
  'sale_returns',
  'sale_details',
  'sales',
  'purchase_return_details',
  'purchase_returns',
  'purchase_details',
  'purchases',
  'journal_details',
  'journals',
  'day_end_details',
  'day_ends',
  'hold_bill_details',
  'hold_bills',
  'expenses',
  'expense_titles',
  'ledger',
  'draft_sales',
  'stock_transfer_details',
  'stock_transfers',
  'stock_adjustments',
  'store_stocks',
  'attendance',
  'employee_advances',
  'payrolls',
  'employees',
  'hr_settings',
  'fingerprints',
  'customers',
  'products',
  'sub_categories',
  'categories',
  'cities',
  'customer_categories',
  'customer_types',
  'cargo',
  'loaders',
  'vehicles',
  'stores',
  'packages',
  'subscriptions',
  'system_branding',
  'users',
];

const BACKFILL_TABLES = [
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

function dbLabel(cfg) {
  return `${cfg.host}:${cfg.port} / ${cfg.database}`;
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
      } else if (/^\s*ALTER\s+TABLE\s+/i.test(line) && /AUTO_INCREMENT/i.test(line)) {
        mode = 'alter';
        buffer = `${line}\n`;
      }
      continue;
    }

    buffer += `${line}\n`;
    const trimmed = buffer.trimEnd();
    if (!trimmed.endsWith(';')) continue;

    const stmt = trimmed.trim();
    buffer = '';
    mode = null;

    if (stmt.toUpperCase().startsWith('INSERT INTO')) {
      yield stmt;
    } else if (/^ALTER TABLE `/i.test(stmt) && /AUTO_INCREMENT/i.test(stmt) && /MODIFY `/i.test(stmt)) {
      yield stmt;
    }
  }
}

async function runImportStatements(conn, filePath) {
  let inserts = 0;
  let alters = 0;
  let batch = 0;

  for await (const stmt of extractImportStatements(filePath)) {
    batch += 1;
    try {
      await conn.query(stmt);
      if (stmt.toUpperCase().startsWith('INSERT INTO')) inserts += 1;
      else alters += 1;
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        const m = stmt.match(/^INSERT INTO `([^`]+)`/i) || stmt.match(/^ALTER TABLE `([^`]+)`/i);
        console.log(`\n  skip missing table: ${m?.[1] || 'unknown'}`);
        continue;
      }
      const preview = stmt.slice(0, 120).replace(/\s+/g, ' ');
      throw new Error(`Statement #${batch} failed: ${err.message}\n${preview}...`);
    }
    if (batch % 25 === 0) {
      process.stdout.write(`  ... imported ${batch} statements\r`);
    }
  }

  console.log(`\n  Imported ${inserts} INSERT block(s) and ${alters} AUTO_INCREMENT update(s)`);
}

async function setupBranchScope(prisma, branchId) {
  for (const table of BACKFILL_TABLES) {
    try {
      const result = await prisma.$executeRawUnsafe(
        `UPDATE \`${table}\` SET branch_id = ?`,
        branchId
      );
      console.log(`  branch_id=${branchId} on ${table}: ${result} row(s)`);
    } catch (e) {
      if (e.message?.includes("Unknown column 'branch_id'")) {
        console.log(`  skip ${table} (no branch_id column)`);
      } else {
        throw e;
      }
    }
  }

  await prisma.users.updateMany({
    where: { role: { in: ['SUPER_ADMIN', 'HQ_SUPER_ADMIN'] } },
    data: { branch_id: null },
  });
  await prisma.users.updateMany({
    where: {
      role: { notIn: ['SUPER_ADMIN', 'HQ_SUPER_ADMIN'] },
      OR: [{ branch_id: null }, { branch_id: { not: branchId } }],
    },
    data: { branch_id: branchId },
  });
}

async function main() {
  if (!fs.existsSync(sqlFile)) {
    console.error(`SQL file not found: ${sqlFile}`);
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is not set in .env');
    process.exit(1);
  }

  const cfg = parseDatabaseUrl(dbUrl);
  console.log('\n========================================');
  console.log('  Main Branch SQL Import');
  console.log('========================================');
  console.log(`Database: ${dbLabel(cfg)}`);
  console.log(`SQL file: ${sqlFile}`);
  console.log(`File size: ${(fs.statSync(sqlFile).size / 1024 / 1024).toFixed(2)} MB\n`);

  const conn = await mysql.createConnection({
    ...cfg,
    multipleStatements: false,
    connectTimeout: 60000,
  });

  const prisma = new PrismaClient();

  try {
    const before = {
      sales: await countTable(conn, 'sales'),
      purchases: await countTable(conn, 'purchases'),
      customers: await countTable(conn, 'customers'),
      ledger: await countTable(conn, 'ledger'),
      products: await countTable(conn, 'products'),
    };
    console.log('Current row counts:');
    Object.entries(before).forEach(([k, v]) => console.log(`  ${k}: ${v ?? 'n/a'}`));

    if (checkOnly) {
      console.log('\n(--check only — no changes made)\n');
      return;
    }

    if (!force) {
      console.log('\nThis will DELETE all Main Branch business data and replace it from the SQL dump.');
      console.log('The branches table is kept. Re-run with --force to proceed.\n');
      process.exit(1);
    }

    let mainBranch = await prisma.branch.findUnique({ where: { branch_code: 'MAIN' } });
    if (!mainBranch) {
      mainBranch = await prisma.branch.create({
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
          provision_message: 'Imported from SQL backup',
        },
      });
      console.log(`\nCreated MAIN branch (id=${mainBranch.branch_id})`);
    } else {
      console.log(`\nMAIN branch id=${mainBranch.branch_id}`);
    }

    const branchId = mainBranch.branch_id;

    console.log('\nStep 1/3: Clearing existing Main Branch data...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      await conn.query('SET SESSION max_allowed_packet = 67108864');
    } catch {
      console.log('  (max_allowed_packet session set skipped — using server default)');
    }
    try {
      await conn.query('SET SESSION wait_timeout = 28800');
    } catch {
      /* optional on hosted DB */
    }

    for (const table of TRUNCATE_TABLES) {
      if (!(await tableExists(conn, table))) {
        console.log(`  skip truncate ${table} (missing)`);
        continue;
      }
      await conn.query(`TRUNCATE TABLE \`${table}\``);
      console.log(`  truncated ${table}`);
    }

    console.log('\nStep 2/3: Importing SQL data (INSERT + AUTO_INCREMENT)...');
    await runImportStatements(conn, sqlFile);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('\nStep 3/3: Assigning all imported rows to MAIN branch...');
    await setupBranchScope(prisma, branchId);

    const after = {
      sales: await countTable(conn, 'sales'),
      purchases: await countTable(conn, 'purchases'),
      customers: await countTable(conn, 'customers'),
      ledger: await countTable(conn, 'ledger'),
      products: await countTable(conn, 'products'),
      employees: await countTable(conn, 'employees'),
    };

    console.log('\n========================================');
    console.log('  Import Complete');
    console.log('========================================');
    Object.entries(after).forEach(([k, v]) => console.log(`  ${k}: ${v ?? 'n/a'}`));
    console.log('\nRefresh the app and open Reports to verify.\n');
  } finally {
    await conn.end();
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\nImport failed:', err.message);
  process.exit(1);
});
