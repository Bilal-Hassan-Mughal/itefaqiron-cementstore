#!/usr/bin/env node
/**
 * Drops all existing tables in the target database and restores all tables and data
 * from a phpMyAdmin SQL dump (e.g., 127_0_0_1.sql).
 *
 * Usage:
 *   node scripts/restore-from-sql-clean.js --sql "127_0_0_1.sql"
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');

// 1. Load .env
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

const sqlArgIdx = process.argv.findIndex((a) => a === '--sql');
const sqlFile = sqlArgIdx >= 0
  ? path.resolve(process.argv[sqlArgIdx + 1])
  : path.join(__dirname, '..', '127_0_0_1.sql');

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

async function* parseSqlStatements(filePath) {
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  let currentStmt = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inBacktick = false;
  let inMultiComment = false;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!currentStmt && (trimmed.startsWith('--') || (trimmed.startsWith('/*') && trimmed.endsWith('*/;') === false && !trimmed.includes(';')))) {
      if (trimmed.startsWith('/*') && !trimmed.endsWith('*/')) {
        inMultiComment = true;
      }
      continue;
    }

    let i = 0;
    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (inMultiComment) {
        if (char === '*' && nextChar === '/') {
          inMultiComment = false;
          i += 2;
          continue;
        }
        i++;
        continue;
      }

      if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
        if (char === '-' && nextChar === '-') {
          break; // Single-line comment to end of line
        }
        if (char === '/' && nextChar === '*') {
          inMultiComment = true;
          i += 2;
          continue;
        }
      }

      if (char === "'" && !inDoubleQuote && !inBacktick) {
        if (inSingleQuote) {
          if (line[i - 1] === '\\') {
            let bsCount = 0;
            let b = i - 1;
            while (b >= 0 && line[b] === '\\') { bsCount++; b--; }
            if (bsCount % 2 === 0) {
              inSingleQuote = false;
            }
          } else if (nextChar === "'") {
            currentStmt += "''";
            i += 2;
            continue;
          } else {
            inSingleQuote = false;
          }
        } else {
          inSingleQuote = true;
        }
      } else if (char === '"' && !inSingleQuote && !inBacktick) {
        if (inDoubleQuote) {
          if (line[i - 1] !== '\\') inDoubleQuote = false;
        } else {
          inDoubleQuote = true;
        }
      } else if (char === '`' && !inSingleQuote && !inDoubleQuote) {
        inBacktick = !inBacktick;
      } else if (char === ';' && !inSingleQuote && !inDoubleQuote && !inBacktick && !inMultiComment) {
        currentStmt += char;
        const s = currentStmt.trim();
        currentStmt = '';
        if (s.length > 0 && s !== ';') {
          // Check if this statement should be ignored (e.g. CREATE DATABASE or USE)
          const clean = s.replace(/^\/\*![\s\S]*?\*\/;?/gi, '').trim();
          const verb = clean.split(/\s+/)[0]?.toUpperCase();
          const secondVerb = clean.split(/\s+/)[1]?.toUpperCase();

          if (verb === 'CREATE' && secondVerb === 'DATABASE') {
            // Skip create database
          } else if (verb === 'USE') {
            // Skip use database
          } else if (clean.length > 0 && clean !== ';') {
            yield s;
          }
        }
        i++;
        continue;
      }

      currentStmt += char;
      i++;
    }
    currentStmt += '\n';
  }

  if (currentStmt.trim().length > 0 && currentStmt.trim() !== ';') {
    yield currentStmt.trim();
  }
}

async function main() {
  if (!fs.existsSync(sqlFile)) {
    console.error(`Error: SQL dump file not found: ${sqlFile}`);
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('Error: DATABASE_URL not defined in .env');
    process.exit(1);
  }

  const cfg = parseDatabaseUrl(dbUrl);
  const fileSizeMb = (fs.statSync(sqlFile).size / (1024 * 1024)).toFixed(2);

  console.log('========================================================');
  console.log('  Database Full Restore & Previous Data Removal');
  console.log('========================================================');
  console.log(`Target Host:     ${cfg.host}:${cfg.port}`);
  console.log(`Target Database: ${cfg.database}`);
  console.log(`Target User:     ${cfg.user}`);
  console.log(`SQL Dump File:   ${sqlFile} (${fileSizeMb} MB)`);
  console.log('========================================================\n');

  console.log('Connecting to database...');
  const conn = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    connectTimeout: 60000,
    maxAllowedPacket: 67108864, // 64 MB
  });

  try {
    // Step 1: Disable foreign key checks
    console.log('[1/4] Disabling foreign key checks and tuning session parameters...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      await conn.query('SET SESSION wait_timeout = 28800');
    } catch {}
    try {
      await conn.query('SET SESSION interactive_timeout = 28800');
    } catch {}
    try {
      await conn.query('SET SESSION max_allowed_packet = 67108864');
    } catch {}

    // Step 2: Drop all existing tables
    console.log('[2/4] Dropping all existing tables to remove previous data...');
    const [tables] = await conn.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
    );

    console.log(`Found ${tables.length} existing table(s) to remove.`);
    for (const row of tables) {
      const tableName = row.TABLE_NAME || row.table_name;
      await conn.query(`DROP TABLE IF EXISTS \`${tableName}\``);
    }
    console.log('All previous tables successfully removed.\n');

    // Step 3: Stream and execute statements from SQL dump
    console.log('[3/4] Importing schema and records from SQL dump...');
    const startTime = Date.now();
    let count = 0;
    let creates = 0;
    let inserts = 0;
    let alters = 0;

    for await (const stmt of parseSqlStatements(sqlFile)) {
      count++;
      try {
        await conn.query(stmt);

        const firstWord = stmt.trim().split(/\s+/)[0].toUpperCase();
        if (firstWord === 'CREATE') creates++;
        else if (firstWord === 'INSERT') inserts++;
        else if (firstWord === 'ALTER') alters++;

        if (count % 20 === 0) {
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          process.stdout.write(`  -> Executed ${count} statements (${creates} CREATE, ${inserts} INSERT, ${alters} ALTER) [${elapsed}s]...\r`);
        }
      } catch (err) {
        console.error(`\nError executing statement #${count}: ${err.message}`);
        console.error(`Statement snippet:\n${stmt.slice(0, 200)}...\n`);
        throw err;
      }
    }

    const totalSeconds = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`\nImport complete! Total ${count} statements executed in ${totalSeconds}s.`);
    console.log(`  - Tables created:      ${creates}`);
    console.log(`  - INSERT batches:      ${inserts}`);
    console.log(`  - ALTER constraints:   ${alters}\n`);

    // Step 4: Re-enable foreign key checks & verify row counts
    console.log('[4/4] Re-enabling foreign key checks and verifying data...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    const [newTables] = await conn.query(
      'SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()'
    );
    console.log(`Total tables present in database now: ${newTables.length}`);

    const verifyTables = ['sales', 'sale_details', 'purchases', 'purchase_details', 'customers', 'ledger', 'users', 'products', 'branches', 'attendance'];
    console.log('\nVerification of Key Table Row Counts:');
    for (const t of verifyTables) {
      try {
        const [r] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${t}\``);
        console.log(`  - ${t.padEnd(20)}: ${r[0].cnt.toString().padStart(6)} rows`);
      } catch (e) {
        console.log(`  - ${t.padEnd(20)}: [Table missing or error: ${e.message}]`);
      }
    }

    console.log('\n========================================================');
    console.log('  SUCCESS! Database wiped and restored from 127_0_0_1.sql');
    console.log('========================================================\n');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('\nFATAL ERROR during restore:', err);
  process.exit(1);
});
