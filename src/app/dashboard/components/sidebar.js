'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Drawer,
  List,
  Typography,
  IconButton,
  Collapse,
  Tooltip,
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
  Add as AddIcon,
  Close as CloseIcon,
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
import { canAccessMenuItem } from '@/lib/staff-access';
import { isHqUser } from '@/lib/branch-roles';
import { exitHqPosMode } from '@/lib/branch-client';
import { NAV_FN, SIDEBAR, SIDEBAR_WIDTH, SIDEBAR_SECTION_LABELS, COMPANY, POWERED_BY } from '@/lib/brand-theme';

const COLLAPSED_WIDTH = SIDEBAR_WIDTH.collapsed;
const EXPANDED_WIDTH = SIDEBAR_WIDTH.expanded;

const SECTION_META = {
  Overview: { fn: 'overview', icon: DashboardIcon },
  Accounts: { fn: 'accounts', icon: PeopleIcon },
  Products: { fn: 'inventory', icon: InventoryIcon },
  Finance: { fn: 'finance', icon: AttachMoneyIcon },
  Sales: { fn: 'sales', icon: ShoppingCartIcon },
  Purchase: { fn: 'purchase', icon: ShoppingBagIcon },
  Cargo: { fn: 'inventory', icon: LocalShippingIcon },
  'HR Management': { fn: 'hr', icon: BadgeIcon },
  Reports: { fn: 'reports', icon: PieChartIcon },
  System: { fn: 'system', icon: PersonIcon },
};

const SALES_IDS = new Set(['orders', 'new-sale', 'sales', 'hold-bills', 'sale-returns', 'quotations', 'sales-analytics', 'loaders']);
const PURCHASE_IDS = new Set(['purchases', 'new-purchase', 'purchase-list', 'purchase-returns', 'vehicles', 'purchase-details', 'super-order']);
const INVENTORY_IDS = new Set(['products', 'categories', 'sub-categories', 'store-stock', 'stock-transfer', 'stores', 'cargo']);
const OPERATIONS_IDS = new Set(['day-end', 'day-end-history', 'cash-report', 'bank-report', 'bank-accounts']);
const FINANCE_IDS = new Set(['expenses', 'expense-titles', 'journal', 'internal-transfer', 'adjustment-management']);
const ACCOUNTS_IDS = new Set(['customercategory', 'customer-types', 'customers']);

const getNavFn = (item) => {
  const { id, category } = item;
  if (id === 'dashboard' || id === 'hq') return NAV_FN.overview;
  if (id === 'ledger') return NAV_FN.ledger;
  if (SALES_IDS.has(id) || category === 'sales-operations') return NAV_FN.sales;
  if (PURCHASE_IDS.has(id) || category === 'purchase-operations') return NAV_FN.purchase;
  if (INVENTORY_IDS.has(id) || category === 'product-management' || category === 'cargo-operations') return NAV_FN.inventory;
  if (OPERATIONS_IDS.has(id)) return NAV_FN.operations;
  if (FINANCE_IDS.has(id) || category === 'financial') return NAV_FN.finance;
  if (ACCOUNTS_IDS.has(id) || category === 'customer-management') return NAV_FN.accounts;
  if (category === 'reports') return NAV_FN.reports;
  if (category === 'hr-management') return NAV_FN.hr;
  if (category === 'system') return NAV_FN.system;
  if (category === 'main') return NAV_FN.overview;
  return NAV_FN.overview;
};

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
  'super-order': '/dashboard/super-order',
  'rebate-report': '/dashboard/reports/rebate',
  'balance-sheet': '/dashboard/reports/balance-sheet',
  'stores': '/dashboard/stores',
  'store-stock': '/dashboard/store-stock',
  'stock-transfer': '/dashboard/stock-transfer',
  'employees': '/dashboard/hr?module=employees',
  'attendance': '/dashboard/hr?module=attendance',
  'payroll': '/dashboard/hr?module=salary-sheet',
  'salary-management': '/dashboard/hr?module=salary-sheet',
  'hr': '/dashboard/hr',
  'settings': '/dashboard/settings',
  'import': '/dashboard/import',
  'internal-transfer': '/dashboard/internal-transfer',
  'adjustment-management': '/dashboard/adjustment-management',
};

// Reverse lookup: path → { itemId, category }
const PATH_TO_ITEM = {};

const getItemHref = (itemId) => {
  if (itemId === 'new-sale') return '/dashboard/sales';
  if (itemId === 'new-purchase') return '/dashboard/purchases?view=create';
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
  collapsed,
  onToggleCollapse,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const scrollContainerRef = useRef(null);

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
    { id: 'super-order', name: 'Super Order', icon: ListAltIcon, category: 'purchase-operations', parent: 'Purchase' },

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
    { id: 'rebate-history', name: 'Rebate History', icon: PieChartIcon, category: 'reports', parent: 'Reports' },
    { id: 'supplier-ledger', name: 'Supplier Ledger', icon: DescriptionIcon, category: 'reports', parent: 'Reports' },
    { id: 'balance-sheet', name: 'Balance Sheet', icon: TableChartIcon, category: 'reports', parent: 'Reports' },

    { id: 'hr', name: 'HR Management', icon: BadgeIcon, category: 'hr-management', parent: 'HR Management' },

    { id: 'usermanagement', name: 'User Management', icon: PersonIcon, category: 'system', parent: 'System' },
    { id: 'stores', name: 'Store Management', icon: StoreIcon, category: 'system', parent: 'System' },
    { id: 'store-stock', name: 'Store Stock', icon: InventoryIcon, category: 'system', parent: 'System' },
    { id: 'stock-transfer', name: 'Stock Transfer', icon: SwapHorizIcon, category: 'system', parent: 'System' },
    { id: 'settings', name: 'Biometric Settings', icon: PersonIcon, category: 'system', parent: 'System', adminOnly: true },
    { id: 'import', name: 'Excel Data Import', icon: TableChartIcon, category: 'system', parent: 'System', adminOnly: true },
  ];

  const visibleMenuItems = menuItems.filter((item) => canAccessMenuItem(user, item));

  // Derive activeTab from pathname + query (view=create, type=return, etc.)
  const detectActiveFromPath = useCallback((currentPath, params) => {
    if (!currentPath) return null;

    const view = params?.get?.('view') || null;
    const type = params?.get?.('type') || null;

    if (currentPath.startsWith('/dashboard/sales/analytics')) {
      return { id: 'sales-analytics', category: 'sales-operations' };
    }

    if (currentPath.startsWith('/dashboard/sales')) {
      if (type === 'return') {
        return { id: 'sale-returns', category: 'sales-operations' };
      }
      // Sidebar "New Sale" opens the sales list; form opens from the list page button
      return { id: 'new-sale', category: 'main' };
    }

    if (currentPath.startsWith('/dashboard/purchases')) {
      if (type === 'return') {
        return { id: 'purchase-returns', category: 'purchase-operations' };
      }
      if (view === 'create' || view === 'new') {
        return { id: 'purchases', category: 'main' };
      }
      return { id: 'purchase-list', category: 'purchase-operations' };
    }

    if (currentPath.startsWith('/dashboard/orders')) {
      return { id: 'orders', category: view === 'create' ? 'main' : 'sales-operations' };
    }

    // Order matters: check more specific paths first
    const pathMappings = [
      { path: '/dashboard/usermanagement', id: 'usermanagement', category: 'system' },
      { path: '/dashboard/customercategory', id: 'customercategory', category: 'customer-management' },
      { path: '/dashboard/customers', id: 'customers', category: 'customer-management' },
      { path: '/dashboard/categories', id: 'categories', category: 'product-management' },
      { path: '/dashboard/subcategories', id: 'sub-categories', category: 'product-management' },
      { path: '/dashboard/products', id: 'products', category: 'product-management' },
      { path: '/dashboard/super-order', id: 'super-order', category: 'purchase-operations' },
      { path: '/dashboard/vehicles', id: 'vehicles', category: 'purchase-operations' },
      { path: '/dashboard/finance', id: 'ledger', category: 'main' },
      { path: '/dashboard/hold-bills', id: 'hold-bills', category: 'sales-operations' },
      { path: '/dashboard/expense-titles', id: 'expense-titles', category: 'financial' },
      { path: '/dashboard/expenses', id: 'expenses', category: 'financial' },
      { path: '/dashboard/internal-transfer', id: 'internal-transfer', category: 'financial' },
      { path: '/dashboard/bank-accounts', id: 'bank-accounts', category: 'main' },
      { path: '/dashboard/adjustment-management', id: 'adjustment-management', category: 'financial' },
      { path: '/dashboard/day-end/history', id: 'day-end-history', category: 'financial' },
      { path: '/dashboard/day-end', id: 'day-end', category: 'financial' },
      { path: '/dashboard/cargo', id: 'cargo', category: 'cargo-operations' },
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
      { path: '/dashboard/reports/rebate/history', id: 'rebate-history', category: 'reports' },
      { path: '/dashboard/reports/rebate', id: 'rebate-report', category: 'reports' },
      { path: '/dashboard/reports/supplier-ledger', id: 'supplier-ledger', category: 'reports' },
      { path: '/dashboard/reports/balance-sheet', id: 'balance-sheet', category: 'reports' },
      { path: '/dashboard/reports', id: 'reports-dashboard', category: 'reports' },
      { path: '/dashboard/stores', id: 'stores', category: 'system' },
      { path: '/dashboard/store-stock', id: 'store-stock', category: 'system' },
      { path: '/dashboard/stock-transfer', id: 'stock-transfer', category: 'system' },
      { path: '/dashboard/hr', id: 'hr', category: 'hr-management' },
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

  // Sync active tab and expanded section from pathname + search params
  useEffect(() => {
    const match = detectActiveFromPath(pathname, searchParams);
    if (match) {
      setActiveTab(match.id);
      // Auto-expand the parent section for nested items
      if (match.category !== 'main') {
        setExpandedDropdowns({ [match.category]: true });
      }
    }
  }, [pathname, searchParams, detectActiveFromPath, setActiveTab, setExpandedDropdowns]);

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

  const handleToggleCollapse = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onToggleCollapse === 'function') {
      onToggleCollapse();
    }
  };

  const drawerTransition = theme.transitions.create('width', {
    easing: theme.transitions.easing.easeInOut,
    duration: theme.transitions.duration.standard,
  });

  const renderNavLink = (item, { indent = false } = {}) => {
    const isActive = activeTab === item.id;
    const href = getItemHref(item.id);
    const fn = getNavFn(item);

    return (
      <Box key={`${item.id}-${item.category}`} sx={{ px: 1.5, mb: 0.4 }}>
        <Link href={href} passHref style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <Box
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                handleNavigation(item.id);
              }
            }}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.25,
              pl: indent ? 1.25 : 1,
              pr: 1.25,
              py: 0.65,
              px: indent ? 1.5 : 1.25,
              ml: indent ? 0.75 : 0,
              mr: indent ? 0.5 : 0,
              borderRadius: 2,
              cursor: 'pointer',
              position: 'relative',
              color: isActive ? SIDEBAR.textOnActive : SIDEBAR.textActive,
              bgcolor: isActive ? SIDEBAR.bgActive : 'transparent',
              border: 'none',
              boxShadow: isActive ? '0 2px 8px rgba(26, 85, 227, 0.25)' : 'none',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: isActive ? SIDEBAR.bgActive : SIDEBAR.bgHover,
                color: isActive ? SIDEBAR.textOnActive : SIDEBAR.textActive,
              },
            }}
          >
            <Box
              sx={{
                width: indent ? 28 : 32,
                height: indent ? 28 : 32,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                bgcolor: isActive ? 'rgba(255,255,255,0.2)' : 'transparent',
                color: isActive ? SIDEBAR.textOnActive : fn.main,
                transition: 'all 0.2s ease',
              }}
            >
              <item.icon sx={{ fontSize: indent ? 17 : 18 }} />
            </Box>
            <Typography
              sx={{
                flex: 1,
                fontSize: indent ? '0.8125rem' : '0.8375rem',
                fontWeight: isActive ? 600 : 500,
                letterSpacing: 0.02,
                lineHeight: 1.4,
                userSelect: 'none',
                color: 'inherit',
              }}
            >
              {item.name}
            </Typography>
          </Box>
        </Link>
      </Box>
    );
  };

  const renderCollapsedIcon = (item) => {
    const href = getItemHref(item.id);
    const isActive = activeTab === item.id;
    const fn = getNavFn(item);
    return (
      <Tooltip
        key={item.id}
        title={item.name}
        placement="right"
        arrow
        slotProps={{
          tooltip: {
            sx: {
              bgcolor: '#0f172a',
              fontSize: '0.75rem',
              fontWeight: 600,
              px: 1.25,
              py: 0.75,
            },
          },
        }}
      >
        <Link href={href} passHref style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
          <ListItemButton
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey && e.button === 0) {
                handleNavigation(item.id);
              }
            }}
            sx={{
              borderRadius: 2,
              mb: 0.35,
              minHeight: 42,
              justifyContent: 'center',
              px: 1,
              bgcolor: isActive ? SIDEBAR.bgActive : 'transparent',
              color: isActive ? SIDEBAR.textOnActive : fn.main,
              border: 'none',
              boxShadow: isActive ? '0 2px 8px rgba(26, 85, 227, 0.25)' : 'none',
              transition: 'all 0.2s ease',
              '&:hover': { bgcolor: isActive ? SIDEBAR.bgActive : SIDEBAR.bgHover },
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

  const renderSectionLabel = (label) => {
    const sectionStyle = SIDEBAR_SECTION_LABELS[label] || SIDEBAR_SECTION_LABELS.Modules;
    return (
      <Typography
        sx={{
          px: 2,
          pt: 1.5,
          pb: 0.75,
          fontSize: '0.625rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: sectionStyle.color,
        }}
      >
        {label}
      </Typography>
    );
  };

  const renderSectionHeader = (title, { collapsible = false, expanded = true, onToggle, hasActive = false, itemCount = 0 } = {}) => {
    const meta = SECTION_META[title] || { fn: 'overview', icon: DashboardIcon };
    const fn = NAV_FN[meta.fn] || NAV_FN.overview;
    const Icon = meta.icon;
    const isOpen = collapsible ? expanded : true;
    const rowActive = hasActive || (collapsible && isOpen);

    return (
      <Box
        onClick={collapsible ? onToggle : undefined}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? isOpen : undefined}
        sx={{
          mx: 1,
          mb: 0.25,
          px: 1.25,
          py: 0.85,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: collapsible ? 'pointer' : 'default',
          userSelect: 'none',
          bgcolor: rowActive && collapsible ? SIDEBAR.bgHover : 'transparent',
          transition: 'background 0.2s ease',
          ...(collapsible && {
            '&:hover': { bgcolor: SIDEBAR.bgHover },
          }),
        }}
      >
        <Icon sx={{ fontSize: 18, color: rowActive ? fn.main : SIDEBAR.textMuted, flexShrink: 0 }} />

        <Typography
          sx={{
            flex: 1,
            fontSize: '0.8375rem',
            fontWeight: rowActive ? 600 : 500,
            color: fn.main,
            lineHeight: 1.3,
          }}
        >
          {title}
        </Typography>

        {collapsible && (
          isOpen
            ? <ExpandLess sx={{ fontSize: 18, color: SIDEBAR.textMuted }} />
            : <ChevronRightIcon sx={{ fontSize: 18, color: SIDEBAR.textMuted }} />
        )}
      </Box>
    );
  };

  const renderMenuSection = (category, title) => {
    const items = filteredItems.filter(item => item.category === category);
    if (items.length === 0) return null;
    const isExpanded = isCollapsed ? false : (isSearching ? true : expandedDropdowns[category]);
    const hasActiveChild = items.some(item => activeTab === item.id);
    const meta = SECTION_META[title] || { fn: 'overview' };
    const fn = NAV_FN[meta.fn] || NAV_FN.overview;

    if (isCollapsed) {
      return (
        <Box key={category} sx={{ mb: 0.25 }}>
          {items.map(renderCollapsedIcon)}
          <Divider sx={{ my: 0.75, mx: 1, borderColor: SIDEBAR.border }} />
        </Box>
      );
    }

    return (
      <Box key={category} sx={{ mb: 0.35 }}>
        {renderSectionHeader(title, {
          collapsible: true,
          expanded: isExpanded,
          onToggle: () => toggleDropdown(category),
          hasActive: hasActiveChild,
          itemCount: items.length,
        })}

        <Collapse in={isExpanded} timeout={250}>
          <Box sx={{ mx: 0.5, mb: 0.5, pl: 1.5, pr: 0.5 }}>
            {items.map((item) => renderNavLink(item, { indent: true }))}
          </Box>
        </Collapse>
      </Box>
    );
  };

  const mainItems = filteredItems.filter(item => item.category === 'main');
  const systemItems = filteredItems.filter(item => item.category === 'system');

  const drawerContent = (
    <Box sx={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: SIDEBAR.background,
    }}>
      {/* Toggle + brand */}
      <Box className="sidebar-header-shell" sx={{
        flexShrink: 0,
        borderBottom: `1px solid ${SIDEBAR.border}`,
      }}>
        <Box className="sidebar-header-accent" aria-hidden="true">
          <span className="sidebar-header-accent-shine" />
        </Box>

        {!isMobile && (
          <Box
            sx={{
              position: 'relative',
              zIndex: 1,
              display: 'flex',
              alignItems: isCollapsed ? 'center' : 'flex-start',
              justifyContent: 'space-between',
              gap: 0.75,
              px: isCollapsed ? 0.75 : 1.25,
              pt: isCollapsed ? 0.65 : 0.75,
              pb: isCollapsed ? 1 : 1.1,
              flexDirection: isCollapsed ? 'column' : 'row',
            }}
          >
            {!isCollapsed ? (
              <Box className="sidebar-brand" sx={{ flex: 1, minWidth: 0, pt: 0, pb: 0 }}>
                <Typography component="span" className="sidebar-brand-title" sx={{ display: 'block' }}>
                  {COMPANY.nameShort}
                </Typography>
                <Typography component="span" className="sidebar-brand-sub">
                  {COMPANY.nameSub}
                </Typography>
                <Box className="sidebar-brand-glow" />
              </Box>
            ) : (
              <Typography className="sidebar-brand-collapsed">
                II
              </Typography>
            )}

            <IconButton
              onClick={handleToggleCollapse}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              size="small"
              sx={{
                bgcolor: SIDEBAR.collapseBtn,
                color: '#ffffff',
                width: 30,
                height: 30,
                borderRadius: 1.5,
                zIndex: 20,
                flexShrink: 0,
                mt: isCollapsed ? 0 : 0.15,
                boxShadow: '0 2px 8px rgba(255, 8, 84, 0.35)',
                transition: 'transform 0.2s ease, background-color 0.2s ease',
                '&:hover': {
                  bgcolor: '#e0074a',
                  transform: 'scale(1.05)',
                },
                '&:active': {
                  transform: 'scale(0.96)',
                },
              }}
            >
              {isCollapsed ? <ChevronRightIcon sx={{ fontSize: 17 }} /> : <ChevronLeftIcon sx={{ fontSize: 17 }} />}
            </IconButton>
          </Box>
        )}

        {isMobile && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 1, pt: 0.5, pb: 0.25 }}>
            <IconButton
              onClick={() => setSidebarOpen(false)}
              sx={{ color: SIDEBAR.textMuted, p: 0.5 }}
            >
              <CloseIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Box>
        )}

        {!isCollapsed && !isMobile && (
          <Box className="sidebar-header-ornament" aria-hidden="true">
            <span />
            <span />
            <span />
          </Box>
        )}

        {isMobile && !isCollapsed && (
          <Box sx={{ px: 1.5, pb: 1.25, pt: 0.25 }}>
            <Box className="sidebar-brand">
              <Typography component="span" className="sidebar-brand-title" sx={{ display: 'block' }}>
                {COMPANY.nameShort}
              </Typography>
              <Typography component="span" className="sidebar-brand-sub">
                {COMPANY.nameSub}
              </Typography>
              <Box className="sidebar-brand-glow" />
            </Box>
          </Box>
        )}
      </Box>

      {/* Search — animated blue border */}
      {!isCollapsed && (
        <Box sx={{ px: 1.5, py: 1.25, borderBottom: `1px solid ${SIDEBAR.border}` }}>
          <div className="sidebar-search-wrap">
            <div className="sidebar-search-inner">
              <SearchIcon className="sidebar-search-icon" />
              <input
                type="text"
                className="sidebar-search-input"
                placeholder="Search menu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search sidebar menu"
              />
              {searchQuery && (
                <IconButton size="small" onClick={() => setSearchQuery('')} sx={{ p: 0.25, color: '#94a3b8' }}>
                  <CloseIcon sx={{ fontSize: 15 }} />
                </IconButton>
              )}
            </div>
          </div>
        </Box>
      )}

      {/* Navigation */}
      <Box
        ref={scrollContainerRef}
        sx={{
          flex: 1,
          overflow: 'auto',
          py: 0.5,
          px: isCollapsed ? 0.75 : 0,
          scrollBehavior: 'smooth',
          scrollbarWidth: 'thin',
          scrollbarColor: `${SIDEBAR.bgActive} rgba(26, 85, 227, 0.08)`,
          '&::-webkit-scrollbar': { width: 7 },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(26, 85, 227, 0.08)',
            borderRadius: 10,
            margin: '4px 0',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(26, 85, 227, 0.45)',
            borderRadius: 10,
            border: '1px solid rgba(255, 255, 255, 0.35)',
            '&:hover': { background: 'rgba(26, 85, 227, 0.65)' },
          },
        }}
      >
        <List disablePadding>
          {/* Overview */}
          {mainItems.length > 0 && (
            <Box sx={{ mb: 0.25 }}>
              {!isCollapsed && renderSectionLabel('Quick Access')}
              {!isCollapsed ? (
                <Box sx={{ mx: 0.5, mb: 0.5, px: 0.5 }}>
                  {mainItems.map((item) => renderNavLink(item))}
                </Box>
              ) : (
                mainItems.map((item) => renderCollapsedIcon(item))
              )}
              {isCollapsed && <Divider sx={{ my: 0.75, mx: 1, borderColor: SIDEBAR.border }} />}
            </Box>
          )}

          {!isCollapsed && renderSectionLabel('Modules')}

          {renderMenuSection('customer-management', 'Accounts')}
          {renderMenuSection('product-management', 'Products')}
          {renderMenuSection('financial', 'Finance')}
          {renderMenuSection('sales-operations', 'Sales')}
          {renderMenuSection('purchase-operations', 'Purchase')}
          {renderMenuSection('cargo-operations', 'Cargo')}
          {renderMenuSection('hr-management', 'HR Management')}
          {renderMenuSection('reports', 'Reports')}

          {/* System */}
          {systemItems.length > 0 && (
            <Box sx={{ mb: 1 }}>
              {!isCollapsed && renderSectionLabel('System')}
              {!isCollapsed ? (
                <Box sx={{ mx: 0.5, mb: 0.5, px: 0.5 }}>
                  {systemItems.map((item) => renderNavLink(item))}
                </Box>
              ) : (
                systemItems.map((item) => renderCollapsedIcon(item))
              )}
            </Box>
          )}

          {isSearching && filteredItems.length === 0 && (
            <Box sx={{ px: 2, py: 4, textAlign: 'center' }}>
              <Typography variant="body2" sx={{ color: SIDEBAR.textMuted }}>
                No results for &quot;{searchQuery}&quot;
              </Typography>
            </Box>
          )}
        </List>
      </Box>

      {/* Powered By — fixed footer */}
      <Box
        className="sidebar-powered-by"
        sx={{
          flexShrink: 0,
          borderTop: `1px solid ${SIDEBAR.border}`,
          bgcolor: SIDEBAR.bgElevated,
          px: isCollapsed ? 0.5 : 1.25,
          py: isCollapsed ? 1 : 1.15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: isCollapsed ? 'center' : 'flex-start',
        }}
      >
        {!isCollapsed ? (
          <Box sx={{ width: '100%' }}>
            <Typography
              component="span"
              sx={{
                display: 'block',
                fontSize: '0.5625rem',
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: SIDEBAR.textMuted,
                lineHeight: 1.2,
                mb: 0.25,
              }}
            >
              {POWERED_BY.label}
            </Typography>
            <Typography
              component="span"
              className="sidebar-powered-name"
              sx={{
                display: 'block',
                fontSize: '0.75rem',
                fontWeight: 800,
                letterSpacing: '0.05em',
                lineHeight: 1.25,
              }}
            >
              {POWERED_BY.name}
            </Typography>
          </Box>
        ) : (
          <Tooltip title={`${POWERED_BY.label} ${POWERED_BY.name}`} placement="right" arrow>
            <Box
              className="sidebar-powered-collapsed"
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.65rem',
                fontWeight: 800,
                letterSpacing: '0.02em',
                cursor: 'default',
              }}
            >
              {POWERED_BY.nameShort}
            </Box>
          </Tooltip>
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
        transition: drawerTransition,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: `1px solid ${SIDEBAR.border}`,
          background: SIDEBAR.background,
          overflowX: 'hidden',
          boxShadow: SIDEBAR.drawerShadow,
          transition: drawerTransition,
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
}
