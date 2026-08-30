import mysql from 'mysql2/promise';
import { BRANCH_PHYSICAL_TABLES, resolvePhysicalTable } from '../branch-physical-tables';
import { parseDatabaseUrl } from './database-url';

function quoteId(name) {
  return `\`${String(name).replace(/`/g, '``')}\``;
}

async function openMainConnection(databaseUrl) {
  const parsed = parseDatabaseUrl(databaseUrl);
  if (!parsed) throw new Error('Invalid DATABASE_URL');
  const connection = await mysql.createConnection({
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
    multipleStatements: true,
  });
  return { connection, parsed };
}

/**
 * DROP all prefixed branch tables (e.g. lhr_sales, lhr_customers, …).
 */
export async function dropPrefixedBranchTables(databaseUrl, tablePrefix) {
  if (!tablePrefix) return { dropped: [], mode: 'PREFIXED' };

  const { connection } = await openMainConnection(databaseUrl);
  const dropped = [];

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const baseTable of [...BRANCH_PHYSICAL_TABLES].reverse()) {
      const target = resolvePhysicalTable(baseTable, tablePrefix);
      try {
        await connection.query(`DROP TABLE IF EXISTS ${quoteId(target)}`);
        dropped.push(target);
      } catch (err) {
        console.warn(`dropPrefixedBranchTables: skip ${target}:`, err.message);
      }
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await connection.end();
  }

  return { dropped, mode: 'PREFIXED' };
}

/**
 * DROP dedicated branch database.
 */
export async function dropDedicatedBranchDatabase(databaseUrl, dbName) {
  if (!dbName) throw new Error('Dedicated database name is missing on branch record');

  const adminUrl = process.env.MYSQL_ADMIN_URL || databaseUrl;
  const adminParsed = parseDatabaseUrl(adminUrl);
  if (!adminParsed) throw new Error('Invalid DATABASE_URL');

  const connection = await mysql.createConnection({
    host: adminParsed.host,
    port: adminParsed.port,
    user: adminParsed.user,
    password: adminParsed.password,
    multipleStatements: true,
  });

  try {
    await connection.query(`DROP DATABASE IF EXISTS ${quoteId(dbName)}`);
  } finally {
    await connection.end();
  }

  return { dropped: [dbName], mode: 'DEDICATED' };
}

/** Child rows in SHARED mode (no branch_id on table). */
const SHARED_CHILD_DELETES = [
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

/** Parent tables in SHARED mode (have branch_id). */
const SHARED_PARENT_DELETES = [
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

/**
 * Delete all SHARED-mode rows for a branch from main tables.
 */
export async function deleteSharedBranchData(databaseUrl, branchId) {
  const { connection } = await openMainConnection(databaseUrl);
  const deleted = { childStatements: 0, parentTables: [] };

  try {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');

    for (const sql of SHARED_CHILD_DELETES) {
      await connection.query(sql, [branchId]);
      deleted.childStatements += 1;
    }

    for (const table of SHARED_PARENT_DELETES) {
      await connection.query(`DELETE FROM ${quoteId(table)} WHERE branch_id = ?`, [branchId]);
      deleted.parentTables.push(table);
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
  } finally {
    await connection.end();
  }

  return { ...deleted, mode: 'SHARED' };
}

/**
 * Remove branch physical storage when drop_data is true.
 */
export async function deprovisionBranchStorage(branch, databaseUrl) {
  const mode = branch.isolation_mode || 'SHARED';

  if (mode === 'DEDICATED') {
    return dropDedicatedBranchDatabase(databaseUrl, branch.db_name);
  }

  if (mode === 'PREFIXED') {
    const prefix = branch.table_prefix || branch.branch_code?.toLowerCase()?.replace(/[^a-z0-9_]/g, '');
    return dropPrefixedBranchTables(databaseUrl, prefix);
  }

  return deleteSharedBranchData(databaseUrl, branch.branch_id);
}
