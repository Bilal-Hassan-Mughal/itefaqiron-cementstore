/**
 * Staff (Users table) role checks and module permissions for the POS dashboard.
 */

import {
  expandLegacyModules,
  parseAllowedModules,
  normalizeAllowedModules,
  hasPageAccess,
  canAccessPathWithModules,
  getPageIdsForPath,
  getPagesBySection,
  getAllPageIds,
  SYSTEM_PAGES,
  SYSTEM_PAGE_BY_ID,
} from './page-modules';
import { isHqUser } from './branch-roles';
import { resolveStaffRole, getRoleDisplayName } from './user-role';
import {
  DASHBOARD_ANALYTICS_WIDGET_IDS,
  DASHBOARD_ANALYTICS_CHILD_WIDGET_IDS,
  DASHBOARD_ANALYTICS_WIDGET_ID_SET,
} from './dashboard-analytics-widgets';
import { getRoleTemplateModules, loadCustomRolePermissions } from './role-permissions-store';

export { resolveStaffRole, getRoleDisplayName } from './user-role';

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

/** Roles that receive every page/module by default (User Management → Role Access Map). */
export const FULL_ACCESS_ROLE_KEYS = new Set([
  'BRANCH_SUPER_ADMIN',
  'SUPER_ADMIN',
  'HQ_SUPER_ADMIN',
]);

export const SYSTEM_ROLES = [
  {
    key: 'BRANCH_SUPER_ADMIN',
    name: 'Branch Super Admin',
    description: 'Full control of one branch — all modules enabled by default; adjust in User Management.',
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    badgeGradient: 'from-indigo-500 to-blue-600',
    defaultModules: ['__full_access__'],
  },
  {
    key: 'SUPER_ADMIN',
    name: 'Super Admin',
    description: 'Full system control — all modules enabled by default; adjust in User Management.',
    color: 'bg-red-100 text-red-800 border-red-200',
    badgeGradient: 'from-red-500 to-rose-600',
    defaultModules: ['__full_access__'],
  },
  {
    key: 'ADMIN',
    name: 'Admin',
    description: 'Administrative access to manage operations, users, stores, inventory, and financial modules.',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    badgeGradient: 'from-blue-500 to-indigo-600',
    defaultModules: ['dashboard', 'dashboard_analytics', 'dashboard_low_stock', 'user_management', 'store_management', 'store_stock', 'stock_transfer', 'customers', 'products', 'sales', 'sale_returns', 'purchases', 'cargo', 'finance', 'cash_bank_day_end', 'hr', 'reports', 'profit_report', 'biometrics', 'import']
  },
  {
    key: 'MANAGER',
    name: 'General Manager',
    description: 'Oversees daily sales, purchases, store stock, transfers, staff HR, and operational reports.',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    badgeGradient: 'from-purple-500 to-violet-600',
    defaultModules: ['dashboard', 'dashboard_analytics', 'dashboard_low_stock', 'store_management', 'store_stock', 'stock_transfer', 'customers', 'products', 'sales', 'sale_returns', 'purchases', 'cargo', 'finance', 'cash_bank_day_end', 'hr', 'reports']
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
  if (typeof window !== 'undefined') {
    return getRoleTemplateModules(roleKey, SYSTEM_ROLES);
  }
  if (FULL_ACCESS_ROLE_KEYS.has(roleKey)) {
    return getAllPageIds();
  }
  const role = SYSTEM_ROLES.find((r) => r.key === roleKey);
  const coarse = role ? [...role.defaultModules] : ['dashboard', 'sales'];
  if (coarse.includes('__full_access__')) {
    return getAllPageIds();
  }
  return expandLegacyModules(coarse);
}

export function getStaffRoleName(userOrRole) {
  if (!userOrRole) return '';
  if (typeof userOrRole === 'string') return userOrRole;
  if (typeof userOrRole === 'object') return resolveStaffRole(userOrRole);
  return '';
}

/** Role keys to match User Management templates (resolved + DB role). */
export function getUserRoleKeysForPermissions(user) {
  if (!user) return [];
  const keys = new Set();
  const resolved = resolveStaffRole(user);
  if (resolved) keys.add(resolved);
  if (user.db_role) keys.add(user.db_role);
  if (user.role) keys.add(user.role);
  return [...keys];
}

function getCustomModulesForUser(user) {
  const custom = loadCustomRolePermissions();
  if (!custom) return null;
  for (const key of getUserRoleKeysForPermissions(user)) {
    if (custom[key]?.length) return custom[key];
  }
  return null;
}

export function isAdminRole(role) {
  return role === 'SUPER_ADMIN' || role === 'HQ_SUPER_ADMIN' || role === 'ADMIN' || role === 'BRANCH_SUPER_ADMIN';
}

export function isSuperAdminRole(role) {
  return role === 'SUPER_ADMIN' || role === 'HQ_SUPER_ADMIN' || role === 'BRANCH_SUPER_ADMIN';
}

/** Sidebar Reports section page ids (excludes cash/bank — those live under Quick Access). */
export const REPORT_SECTION_PAGE_IDS = new Set([
  'reports-dashboard',
  'sales-by-date',
  'sales-by-customer',
  'customer-balance-report',
  'customers-balance',
  'customer-ledger',
  'purchases-by-date',
  'purchases-by-supplier',
  'expenses-by-date',
  'order-report',
  'stock-report',
  'sale-report',
  'item-sale-report',
  'purchase-report',
  'rebate-report',
  'rebate-history',
  'supplier-ledger',
  'balance-sheet',
  'profit-report',
]);

/** Dashboard home widgets (assignable in user management). */
export const DASHBOARD_WIDGET_PAGE_IDS = new Set([
  'dashboard',
  'dashboard-low-stock',
  ...DASHBOARD_ANALYTICS_WIDGET_IDS,
]);

export function isReportSectionPageId(pageId) {
  return REPORT_SECTION_PAGE_IDS.has(pageId);
}

/** User may open the Reports hub page (not individual report pages). */
export function hasFullReportsAccess(user) {
  if (!user) return false;
  return hasPageAccess(getStaffAllowedModules(user), 'reports-dashboard');
}

/** Report page access — controlled only by User Management modules. */
export function canAccessReportPage(user, pageId) {
  if (!user || !pageId) return false;
  return hasPageAccess(getStaffAllowedModules(user), pageId);
}

export function getReportsLandingPath(user) {
  if (!user) return '/dashboard/reports';
  const allowed = getStaffAllowedModules(user);
  if (hasPageAccess(allowed, 'reports-dashboard')) {
    return '/dashboard/reports';
  }
  for (const pageId of REPORT_SECTION_PAGE_IDS) {
    if (hasPageAccess(allowed, pageId)) {
      return SYSTEM_PAGE_BY_ID[pageId]?.path || '/dashboard/reports';
    }
  }
  return '/dashboard/reports';
}

/**
 * Resolved page ids for a staff user.
 * On the client, a customized Role Access Map is the live source of truth for that role.
 * Otherwise uses allowed_modules from DB/session, then factory role defaults.
 */
export function getStaffAllowedModules(user) {
  if (!user) return [];
  const roleName = getStaffRoleName(user);

  if (typeof window !== 'undefined') {
    const fromRoleMap = getCustomModulesForUser(user);
    if (fromRoleMap?.length) return fromRoleMap;
  }

  const parsed = parseAllowedModules(user.allowed_modules);
  if (Array.isArray(parsed) && parsed.length > 0) {
    return normalizeAllowedModules(parsed);
  }
  return getRoleDefaultModules(roleName);
}

/** Sidebar / navigation — User Management modules only (+ HQ-only items for HQ users). */
export function canAccessMenuItem(user, item) {
  if (!user || !item?.id) return false;
  if (item.hqOnly && !isHqUser(user)) return false;

  const allowed = getStaffAllowedModules(user);
  const pageId = item.id;

  if (pageId === 'hr') {
    const hrPages = ['hr', 'employees', 'attendance', 'payroll', 'salary-management'];
    return hrPages.some((id) => hasPageAccess(allowed, id));
  }

  return hasPageAccess(allowed, pageId);
}

/** Monthly Analytics widget — each widget must be checked individually. */
export function hasDashboardWidgetAccess(user, widgetId) {
  if (!user || !widgetId) return false;
  if (!DASHBOARD_ANALYTICS_WIDGET_ID_SET.has(widgetId)) return false;
  return hasPageAccess(getStaffAllowedModules(user), widgetId);
}

/** Any Monthly Analytics widget visible on dashboard. */
export function canViewAnyDashboardAnalytics(user) {
  if (!user) return false;
  const allowed = getStaffAllowedModules(user);
  return DASHBOARD_ANALYTICS_WIDGET_IDS.some((id) => hasPageAccess(allowed, id));
}

/** @deprecated — use hasDashboardWidgetAccess(user, widgetId) or canViewAnyDashboardAnalytics */
export function hasDashboardAnalyticsAccess(user) {
  return canViewAnyDashboardAnalytics(user);
}

/** @deprecated alias */
export function hasDashboardReportsAccess(user) {
  return canViewAnyDashboardAnalytics(user);
}

export { DASHBOARD_ANALYTICS_WIDGET_IDS, DASHBOARD_ANALYTICS_CHILD_WIDGET_IDS } from './dashboard-analytics-widgets';

export function canAccessDashboardShortcut(user, path) {
  if (!user || !path) return false;
  const pathname = String(path).split('?')[0];

  if (pathname === '/dashboard/reports' || pathname.startsWith('/dashboard/reports/')) {
    const pageIds = getPageIdsForPath(pathname);
    if (pageIds.length === 0 && pathname === '/dashboard/reports') {
      return canAccessReportPage(user, 'reports-dashboard');
    }
    return pageIds.some((id) => canAccessReportPage(user, id));
  }

  return canStaffAccessPath(user, pathname);
}

export function filterDashboardShortcuts(user, actions) {
  if (!user) return [];
  return (actions || [])
    .filter((action) => canAccessDashboardShortcut(user, action.path))
    .map((action) => {
      const pathname = String(action.path || '').split('?')[0];
      if (pathname === '/dashboard/reports') {
        return {
          ...action,
          path: getReportsLandingPath(user),
        };
      }
      return action;
    });
}

export function canViewDashboardLowStock(user) {
  if (!user) return false;
  return hasPageAccess(getStaffAllowedModules(user), 'dashboard-low-stock');
}

/** Who may open User Management — module access only. */
export function canManageUsers(user) {
  return canStaffAccessPath(user, '/dashboard/usermanagement');
}

/** Group selected page ids by section for access summary UI */
export function getAccessSummaryBySection(selected = []) {
  const selectedSet = new Set(normalizeAllowedModules(selected));
  return getPagesBySection().map(({ section, pages }) => {
    const granted = pages.filter((p) => selectedSet.has(p.id));
    return {
      section,
      total: pages.length,
      granted: granted.length,
      pages: granted.map((p) => p.name),
      pageIds: pages.map((p) => p.id),
    };
  });
}

function normalizePath(pathname) {
  if (!pathname) return '/';
  let p = pathname;
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

/** Route access — User Management allowed_modules only. */
export function canStaffAccessPath(userOrRole, pathname) {
  const user = typeof userOrRole === 'object' ? userOrRole : null;
  const roleName = user ? getStaffRoleName(user) : userOrRole;
  const p = normalizePath(pathname);

  if (p.startsWith('/dashboard/hq')) {
    return isHqUser(user || { role: roleName });
  }

  const staffUser = user || { role: roleName };
  const allowed = getStaffAllowedModules(staffUser);

  if (p === '/dashboard' || p === '/dashboard/') {
    return hasPageAccess(allowed, 'dashboard');
  }

  const pageIds = getPageIdsForPath(p);
  if (pageIds.length > 0) {
    return pageIds.some((id) => hasPageAccess(allowed, id));
  }

  return canAccessPathWithModules(allowed, p);
}

export function getFirstAllowedPathForStaff(userOrRole) {
  const user = typeof userOrRole === 'object' ? userOrRole : null;
  const allowed = getStaffAllowedModules(user || { role: userOrRole });

  for (const page of SYSTEM_PAGES) {
    if (hasPageAccess(allowed, page.id)) return page.path;
  }

  return '/dashboard';
}

