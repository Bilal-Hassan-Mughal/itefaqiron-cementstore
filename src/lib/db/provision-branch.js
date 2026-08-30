import { execSync } from 'child_process';
import mysql from 'mysql2/promise';
import path from 'path';
import { BRANCH_PHYSICAL_TABLES, resolvePhysicalTable } from '../branch-physical-tables';
import { buildDatabaseUrl, parseDatabaseUrl, suggestDedicatedDbName } from './database-url';

function quoteId(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

/**
 * Create empty prefixed tables in the SAME database (lhr_sales, lhr_customers, …).
 */
export async function provisionPrefixedTables(connection, tablePrefix) {
  const created = [];
  for (const baseTable of BRANCH_PHYSICAL_TABLES) {
    const target = resolvePhysicalTable(baseTable, tablePrefix);
    const source = baseTable;
    try {
      await connection.query(`CREATE TABLE IF NOT EXISTS ${quoteId(target)} LIKE ${quoteId(source)}`);
      created.push(target);
    } catch (err) {
      if (err.code === 'ER_NO_SUCH_TABLE') {
        console.warn(`  ⚠️  Template table ${source} missing — skip ${target}`);
        continue;
      }
      throw err;
    }
  }
  return created;
}

/**
 * Try CREATE DATABASE + prisma db push for a dedicated branch database.
 */
export async function provisionDedicatedDatabase(branchCode, mainDatabaseUrl) {
  const adminUrl = process.env.MYSQL_ADMIN_URL || mainDatabaseUrl;
  const parsed = parseDatabaseUrl(adminUrl);
  if (!parsed) throw new Error('Invalid DATABASE_URL');

  const dbName = suggestDedicatedDbName(mainDatabaseUrl, branchCode);
  if (!dbName) throw new Error('Could not derive dedicated database name');

  const connection = await mysql.createConnection({
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    multipleStatements: true,
  });

  try {
    await connection.query(`CREATE DATABASE IF NOT EXISTS ${quoteId(dbName)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  } finally {
    await connection.end();
  }

  const branchUrl = buildDatabaseUrl({
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: dbName,
  });

  const projectRoot = path.join(process.cwd());
  execSync('npx prisma db push --skip-generate', {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: branchUrl },
    stdio: 'pipe',
  });

  return {
    db_host: parsed.host,
    db_port: parsed.port,
    db_name: dbName,
    db_user: parsed.user,
    db_password: parsed.password,
    database_url: branchUrl,
  };
}

/**
 * Provision branch storage: dedicated DB if allowed, else prefixed tables in main DB.
 */
export async function provisionBranchStorage(branchCode, mainDatabaseUrl) {
  const tablePrefix = branchCode.toLowerCase().replace(/[^a-z0-9_]/g, '');

  if (process.env.BRANCH_ISOLATION_MODE === 'DEDICATED' || process.env.MYSQL_ADMIN_URL) {
    try {
      const dedicated = await provisionDedicatedDatabase(branchCode, mainDatabaseUrl);
      return {
        isolation_mode: 'DEDICATED',
        table_prefix: tablePrefix,
        tables_provisioned: true,
        provision_status: 'ACTIVE',
        provision_message: `Dedicated database ${dedicated.db_name} created with full schema.`,
        ...dedicated,
      };
    } catch (err) {
      console.warn('Dedicated DB provision failed, falling back to prefixed tables:', err.message);
    }
  }

  const parsed = parseDatabaseUrl(mainDatabaseUrl);
  if (!parsed) throw new Error('Invalid DATABASE_URL');

  const connection = await mysql.createConnection({
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
  });

  try {
    const created = await provisionPrefixedTables(connection, tablePrefix);
    return {
      isolation_mode: 'PREFIXED',
      table_prefix: tablePrefix,
      tables_provisioned: true,
      provision_status: 'ACTIVE',
      provision_message: `Created ${created.length} dedicated tables (${tablePrefix}_*) in ${parsed.database}.`,
      db_host: parsed.host,
      db_port: parsed.port,
      db_name: parsed.database,
      db_user: parsed.user,
      db_password: parsed.password,
    };
  } finally {
    await connection.end();
  }
}
