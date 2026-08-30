/**
 * Staff (Users table) role checks and module permissions for the POS dashboard.
 */

export const SYSTEM_MODULES = [
  { id: 'dashboard', name: 'Dashboard', category: 'General', description: 'Main overview dashboard & quick metrics' },
  { id: 'user_management', name: 'User Management', category: 'System Control', description: 'Manage system users, roles, and access permissions' },
  { id: 'store_management', name: 'Store Management', category: 'Stores & Stock', description: 'Manage store branches and physical store locations' },
  { id: 'store_stock', name: 'Store Stock', category: 'Stores & Stock', description: 'View and manage inventory stock quantities per store' },
  { id: 'stock_transfer', name: 'Stock Transfer', category: 'Stores & Stock', description: 'Transfer product stock between different store locations' },
  { id: 'customers', name: 'Accounts & Customers', category: 'Core', description: 'Customer profiles, customer categories, and customer balance' },
  { id: 'products', name: 'Products & Categories', category: 'Core', description: 'Product catalog, product categories, and subcategories' },
  { id: 'sales', name: 'Sales & Orders', category: 'Sales', description: 'POS New Sale, Order List, Sales Analytics, and Hold Bills' },
  { id: 'sale_returns', name: 'Sale Returns & Loaders', category: 'Sales', description: 'Sale Returns, Loader/Transport management, and Quotations' },
  { id: 'purchases', name: 'Purchases & Vehicles', category: 'Procurement', description: 'New Purchase, Purchase List, Purchase Returns, and Supplier Vehicles' },
  { id: 'cargo', name: 'Cargo Management', category: 'Logistics', description: 'Cargo tracking, freight charges, and logistics' },
  { id: 'finance', name: 'Finance & Expenses', category: 'Finance', description: 'Expense management, Expense titles, Journal vouchers, and Adjustments' },
  { id: 'cash_bank_day_end', name: 'Cash, Bank & Day End', category: 'Finance', description: 'Cash reports, Bank reports, and Day End / Day Close operations' },
  { id: 'hr', name: 'HR & Payroll', category: 'Operations', description: 'Employee records, Daily attendance, and Payroll/Salary processing' },
  { id: 'reports', name: 'Business Reports', category: 'Analytics', description: 'Sales, Purchases, Stock, Customer Ledger, and Balance Sheet reports' },
  { id: 'profit_report', name: 'Profit & Loss Report', category: 'Analytics', description: 'Confidential profitability analysis and margin reporting' },
  { id: 'biometrics', name: 'Biometric Settings', category: 'System Control', description: 'Fingerprint enrollment, PIN code management, and device auth' },
  { id: 'import', name: 'Excel Data Import', category: 'System Control', description: 'Import product catalog, customer records, and bulk data from Excel' }
];

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
  const role = SYSTEM_ROLES.find(r => r.key === roleKey);
  return role ? [...role.defaultModules] : ['dashboard', 'sales', 'sale_returns'];
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

  // Check allowed modules if user object is available
  let allowed = [];
  if (user) {
    try {
      if (user.allowed_modules) {
        allowed = typeof user.allowed_modules === 'string'
          ? JSON.parse(user.allowed_modules)
          : user.allowed_modules;
      }
    } catch (e) {
      console.error('Failed to parse user.allowed_modules:', e);
    }
  }

  // If user object has no explicit allowed_modules array, use role defaults
  if (!Array.isArray(allowed) || allowed.length === 0) {
    allowed = getRoleDefaultModules(roleName);
  }

  // Dashboard homepage permission check
  if (p === '/dashboard' || p === '/dashboard/') {
    return Array.isArray(allowed) && allowed.includes('dashboard');
  }

  if (Array.isArray(allowed) && allowed.length > 0) {
    const modulePrefixMap = {
      '/dashboard/usermanagement': 'user_management',
      '/dashboard/stores': 'store_management',
      '/dashboard/store-stock': 'store_stock',
      '/dashboard/stock-transfer': 'stock_transfer',
      '/dashboard/settings': 'biometrics',
      '/dashboard/import': 'import',

      '/dashboard/subscriptions': 'customers',
      '/dashboard/customercategory': 'customers',
      '/dashboard/customer-types': 'customers',
      '/dashboard/customers': 'customers',

      '/dashboard/categories': 'products',
      '/dashboard/subcategories': 'products',
      '/dashboard/products': 'products',

      '/dashboard/vehicles': 'purchases',
      '/dashboard/purchases': 'purchases',
      '/dashboard/purchase-returns': 'purchases',
      '/dashboard/purchase-details': 'purchases',

      '/dashboard/cargo': 'cargo',

      '/dashboard/orders': 'sales',
      '/dashboard/new-sale': 'sales',
      '/dashboard/sales': 'sales',
      '/dashboard/hold-bills': 'sales',

      '/dashboard/quotations': 'sale_returns',
      '/dashboard/loaders': 'sale_returns',
      '/dashboard/sale-returns': 'sale_returns',

      '/dashboard/expense-titles': 'finance',
      '/dashboard/expenses': 'finance',
      '/dashboard/journal': 'finance',
      '/dashboard/finance': 'finance',
      '/dashboard/internal-transfer': 'finance',
      '/dashboard/adjustment-management': 'finance',
      '/dashboard/bank-accounts': 'finance',

      '/dashboard/day-end': 'cash_bank_day_end',
      '/dashboard/reports/cash-report': 'cash_bank_day_end',
      '/dashboard/reports/bank-report': 'cash_bank_day_end',

      '/dashboard/reports/profit-report': 'profit_report',
      '/dashboard/reports': 'reports',

      '/dashboard/employees': 'hr',
      '/dashboard/attendance': 'hr',
      '/dashboard/payroll': 'hr',
      '/dashboard/salary-management': 'hr',
    };

    const sortedPrefixes = Object.keys(modulePrefixMap).sort((a, b) => b.length - a.length);
    for (const prefix of sortedPrefixes) {
      if (p === prefix || p.startsWith(`${prefix}/`)) {
        const requiredModule = modulePrefixMap[prefix];
        // Check direct match or legacy fallback keys
        if (allowed.includes(requiredModule)) return true;
        if (requiredModule === 'user_management' && (allowed.includes('system') || allowed.includes('system_settings'))) return true;
        if (requiredModule === 'store_management' && (allowed.includes('system') || allowed.includes('stores_stock'))) return true;
        if (requiredModule === 'store_stock' && (allowed.includes('system') || allowed.includes('stores_stock'))) return true;
        if (requiredModule === 'stock_transfer' && (allowed.includes('system') || allowed.includes('stores_stock'))) return true;
        if (requiredModule === 'biometrics' && (allowed.includes('system') || allowed.includes('system_settings'))) return true;
        if (requiredModule === 'import' && (allowed.includes('system') || allowed.includes('system_settings'))) return true;
        if (requiredModule === 'customers' && allowed.includes('accounts')) return true;
        if (requiredModule === 'sale_returns' && allowed.includes('sales')) return true;
        if (requiredModule === 'cash_bank_day_end' && (allowed.includes('cash_bank_day_end') || allowed.includes('finance') || allowed.includes('reports') || allowed.includes('sales') || allowed.includes('cash_day_end'))) return true;
        return false;
      }
    }
    return false;
  }

  // Fallback to role-based check if allowed_modules is empty/null or not user object
  if (roleName === 'SUPER_ADMIN' || roleName === 'ADMIN' || roleName === 'BRANCH_SUPER_ADMIN') return true;
  if (roleName === 'SALESMAN') return isPathAllowedForSalesman(pathname);
  return false;
}

export function getFirstAllowedPathForStaff(userOrRole) {
  const user = typeof userOrRole === 'object' ? userOrRole : null;
  const roleName = user ? getStaffRoleName(user) : userOrRole;
  if (roleName === 'SUPER_ADMIN') return '/dashboard';

  let allowed = [];
  if (user) {
    try {
      if (user.allowed_modules) {
        allowed = typeof user.allowed_modules === 'string'
          ? JSON.parse(user.allowed_modules)
          : user.allowed_modules;
      }
    } catch (e) {
      console.error('Failed to parse allowed_modules:', e);
    }
  }

  if (!Array.isArray(allowed) || allowed.length === 0) {
    allowed = getRoleDefaultModules(roleName);
  }

  const moduleToPathOrder = [
    { module: 'dashboard', path: '/dashboard' },
    { module: 'sales', path: '/dashboard/sales' },
    { module: 'sale_returns', path: '/dashboard/sale-returns' },
    { module: 'customers', path: '/dashboard/customers' },
    { module: 'products', path: '/dashboard/products' },
    { module: 'purchases', path: '/dashboard/purchases' },
    { module: 'store_stock', path: '/dashboard/store-stock' },
    { module: 'stock_transfer', path: '/dashboard/stock-transfer' },
    { module: 'cargo', path: '/dashboard/cargo' },
    { module: 'finance', path: '/dashboard/finance' },
    { module: 'cash_bank_day_end', path: '/dashboard/day-end' },
    { module: 'hr', path: '/dashboard/employees' },
    { module: 'reports', path: '/dashboard/reports' },
    { module: 'profit_report', path: '/dashboard/reports/profit-report' },
    { module: 'user_management', path: '/dashboard/usermanagement' },
    { module: 'store_management', path: '/dashboard/stores' },
    { module: 'biometrics', path: '/dashboard/settings' },
    { module: 'import', path: '/dashboard/import' }
  ];

  for (const item of moduleToPathOrder) {
    if (allowed.includes(item.module)) return item.path;
  }

  return '/dashboard';
}

