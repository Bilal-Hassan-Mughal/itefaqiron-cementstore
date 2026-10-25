import { PrismaClient } from '@prisma/client';
import {
  getActiveBranchId,
  getActiveBranchPrisma,
  getActiveTablePrefix,
  getBranchContext,
} from './branch-context';
import { BRANCH_SCOPED_MODELS, getModelDelegate } from './branch-scoped-models';
import { buildDatabaseUrl } from './db/database-url';
import { resolvePhysicalTable } from './branch-physical-tables';

const globalForPrisma = globalThis;

const READ_OPS = new Set(['findMany', 'findFirst', 'count', 'aggregate', 'groupBy']);
const WRITE_WHERE_OPS = new Set(['update', 'updateMany', 'delete', 'deleteMany']);

const MODEL_TABLE = {
  Users: 'users',
  CustomerCategory: 'customer_categories',
  CustomerType: 'customer_types',
  City: 'cities',
  Customer: 'customers',
  Categories: 'categories',
  SubCategory: 'sub_categories',
  Product: 'products',
  Ledger: 'ledger',
  ExpenseTitle: 'expense_titles',
  Expense: 'expenses',
  Sale: 'sales',
  Purchase: 'purchases',
  PurchaseReturn: 'purchase_returns',
  Vehicle: 'vehicles',
  Loader: 'loaders',
  Cargo: 'cargo',
  SaleReturn: 'sale_returns',
  HoldBill: 'hold_bills',
  DayEnd: 'day_ends',
  Journal: 'journals',
  Store: 'stores',
  Package: 'packages',
  Subscription: 'subscriptions',
  StockTransfer: 'stock_transfers',
  DraftSale: 'draft_sales',
  Employee: 'employees',
  HrSettings: 'hr_settings',
  Payment: 'payments',
  ActivityLog: 'activity_logs',
};

function createExtendedClient(base, { useBranchIdFilter }) {
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const ctx = getBranchContext();
          const branchId = useBranchIdFilter ? getActiveBranchId() : null;

          if (ctx?.isolationMode === 'PREFIXED' && MODEL_TABLE[model]) {
            const physical = resolvePhysicalTable(MODEL_TABLE[model], ctx.tablePrefix);
            if (operation === 'findMany') {
              return base.$queryRawUnsafe(`SELECT * FROM \`${physical}\``);
            }
            if (operation === 'count') {
              const rows = await base.$queryRawUnsafe(`SELECT COUNT(*) AS c FROM \`${physical}\``);
              return rows?.[0]?.c ?? 0;
            }
          }

          if (!branchId || !BRANCH_SCOPED_MODELS.has(model)) {
            return query(args);
          }

          const nextArgs = { ...args };

          if (operation === 'findUnique') {
            const delegate = getModelDelegate(model);
            return base[delegate].findFirst({
              where: { ...(nextArgs.where || {}), branch_id: branchId },
              include: nextArgs.include,
              select: nextArgs.select,
            });
          }

          if (READ_OPS.has(operation) || WRITE_WHERE_OPS.has(operation)) {
            nextArgs.where = { ...(nextArgs.where || {}), branch_id: branchId };
          }

          if (operation === 'create' && nextArgs.data) {
            nextArgs.data = { ...nextArgs.data, branch_id: nextArgs.data.branch_id ?? branchId };
          }

          if (operation === 'createMany' && Array.isArray(nextArgs.data)) {
            nextArgs.data = nextArgs.data.map((row) => ({
              ...row,
              branch_id: row.branch_id ?? branchId,
            }));
          }

          if (operation === 'upsert') {
            nextArgs.where = { ...(nextArgs.where || {}), branch_id: branchId };
            nextArgs.create = {
              ...(nextArgs.create || {}),
              branch_id: nextArgs.create?.branch_id ?? branchId,
            };
          }

          return query(nextArgs);
        },
      },
    },
  });
}

function createBaseClient(useBranchIdFilter) {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
  return createExtendedClient(base, { useBranchIdFilter });
}

const branchClientCache = new Map();

export function getDedicatedBranchClient(branch) {
  if (!branch?.branch_id) return null;

  if (
    branch.isolation_mode === 'DEDICATED'
    && branch.db_host
    && branch.db_name
    && branch.db_user
    && branch.db_password
  ) {
    const key = `db:${branch.branch_id}:${branch.db_name}`;
    if (branchClientCache.has(key)) return branchClientCache.get(key);

    const url = buildDatabaseUrl({
      host: branch.db_host,
      port: branch.db_port || 3306,
      user: branch.db_user,
      password: branch.db_password,
      database: branch.db_name,
    });

    const base = new PrismaClient({
      datasources: { db: { url } },
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
    const client = createExtendedClient(base, { useBranchIdFilter: false });
    branchClientCache.set(key, client);
    return client;
  }

  return null;
}

export const centralPrisma = globalForPrisma.centralPrisma || createBaseClient(true);
if (process.env.NODE_ENV !== 'production') globalForPrisma.centralPrisma = centralPrisma;

function resolveRequestClient() {
  const dedicated = getActiveBranchPrisma();
  if (dedicated) return dedicated;
  return centralPrisma;
}

export const prisma = new Proxy(centralPrisma, {
  get(_target, prop) {
    const client = resolveRequestClient();
    const value = client[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default prisma;

export function sqlBranchWhere(branchId, tableAlias = '') {
  const ctx = getBranchContext();
  if (ctx?.isolationMode === 'DEDICATED' || ctx?.isolationMode === 'PREFIXED') return '1=1';
  const col = tableAlias ? `${tableAlias}.branch_id` : 'branch_id';
  return `${col} = ${Number(branchId)}`;
}

export function sqlTableName(baseTable) {
  const prefix = getActiveTablePrefix();
  const mode = getBranchContext()?.isolationMode;
  if (mode !== 'PREFIXED' || !prefix) return baseTable;
  return resolvePhysicalTable(baseTable, prefix);
}
