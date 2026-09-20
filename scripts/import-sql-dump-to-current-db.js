/**
 * Import a phpMyAdmin dump into the database from DATABASE_URL.
 * Creates tables from the dump, loads all INSERT data, then restores HQ logins.
 *
 * Does not change .env. Skips CREATE DATABASE / USE so data lands in the current DB.
 *
 * Usage:
 *   node scripts/import-sql-dump-to-current-db.js --check --sql u596582580_ittefaqiron.sql
 *   node scripts/import-sql-dump-to-current-db.js --force --sql u596582580_ittefaqiron.sql
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
const { spawn } = require('child_process');

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
  : path.join(__dirname, '..', 'u596582580_ittefaqiron.sql');

const HQ_EMAILS = new Set([
  'superadmin@itefaqbuilders.com',
  'hq@itefaqbuilders.com',
]);

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

function tableFromStmt(stmt, kind) {
  const m = stmt.match(new RegExp(`^${kind}\\s+(?:TABLE\\s+)?\`([^\`]+)\``, 'i'));
  return m ? m[1] : null;
}

async function* extractStatements(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let mode = null;
  let buffer = '';

  for await (const line of rl) {
    if (!mode) {
      if (/^\s*(CREATE\s+TABLE|INSERT\s+INTO|ALTER\s+TABLE|DROP\s+TABLE)\s+/i.test(line)) {
        mode = 'stmt';
        buffer = `${line}\n`;
        if (line.trim().endsWith(';')) {
          yield buffer.trim();
          buffer = '';
          mode = null;
        }
      }
      continue;
    }

    buffer += `${line}\n`;
    if (!line.trim().endsWith(';')) continue;
    yield buffer.trim();
    buffer = '';
    mode = null;
  }
}

async function countTable(conn, table) {
  const [exists] = await conn.query(
    `SELECT COUNT(*) AS cnt FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  if (!Number(exists[0].cnt)) return null;
  const [rows] = await conn.query(`SELECT COUNT(*) AS cnt FROM \`${table}\``);
  return Number(rows[0].cnt);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing in .env');
    process.exit(1);
  }
  if (!fs.existsSync(sqlFile)) {
    console.error(`SQL file not found: ${sqlFile}`);
    process.exit(1);
  }

  const cfg = parseDatabaseUrl(process.env.DATABASE_URL);
  const sizeMb = (fs.statSync(sqlFile).size / 1024 / 1024).toFixed(2);
  console.log('\nImport dump into current Cloud Panel database');
  console.log(`Host:     ${cfg.host}:${cfg.port}`);
  console.log(`Database: ${cfg.database}`);
  console.log(`SQL file: ${path.basename(sqlFile)} (${sizeMb} MB)`);

  const conn = await mysql.createConnection({
    ...cfg,
    multipleStatements: false,
    connectTimeout: 60000,
    charset: 'utf8mb4',
  });

  let hqKeep = [];
  try {
    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() ORDER BY TABLE_NAME`
    );
    console.log(`Existing tables: ${tables.length}`);

    const before = {
      sales: await countTable(conn, 'sales'),
      purchases: await countTable(conn, 'purchases'),
      customers: await countTable(conn, 'customers'),
      ledger: await countTable(conn, 'ledger'),
      products: await countTable(conn, 'products'),
      users: await countTable(conn, 'users'),
    };
    console.log('Current counts:', before);

    try {
      const [hq] = await conn.query(
        `SELECT user_id, email, role, branch_id, password, full_name, is_verified, status
         FROM users
         WHERE email IN (?, ?) OR role IN ('SUPER_ADMIN','HQ_SUPER_ADMIN')`,
        [...HQ_EMAILS]
      );
      hqKeep = hq;
      console.log(`HQ logins to restore after import: ${hqKeep.length}`);
      hqKeep.forEach((u) => console.log(`  ${u.email} | ${u.role}`));
    } catch {
      console.log('No users table yet — HQ accounts will be seeded after import.');
    }

    if (checkOnly) {
      console.log('\n(--check only — no changes made)\n');
      return;
    }
    if (!force) {
      console.log('\nRe-run with --force to create tables and load data.\n');
      process.exit(1);
    }

    try { await conn.query('SET SESSION max_allowed_packet = 134217728'); } catch { /* hosted may forbid */ }
    try {
      await conn.query('SET SESSION wait_timeout = 28800');
      await conn.query('SET SESSION net_read_timeout = 600');
      await conn.query('SET SESSION net_write_timeout = 600');
    } catch { /* optional */ }

    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('SET UNIQUE_CHECKS = 0');
    await conn.query("SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO'");

    const [allTables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`
    );
    if (allTables.length) {
      const names = allTables.map((t) => `\`${t.TABLE_NAME}\``).join(', ');
      console.log(`\nDropping ${allTables.length} existing tables...`);
      await conn.query(`DROP TABLE IF EXISTS ${names}`);
    }

    const creates = [];
    const inserts = [];
    const alters = [];
    for await (const stmt of extractStatements(sqlFile)) {
      if (/^CREATE TABLE/i.test(stmt)) creates.push(stmt);
      else if (/^INSERT INTO/i.test(stmt)) inserts.push(stmt);
      else if (/^ALTER TABLE/i.test(stmt)) alters.push(stmt);
    }

    const created = new Set();
    let insertCount = 0;
    let alterCount = 0;
    let failed = 0;
    const errors = [];

    console.log(`\nCreating ${creates.length} tables...`);
    for (const stmt of creates) {
      const table = tableFromStmt(stmt, 'CREATE TABLE');
      try {
        await conn.query(stmt);
        if (table) created.add(table);
      } catch (err) {
        failed += 1;
        if (errors.length < 25) errors.push(`CREATE ${table}: ${err.message}`);
      }
    }

    console.log(`Loading ${inserts.length} INSERT statements...`);
    for (const stmt of inserts) {
      const table = tableFromStmt(stmt, 'INSERT INTO');
      try {
        await conn.query(stmt);
        insertCount += 1;
      } catch (err) {
        failed += 1;
        if (errors.length < 25) errors.push(`INSERT ${table}: ${err.message}`);
      }
    }

    console.log(`Applying ${alters.length} ALTER statements...`);
    for (const stmt of alters) {
      const table = tableFromStmt(stmt, 'ALTER TABLE');
      try {
        await conn.query(stmt);
        alterCount += 1;
      } catch (err) {
        failed += 1;
        if (errors.length < 25) errors.push(`ALTER ${table}: ${err.message}`);
      }
    }

    console.log(`Tables created: ${created.size}`);
    console.log(`INSERT statements: ${insertCount}`);
    console.log(`ALTER statements: ${alterCount}`);
    console.log(`Failed statements: ${failed}`);
    if (errors.length) {
      console.log('First errors:');
      errors.forEach((e) => console.log(`  ${e}`));
    }

    if (hqKeep.length) {
      console.log('\nRestoring HQ logins...');
      try {
        for (const u of hqKeep) {
          await conn.query(
            `INSERT INTO users
              (user_id, role, branch_id, full_name, email, password, is_verified, status, created_at, updated_at)
             VALUES (?, ?, NULL, ?, ?, ?, ?, ?, NOW(3), NOW(3))
             ON DUPLICATE KEY UPDATE
               role = VALUES(role),
               branch_id = NULL,
               full_name = VALUES(full_name),
               password = VALUES(password),
               status = VALUES(status)`,
            [u.user_id, u.role, u.full_name, u.email, u.password, u.is_verified ?? 1, u.status || 'ACTIVE']
          );
          console.log(`  restored ${u.email}`);
        }
      } catch (err) {
        console.log(`  HQ restore deferred to seed-admin: ${err.message}`);
      }
    }

    await conn.query(
      `UPDATE branches
       SET db_host = ?, db_port = ?, db_name = ?, db_user = ?, db_password = ?
       WHERE db_name IS NOT NULL`,
      [cfg.host, cfg.port, cfg.database, cfg.user, cfg.password]
    );

    await conn.query('SET UNIQUE_CHECKS = 1');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    const after = {
      sales: await countTable(conn, 'sales'),
      purchases: await countTable(conn, 'purchases'),
      customers: await countTable(conn, 'customers'),
      ledger: await countTable(conn, 'ledger'),
      products: await countTable(conn, 'products'),
      users: await countTable(conn, 'users'),
      branches: await countTable(conn, 'branches'),
    };
    console.log('\nAfter import:', after);
  } finally {
    await conn.end();
  }

  console.log('\nSeeding HQ accounts (keeps / updates HQ Super Admin + HQ Administrator)...');
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'prisma', 'seed-admin.js')], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: process.env,
    });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`seed-admin exit ${code}`))));
  });

  console.log('\nImport finished.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
