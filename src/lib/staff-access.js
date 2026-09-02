/**
 * Staff (Users table) role checks and module permissions for the POS dashboard.
 */

import {
  expandLegacyModules,
  parseAllowedModules,
  hasPageAccess,
  canAccessPathWithModules,
  getPagesBySection,
  getAllPageIds,
  SYSTEM_PAGES,
} from './page-modules';

/** Every sidebar page — use for User Management checkboxes */
export {
  SYSTEM_PAGES,
  PAGE_SECTIONS,
  getPagesBySection,
  getAllPageIds,
  hasPageAccess,
  normalizeAllowedModules,
  expandLegacyModules,
  parseAllowedModules,
} from './page-modules';

/** @deprecated use SYSTEM_PAGES — kept for imports that expect SYSTEM_MODULES */
export const SYSTEM_MODULES = SYSTEM_PAGES.map((p) => ({
  id: p.id,
  name: p.name,
  category: p.section,
  description: p.path,
  section: p.section,
  adminOnly: p.adminOnly,
}));

export const SYSTEM_ROLES = [
  {
    key: 'BRANCH_SUPER_ADMIN',
    name: 'Branch Super Admin',
    description: 'Full control of one branch — manage staff, settings, and all POS modules for that location.',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    badgeGradient: 'from-indigo-500 to-blue-600',
    defaultModules: ['dashboard', 'user_management', 'store_management', 'store_stock', 'stock_transfer', 'customers', 'products', 'sales', 'sale_returns', 'purchases', 'cargo', 'finance', 'cash_bank_day_end', 'hr', 'reports', 'profit_report', 'biometrics', 'import']
  },
  {
    key: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Full system control and unrestricted access to all modules and configurations.',
    color: 'bg-red-100 text-red-800 border-red-200',
    badgeGradient: 'from-red-500 to-rose-600',
    defaultModules: ['dashboard', 'user_management', 'store_management', 'store_stock', 'stock_transfer', 'customers', 'products', 'sales', 'sale_returns', 'purchases', 'cargo', 'finance', 'cash_bank_day_end', 'hr', 'reports', 'profit_report', 'biometrics', 'import']
  },
  {
    key: 'ADMIN',
    name: 'Admin',
    description: 'Administrative access to manage operations, users, stores, inventory, and financial modules.',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    badgeGradient: 'from-blue-500 to-indigo-600',
    defaultModules: ['dashboard', 'user_management', 'store_management', 'store_stock', 'stock_transfer', 'customers', 'products', 'sales', 'sale_returns', 'purchases', 'cargo', 'finance', 'cash_bank_day_end', 'hr', 'reports', 'profit_report', 'biometrics', 'import']
  },
  {
    key: 'MANAGER',
    name: 'General Manager',
    description: 'Oversees daily sales, purchases, store stock, transfers, staff HR, and operational reports.',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    badgeGradient: 'from-purple-500 to-violet-600',
    defaultModules: ['dashboard', 'store_management', 'store_stock', 'stock_transfer', 'customers', 'products', 'sales', 'sale_returns', 'purchases', 'cargo', 'finance', 'cash_bank_day_end', 'hr', 'reports']
  },
  {
    key: 'ACCOUNTANT',
    name: 'Accountant',
    description: 'Focuses on financial ledgers, customer accounts, cash/bank, day-end, and profit reports.',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    badgeGradient: 'from-emerald-500 to-teal-600',
    defaultModules: ['dashboard', 'customers', 'finance', 'cash_bank_day_end', 'reports', 'profit_report']
  },
  {
    key: 'SALESMAN',
    name: 'Salesman',
    description: 'Sales floor permissions to create orders, process sales, quotations, and manage loaders.',
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    badgeGradient: 'from-amber-500 to-orange-600',
    defaultModules: ['dashboard', 'sales', 'sale_returns', 'customers']
  },
  {
    key: 'STOCK_MANAGER',
    name: 'Inventory Manager',
    description: 'Manages products, categories, store stock, stock transfers, and purchase entries.',
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    badgeGradient: 'from-cyan-500 to-sky-600',
    defaultModules: ['dashboard', 'products', 'purchases', 'store_stock', 'stock_transfer']
  }
];

export function getRoleDefaultModules(roleKey) {
  const role = SYSTEM_ROLES.find((r) => r.key === roleKey);
  const coarse = role ? [...role.defaultModules] : ['dashboard', 'sales'];
  return expandLegacyModules(coarse);
}

export function getStaffRoleName(user) {
  if (!user) return '';
  if (typeof user.role === 'string') return user.role;
  return user.role?.name || user.role?.displayName || '';
}

export function isAdminRole(role) {
  return role === 'SUPER_ADMIN' || role === 'HQ_SUPER_ADMIN' || role === 'ADMIN' || role === 'BRANCH_SUPER_ADMIN';
}

/** Menu item ids visible to SALESMAN (must match paths in isPathAllowedForSalesman). */
export const SALESMAN_ALLOWED_MENU_IDS = new Set([
  'dashboard',
  'orders',
  'new-sale',
  'sales',
  'hold-bills',
  'quotations',
  'sales-analytics',
  'sale-returns',
  'loaders',
]);

function normalizePath(pathname) {
  if (!pathname) return '/';
  let p = pathname;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

/**
 * SALESMAN may only open these areas (prefix match after /dashboard for listed segments).
 */
export function isPathAllowedForSalesman(pathname) {
  const p = normalizePath(pathname);
  if (p === '/dashboard') return true;

  const allowedPrefixes = [
    '/dashboard/orders',
    '/dashboard/quotations',
    '/dashboard/hold-bills',
    '/dashboard/loaders',
    '/dashboard/sales',
  ];

  return allowedPrefixes.some(
    (prefix) => p === prefix || p.startsWith(`${prefix}/`)
  );
}

export function canStaffAccessPath(userOrRole, pathname) {
  const user = typeof userOrRole === 'object' ? userOrRole : null;
  const roleName = user ? getStaffRoleName(user) : userOrRole;

  if (roleName === 'SUPER_ADMIN' || roleName === 'HQ_SUPER_ADMIN' || roleName === 'BRANCH_SUPER_ADMIN') return true;

  const p = normalizePath(pathname);
  if (p.startsWith('/dashboard/hq')) return roleName === 'HQ_SUPER_ADMIN' || roleName === 'SUPER_ADMIN';

  let allowed = user ? parseAllowedModules(user.allowed_modules) : [];
  if (!Array.isArray(allowed) || allowed.length === 0) {
    allowed = getRoleDefaultModules(roleName);
  } else {
    allowed = expandLegacyModules(allowed);
  }

  if (p === '/dashboard' || p === '/dashboard/') {
    return allowed.includes('dashboard');
  }

  if (roleName === 'ADMIN' && allowed.length === 0) return true;

  return canAccessPathWithModules(allowed, p);
}

export function getFirstAllowedPathForStaff(userOrRole) {
  const user = typeof userOrRole === 'object' ? userOrRole : null;
  const roleName = user ? getStaffRoleName(user) : userOrRole;
  if (roleName === 'SUPER_ADMIN' || roleName === 'BRANCH_SUPER_ADMIN') return '/dashboard';

  let allowed = user ? parseAllowedModules(user.allowed_modules) : [];
  if (!Array.isArray(allowed) || allowed.length === 0) {
    allowed = getRoleDefaultModules(roleName);
  } else {
    allowed = expandLegacyModules(allowed);
  }

  for (const page of SYSTEM_PAGES) {
    if (allowed.includes(page.id)) return page.path;
  }

  return '/dashboard';
}

