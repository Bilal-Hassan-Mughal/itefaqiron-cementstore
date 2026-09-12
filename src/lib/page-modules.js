/**
 * Every sidebar page is its own module — single source of truth for permissions.
 */

import {
  DASHBOARD_ANALYTICS_WIDGETS,
  DASHBOARD_ANALYTICS_CHILD_WIDGET_IDS,
} from './dashboard-analytics-widgets';

export const PAGE_SECTIONS = [
  'Dashboard',
  'Monthly Analytics',
  'Quick Access',
  'Accounts',
  'Products',
  'Finance',
  'Sales',
  'Purchase',
  'Cargo',
  'Reports',
  'HR Management',
  'System',
];

/** @type {{ id: string, name: string, section: string, path: string, adminOnly?: boolean, hqOnly?: boolean }[]} */
export const SYSTEM_PAGES = [
  { id: 'dashboard', name: 'Dashboard Home', section: 'Dashboard', path: '/dashboard', description: 'Main dashboard page with shortcuts' },
  { id: 'dashboard-low-stock', name: 'Dashboard Low Stock Alerts', section: 'Dashboard', path: '/dashboard', description: 'Low stock grid on dashboard home' },

  ...DASHBOARD_ANALYTICS_WIDGETS.map((w) => ({
    id: w.id,
    name: w.name,
    section: 'Monthly Analytics',
    path: '/dashboard',
    description: w.description,
  })),

  { id: 'orders', name: 'Order List', section: 'Quick Access', path: '/dashboard/orders' },
  { id: 'new-sale', name: 'New Sale', section: 'Quick Access', path: '/dashboard/sales' },
  { id: 'purchases', name: 'New Purchase', section: 'Quick Access', path: '/dashboard/purchases' },
  { id: 'day-end', name: 'Day End / Day Close', section: 'Quick Access', path: '/dashboard/day-end' },
  { id: 'day-end-history', name: 'Closing History', section: 'Quick Access', path: '/dashboard/day-end/history' },
  { id: 'cash-report', name: 'Cash Report', section: 'Quick Access', path: '/dashboard/reports/cash-report' },
  { id: 'bank-report', name: 'Bank Report', section: 'Quick Access', path: '/dashboard/reports/bank-report' },
  { id: 'bank-accounts', name: 'Bank Accounts', section: 'Quick Access', path: '/dashboard/bank-accounts' },
  { id: 'ledger', name: 'Ledger', section: 'Quick Access', path: '/dashboard/finance' },

  { id: 'customercategory', name: 'Account Categories', section: 'Accounts', path: '/dashboard/customercategory' },
  { id: 'customer-types', name: 'Account Types', section: 'Accounts', path: '/dashboard/customer-types', adminOnly: true },
  { id: 'customers', name: 'Accounts', section: 'Accounts', path: '/dashboard/customers' },

  { id: 'categories', name: 'Category Management', section: 'Products', path: '/dashboard/categories' },
  { id: 'sub-categories', name: 'Sub Category Management', section: 'Products', path: '/dashboard/subcategories' },
  { id: 'products', name: 'Product List', section: 'Products', path: '/dashboard/products' },

  { id: 'expense-titles', name: 'Expense Titles', section: 'Finance', path: '/dashboard/expense-titles' },
  { id: 'expenses', name: 'Expense Management', section: 'Finance', path: '/dashboard/expenses' },
  { id: 'journal', name: 'Journal Entries', section: 'Finance', path: '/dashboard/journal' },
  { id: 'internal-transfer', name: 'Internal Transfer', section: 'Finance', path: '/dashboard/internal-transfer' },
  { id: 'adjustment-management', name: 'Adjustment Account', section: 'Finance', path: '/dashboard/adjustment-management' },

  { id: 'sales', name: 'Sales List', section: 'Sales', path: '/dashboard/sales' },
  { id: 'hold-bills', name: 'Hold Bills', section: 'Sales', path: '/dashboard/hold-bills' },
  { id: 'sale-returns', name: 'Sale Returns', section: 'Sales', path: '/dashboard/sales' },
  { id: 'loaders', name: 'Loader / Transport', section: 'Sales', path: '/dashboard/loaders' },
  { id: 'quotations', name: 'Quotations', section: 'Sales', path: '/dashboard/quotations' },
  { id: 'sales-analytics', name: 'Sales Analytics', section: 'Sales', path: '/dashboard/sales/analytics' },

  { id: 'new-purchase', name: 'Create New Purchase', section: 'Purchase', path: '/dashboard/purchases' },
  { id: 'purchase-list', name: 'Purchase List', section: 'Purchase', path: '/dashboard/purchases' },
  { id: 'purchase-returns', name: 'Purchase Returns', section: 'Purchase', path: '/dashboard/purchases' },
  { id: 'vehicles', name: 'Vehicle Management', section: 'Purchase', path: '/dashboard/vehicles' },
  { id: 'purchase-details', name: 'Purchase Details', section: 'Purchase', path: '/dashboard/purchases' },
  { id: 'super-order', name: 'Super Order', section: 'Purchase', path: '/dashboard/super-order' },

  { id: 'cargo', name: 'Cargo Management', section: 'Cargo', path: '/dashboard/cargo' },

  { id: 'reports-dashboard', name: 'Reports Dashboard', section: 'Reports', path: '/dashboard/reports' },
  { id: 'sales-by-date', name: 'Sales (By Date)', section: 'Reports', path: '/dashboard/reports/sales-by-date' },
  { id: 'sales-by-customer', name: 'Sales (Customer Wise)', section: 'Reports', path: '/dashboard/reports/sales-by-customer' },
  { id: 'customer-balance-report', name: 'Customer Balance Report', section: 'Reports', path: '/dashboard/reports/customer-balance-report' },
  { id: 'customers-balance', name: 'Customers Balance (Basic)', section: 'Reports', path: '/dashboard/reports/customers-balance' },
  { id: 'customer-ledger', name: 'Customer Ledger', section: 'Reports', path: '/dashboard/reports/customer-ledger' },
  { id: 'purchases-by-date', name: 'Purchases (By Date)', section: 'Reports', path: '/dashboard/reports/purchases-by-date' },
  { id: 'purchases-by-supplier', name: 'Purchases (Supplier Wise)', section: 'Reports', path: '/dashboard/reports/purchases-by-supplier' },
  { id: 'expenses-by-date', name: 'Expenses Report', section: 'Reports', path: '/dashboard/reports/expenses-by-date' },
  { id: 'order-report', name: 'Order Report', section: 'Reports', path: '/dashboard/reports/order-report' },
  { id: 'stock-report', name: 'Stock Report', section: 'Reports', path: '/dashboard/reports/stock-report' },
  { id: 'sale-report', name: 'Sale Report', section: 'Reports', path: '/dashboard/reports/sale-report' },
  { id: 'item-sale-report', name: 'Item Sale Report', section: 'Reports', path: '/dashboard/reports/item-sale-report' },
  { id: 'profit-report', name: 'Profit Report', section: 'Reports', path: '/dashboard/reports/profit-report' },
  { id: 'purchase-report', name: 'Purchase Report', section: 'Reports', path: '/dashboard/reports/purchase-report' },
  { id: 'rebate-report', name: 'Rebate Report', section: 'Reports', path: '/dashboard/reports/rebate' },
  { id: 'rebate-history', name: 'Rebate History', section: 'Reports', path: '/dashboard/reports/rebate/history' },
  { id: 'supplier-ledger', name: 'Supplier Ledger', section: 'Reports', path: '/dashboard/reports/supplier-ledger' },
  { id: 'balance-sheet', name: 'Balance Sheet', section: 'Reports', path: '/dashboard/reports/balance-sheet' },

  { id: 'hr', name: 'HR Management', section: 'HR Management', path: '/dashboard/hr' },
  { id: 'employees', name: 'Employees', section: 'HR Management', path: '/dashboard/hr?tab=employees' },
  { id: 'attendance', name: 'Attendance', section: 'HR Management', path: '/dashboard/hr?tab=attendance' },
  { id: 'payroll', name: 'Payroll / Salary', section: 'HR Management', path: '/dashboard/hr?tab=salary' },
  { id: 'salary-management', name: 'Salary & Advances', section: 'HR Management', path: '/dashboard/hr?tab=salary' },

  { id: 'usermanagement', name: 'User Management', section: 'System', path: '/dashboard/usermanagement' },
  { id: 'stores', name: 'Store Management', section: 'System', path: '/dashboard/stores' },
  { id: 'store-stock', name: 'Store Stock', section: 'System', path: '/dashboard/store-stock' },
  { id: 'stock-transfer', name: 'Stock Transfer', section: 'System', path: '/dashboard/stock-transfer' },
  { id: 'settings', name: 'Biometric Settings', section: 'System', path: '/dashboard/settings', adminOnly: true },
  { id: 'import', name: 'Excel Data Import', section: 'System', path: '/dashboard/import', adminOnly: true },
];

export const SYSTEM_PAGE_IDS = new Set(SYSTEM_PAGES.map((p) => p.id));

export const SYSTEM_PAGE_BY_ID = Object.fromEntries(SYSTEM_PAGES.map((p) => [p.id, p]));

/** Legacy coarse modules → page ids (backward compatibility) */
export const LEGACY_MODULE_TO_PAGES = {
  dashboard: ['dashboard'],
  dashboard_analytics: [...DASHBOARD_ANALYTICS_CHILD_WIDGET_IDS],
  dashboard_low_stock: ['dashboard-low-stock'],
  user_management: ['usermanagement'],
  store_management: ['stores'],
  store_stock: ['store-stock'],
  stock_transfer: ['stock-transfer'],
  customers: ['customercategory', 'customer-types', 'customers'],
  products: ['categories', 'sub-categories', 'products'],
  sales: ['orders', 'new-sale', 'sales', 'hold-bills', 'sales-analytics'],
  sale_returns: ['sale-returns', 'loaders', 'quotations'],
  purchases: ['purchases', 'new-purchase', 'purchase-list', 'purchase-returns', 'vehicles', 'purchase-details', 'super-order'],
  cargo: ['cargo'],
  finance: ['expense-titles', 'expenses', 'journal', 'ledger', 'internal-transfer', 'adjustment-management', 'bank-accounts'],
  cash_bank_day_end: ['day-end', 'day-end-history', 'cash-report', 'bank-report'],
  hr: ['hr', 'employees', 'attendance', 'payroll', 'salary-management'],
  reports: [
    'reports-dashboard', 'sales-by-date', 'sales-by-customer', 'customer-balance-report',
    'customers-balance', 'customer-ledger', 'purchases-by-date', 'purchases-by-supplier',
    'expenses-by-date', 'order-report', 'stock-report', 'sale-report', 'item-sale-report',
    'purchase-report', 'rebate-report', 'rebate-history', 'supplier-ledger', 'balance-sheet',
  ],
  profit_report: ['profit-report'],
  biometrics: ['settings'],
  import: ['import'],
  system: ['usermanagement', 'stores', 'store-stock', 'stock-transfer', 'settings', 'import'],
  system_settings: ['usermanagement', 'stores', 'store-stock', 'stock-transfer', 'settings', 'import'],
  accounts: ['customercategory', 'customer-types', 'customers'],
  stores_stock: ['stores', 'store-stock', 'stock-transfer'],
  cash_day_end: ['day-end', 'day-end-history', 'cash-report', 'bank-report'],
};

/** Path prefix → page ids that grant access (longest match wins) */
const PATH_PAGE_RULES = [
  { prefix: '/dashboard/day-end/history', pageIds: ['day-end-history'] },
  { prefix: '/dashboard/sales/analytics', pageIds: ['sales-analytics'] },
  { prefix: '/dashboard/reports/sales-by-date', pageIds: ['sales-by-date'] },
  { prefix: '/dashboard/reports/sales-by-customer', pageIds: ['sales-by-customer'] },
  { prefix: '/dashboard/reports/customer-balance-report', pageIds: ['customer-balance-report'] },
  { prefix: '/dashboard/reports/customers-balance', pageIds: ['customers-balance'] },
  { prefix: '/dashboard/reports/customer-ledger', pageIds: ['customer-ledger'] },
  { prefix: '/dashboard/reports/purchases-by-date', pageIds: ['purchases-by-date'] },
  { prefix: '/dashboard/reports/purchases-by-supplier', pageIds: ['purchases-by-supplier'] },
  { prefix: '/dashboard/reports/expenses-by-date', pageIds: ['expenses-by-date'] },
  { prefix: '/dashboard/reports/cash-report', pageIds: ['cash-report'] },
  { prefix: '/dashboard/reports/bank-report', pageIds: ['bank-report'] },
  { prefix: '/dashboard/reports/order-report', pageIds: ['order-report'] },
  { prefix: '/dashboard/reports/stock-report', pageIds: ['stock-report'] },
  { prefix: '/dashboard/reports/sale-report', pageIds: ['sale-report'] },
  { prefix: '/dashboard/reports/item-sale-report', pageIds: ['item-sale-report'] },
  { prefix: '/dashboard/reports/profit-report', pageIds: ['profit-report'] },
  { prefix: '/dashboard/reports/purchase-report', pageIds: ['purchase-report'] },
  { prefix: '/dashboard/reports/rebate/history', pageIds: ['rebate-history', 'rebate-report'] },
  { prefix: '/dashboard/reports/rebate', pageIds: ['rebate-report'] },
  { prefix: '/dashboard/reports/supplier-ledger', pageIds: ['supplier-ledger'] },
  { prefix: '/dashboard/reports/balance-sheet', pageIds: ['balance-sheet'] },
  { prefix: '/dashboard/reports', pageIds: ['reports-dashboard'] },
  { prefix: '/dashboard/usermanagement', pageIds: ['usermanagement'] },
  { prefix: '/dashboard/customercategory', pageIds: ['customercategory'] },
  { prefix: '/dashboard/customer-types', pageIds: ['customer-types'] },
  { prefix: '/dashboard/customers', pageIds: ['customers'] },
  { prefix: '/dashboard/categories', pageIds: ['categories'] },
  { prefix: '/dashboard/subcategories', pageIds: ['sub-categories'] },
  { prefix: '/dashboard/products', pageIds: ['products'] },
  { prefix: '/dashboard/expense-titles', pageIds: ['expense-titles'] },
  { prefix: '/dashboard/expenses', pageIds: ['expenses'] },
  { prefix: '/dashboard/journal', pageIds: ['journal'] },
  { prefix: '/dashboard/internal-transfer', pageIds: ['internal-transfer'] },
  { prefix: '/dashboard/adjustment-management', pageIds: ['adjustment-management'] },
  { prefix: '/dashboard/bank-accounts', pageIds: ['bank-accounts'] },
  { prefix: '/dashboard/finance', pageIds: ['ledger'] },
  { prefix: '/dashboard/hold-bills', pageIds: ['hold-bills'] },
  { prefix: '/dashboard/quotations', pageIds: ['quotations'] },
  { prefix: '/dashboard/loaders', pageIds: ['loaders'] },
  { prefix: '/dashboard/orders', pageIds: ['orders'] },
  { prefix: '/dashboard/vehicles', pageIds: ['vehicles'] },
  { prefix: '/dashboard/cargo', pageIds: ['cargo'] },
  { prefix: '/dashboard/day-end', pageIds: ['day-end'] },
  { prefix: '/dashboard/hr', pageIds: ['hr', 'employees', 'attendance', 'payroll', 'salary-management'] },
  { prefix: '/dashboard/employees', pageIds: ['employees', 'hr'] },
  { prefix: '/dashboard/attendance', pageIds: ['attendance'] },
  { prefix: '/dashboard/payroll', pageIds: ['payroll'] },
  { prefix: '/dashboard/salary-management', pageIds: ['salary-management'] },
  { prefix: '/dashboard/stores', pageIds: ['stores'] },
  { prefix: '/dashboard/store-stock', pageIds: ['store-stock'] },
  { prefix: '/dashboard/stock-transfer', pageIds: ['stock-transfer'] },
  { prefix: '/dashboard/settings', pageIds: ['settings'] },
  { prefix: '/dashboard/import', pageIds: ['import'] },
  { prefix: '/dashboard/sales', pageIds: ['new-sale', 'sales', 'sale-returns'] },
  { prefix: '/dashboard/super-order', pageIds: ['super-order'] },
  { prefix: '/dashboard/purchases', pageIds: ['purchases', 'new-purchase', 'purchase-list', 'purchase-returns', 'purchase-details'] },
  { prefix: '/dashboard', pageIds: ['dashboard'] },
];

export function parseAllowedModules(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function expandLegacyModules(allowed) {
  if (!Array.isArray(allowed) || allowed.length === 0) return [];
  const pages = new Set();
  for (const id of allowed) {
    if (SYSTEM_PAGE_IDS.has(id)) {
      pages.add(id);
      continue;
    }
    const mapped = LEGACY_MODULE_TO_PAGES[id];
    if (mapped) mapped.forEach((p) => pages.add(p));
  }
  return [...pages];
}

export function normalizeAllowedModules(raw) {
  const expanded = expandLegacyModules(parseAllowedModules(raw));
  return expanded.filter((id) => id !== 'dashboard-analytics');
}

export function hasPageAccess(allowed, pageId) {
  const expanded = expandLegacyModules(parseAllowedModules(allowed));
  return expanded.includes(pageId);
}

export function getPageIdsForPath(pathname) {
  let p = pathname || '/';
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  for (const rule of PATH_PAGE_RULES) {
    if (p === rule.prefix || p.startsWith(`${rule.prefix}/`)) {
      return rule.pageIds;
    }
  }
  return [];
}

export function canAccessPathWithModules(allowed, pathname) {
  const pageIds = getPageIdsForPath(pathname);
  if (pageIds.length === 0) return false;
  return pageIds.some((id) => hasPageAccess(allowed, id));
}

export function getPagesBySection() {
  return PAGE_SECTIONS.map((section) => ({
    section,
    pages: SYSTEM_PAGES.filter((p) => p.section === section),
  }));
}

export function getAllPageIds() {
  return SYSTEM_PAGES.map((p) => p.id);
}

export function getAllPageIdsForSection(section) {
  return SYSTEM_PAGES.filter((p) => p.section === section).map((p) => p.id);
}
