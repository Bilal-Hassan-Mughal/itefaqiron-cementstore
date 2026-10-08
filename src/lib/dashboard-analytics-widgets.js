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
    name: 'Month-End — To Receive',
    description: 'Closing balance total to collect from parties at each month end',
  },
  {
    id: 'dashboard-monthly-debit',
    name: 'Month-End — To Pay',
    description: 'Closing balance total to pay to parties at each month end',
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
    id: 'dashboard-top-customers-sale',
    name: 'Top Customers by Sale',
    description: 'Top customers ranked by confirmed bill item sales (qty × rate, minus returns)',
  },
  {
    id: 'dashboard-top-products-sale',
    name: 'Top Products by Sale',
    description: 'Top products ranked by confirmed bill item sales (qty × rate, minus returns)',
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
