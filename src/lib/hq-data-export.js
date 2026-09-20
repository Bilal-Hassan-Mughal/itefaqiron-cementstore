import mysql from 'mysql2/promise';
import * as XLSX from 'xlsx';
import { centralPrisma } from './prisma';
import { parseDatabaseUrl } from './db/database-url';
import { BRANCH_PHYSICAL_TABLES, resolvePhysicalTable } from './branch-physical-tables';

function quoteIdentifier(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

export function escapeSqlValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (val instanceof Date) {
    return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }
  if (Buffer.isBuffer(val)) return `0x${val.toString('hex')}`;
  if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  if (typeof val === 'bigint') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  return `'${String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\0/g, '\\0')}'`;
}

/** Excel (.xlsx) hard limit per cell — longer text must be truncated. */
const EXCEL_MAX_CELL_CHARS = 32767;
const EXCEL_TRUNC_SUFFIX = '… [truncated — use SQL export for full value]';

function fitExcelCellValue(value) {
  if (value == null) return value;

  let text;
  if (typeof value === 'string') {
    text = value;
  } else if (typeof value === 'object') {
    try {
      text = JSON.stringify(value);
    } catch {
      text = String(value);
    }
  } else {
    text = String(value);
  }

  if (text.length <= EXCEL_MAX_CELL_CHARS) return text;
  return text.slice(0, EXCEL_MAX_CELL_CHARS - EXCEL_TRUNC_SUFFIX.length) + EXCEL_TRUNC_SUFFIX;
}

function serializeExcelRow(row) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (Buffer.isBuffer(value)) {
      // Large blobs (e.g. fingerprint templates) cannot fit in Excel cells.
      out[key] = value.length > 1000
        ? `[binary ${value.length} bytes — use SQL export for full data]`
        : fitExcelCellValue(value.toString('base64'));
    } else if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (typeof value === 'bigint') {
      out[key] = Number(value);
    } else if (typeof value === 'string' || typeof value === 'object') {
      out[key] = fitExcelCellValue(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function excelSheetName(tableName) {
  return tableName.slice(0, 31).replace(/[\\/*?:\[\]]/g, '_') || 'Sheet';
}

/** Full central database export — all tables, all branches, HQ data included. */
export async function loadFullDatabaseExportTarget() {
  const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
  if (!parsed?.database) {
    const err = new Error('DATABASE_URL is not configured');
    err.status = 500;
    throw err;
  }

  return {
    config: {
      host: parsed.host,
      port: parsed.port,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
    },
    tableFilter: null,
    scopeLabel: `Complete database (${parsed.database}) — all branches & HQ`,
    databaseName: parsed.database,
  };
}

/** Resolve MySQL connection + table scope for a branch backup. */
export async function loadBranchExportTarget(branchId) {
  const branch = await centralPrisma.branch.findUnique({
    where: { branch_id: branchId },
    select: {
      branch_id: true,
      branch_code: true,
      branch_name: true,
      isolation_mode: true,
      table_prefix: true,
      db_host: true,
      db_port: true,
      db_name: true,
      db_user: true,
      db_password: true,
    },
  });

  if (!branch) {
    const err = new Error('Branch not found');
    err.status = 404;
    throw err;
  }

  if (
    branch.isolation_mode === 'DEDICATED'
    && branch.db_host
    && branch.db_name
    && branch.db_user
    && branch.db_password
  ) {
    return {
      branch,
      config: {
        host: branch.db_host,
        port: branch.db_port || 3306,
        user: branch.db_user,
        password: branch.db_password,
        database: branch.db_name,
      },
      tableFilter: null,
      scopeLabel: `Dedicated database (${branch.db_name})`,
    };
  }

  const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
  if (!parsed?.database) {
    const err = new Error('DATABASE_URL is not configured');
    err.status = 500;
    throw err;
  }

  const config = {
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
  };

  if (branch.isolation_mode === 'PREFIXED' && branch.table_prefix) {
    const tableFilter = BRANCH_PHYSICAL_TABLES.map((table) =>
      resolvePhysicalTable(table, branch.table_prefix)
    );
    return {
      branch,
      config,
      tableFilter,
      scopeLabel: `Prefixed tables (${branch.table_prefix}_*)`,
    };
  }

  return {
    branch,
    config,
    tableFilter: null,
    scopeLabel: `Full database (${parsed.database})`,
  };
}

export async function createExportConnection(config) {
  return mysql.createConnection({
    ...config,
    multipleStatements: false,
  });
}

export async function listExportTables(connection, database, tableFilter) {
  if (Array.isArray(tableFilter) && tableFilter.length > 0) {
    const placeholders = tableFilter.map(() => '?').join(', ');
    const [rows] = await connection.query(
      `SELECT TABLE_NAME AS name
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${placeholders})
       ORDER BY TABLE_NAME`,
      [database, ...tableFilter]
    );
    const found = new Set(rows.map((row) => row.name));
    return tableFilter.filter((name) => found.has(name));
  }

  const [rows] = await connection.query('SHOW TABLES');
  const key = `Tables_in_${database}`;
  return rows.map((row) => row[key]).filter(Boolean);
}

export async function* generateSqlDump(connection, database, tables) {
  const stamp = new Date().toISOString();
  yield `-- Ittefaq Iron HQ Database Export\n`;
  yield `-- Database: ${database}\n`;
  yield `-- Generated: ${stamp}\n\n`;
  yield 'SET NAMES utf8mb4;\n';
  yield 'SET FOREIGN_KEY_CHECKS=0;\n\n';

  for (const table of tables) {
    const tableId = quoteIdentifier(table);
    const [createRows] = await connection.query(`SHOW CREATE TABLE ${tableId}`);
    const createSql = createRows[0]?.['Create Table'];
    if (!createSql) continue;

    yield `--\n-- Table structure for ${table}\n--\n\n`;
    yield `DROP TABLE IF EXISTS ${tableId};\n`;
    yield `${createSql};\n\n`;

    const [rows] = await connection.query(`SELECT * FROM ${tableId}`);
    if (!rows.length) {
      yield `-- No rows in ${table}\n\n`;
      continue;
    }

    yield `--\n-- Data for ${table}\n--\n\n`;
    const columns = Object.keys(rows[0]);
    const columnList = columns.map((col) => quoteIdentifier(col)).join(', ');

    for (const row of rows) {
      const values = columns.map((col) => escapeSqlValue(row[col])).join(', ');
      yield `INSERT INTO ${tableId} (${columnList}) VALUES (${values});\n`;
    }
    yield '\n';
  }

  yield 'SET FOREIGN_KEY_CHECKS=1;\n';
}

export async function buildExcelBuffer(connection, tables) {
  const workbook = XLSX.utils.book_new();

  for (const table of tables) {
    const tableId = quoteIdentifier(table);
    const [rows] = await connection.query(`SELECT * FROM ${tableId}`);
    const sheetRows = rows.map(serializeExcelRow);
    const worksheet = sheetRows.length
      ? XLSX.utils.json_to_sheet(sheetRows)
      : XLSX.utils.aoa_to_sheet([['(empty table)']]);
    XLSX.utils.book_append_sheet(workbook, worksheet, excelSheetName(table));
  }

  if (!workbook.SheetNames.length) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['No tables found']]), 'Export');
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export function buildExportFilename(databaseName, format) {
  const label = String(databaseName || 'database').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const date = new Date().toISOString().slice(0, 10);
  if (format === 'excel') return `ittefaq-${label}-${date}.xlsx`;
  return `ittefaq-${label}-${date}.sql`;
}

export function formatExportBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(2)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatExportDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins < 60) return secs ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins ? `${hours}h ${remMins}m` : `${hours}h`;
}

/** Fast row/size estimate for export progress UI (uses information_schema approx counts). */
export async function getExportPreview(connection, database, tableFilter, format) {
  const tables = await listExportTables(connection, database, tableFilter);
  if (!tables.length) {
    return {
      tableCount: 0,
      totalRows: 0,
      estimatedSeconds: 0,
      estimatedBytes: 0,
    };
  }

  const placeholders = tables.map(() => '?').join(', ');
  const [rows] = await connection.query(
    `SELECT TABLE_NAME AS name, TABLE_ROWS AS row_estimate
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${placeholders})`,
    [database, ...tables]
  );

  let totalRows = 0;
  for (const row of rows) {
    totalRows += Number(row.row_estimate || 0);
  }

  const tableCount = tables.length;
  const bytesPerRow = format === 'excel' ? 220 : 480;
  const estimatedBytes = Math.round(totalRows * bytesPerRow + tableCount * 2500);
  const baseSeconds = 4 + tableCount * 0.45;
  const rowSeconds = format === 'excel' ? totalRows * 0.0035 : totalRows * 0.0018;
  const estimatedSeconds = Math.max(10, Math.ceil(baseSeconds + rowSeconds));

  return {
    tableCount,
    totalRows,
    estimatedSeconds,
    estimatedBytes,
  };
}
