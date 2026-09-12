export const HQ_REPORT_PERIODS = [
  { id: 'month', label: 'This Month' },
  { id: 'last_month', label: 'Last Month' },
  { id: 'week', label: 'Last 7 Days' },
  { id: 'year', label: 'This Year' },
];

function toYmd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function resolveHqPeriodRange(periodId) {
  const today = new Date();
  const toStr = toYmd(today);
  let from = new Date(today);

  switch (periodId) {
    case 'last_month':
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return {
        from: toYmd(from),
        to: toYmd(new Date(today.getFullYear(), today.getMonth(), 0)),
      };
    case 'week':
      from.setDate(today.getDate() - 6);
      return { from: toYmd(from), to: toStr };
    case 'year':
      from = new Date(today.getFullYear(), 0, 1);
      return { from: toYmd(from), to: toStr };
    case 'month':
    default:
      from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toYmd(from), to: toStr };
  }
}

export const HQ_REPORTS = [
  {
    id: 'sales',
    title: 'Sale Report',
    short: 'Sales',
    description: 'Each invoice item total, then all invoices are added and shown by day',
    href: '/dashboard/hq/reports/sales',
    accent: '#4338ca',
    accentSoft: '#eef2ff',
    unit: 'PKR',
    filters: ['branch', 'period'],
    formula: 'On each invoice: item 1 qty × its rate, then item 2 qty × its rate, add them · Then the next invoice the same way · Grand total = invoice 1 + invoice 2 + … · Labour and delivery are not items',
  },
  {
    id: 'purchases',
    title: 'Purchase Report',
    short: 'Purchases',
    description: 'Two separate graphs — each purchase invoice on its own: purchase rate, then cost rate',
    href: '/dashboard/hq/reports/purchases',
    accent: '#0f766e',
    accentSoft: '#ecfdf5',
    unit: 'PKR',
    filters: ['branch', 'period'],
    formula: 'Purchase graph = each item qty × that item purchase rate (crate) · Do not use sale rate (unit_rate / prate) · Then the next invoice · Cost graph = same qty × this invoice cost rate: purchase rate + inner labour/delivery + inner city charges, plus outer cargo only if “include cargo in cost” was saved · Fare and unloading stay out of both totals · Sale value on the invoice is qty × sale rate and is shown separately',
  },
  {
    id: 'payments',
    title: 'Payment Report',
    short: 'Payments',
    description: 'From general ledger receipts and payments on accounts',
    href: '/dashboard/hq/reports/payments',
    accent: '#0f766e',
    accentSoft: '#ecfdf5',
    unit: 'PKR',
    filters: ['branch', 'period', 'payment_type'],
    formula: 'From general ledger · Received = credit on party account · Paid = debit on party account',
  },
  {
    id: 'profit',
    title: 'Profit Report',
    short: 'Profit',
    description: 'Each invoice item sales minus item cost, then expenses',
    href: '/dashboard/hq/reports/profit',
    accent: '#047857',
    accentSoft: '#ecfdf5',
    unit: 'PKR',
    filters: ['branch', 'period'],
    formula: 'Each sale invoice: item amount − (qty × purchase cost), then next bill · Net profit = those invoice profits − ledger expenses · Labour and delivery are not sales',
  },
  {
    id: 'customers-balance',
    title: 'Top Customers — Pending Balance',
    short: 'Customer Pending',
    description: 'Customers who still owe us on their current ledger account',
    href: '/dashboard/hq/reports/customers-balance',
    accent: '#b45309',
    accentSoft: '#fffbeb',
    unit: 'PKR',
    filters: ['branch', 'limit'],
    formula: 'From general ledger · Pending = current customer account balance greater than zero · cash, bank and supplier accounts excluded',
  },
  {
    id: 'suppliers-balance',
    title: 'Top Suppliers — To Pay',
    short: 'Supplier Payable',
    description: 'Suppliers we still have to pay on their current ledger account',
    href: '/dashboard/hq/reports/suppliers-balance',
    accent: '#9a3412',
    accentSoft: '#fff7ed',
    unit: 'PKR',
    filters: ['branch', 'limit'],
    formula: 'From general ledger · To pay = current supplier account credit/negative balance · cash and bank accounts excluded',
  },
  {
    id: 'customers-activity',
    title: 'Top Customers — Purchased vs Received',
    short: 'Customer Activity',
    description: 'How much customers purchased from us and how much we received',
    href: '/dashboard/hq/reports/customers-activity',
    accent: '#4338ca',
    accentSoft: '#eef2ff',
    unit: 'PKR',
    filters: ['branch', 'period', 'limit'],
    grouped: true,
    formula: 'Purchased = each customer invoice item qty × rate, then the next bill · Labour and delivery excluded · Received = ledger payment credit · Pending = purchased − received',
  },
  {
    id: 'suppliers-activity',
    title: 'Top Suppliers — Purchased vs Paid',
    short: 'Supplier Activity',
    description: 'How much we purchased from suppliers and how much we paid them',
    href: '/dashboard/hq/reports/suppliers-activity',
    accent: '#0f766e',
    accentSoft: '#ecfdf5',
    unit: 'PKR',
    filters: ['branch', 'period', 'limit'],
    grouped: true,
    formula: 'Purchased = each supplier invoice item qty × purchase rate (crate), then the next bill · Fare, labour and cargo excluded from purchase rate · Paid = ledger payment debit · Still to pay = purchased − paid',
  },
  {
    id: 'expenses',
    title: 'Expense Report — Booked vs Settled',
    short: 'Expenses',
    description: 'Ledger expenses and how much has been settled',
    href: '/dashboard/hq/reports/expenses',
    accent: '#be123c',
    accentSoft: '#fff1f2',
    unit: 'PKR',
    filters: ['branch', 'period'],
    grouped: true,
    formula: 'From general ledger · Expense = Expense ledger amount · Settled = paid expense ledger entries · Pending = unpaid expense records not yet settled in ledger',
  },
];

export function getHqReport(id) {
  if (id === 'customers-supplies') {
    return HQ_REPORTS.find((r) => r.id === 'customers-activity') || null;
  }
  return HQ_REPORTS.find((r) => r.id === id) || null;
}
