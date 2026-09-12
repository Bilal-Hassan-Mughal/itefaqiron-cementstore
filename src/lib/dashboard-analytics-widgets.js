/**
 * Widgets inside "Monthly Analytics & Financial Performance" on dashboard home.
 * Each widget is assigned individually in User Management → Monthly Analytics.
 */

/** @type {{ id: string, name: string, description: string }[]} */
export const DASHBOARD_ANALYTICS_WIDGETS = [
  {
    id: 'dashboard-kpi',
    name: 'KPI Summary Cards',
    description: 'Total Sales, Orders, Active Customers, Total Products',
  },
  {
    id: 'dashboard-monthly-credit',
    name: 'Monthly Credit',
    description: 'Monthly credit / receivings bar chart',
  },
  {
    id: 'dashboard-monthly-debit',
    name: 'Monthly Debit',
    description: 'Monthly debit / payments bar chart',
  },
  {
    id: 'dashboard-monthly-profit',
    name: 'Monthly Profit',
    description: 'Monthly net profit bar chart',
  },
  {
    id: 'dashboard-monthly-sales',
    name: 'Monthly Sales',
    description: 'Monthly sales volume bar chart',
  },
  {
    id: 'dashboard-sales-overview',
    name: 'Sales Overview (7 days)',
    description: 'Bills vs Orders — last 7 days',
  },
  {
    id: 'dashboard-transactions-overview',
    name: 'Transactions Overview (7 days)',
    description: 'All transactions vs orders — last 7 days',
  },
  {
    id: 'dashboard-customer-balance',
    name: 'Top Customers by Balance',
    description: 'Customer balance bar chart with category filter',
  },
  {
    id: 'dashboard-supplier-balance',
    name: 'Top Suppliers by Balance',
    description: 'Supplier balance bar chart with category filter',
  },
  {
    id: 'dashboard-recent-activity',
    name: 'Recent Activity',
    description: 'Latest sales and purchases on dashboard',
  },
];

export const DASHBOARD_ANALYTICS_WIDGET_IDS = DASHBOARD_ANALYTICS_WIDGETS.map((w) => w.id);

export const DASHBOARD_ANALYTICS_WIDGET_ID_SET = new Set(DASHBOARD_ANALYTICS_WIDGET_IDS);

/** @deprecated use DASHBOARD_ANALYTICS_WIDGET_IDS — kept for imports */
export const DASHBOARD_ANALYTICS_CHILD_WIDGET_IDS = DASHBOARD_ANALYTICS_WIDGET_IDS;

/** Legacy master id — stripped from permissions; no longer grants access */
export const DASHBOARD_ANALYTICS_LEGACY_MASTER_ID = 'dashboard-analytics';
