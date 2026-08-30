/**
 * Business tables that get a dedicated physical copy per branch
 * (PREFIXED: lhr_sales, DEDICATED: sales in separate database).
 */
export const BRANCH_PHYSICAL_TABLES = [
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

/** Template tables for PREFIXED branches (MAIN / legacy uses unprefixed names). */
export const TEMPLATE_TABLE_MAP = Object.fromEntries(
  BRANCH_PHYSICAL_TABLES.map((t) => [t, t])
);

export function resolvePhysicalTable(baseTable, tablePrefix) {
  if (!tablePrefix) return baseTable;
  const prefix = tablePrefix.toLowerCase().replace(/[^a-z0-9_]/g, '');
  return `${prefix}_${baseTable}`;
}

export function isDedicatedIsolation(branch) {
  if (!branch) return false;
  return branch.isolation_mode === 'DEDICATED' || branch.isolation_mode === 'PREFIXED';
}
