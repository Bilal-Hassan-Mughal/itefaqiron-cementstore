/**
 * Staff role resolution — DB role, display labels, legacy ADMIN → MANAGER/ACCOUNTANT/etc.
 */

import { parseAllowedModules } from './page-modules';

const ROLE_META = {
  BRANCH_SUPER_ADMIN: { name: 'Branch Super Admin', defaultModules: ['dashboard', 'user_management', 'store_management', 'store_stock', 'stock_transfer', 'customers', 'products', 'sales', 'sale_returns', 'purchases', 'cargo', 'finance', 'cash_bank_day_end', 'hr', 'reports', 'profit_report', 'biometrics', 'import'] },
  SUPER_ADMIN: { name: 'Super Admin', defaultModules: ['dashboard', 'user_management', 'store_management', 'store_stock', 'stock_transfer', 'customers', 'products', 'sales', 'sale_returns', 'purchases', 'cargo', 'finance', 'cash_bank_day_end', 'hr', 'reports', 'profit_report', 'biometrics', 'import'] },
  HQ_SUPER_ADMIN: { name: 'HQ Super Admin', defaultModules: ['dashboard', 'user_management', 'store_management', 'store_stock', 'stock_transfer', 'customers', 'products', 'sales', 'sale_returns', 'purchases', 'cargo', 'finance', 'cash_bank_day_end', 'hr', 'reports', 'profit_report', 'biometrics', 'import'] },
  ADMIN: { name: 'Admin', defaultModules: ['dashboard', 'user_management', 'store_management', 'store_stock', 'stock_transfer', 'customers', 'products', 'sales', 'sale_returns', 'purchases', 'cargo', 'finance', 'cash_bank_day_end', 'hr', 'reports', 'profit_report', 'biometrics', 'import'] },
  MANAGER: { name: 'General Manager', defaultModules: ['dashboard', 'store_management', 'store_stock', 'stock_transfer', 'customers', 'products', 'sales', 'sale_returns', 'purchases', 'cargo', 'finance', 'cash_bank_day_end', 'hr', 'reports'] },
  ACCOUNTANT: { name: 'Accountant', defaultModules: ['dashboard', 'customers', 'finance', 'cash_bank_day_end', 'reports', 'profit_report'] },
  SALESMAN: { name: 'Salesman', defaultModules: ['dashboard', 'sales', 'sale_returns', 'customers'] },
  STOCK_MANAGER: { name: 'Inventory Manager', defaultModules: ['dashboard', 'products', 'purchases', 'store_stock', 'stock_transfer'] },
};

export const STAFF_ROLE_KEYS = new Set([
  'SUPER_ADMIN',
  'HQ_SUPER_ADMIN',
  'BRANCH_SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'ACCOUNTANT',
  'STOCK_MANAGER',
  'SALESMAN',
]);

const LEGACY_ADMIN_OPERATIONAL = ['MANAGER', 'ACCOUNTANT', 'STOCK_MANAGER', 'SALESMAN'];

/** Map UI / form role keys to Prisma UserRole enum (1:1). */
export function toDbRole(role) {
  const key = String(role || 'SALESMAN').toUpperCase();
  if (STAFF_ROLE_KEYS.has(key)) return key;
  return 'SALESMAN';
}

export function getRoleDisplayName(roleKey) {
  if (!roleKey) return 'Staff';
  if (ROLE_META[roleKey]?.name) return ROLE_META[roleKey].name;
  return String(roleKey).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Infer operational role when legacy data stored MANAGER/ACCOUNTANT as ADMIN. */
export function inferLegacyAdminRole(allowed_modules) {
  const raw = parseAllowedModules(allowed_modules);
  if (!raw.length) return 'ADMIN';

  if (
    raw.includes('user_management') ||
    raw.includes('usermanagement') ||
    raw.includes('biometrics') ||
    raw.includes('import')
  ) {
    return 'ADMIN';
  }

  if (
    raw.includes('profit_report') &&
    !raw.includes('products') &&
    !raw.includes('purchases') &&
    !raw.includes('sales')
  ) {
    return 'ACCOUNTANT';
  }

  if (
    (raw.includes('products') || raw.includes('store_stock') || raw.includes('stock_transfer')) &&
    !raw.includes('sales') &&
    !raw.includes('sale_returns') &&
    !raw.includes('reports') &&
    !raw.includes('hr')
  ) {
    return 'STOCK_MANAGER';
  }

  if (
    raw.includes('sales') &&
    !raw.includes('purchases') &&
    !raw.includes('user_management') &&
    !raw.includes('reports') &&
    !raw.includes('finance')
  ) {
    return 'SALESMAN';
  }

  if (
    raw.includes('reports') ||
    raw.includes('hr') ||
    raw.includes('purchases') ||
    raw.includes('store_management') ||
    raw.includes('cargo')
  ) {
    return 'MANAGER';
  }

  let best = 'MANAGER';
  let bestScore = 0;
  for (const key of LEGACY_ADMIN_OPERATIONAL) {
    const roleDef = ROLE_META[key];
    if (!roleDef) continue;
    let score = 0;
    for (const mod of roleDef.defaultModules) {
      if (raw.includes(mod)) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = key;
    }
  }
  if (bestScore >= 4) return best;

  return 'ADMIN';
}

/** Effective role for access checks and UI (handles legacy ADMIN rows). */
export function resolveStaffRole(user) {
  if (!user) return '';
  const role = typeof user.role === 'string' ? user.role : user.role?.name || '';
  if (!role) return '';
  if (role !== 'ADMIN') return role;
  return inferLegacyAdminRole(user.allowed_modules);
}

/** Normalize user object returned from API / login. */
export function normalizeUserForClient(user) {
  if (!user) return user;
  const resolvedRole = resolveStaffRole(user);
  return {
    ...user,
    role: resolvedRole,
    db_role: user.role,
    role_label: getRoleDisplayName(resolvedRole),
  };
}

/** True branch admin — can manage users (not manager/accountant/stock). */
export function isBranchUserManager(user) {
  if (!user) return false;
  const role = resolveStaffRole(user);
  if (role === 'BRANCH_SUPER_ADMIN') return true;
  if (role !== 'ADMIN') return false;

  const raw = parseAllowedModules(user.allowed_modules);
  if (!raw.length) return true;
  return raw.includes('user_management') || raw.includes('usermanagement');
}
