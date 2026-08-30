'use client';

import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Drawer,
  List,
  Typography,
  IconButton,
  Avatar,
  Collapse,
  Tooltip,
  InputBase,
  ListItemButton,
  ListItemIcon,
  Divider,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  Search as SearchIcon,
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  Inventory as InventoryIcon,
  Description as DescriptionIcon,
  AttachMoney as AttachMoneyIcon,
  ShoppingCart as ShoppingCartIcon,
  ShoppingBag as ShoppingBagIcon,
  LocalShipping as LocalShippingIcon,
  Person as PersonIcon,
  Label as LabelIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Receipt as ReceiptIcon,
  CreditCard as CreditCardIcon,
  TableChart as TableChartIcon,
  MenuBook as MenuBookIcon,
  ExpandLess,
  ExpandMore,
  Add as AddIcon,
  Close as CloseIcon,
  Logout as LogoutIcon,
  CalendarToday as CalendarIcon,
  TrendingUp as TrendingUpIcon,
  Store as StoreIcon,
  AssignmentReturn as AssignmentReturnIcon,
  SwapHoriz as SwapHorizIcon,
  PieChart as PieChartIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ListAlt as ListAltIcon,
  Badge as BadgeIcon,
  EventNote as EventNoteIcon,
  Payments as PaymentsIcon,
} from '@mui/icons-material';
import { isAdminRole as isAdminRoleName, getStaffRoleName, getRoleDefaultModules, SALESMAN_ALLOWED_MENU_IDS } from '@/lib/staff-access';
import { isHqUser } from '@/lib/branch-roles';
import { exitHqPosMode } from '@/lib/branch-client';

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 280;
const SIDEBAR_BG = '#ffffff';

const SECTION_COLORS = [
  '#d4ff00', // Lime
  '#00e676', // Green
  '#1de9b6', // Teal
  '#00e5ff', // Cyan
  '#2979ff', // Blue
  '#8c52ff', // Indigo
  '#d500f9', // Violet
  '#ffd600', // Yellow
];

const PILL_COLORS = [
  '#d4ff00', // Lime
  '#00e676', // Green
  '#1de9b6', // Teal
  '#00e5ff', // Cyan
  '#2979ff', // Blue
  '#8c52ff', // Indigo
  '#d500f9', // Violet
  '#ffd600', // Yellow
];

const PILL_WIDTHS = [
  '95%', '80%', '90%', '74%', '97%', '83%', '88%',
  '77%', '93%', '85%', '72%', '96%', '79%', '87%',
];

// Map item IDs to their route paths for URL-based active detection
const ROUTE_MAP = {
  'dashboard': '/dashboard',
  'hq': '/dashboard/hq',
  'usermanagement': '/dashboard/usermanagement',
  'customercategory': '/dashboard/customercategory',
  'customer-types': '/dashboard/customer-types',
  'customers': '/dashboard/customers',
  'categories': '/dashboard/categories',
  'sub-categories': '/dashboard/subcategories',
  'products': '/dashboard/products',
  'purchases': '/dashboard/purchases',
  'new-purchase': '/dashboard/purchases',
  'purchase-list': '/dashboard/purchases',
  'purchase-returns': '/dashboard/purchases',
  'vehicles': '/dashboard/vehicles',
  'ledger': '/dashboard/finance',
  'sales': '/dashboard/sales',
  'hold-bills': '/dashboard/hold-bills',
  'sale-returns': '/dashboard/sales',
  'loaders': '/dashboard/loaders',
  'expense-titles': '/dashboard/expense-titles',
  'expenses': '/dashboard/expenses',
  'journal': '/dashboard/journal',
  'internal-transfer': '/dashboard/internal-transfer',
  'bank-accounts': '/dashboard/bank-accounts',
  'day-end': '/dashboard/day-end',
  'day-end-history': '/dashboard/day-end/history',
  'cargo': '/dashboard/cargo',
  'new-sale': '/dashboard/sales',
  'orders': '/dashboard/orders',
  'quotations': '/dashboard/quotations',
  'sales-analytics': '/dashboard/sales/analytics',
  'reports-dashboard': '/dashboard/reports',
  'sales-by-date': '/dashboard/reports/sales-by-date',
  'sales-by-customer': '/dashboard/reports/sales-by-customer',
  'customer-balance-report': '/dashboard/reports/customer-balance-report',
  'customers-balance': '/dashboard/reports/customers-balance',
  'customer-ledger': '/dashboard/reports/customer-ledger',
  'purchases-by-date': '/dashboard/reports/purchases-by-date',
  'purchases-by-supplier': '/dashboard/reports/purchases-by-supplier',
  'expenses-by-date': '/dashboard/reports/expenses-by-date',
  'cash-report': '/dashboard/reports/cash-report',
  'bank-report': '/dashboard/reports/bank-report',
  'order-report': '/dashboard/reports/order-report',
  'stock-report': '/dashboard/reports/stock-report',
  'sale-report': '/dashboard/reports/sale-report',
  'item-sale-report': '/dashboard/reports/item-sale-report',
  'profit-report': '/dashboard/reports/profit-report',
  'purchase-report': '/dashboard/reports/purchase-report',
  'purchase-details': '/dashboard/purchases',
  'rebate-report': '/dashboard/reports/rebate',
  'balance-sheet': '/dashboard/reports/balance-sheet',
  'stores': '/dashboard/stores',
  'store-stock': '/dashboard/store-stock',
  'stock-transfer': '/dashboard/stock-transfer',
  'employees': '/dashboard/employees',
  'attendance': '/dashboard/attendance',
  'payroll': '/dashboard/payroll',
  'salary-management': '/dashboard/salary-management',
  'settings': '/dashboard/settings',
  'import': '/dashboard/import',
  'internal-transfer': '/dashboard/internal-transfer',
  'adjustment-management': '/dashboard/adjustment-management',
};

// Reverse lookup: path → { itemId, category }
const PATH_TO_ITEM = {};

const getItemHref = (itemId) => {
  if (itemId === 'new-purchase') return '/dashboard/purchases?view=new';
  if (itemId === 'purchase-returns') return '/dashboard/purchases?type=return';
  if (itemId === 'sale-returns') return '/dashboard/sales?type=return';
  if (itemId === 'sub-categories') return '/dashboard/subcategories';
  return ROUTE_MAP[itemId] || '/dashboard';
};

export default function Sidebar({
  sidebarOpen,
  setSidebarOpen,
  activeTab,
  setActiveTab,
  expandedDropdowns,
  setExpandedDropdowns,
  user,
  handleLogout,
  collapsed,
  setCollapsed
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef(null);

  const getItemColor = (item, colorIdx) => {
    if (item.id === 'orders') return '#006D31'; // Orders
    if (item.id === 'new-sale' || item.id === 'sales') return '#04371A'; // Sales
    if (item.category === 'purchase-operations' || item.id === 'purchases') return '#00AC41'; // Purchases
    if (item.category === 'customer-management' || item.id === 'customers' || item.id === 'customercategory') return '#A434FF'; // Accounts
    if (item.category === 'reports' || item.id === 'reports-dashboard') return '#0E0061'; // Reports
    return PILL_COLORS[colorIdx % PILL_COLORS.length];
  };

  const getSectionColor = (category, sectionIdx) => {
    if (category === 'sales-operations') return '#04371A'; // Sales
    if (category === 'purchase-operations') return '#00AC41'; // Purchases
    if (category === 'customer-management') return '#A434FF'; // Accounts
    if (category === 'reports') return '#0E0061'; // Reports
    return SECTION_COLORS[sectionIdx % SECTION_COLORS.length];
  };

  const isDarkColor = (color) => {
    const darkColors = ['#006D31', '#04371A', '#00AC41', '#A434FF', '#0E0061', '#8c52ff', '#2979ff', '#d500f9'];
    return darkColors.includes(color);
  };

  const menuItems = [
    { id: 'hq', name: 'Head Office', icon: StoreIcon, category: 'main', hqOnly: true },
    { id: 'dashboard', name: 'Dashboard', icon: DashboardIcon, category: 'main' },
    { id: 'orders', name: 'Order List', icon: ListAltIcon, category: 'main' },
    { id: 'new-sale', name: 'New Sale', icon: AddIcon, category: 'main' },
    { id: 'purchases', name: 'New Purchase', icon: ShoppingBagIcon, category: 'main' },
    { id: 'day-end', name: 'Day End / Day Close', icon: CalendarIcon, category: 'main' },
    { id: 'day-end-history', name: 'Closing History', icon: CalendarIcon, category: 'main' },
    { id: 'cash-report', name: 'Cash Report', icon: AttachMoneyIcon, category: 'main' },
    { id: 'bank-report', name: 'Bank Report', icon: CreditCardIcon, category: 'main' },
    { id: 'bank-accounts', name: 'Bank Accounts', icon: CreditCardIcon, category: 'main' },
    { id: 'ledger', name: 'Ledger', icon: DescriptionIcon, category: 'main' },

    { id: 'customercategory', name: 'Account Categories', icon: LabelIcon, category: 'customer-management', parent: 'Accounts' },
    { id: 'customer-types', name: 'Account Types', icon: LabelIcon, category: 'customer-management', parent: 'Accounts', adminOnly: true },
    { id: 'customers', name: 'Accounts', icon: PeopleIcon, category: 'customer-management', parent: 'Accounts' },

    { id: 'categories', name: 'Category Management', icon: FolderIcon, category: 'product-management', parent: 'Product Management' },
    { id: 'sub-categories', name: 'Sub Category Management', icon: FolderOpenIcon, category: 'product-management', parent: 'Product Management' },
    { id: 'products', name: 'Product List', icon: InventoryIcon, category: 'product-management', parent: 'Product Management' },

    { id: 'expense-titles', name: 'Expense Titles', icon: LabelIcon, category: 'financial', parent: 'Finance' },
    { id: 'expenses', name: 'Expense Management', icon: AttachMoneyIcon, category: 'financial', parent: 'Finance' },
    { id: 'journal', name: 'Journal Entries', icon: MenuBookIcon, category: 'financial', parent: 'Finance' },
    { id: 'internal-transfer', name: 'Internal Transfer', icon: SwapHorizIcon, category: 'financial', parent: 'Finance' },
    { id: 'adjustment-management', name: 'Adjustment Account', icon: SwapHorizIcon, category: 'financial', parent: 'Finance' },
    { id: 'day-end', name: 'Day End Closing', icon: CalendarIcon, category: 'financial', parent: 'Finance' },
    { id: 'day-end-history', name: 'Closing History', icon: CalendarIcon, category: 'financial', parent: 'Finance' },

    { id: 'orders', name: 'Order List', icon: ListAltIcon, category: 'sales-operations', parent: 'Sales' },
    { id: 'sales', name: 'Sales', icon: ShoppingCartIcon, category: 'sales-operations', parent: 'Sales' },
    { id: 'hold-bills', name: 'Hold Bills', icon: InventoryIcon, category: 'sales-operations', parent: 'Sales' },
    { id: 'sale-returns', name: 'Sale Returns', icon: CloseIcon, category: 'sales-operations', parent: 'Sales' },
    { id: 'loaders', name: 'Loader/Transport', icon: LocalShippingIcon, category: 'sales-operations', parent: 'Sales' },
    { id: 'quotations', name: 'Quotations', icon: ReceiptIcon, category: 'sales-operations', parent: 'Sales' },
    { id: 'sales-analytics', name: 'Sales Analytics', icon: TrendingUpIcon, category: 'sales-operations', parent: 'Sales' },

    { id: 'new-purchase', name: 'Create New Purchase', icon: AddIcon, category: 'purchase-operations', parent: 'Purchase' },
    { id: 'purchase-list', name: 'Purchase List', icon: ShoppingBagIcon, category: 'purchase-operations', parent: 'Purchase' },
    { id: 'purchase-returns', name: 'Purchase Returns', icon: AssignmentReturnIcon, category: 'purchase-operations', parent: 'Purchase' },
    { id: 'vehicles', name: 'Vehicle Management', icon: LocalShippingIcon, category: 'purchase-operations', parent: 'Purchase' },
    { id: 'purchase-details', name: 'Purchase Details', icon: TableChartIcon, category: 'purchase-operations', parent: 'Purchase' },

    { id: 'cargo', name: 'Cargo Management', icon: LocalShippingIcon, category: 'cargo-operations', parent: 'Cargo' },

    { id: 'reports-dashboard', name: 'Reports Dashboard', icon: DashboardIcon, category: 'reports', parent: 'Reports' },
    { id: 'sales-by-date', name: 'Sales (By Date)', icon: CalendarIcon, category: 'reports', parent: 'Reports' },
    { id: 'sales-by-customer', name: 'Sales (Customer Wise)', icon: PeopleIcon, category: 'reports', parent: 'Reports' },
    { id: 'customer-balance-report', name: 'Customer Balance Report', icon: TableChartIcon, category: 'reports', parent: 'Reports' },
    { id: 'customers-balance', name: 'Customers Balance (Basic)', icon: AttachMoneyIcon, category: 'reports', parent: 'Reports' },
    { id: 'customer-ledger', name: 'Customer Ledger', icon: DescriptionIcon, category: 'reports', parent: 'Reports' },
    { id: 'purchases-by-date', name: 'Purchases (By Date)', icon: CalendarIcon, category: 'reports', parent: 'Reports' },
    { id: 'purchases-by-supplier', name: 'Purchases (Supplier Wise)', icon: ShoppingBagIcon, category: 'reports', parent: 'Reports' },
    { id: 'expenses-by-date', name: 'Expenses Report', icon: TrendingUpIcon, category: 'reports', parent: 'Reports' },
    { id: 'order-report', name: 'Order Report', icon: DescriptionIcon, category: 'reports', parent: 'Reports' },
    { id: 'stock-report', name: 'Stock Report', icon: InventoryIcon, category: 'reports', parent: 'Reports' },
    { id: 'sale-report', name: 'Sale Report', icon: ShoppingCartIcon, category: 'reports', parent: 'Reports' },
    { id: 'item-sale-report', name: 'Item Sale Report', icon: ShoppingCartIcon, category: 'reports', parent: 'Reports' },
    { id: 'profit-report', name: 'Profit Report', icon: TrendingUpIcon, category: 'reports', parent: 'Reports' },
    { id: 'purchase-report', name: 'Purchase Report', icon: ShoppingBagIcon, category: 'reports', parent: 'Reports' },
    { id: 'rebate-report', name: 'Rebate Report', icon: PieChartIcon, category: 'reports', parent: 'Reports' },
    { id: 'balance-sheet', name: 'Balance Sheet', icon: TableChartIcon, category: 'reports', parent: 'Reports' },

    { id: 'employees', name: 'Employees', icon: BadgeIcon, category: 'hr-management', parent: 'HR Management' },
    { id: 'attendance', name: 'Attendance', icon: EventNoteIcon, category: 'hr-management', parent: 'HR Management' },
    { id: 'payroll', name: 'Payroll / Salary', icon: PaymentsIcon, category: 'hr-management', parent: 'HR Management' },
    { id: 'salary-management', name: 'Salary & Advances', icon: PaymentsIcon, category: 'hr-management', parent: 'HR Management' },

    { id: 'usermanagement', name: 'User Management', icon: PersonIcon, category: 'system', parent: 'System' },
    { id: 'stores', name: 'Store Management', icon: StoreIcon, category: 'system', parent: 'System' },
    { id: 'store-stock', name: 'Store Stock', icon: InventoryIcon, category: 'system', parent: 'System' },
    { id: 'stock-transfer', name: 'Stock Transfer', icon: SwapHorizIcon, category: 'system', parent: 'System' },
    { id: 'settings', name: 'Biometric Settings', icon: PersonIcon, category: 'system', parent: 'System', adminOnly: true },
    { id: 'import', name: 'Excel Data Import', icon: TableChartIcon, category: 'system', parent: 'System', adminOnly: true },
  ];

  const getRequiredModule = (item) => {
    if (item.id === 'dashboard') return 'dashboard';
    if (item.id === 'profit-report') return 'profit_report';
    if (item.category === 'reports' || item.parent === 'Reports') return 'reports';

    const categoryToModuleMap = {
      'subscriptions': 'customers',
      'customercategory': 'customers',
      'customer-types': 'customers',
      'customers': 'customers',

      'categories': 'products',
      'sub-categories': 'products',
      'products': 'products',

      'expense-titles': 'finance',
      'expenses': 'finance',
      'journal': 'finance',
      'internal-transfer': 'finance',
      'bank-accounts': 'finance',
      'adjustment-management': 'finance',
      'ledger': 'finance',

      'day-end': 'cash_bank_day_end',
      'day-end-history': 'cash_bank_day_end',
      'cash-report': 'cash_bank_day_end',
      'bank-report': 'cash_bank_day_end',

      'orders': 'sales',
      'sales': 'sales',
      'hold-bills': 'sales',
      'sales-analytics': 'sales',
      'new-sale': 'sales',

      'sale-returns': 'sale_returns',
      'loaders': 'sale_returns',
      'quotations': 'sale_returns',

      'new-purchase': 'purchases',
      'purchases': 'purchases',
      'purchase-list': 'purchases',
      'purchase-returns': 'purchases',
      'vehicles': 'purchases',
      'purchase-details': 'purchases',

      'cargo': 'cargo',

      'employees': 'hr',
      'attendance': 'hr',
      'payroll': 'hr',
      'salary-management': 'hr',

      'stores': 'store_management',
      'store-stock': 'store_stock',
      'stock-transfer': 'stock_transfer',

      'usermanagement': 'user_management',
      'settings': 'biometrics',
      'import': 'import',
    };

    if (categoryToModuleMap[item.id]) return categoryToModuleMap[item.id];

    const categoryMapping = {
      'customer-management': 'customers',
      'product-management': 'products',
      'financial': 'finance',
      'sales-operations': 'sales',
      'purchase-operations': 'purchases',
      'cargo-operations': 'cargo',
      'hr-management': 'hr',
      'system': 'biometrics',
    };
    return categoryMapping[item.category];
  };

  const roleName = getStaffRoleName(user);
  const isAdmin = isAdminRoleName(roleName);

  let allowed = [];
  try {
    if (user?.allowed_modules) {
      allowed = typeof user.allowed_modules === 'string'
        ? JSON.parse(user.allowed_modules)
        : user.allowed_modules;
    }
  } catch (e) {
    console.error('Failed to parse allowed_modules:', e);
  }

  // Fallback to role defaults if allowed_modules is not set or empty
  if (!Array.isArray(allowed) || allowed.length === 0) {
    allowed = getRoleDefaultModules(roleName);
  }

  const visibleMenuItems = menuItems.filter((item) => {
    if (item.hqOnly && !isHqUser(user)) return false;
    if (item.adminOnly && !isAdmin) return false;
    if (roleName === 'SUPER_ADMIN' || roleName === 'HQ_SUPER_ADMIN') return true;

    const requiredModule = getRequiredModule(item);
    if (requiredModule && Array.isArray(allowed)) {
      if (allowed.includes(requiredModule)) return true;
      // Backward compatibility checks for legacy permission arrays
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

    if (isAdmin) return true;
    return SALESMAN_ALLOWED_MENU_IDS.has(item.id);
  });

  // Derive activeTab and auto-expand the correct parent section from the URL pathname
  const detectActiveFromPath = useCallback((currentPath) => {
    if (!currentPath) return null;

    // Order matters: check more specific paths first
    const pathMappings = [
      { path: '/dashboard/usermanagement', id: 'usermanagement', category: 'system' },
      { path: '/dashboard/customercategory', id: 'customercategory', category: 'customer-management' },
      { path: '/dashboard/customers', id: 'customers', category: 'customer-management' },
      { path: '/dashboard/categories', id: 'categories', category: 'product-management' },
      { path: '/dashboard/subcategories', id: 'sub-categories', category: 'product-management' },
      { path: '/dashboard/products', id: 'products', category: 'product-management' },
      { path: '/dashboard/vehicles', id: 'vehicles', category: 'purchase-operations' },
      { path: '/dashboard/finance', id: 'ledger', category: 'main' },
      { path: '/dashboard/sales/analytics', id: 'sales-analytics', category: 'sales-operations' },
      { path: '/dashboard/sales', id: 'sales', category: 'sales-operations' },
      { path: '/dashboard/hold-bills', id: 'hold-bills', category: 'sales-operations' },
      { path: '/dashboard/purchases', id: 'purchases', category: 'purchase-operations' },
      { path: '/dashboard/expense-titles', id: 'expense-titles', category: 'financial' },
      { path: '/dashboard/expenses', id: 'expenses', category: 'financial' },
      { path: '/dashboard/internal-transfer', id: 'internal-transfer', category: 'financial' },
      { path: '/dashboard/bank-accounts', id: 'bank-accounts', category: 'main' },
      { path: '/dashboard/adjustment-management', id: 'adjustment-management', category: 'financial' },
      { path: '/dashboard/day-end/history', id: 'day-end-history', category: 'financial' },
      { path: '/dashboard/day-end', id: 'day-end', category: 'financial' },
      { path: '/dashboard/cargo', id: 'cargo', category: 'cargo-operations' },
      { path: '/dashboard/orders', id: 'orders', category: 'sales-operations' },
      { path: '/dashboard/quotations', id: 'quotations', category: 'sales-operations' },
      { path: '/dashboard/loaders', id: 'loaders', category: 'sales-operations' },
      { path: '/dashboard/reports/sales-by-date', id: 'sales-by-date', category: 'reports' },
      { path: '/dashboard/reports/sales-by-customer', id: 'sales-by-customer', category: 'reports' },
      { path: '/dashboard/reports/customer-balance-report', id: 'customer-balance-report', category: 'reports' },
      { path: '/dashboard/reports/customers-balance', id: 'customers-balance', category: 'reports' },
      { path: '/dashboard/reports/customer-ledger', id: 'customer-ledger', category: 'reports' },
      { path: '/dashboard/reports/purchases-by-date', id: 'purchases-by-date', category: 'reports' },
      { path: '/dashboard/reports/purchases-by-supplier', id: 'purchases-by-supplier', category: 'reports' },
      { path: '/dashboard/reports/expenses-by-date', id: 'expenses-by-date', category: 'reports' },
      { path: '/dashboard/reports/cash-report', id: 'cash-report', category: 'main' },
      { path: '/dashboard/reports/bank-report', id: 'bank-report', category: 'main' },
      { path: '/dashboard/reports/order-report', id: 'order-report', category: 'reports' },
      { path: '/dashboard/reports/stock-report', id: 'stock-report', category: 'reports' },
      { path: '/dashboard/reports/sale-report', id: 'sale-report', category: 'reports' },
      { path: '/dashboard/reports/item-sale-report', id: 'item-sale-report', category: 'reports' },
      { path: '/dashboard/reports/profit-report', id: 'profit-report', category: 'reports' },
      { path: '/dashboard/reports/purchase-report', id: 'purchase-report', category: 'reports' },
      { path: '/dashboard/reports/rebate', id: 'rebate-report', category: 'reports' },
      { path: '/dashboard/reports/balance-sheet', id: 'balance-sheet', category: 'reports' },
      { path: '/dashboard/reports', id: 'reports-dashboard', category: 'reports' },
      { path: '/dashboard/stores', id: 'stores', category: 'system' },
      { path: '/dashboard/store-stock', id: 'store-stock', category: 'system' },
      { path: '/dashboard/stock-transfer', id: 'stock-transfer', category: 'system' },
      { path: '/dashboard/employees', id: 'employees', category: 'hr-management' },
      { path: '/dashboard/attendance', id: 'attendance', category: 'hr-management' },
      { path: '/dashboard/payroll', id: 'payroll', category: 'hr-management' },
      { path: '/dashboard/salary-management', id: 'salary-management', category: 'hr-management' },
      { path: '/dashboard/settings', id: 'settings', category: 'system' },
      { path: '/dashboard/import', id: 'import', category: 'system' },
      { path: '/dashboard', id: 'dashboard', category: 'main' },
    ];

    for (const mapping of pathMappings) {
      if (mapping.path === '/dashboard') {
        if (currentPath === '/dashboard' || currentPath === '/dashboard/') {
          return mapping;
        }
      } else if (currentPath.startsWith(mapping.path)) {
        return mapping;
      }
    }
    return null;
  }, []);

  // Sync active tab and expanded section from pathname
  useEffect(() => {
    const match = detectActiveFromPath(pathname);
    if (match) {
      setActiveTab(match.id);
      // Only auto-expand the parent section (accordion: only one open)
      if (match.category !== 'main') {
        setExpandedDropdowns({ [match.category]: true });
      }
    }
  }, [pathname, detectActiveFromPath, setActiveTab, setExpandedDropdowns]);

  const isSearching = searchQuery.trim().length > 0;
  const filteredItems = isSearching
    ? visibleMenuItems.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : visibleMenuItems;

  // Accordion toggle: only one section can be open at a time
  const toggleDropdown = (category) => {
    setExpandedDropdowns(prev => {
      const isCurrentlyOpen = prev[category];
      if (isCurrentlyOpen) {
        // Close this one → all closed
        return {};
      }
      // Open this one → close all others
      return { [category]: true };
    });
  };

  const handleNavigation = (itemId) => {
    if (itemId === 'hq' && isHqUser(user)) {
      exitHqPosMode();
    }
    setActiveTab(itemId);
    setSidebarOpen(false);
  };


  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('lg'), { noSsr: true, defaultMatches: false });

  const drawerWidth = collapsed && !isMobile ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const isCollapsed = collapsed && !isMobile;

  const GoldCoin = () => (
    <Box sx={{
      width: 30,
      height: 30,
      borderRadius: '50%',
      flexShrink: 0,
      ml: 1,
      background: 'radial-gradient(circle at 35% 30%, #fff59d, #ffc107 50%, #e65100)',
      boxShadow: '0 2px 6px rgba(0,0,0,0.25), inset 0 1px 3px rgba(255,255,255,0.5)',
      border: '1.5px solid rgba(255,200,50,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Box sx={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 35%, #fff9c4, #ffd54f 55%, #ff6f00)',
        border: '1px solid rgba(255,255,255,0.5)',
      }} />
    </Box>
  );

  // Colorful pill item with icon + text + optional gold coin
  // Active items are bold + outlined; inactive items are slightly faded
  const renderPillItem = (item, colorIdx, showCoin = false) => {
    const color = getItemColor(item, colorIdx);
    const width = PILL_WIDTHS[colorIdx % PILL_WIDTHS.length];
    const isActive = activeTab === item.id;
    const isDark = isDarkColor(color);
    const href = getItemHref(item.id);

    return (
      <Box key={`${item.id}-${item.category}`} sx={{ mb: 0.9, px: 1.5 }}>
        <Link href={href} passHref style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <Box
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                handleNavigation(item.id);
              }
            }}
            sx={{
              width,
              background: `linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.1) 40%, rgba(0, 0, 0, 0.15) 100%)`,
              backgroundColor: color,
              borderRadius: '28px',
              display: 'flex',
              alignItems: 'center',
              px: 1.5,
              py: 0.9,
              cursor: 'pointer',
              outline: isActive ? (isDark ? '2.5px solid rgba(255,255,255,0.6)' : '2.5px solid rgba(0,0,0,0.35)') : 'none',
              outlineOffset: '1px',
              boxShadow: isActive
                ? `0 6px 20px ${color}b0, inset 0 2px 3px rgba(255,255,255,0.7), inset 0 -2px 3px rgba(0,0,0,0.15)`
                : `0 3px 10px ${color}70, inset 0 2px 3px rgba(255,255,255,0.5), inset 0 -1.5px 2px rgba(0,0,0,0.1)`,
              opacity: 1,
              transform: isActive ? 'scale(1.02)' : 'scale(1)',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                opacity: 1,
                boxShadow: `0 8px 24px ${color}cc, inset 0 2px 3px rgba(255,255,255,0.8), inset 0 -2px 3px rgba(0,0,0,0.2)`,
                filter: 'brightness(1.12) contrast(1.05)',
                transform: 'translateX(5px) scale(1.04)',
                backgroundColor: color,
              },
            }}
          >
            <Box sx={{
              color: isActive 
                ? (isDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.8)') 
                : (isDark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.5)'),
              display: 'flex',
              alignItems: 'center',
              mr: 1.5,
              flexShrink: 0,
              transition: 'color 0.2s ease',
            }}>
              <item.icon sx={{ fontSize: 21 }} />
            </Box>
            <Typography sx={{
              fontWeight: isActive ? 800 : 600,
              color: isActive 
                ? (isDark ? '#fff' : '#000') 
                : (isDark ? 'rgba(255,255,255,0.85)' : '#333'),
              flex: 1,
              fontSize: '0.84rem',
              letterSpacing: 0.3,
              lineHeight: 1.3,
              userSelect: 'none',
              transition: 'all 0.2s ease',
            }}>
              {item.name}
            </Typography>
            {showCoin && <GoldCoin />}
          </Box>
        </Link>
      </Box>
    );
  };

  // Simple child item with sharp corners (no border radius) and indented alignment
  const renderChildItem = (item, colorIdx, sectionColor) => {
    const isActive = activeTab === item.id;
    const isDark = isDarkColor(sectionColor);
    const href = getItemHref(item.id);

    return (
      <Box key={`${item.id}-${item.category}`} sx={{ mb: 0.2 }}>
        <Link href={href} passHref style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <Box
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                handleNavigation(item.id);
              }
            }}
            sx={{
              width: '100%',
              background: isActive
                ? `linear-gradient(135deg, rgba(255, 255, 255, 0.45) 0%, rgba(255, 255, 255, 0.1) 40%, rgba(0, 0, 0, 0.1) 100%)`
                : 'transparent',
              backgroundColor: isActive ? sectionColor : 'transparent',
              borderRadius: '0px', // REMOVE CORNERS
              display: 'flex',
              alignItems: 'center',
              pl: 4.5, // Indent child items
              pr: 2,
              py: 1,
              cursor: 'pointer',
              borderLeft: isActive 
                ? (isDark ? `4px solid #fff` : `4px solid #111`) 
                : `4px solid transparent`,
              opacity: isActive ? 1 : 0.75,
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                opacity: 1,
                backgroundColor: isActive ? sectionColor : `${sectionColor}22`,
                borderLeft: isActive 
                  ? (isDark ? `4px solid #fff` : `4px solid #111`) 
                  : `4px solid ${sectionColor}`,
                transform: 'translateX(4px)',
                filter: 'brightness(1.05)',
              },
            }}
          >
            <Box sx={{
              color: isActive 
                ? (isDark ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.85)') 
                : 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              mr: 1.5,
              flexShrink: 0,
              transition: 'color 0.2s ease',
            }}>
              <item.icon sx={{ fontSize: 19 }} />
            </Box>
            <Typography sx={{
              fontWeight: isActive ? 700 : 500,
              color: isActive 
                ? (isDark ? '#fff' : '#000') 
                : '#444',
              flex: 1,
              fontSize: '0.82rem',
              letterSpacing: 0.2,
              lineHeight: 1.3,
              userSelect: 'none',
              transition: 'all 0.2s ease',
            }}>
              {item.name}
            </Typography>
          </Box>
        </Link>
      </Box>
    );
  };

  const renderCollapsedIcon = (item) => {
    const href = getItemHref(item.id);
    return (
      <Tooltip key={item.id} title={item.name} placement="right" arrow>
        <Link href={href} passHref style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <ListItemButton
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                handleNavigation(item.id);
              }
            }}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              minHeight: 44,
              justifyContent: 'center',
              px: 1,
              backgroundColor: activeTab === item.id ? 'rgba(0,0,0,0.08)' : 'transparent',
              color: activeTab === item.id ? '#111' : '#888',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.05)' },
            }}
          >
            <ListItemIcon sx={{ minWidth: 0, color: 'inherit', justifyContent: 'center' }}>
              <item.icon fontSize="small" />
            </ListItemIcon>
          </ListItemButton>
        </Link>
      </Tooltip>
    );
  };

  const renderMenuSection = (category, title, sectionIdx) => {
    const items = filteredItems.filter(item => item.category === category);
    if (items.length === 0) return null;
    const isExpanded = isCollapsed ? false : (isSearching ? true : expandedDropdowns[category]);
    const sectionColor = getSectionColor(category, sectionIdx);
    const hasActiveChild = items.some(item => activeTab === item.id);
    const isDark = isDarkColor(sectionColor);

    if (isCollapsed) {
      return (
        <Box key={category} sx={{ mb: 0.5 }}>
          {items.map(renderCollapsedIcon)}
          <Divider sx={{ my: 0.5, borderColor: 'rgba(0,0,0,0.08)' }} />
        </Box>
      );
    }

    return (
      <Box key={category} sx={{ mb: 0.5 }}>
        {/* Section header — colorful pill */}
        <Box sx={{ px: 1.5, mb: 0.3, mt: 1 }}>
          <Box
            onClick={() => toggleDropdown(category)}
            sx={{
              width: '100%',
              background: `linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.1) 40%, rgba(0, 0, 0, 0.15) 100%)`,
              backgroundColor: sectionColor,
              borderRadius: '22px',
              display: 'flex',
              alignItems: 'center',
              px: 2,
              py: 0.9,
              cursor: 'pointer',
              boxShadow: hasActiveChild
                ? `0 5px 15px ${sectionColor}b0, inset 0 2px 3px rgba(255,255,255,0.7), inset 0 -2px 3px rgba(0,0,0,0.15)`
                : `0 3px 10px ${sectionColor}60, inset 0 2px 3px rgba(255,255,255,0.5), inset 0 -1.5px 2px rgba(0,0,0,0.1)`,
              outline: hasActiveChild ? `2px solid ${sectionColor}` : 'none',
              outlineOffset: '1px',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                filter: 'brightness(1.12) contrast(1.05)',
                boxShadow: `0 6px 18px ${sectionColor}cc, inset 0 2px 3px rgba(255,255,255,0.8), inset 0 -2px 3px rgba(0,0,0,0.2)`,
                backgroundColor: sectionColor,
                transform: 'scale(1.02)',
              },
            }}
          >
            <Typography sx={{
              color: isDark ? '#fff' : '#111',
              fontWeight: 800,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              fontSize: '0.78rem',
              flex: 1,
              userSelect: 'none',
            }}>
              {title}
            </Typography>
            {isExpanded
              ? <ExpandLess sx={{ fontSize: 18, color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)', transition: 'transform 0.3s ease' }} />
              : <ExpandMore sx={{ fontSize: 18, color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)', transition: 'transform 0.3s ease' }} />}
            <GoldCoin />
          </Box>
        </Box>

        <Collapse in={isExpanded} timeout={300} easing="cubic-bezier(0.4, 0, 0.2, 1)">
          <Box sx={{ pt: 0.25, pb: 0.5 }}>
            {items.map((item) => {
              const globalIdx = visibleMenuItems.findIndex(i => i === item);
              return renderChildItem(item, globalIdx, sectionColor);
            })}
          </Box>
        </Collapse>
      </Box>
    );
  };

  const mainItems = filteredItems.filter(item => item.category === 'main');
  const systemItems = filteredItems.filter(item => item.category === 'system');

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: SIDEBAR_BG }}>
      {/* Header */}
      <Box sx={{
        p: isCollapsed ? 1 : 2,
        borderBottom: '1px solid rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        minHeight: 68,
        bgcolor: '#ffffff',
      }}>
        {!isCollapsed && (
          <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
            <Avatar sx={{
              background: 'linear-gradient(135deg, #cce840, #36c46c)',
              mr: 1.5,
              width: 38,
              height: 38,
              flexShrink: 0,
            }}>
              <DashboardIcon sx={{ color: '#111', fontSize: 20 }} />
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{
                fontWeight: 800,
                color: '#111',
                fontSize: '0.9rem',
                lineHeight: 1.2,
                letterSpacing: 0.5,
              }}>
                Ittefaq Iron
              </Typography>
              <Typography variant="caption" sx={{ color: '#888', fontWeight: 500 }}>
                POS System
              </Typography>
            </Box>
          </Box>
        )}

        {!isMobile && (
          <Tooltip title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} placement="right">
            <IconButton
              onClick={() => setCollapsed(!collapsed)}
              size="small"
              sx={{ color: '#aaa', flexShrink: 0, '&:hover': { color: '#333' } }}
            >
              {isCollapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
            </IconButton>
          </Tooltip>
        )}

        {isMobile && (
          <IconButton onClick={() => setSidebarOpen(false)} sx={{ color: '#888' }}>
            <CloseIcon />
          </IconButton>
        )}
      </Box>

      {/* Search */}
      {!isCollapsed && (
        <Box sx={{ px: 1.5, py: 1.2, borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <Box sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.7,
            borderRadius: '20px',
            border: '1px solid rgba(0,0,0,0.12)',
            bgcolor: '#f5f5f5',
            '&:focus-within': { borderColor: '#36c46c', bgcolor: '#f0fff4' },
          }}>
            <SearchIcon sx={{ color: '#aaa', fontSize: 17 }} />
            <InputBase
              placeholder="Search menu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              fullWidth
              sx={{ fontSize: 13, color: '#333' }}
              inputProps={{ 'aria-label': 'search sidebar menu' }}
            />
            {searchQuery && (
              <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.25, color: '#aaa' }}>
                <CloseIcon sx={{ fontSize: 15 }} />
              </IconButton>
            )}
          </Box>
        </Box>
      )}

      {/* Navigation */}
      <Box
        ref={scrollContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          py: 1,
          px: isCollapsed ? 0.5 : 0,
          scrollBehavior: 'smooth',
          '&::-webkit-scrollbar': { width: 5 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(0,0,0,0.12)',
            borderRadius: 10,
            '&:hover': { background: 'rgba(0,0,0,0.2)' },
          },
        }}
      >
        <List disablePadding>
          {/* Overview */}
          {mainItems.length > 0 && (
            <Box sx={{ mb: 0.5 }}>
              {!isCollapsed && (
                <Box sx={{ px: 1.5, mb: 0.3, mt: 0.5 }}>
                  <Box sx={{
                    width: '100%',
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.25) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(0, 0, 0, 0.15) 100%)',
                    backgroundColor: '#111',
                    borderRadius: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 0.9,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.25), inset 0 1px 2px rgba(255,255,255,0.3)',
                  }}>
                    <Typography sx={{
                      color: '#cce840',
                      fontWeight: 800,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      fontSize: '0.78rem',
                      userSelect: 'none',
                    }}>
                      Overview
                    </Typography>
                  </Box>
                </Box>
              )}
              {mainItems.map((item) => {
                if (isCollapsed) return renderCollapsedIcon(item);
                const globalIdx = visibleMenuItems.findIndex(i => i === item);
                return renderPillItem(item, globalIdx, true);
              })}
              {isCollapsed && <Divider sx={{ my: 0.5, borderColor: 'rgba(0,0,0,0.08)' }} />}
            </Box>
          )}

          {renderMenuSection('customer-management', 'Accounts', 0)}
          {renderMenuSection('product-management', 'Products', 1)}
          {renderMenuSection('financial', 'Finance', 2)}
          {renderMenuSection('sales-operations', 'Sales', 3)}
          {renderMenuSection('purchase-operations', 'Purchase', 4)}
          {renderMenuSection('cargo-operations', 'Cargo', 5)}
          {renderMenuSection('hr-management', 'HR Management', 6)}
          {renderMenuSection('reports', 'Reports', 7)}

          {/* System */}
          {systemItems.length > 0 && (
            <Box sx={{ mb: 1 }}>
              {!isCollapsed && (
                <Box sx={{ px: 1.5, mb: 0.3, mt: 1 }}>
                  <Box sx={{
                    width: '100%',
                    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.3) 0%, rgba(255, 255, 255, 0.08) 50%, rgba(0, 0, 0, 0.15) 100%)',
                    backgroundColor: '#555',
                    borderRadius: '22px',
                    display: 'flex',
                    alignItems: 'center',
                    px: 2,
                    py: 0.9,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.2), inset 0 1px 2px rgba(255,255,255,0.4)',
                  }}>
                    <Typography sx={{
                      color: '#fff',
                      fontWeight: 800,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      fontSize: '0.78rem',
                      userSelect: 'none',
                    }}>
                      System
                    </Typography>
                  </Box>
                </Box>
              )}
              {systemItems.map((item) => {
                if (isCollapsed) return renderCollapsedIcon(item);
                const globalIdx = visibleMenuItems.findIndex(i => i === item);
                return renderPillItem(item, globalIdx);
              })}
            </Box>
          )}

          {isSearching && filteredItems.length === 0 && (
            <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: '#aaa' }}>
                No results for &quot;{searchQuery}&quot;
              </Typography>
            </Box>
          )}
        </List>
      </Box>

      {/* User Profile */}
      <Box sx={{ p: isCollapsed ? 0.5 : 1.5, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        {isCollapsed ? (
          <Tooltip title={`${user?.email} — Logout`} placement="right" arrow>
            <IconButton onClick={handleLogout} sx={{ width: '100%', borderRadius: 2, py: 1, color: '#888' }}>
              <LogoutIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <Box sx={{
            p: 1.5,
            borderRadius: '16px',
            border: '1px solid rgba(0,0,0,0.08)',
            bgcolor: '#f8f8f8',
            display: 'flex',
            alignItems: 'center',
          }}>
            <Avatar sx={{
              background: 'linear-gradient(135deg, #7858d4, #22c4d4)',
              mr: 1.5,
              width: 34,
              height: 34,
              fontSize: '0.85rem',
              fontWeight: 700,
            }}>
              {user?.email?.charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: '#222', fontSize: '0.8rem' }} noWrap>
                {user?.email}
              </Typography>
              <Typography variant="caption" sx={{ color: '#888', textTransform: 'uppercase', fontSize: '0.65rem' }}>
                {user?.role?.displayName || user?.role?.name || user?.role}
              </Typography>
            </Box>
            <Tooltip title="Logout">
              <IconButton onClick={handleLogout} size="small" sx={{ color: '#bbb', '&:hover': { color: '#e04858' } }}>
                <LogoutIcon sx={{ fontSize: 18 }} />
              </IconButton>
            </Tooltip>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={isMobile ? 'temporary' : 'permanent'}
      open={isMobile ? sidebarOpen : true}
      onClose={() => setSidebarOpen(false)}
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        transition: theme.transitions.create('width', {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid rgba(0,0,0,0.1)',
          bgcolor: SIDEBAR_BG,
          overflowX: 'hidden',
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
