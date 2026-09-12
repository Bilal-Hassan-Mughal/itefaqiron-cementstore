import { centralPrisma } from '@/lib/branch-server';

export function parseDateRange(fromDate, toDate) {
  if (!fromDate && !toDate) return null;
  const tz = '+05:00';
  const range = {};
  if (fromDate) range.gte = new Date(`${fromDate}T00:00:00.000${tz}`);
  if (toDate) range.lte = new Date(`${toDate}T23:59:59.999${tz}`);
  return range;
}

export function num(v) {
  if (v == null) return 0;
  return typeof v === 'object' && v.toNumber ? v.toNumber() : Number(v) || 0;
}

function systemCategoryWhere() {
  return {
    OR: [
      { cus_cat_title: { contains: 'cash' } },
      { cus_cat_title: { contains: 'Cash' } },
      { cus_cat_title: { contains: 'bank' } },
      { cus_cat_title: { contains: 'Bank' } },
    ],
  };
}

export async function loadBranchOptions(branchId) {
  return centralPrisma.branch.findMany({
    where: branchId ? { branch_id: branchId } : undefined,
    orderBy: { branch_id: 'asc' },
    select: {
      branch_id: true,
      branch_code: true,
      branch_name: true,
      status: true,
    },
  });
}

async function skipCategoryIds() {
  const rows = await centralPrisma.customerCategory.findMany({
    where: systemCategoryWhere(),
    select: { cus_cat_id: true },
  });
  return rows.map((c) => c.cus_cat_id);
}

function branchLabel(branch) {
  const name = (branch?.branch_name || '').trim();
  if (name) return name;
  return branch?.branch_code || `Branch ${branch?.branch_id || ''}`.trim();
}

function formatDayLabel(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatMonthLabel(iso) {
  const d = new Date(`${iso}-01T00:00:00`);
  return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
}

function timeGrain(fromDate, toDate) {
  if (!fromDate || !toDate) return 'day';
  const days = (new Date(toDate) - new Date(fromDate)) / 86400000;
  return days > 45 ? 'month' : 'day';
}

function addDaysYmd(ymd, days) {
  const d = new Date(`${ymd}T00:00:00+05:00`);
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function lastDayOfMonth(ymd) {
  const d = new Date(`${ymd}T00:00:00+05:00`);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  const y = last.getFullYear();
  const m = String(last.getMonth() + 1).padStart(2, '0');
  const day = String(last.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Year → every month. Month → every day. 7 days → those 7 days through today. */
function chartSpan(fromDate, toDate, grain) {
  if (!fromDate || !toDate) return { fromDate, toDate, grain };
  if (grain === 'month') {
    const y = fromDate.slice(0, 4);
    return { fromDate: `${y}-01-01`, toDate: `${y}-12-31`, grain };
  }
  const from = new Date(`${fromDate}T00:00:00+05:00`);
  const to = new Date(`${toDate}T00:00:00+05:00`);
  const spanDays = Math.round((to - from) / 86400000) + 1;
  if (from.getDate() === 1 && spanDays >= 8) {
    return { fromDate, toDate: lastDayOfMonth(fromDate), grain };
  }
  return { fromDate, toDate, grain };
}

function periodKeys(fromDate, toDate, grain) {
  const keys = [];
  if (!fromDate || !toDate) return keys;
  if (grain === 'month') {
    const [fy, fm] = fromDate.split('-').map(Number);
    const [ty, tm] = toDate.split('-').map(Number);
    let y = fy;
    let m = fm;
    while (y < ty || (y === ty && m <= tm)) {
      keys.push(`${y}-${String(m).padStart(2, '0')}`);
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    return keys;
  }
  let cursor = fromDate;
  while (cursor <= toDate) {
    keys.push(cursor);
    cursor = addDaysYmd(cursor, 1);
  }
  return keys;
}

function fillTimeChart(fromDate, toDate, grain, valueMap) {
  const span = chartSpan(fromDate, toDate, grain);
  return periodKeys(span.fromDate, span.toDate, grain).map((key) => {
    const hit = valueMap.get(key);
    return {
      label: grain === 'month' ? formatMonthLabel(key) : formatDayLabel(key),
      value: hit?.value || 0,
      qty: Math.round((hit?.qty || 0) * 100) / 100,
      count: hit?.count || 0,
    };
  });
}

function bucketKey(date, grain) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return grain === 'month' ? `${y}-${m}` : `${y}-${m}-${day}`;
}

function bucketRows(rows, grain, fromDate, toDate) {
  const map = new Map();
  rows.forEach((row) => {
    const key = bucketKey(row.date, grain);
    const prev = map.get(key) || { value: 0, count: 0, qty: 0 };
    prev.value += num(row.value);
    prev.count += row.count || 1;
    prev.qty += num(row.qty);
    map.set(key, prev);
  });
  if (fromDate && toDate) {
    return fillTimeChart(fromDate, toDate, grain, map);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, v]) => ({
      label: grain === 'month' ? formatMonthLabel(key) : formatDayLabel(key),
      value: v.value,
      count: v.count,
      qty: v.qty,
    }));
}

function mapByBranch(branches, getValue) {
  return branches
    .map((b) => ({
      label: branchLabel(b),
      value: num(getValue(b.branch_id)),
      branch_id: b.branch_id,
      branch_code: b.branch_code,
      branch_name: b.branch_name,
    }))
    .filter((row) => row.value !== 0)
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
}

function ledgerBaseWhere(branchId, dateRange) {
  const where = {};
  if (branchId) where.branch_id = branchId;
  if (dateRange) where.created_at = dateRange;
  return where;
}

function partyCustomerFilter(skipIds) {
  if (!skipIds.length) return {};
  return { customer: { cus_category: { notIn: skipIds } } };
}

const SUPPLIER_NAME_OR = {
  OR: [
    { customer_category: { cus_cat_title: { contains: 'supplier' } } },
    { customer_category: { cus_cat_title: { contains: 'Supplier' } } },
    { customer_type: { cus_type_title: { contains: 'supplier' } } },
    { customer_type: { cus_type_title: { contains: 'Supplier' } } },
  ],
};

function customerAccountFilter(skipIds) {
  return {
    customer: {
      ...(skipIds.length ? { cus_category: { notIn: skipIds } } : {}),
      NOT: SUPPLIER_NAME_OR,
    },
  };
}

function supplierAccountFilter(skipIds) {
  return {
    customer: {
      ...(skipIds.length ? { cus_category: { notIn: skipIds } } : {}),
      ...SUPPLIER_NAME_OR,
    },
  };
}

function customerRecordFilter(skipIds) {
  return {
    ...(skipIds.length ? { cus_category: { notIn: skipIds } } : {}),
    NOT: SUPPLIER_NAME_OR,
  };
}

function supplierRecordFilter(skipIds) {
  return {
    ...(skipIds.length ? { cus_category: { notIn: skipIds } } : {}),
    ...SUPPLIER_NAME_OR,
  };
}

const RECEIVE_LEDGER_WHERE = {
  credit_amount: { gt: 0 },
  OR: [
    { ledger_type: { in: ['Receiving', 'Receipt'] } },
    { details: { contains: 'Payment Received' } },
  ],
};

const PAY_LEDGER_WHERE = {
  debit_amount: { gt: 0 },
  OR: [
    { ledger_type: { in: ['Payment', 'Pay'] } },
    { details: { contains: 'Payment Paid' } },
  ],
};

const EXPENSE_LEDGER_WHERE = {
  ledger_type: 'Expense',
};

const PURCHASE_LEDGER_WHERE = {
  credit_amount: { gt: 0 },
  OR: [
    { trnx_type: 'PURCHASE' },
    { details: { contains: 'Purchase Invoice' } },
  ],
};

const ledgerInclude = {
  customer: { select: { cus_name: true, cus_id: true } },
  branch: { select: { branch_code: true, branch_name: true } },
};

function isExtraChargeItem(name) {
  return /labour|labor|deliver|shipping|freight|transport|cargo|fare/i.test(String(name || ''));
}

function invoiceExtras(sale) {
  return num(sale.shipping_amount) + num(sale.labour_charges);
}

function itemQtyTimesRate(detail) {
  const qty = num(detail.qnty);
  const rate = num(detail.unit_rate);
  if (qty && rate) return Math.round(qty * rate * 100) / 100;
  return Math.round(num(detail.total_amount || detail.net_total) * 100) / 100;
}

/** Invoice 1: item1 qty×rate + item2 qty×rate + … then invoice 2 the same way. */
function saleInvoiceTotals(sale) {
  let items = 0;
  let qty = 0;
  let cost = 0;
  (sale.sale_details || []).forEach((d) => {
    if (isExtraChargeItem(d.product?.pro_title)) return;
    const line = itemQtyTimesRate(d);
    items += line;
    qty += num(d.qnty);
    cost += num(d.qnty) * num(d.product?.pro_cost_price);
  });
  return {
    items: Math.round(items * 100) / 100,
    qty: Math.round(qty * 100) / 100,
    cost: Math.round(cost * 100) / 100,
    extras: invoiceExtras(sale),
  };
}

function roundMoney(v) {
  return Math.round(Number(v) * 100) / 100;
}

/** Invoice purchase rate. crate only — prate and unit_rate are the sale rate. */
function purchaseItemRate(detail) {
  const crate = num(detail.crate);
  if (crate) return crate;
  const qty = num(detail.qnty);
  const line = num(detail.total_amount);
  if (qty && line) return line / qty;
  return 0;
}

/**
 * Same split as purchases/page.js recomputeDistributedCosts.
 * include_labour / include_incity are UI-only and not stored — if those amounts
 * exist on the invoice they were added to the item cost rate.
 * Outer cargo enters cost only when include_cargo_in_costprice is true.
 * Fare and unloading never enter purchase rate or cost rate.
 */
function purchaseCostPartsPerUnit(purchase, qty) {
  if (qty <= 0) return { labour: 0, incity: 0, cargo: 0 };
  const labour = num(purchase.labour_amount) + num(purchase.transport_amount);
  const incity = num(purchase.incity_own_labour) + num(purchase.incity_own_delivery);
  const cargo = purchase.include_cargo_in_costprice
    ? num(purchase.out_labour_amount) + num(purchase.out_delivery_amount)
    : 0;
  return {
    labour: labour / qty,
    incity: incity / qty,
    cargo: cargo / qty,
  };
}

function purchaseLineCostRate(detail, parts) {
  return roundMoney(purchaseItemRate(detail) + parts.labour + parts.incity + parts.cargo);
}

function purchaseHeaderExtras(purchase) {
  return num(purchase.fare_amount) + num(purchase.unloading_amount)
    + num(purchase.labour_amount) + num(purchase.transport_amount)
    + num(purchase.out_labour_amount) + num(purchase.out_delivery_amount)
    + num(purchase.incity_own_labour) + num(purchase.incity_own_delivery);
}

/** Invoice 1: each item qty × purchase rate, then next item, then next bill. */
function purchaseInvoiceTotals(purchase) {
  const lines = (purchase.purchase_details || []).filter((d) => !isExtraChargeItem(d.product?.pro_title));
  const qty = lines.reduce((s, d) => s + num(d.qnty), 0);
  const parts = purchaseCostPartsPerUnit(purchase, qty);
  let purchaseAmt = 0;
  let costAmt = 0;
  let saleAmt = 0;
  lines.forEach((d) => {
    const q = num(d.qnty);
    const purchaseRate = purchaseItemRate(d);
    const saleRate = num(d.unit_rate);
    purchaseAmt += q && purchaseRate ? roundMoney(q * purchaseRate) : roundMoney(num(d.total_amount));
    costAmt += roundMoney(q * purchaseLineCostRate(d, parts));
    saleAmt += q && saleRate ? roundMoney(q * saleRate) : 0;
  });
  return {
    items: roundMoney(purchaseAmt),
    purchase: roundMoney(purchaseAmt),
    cost: roundMoney(costAmt),
    sale: roundMoney(saleAmt),
    qty: roundMoney(qty),
    extras: purchaseHeaderExtras(purchase),
  };
}

const saleInvoiceInclude = {
  customer: { select: { cus_id: true, cus_name: true } },
  branch: { select: { branch_code: true, branch_name: true } },
  sale_details: {
    select: {
      qnty: true,
      unit_rate: true,
      total_amount: true,
      net_total: true,
      product: { select: { pro_title: true, pro_cost_price: true } },
    },
  },
};

async function loadSaleInvoices({ branchId, dateRange, take = 4000 }) {
  return centralPrisma.sale.findMany({
    where: {
      bill_type: 'BILL',
      ...(branchId ? { branch_id: branchId } : {}),
      ...(dateRange ? { created_at: dateRange } : {}),
    },
    include: saleInvoiceInclude,
    orderBy: [{ created_at: 'asc' }, { sale_id: 'asc' }],
    take,
  });
}

async function loadPurchaseInvoices({ branchId, dateRange, take = 4000 }) {
  return centralPrisma.purchase.findMany({
    where: {
      ...(branchId ? { branch_id: branchId } : {}),
      ...(dateRange ? { created_at: dateRange } : {}),
    },
    include: {
      customer: { select: { cus_id: true, cus_name: true } },
      branch: { select: { branch_code: true, branch_name: true } },
      purchase_details: {
        select: {
          qnty: true,
          unit_rate: true,
          crate: true,
          total_amount: true,
          product: { select: { pro_title: true, pro_cost_price: true, pro_crate: true, pro_sale_price: true } },
        },
      },
    },
    orderBy: [{ created_at: 'asc' }, { pur_id: 'asc' }],
    take,
  });
}

function invoiceChartLimit(limit, fallback = 20) {
  return Math.min(Math.max(parseInt(limit, 10) || fallback, 5), 50);
}

function expenseAmount(entry) {
  return num(entry.payments) || num(entry.credit_amount) || num(entry.debit_amount);
}

async function loadLedger(where, { take = 2500, order = 'desc' } = {}) {
  return centralPrisma.ledger.findMany({
    where,
    include: ledgerInclude,
    orderBy: { created_at: order },
    take,
  });
}

export async function getSalesAnalytics({ branchId, dateRange, fromDate, toDate, detailed = false }) {
  const invoices = await loadSaleInvoices({ branchId, dateRange });
  const productMap = new Map();
  let running = 0;
  let extras = 0;
  let itemQty = 0;

  const rows = invoices.map((sale) => {
    const t = saleInvoiceTotals(sale);
    running += t.items;
    extras += t.extras;
    itemQty += t.qty;
    (sale.sale_details || []).forEach((d) => {
      if (isExtraChargeItem(d.product?.pro_title)) return;
      const name = d.product?.pro_title || 'Item';
      const prev = productMap.get(name) || { amount: 0, qty: 0 };
      prev.amount += num(d.net_total || d.total_amount);
      prev.qty += num(d.qnty);
      productMap.set(name, prev);
    });
    const billNo = sale.bill_number || sale.sale_id;
    return {
      id: sale.sale_id,
      bill_no: String(billNo),
      branch_code: sale.branch?.branch_code || '—',
      branch_name: sale.branch?.branch_name || '—',
      date: sale.created_at,
      customer: sale.customer?.cus_name || '—',
      bill_type: 'Invoice',
      amount: t.items,
      items: t.items,
      qty: t.qty,
      extras: t.extras,
      running,
      payment: num(sale.payment),
    };
  });

  const total = running;
  const grain = timeGrain(fromDate, toDate);
  const dayMap = new Map();
  rows.forEach((row) => {
    const key = bucketKey(row.date, grain);
    const prev = dayMap.get(key) || { value: 0, qty: 0, count: 0 };
    prev.value += row.amount;
    prev.qty += row.qty;
    prev.count += 1;
    dayMap.set(key, prev);
  });
  const chart = fillTimeChart(fromDate, toDate, grain, dayMap);

  const products = [...productMap.entries()]
    .map(([label, v]) => ({ label, value: v.amount, qty: Math.round(v.qty * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 12);

  return {
    summary: {
      total,
      items: total,
      extras,
      qty: Math.round(itemQty * 100) / 100,
      count: rows.length,
      label: 'Invoice item sales',
    },
    products,
    chart,
    rows: detailed ? rows : [],
  };
}

export async function getPurchaseAnalytics({ branchId, dateRange, fromDate, toDate, detailed = false }) {
  const invoices = await loadPurchaseInvoices({ branchId, dateRange });
  let runningPurchase = 0;
  let runningCost = 0;
  let runningSale = 0;
  let extras = 0;
  let itemQty = 0;

  const rows = invoices.map((purchase) => {
    const t = purchaseInvoiceTotals(purchase);
    runningPurchase = roundMoney(runningPurchase + t.purchase);
    runningCost = roundMoney(runningCost + t.cost);
    runningSale = roundMoney(runningSale + t.sale);
    extras = roundMoney(extras + t.extras);
    itemQty = roundMoney(itemQty + t.qty);
    return {
      id: purchase.pur_id,
      bill_no: purchase.invoice_number || String(purchase.pur_id),
      branch_code: purchase.branch?.branch_code || '—',
      branch_name: purchase.branch?.branch_name || '—',
      date: purchase.created_at,
      customer: purchase.customer?.cus_name || '—',
      amount: t.purchase,
      purchase: t.purchase,
      cost: t.cost,
      sale: t.sale,
      qty: t.qty,
      extras: t.extras,
      running: runningPurchase,
      running_cost: runningCost,
    };
  });

  const grain = timeGrain(fromDate, toDate);
  const purchaseMap = new Map();
  const costMap = new Map();
  rows.forEach((row) => {
    const key = bucketKey(row.date, grain);
    const p = purchaseMap.get(key) || { value: 0, qty: 0, count: 0 };
    p.value += row.purchase;
    p.qty += row.qty;
    p.count += 1;
    purchaseMap.set(key, p);
    const c = costMap.get(key) || { value: 0, qty: 0, count: 0 };
    c.value += row.cost;
    c.qty += row.qty;
    c.count += 1;
    costMap.set(key, c);
  });

  const purchaseTime = fillTimeChart(fromDate, toDate, grain, purchaseMap);
  const costTime = fillTimeChart(fromDate, toDate, grain, costMap);
  const chart = purchaseTime.map((d, i) => ({
    ...d,
    purchase: d.value,
    cost: costTime[i]?.value || 0,
  }));
  const invoiceRows = rows.map((row) => ({
    label: `#${row.bill_no}`,
    qty: row.qty,
    count: 1,
    purchase: row.purchase,
    cost: row.cost,
  }));

  return {
    summary: {
      total: Math.round(runningPurchase * 100) / 100,
      purchase: Math.round(runningPurchase * 100) / 100,
      cost: Math.round(runningCost * 100) / 100,
      sale: Math.round(runningSale * 100) / 100,
      extras,
      qty: Math.round(itemQty * 100) / 100,
      count: rows.length,
      label: 'Purchase rate total',
    },
    chart,
    charts: [
      {
        id: 'purchase',
        title: 'Purchase Rate',
        subtitle: 'Each invoice separately — qty × purchase rate (crate)',
        color: '#0f766e',
        total: Math.round(runningPurchase * 100) / 100,
        data: invoiceRows.map((d) => ({ ...d, value: d.purchase })),
      },
      {
        id: 'cost',
        title: 'Cost Rate',
        subtitle: 'Each invoice separately — qty × this invoice cost rate',
        color: '#c2410c',
        total: Math.round(runningCost * 100) / 100,
        data: invoiceRows.map((d) => ({ ...d, value: d.cost })),
      },
    ],
    rows: detailed ? rows : [],
  };
}

export async function getPaymentAnalytics({
  branchId, dateRange, fromDate, toDate, paymentType = 'ALL', detailed = false,
}) {
  const skipIds = await skipCategoryIds();
  const typeWhere =
    paymentType === 'PAY' ? PAY_LEDGER_WHERE
      : paymentType === 'RECEIVE' ? RECEIVE_LEDGER_WHERE
        : { OR: [RECEIVE_LEDGER_WHERE, PAY_LEDGER_WHERE] };

  const where = {
    ...ledgerBaseWhere(branchId, dateRange),
    ...partyCustomerFilter(skipIds),
    ...typeWhere,
  };

  const [branches, entries] = await Promise.all([
    loadBranchOptions(branchId),
    loadLedger(where, { take: detailed ? 400 : 2000 }),
  ]);

  const received = entries
    .filter((e) => num(e.credit_amount) > 0)
    .reduce((s, e) => s + num(e.credit_amount), 0);
  const paid = entries
    .filter((e) => num(e.debit_amount) > 0 && num(e.credit_amount) <= 0)
    .reduce((s, e) => s + num(e.debit_amount), 0);

  const byBranch = new Map();
  entries.forEach((e) => {
    const amt = num(e.credit_amount) > 0 ? num(e.credit_amount) : num(e.debit_amount);
    byBranch.set(e.branch_id, num(byBranch.get(e.branch_id)) + amt);
  });

  const chart = branchId
    ? bucketRows(
        entries.map((e) => ({
          date: e.created_at,
          value: num(e.credit_amount) > 0 ? num(e.credit_amount) : num(e.debit_amount),
        })),
        timeGrain(fromDate, toDate),
        fromDate,
        toDate
      )
    : mapByBranch(branches, (id) => num(byBranch.get(id)));

  return {
    summary: {
      total: received + paid,
      received,
      paid,
      count: entries.length,
      label: 'Ledger Payments',
    },
    chart,
    rows: detailed
      ? entries.map((e) => ({
          id: e.l_id,
          branch_code: e.branch?.branch_code || '—',
          branch_name: e.branch?.branch_name || '—',
          date: e.created_at,
          account: e.customer?.cus_name || '—',
          payment_type: num(e.credit_amount) > 0 ? 'RECEIVE' : 'PAY',
          amount: num(e.credit_amount) > 0 ? num(e.credit_amount) : num(e.debit_amount),
          description: e.details || '—',
        }))
      : [],
  };
}

export async function getProfitAnalytics({ branchId, dateRange, fromDate, toDate, detailed = false }) {
  const expWhere = {
    ...ledgerBaseWhere(branchId, dateRange),
    ...EXPENSE_LEDGER_WHERE,
  };

  const [invoices, expEntries] = await Promise.all([
    loadSaleInvoices({ branchId, dateRange }),
    loadLedger(expWhere, { take: 2000 }),
  ]);

  let totalSales = 0;
  let totalCost = 0;
  const rows = invoices.map((sale) => {
    const t = saleInvoiceTotals(sale);
    totalSales += t.items;
    totalCost += t.cost;
    return {
      id: sale.sale_id,
      bill_no: String(sale.bill_number || sale.sale_id),
      branch_code: sale.branch?.branch_code || '—',
      branch_name: sale.branch?.branch_name || '—',
      date: sale.created_at,
      customer: sale.customer?.cus_name || '—',
      sales: t.items,
      cost: t.cost,
      profit: t.items - t.cost,
    };
  });

  const totalExpenses = expEntries.reduce((s, e) => s + expenseAmount(e), 0);
  const totalGross = totalSales - totalCost;
  const totalNet = totalGross - totalExpenses;

  const chart = bucketRows(
    rows.map((r) => ({ date: r.date, value: r.profit })),
    timeGrain(fromDate, toDate),
    fromDate,
    toDate
  );

  return {
    summary: {
      total: totalNet,
      sales: totalSales,
      cost: totalCost,
      gross: totalGross,
      expenses: totalExpenses,
      count: rows.length,
      label: 'Net Profit',
    },
    chart,
    rows: detailed ? rows : [],
  };
}

function expenseTitle(details) {
  const text = String(details || '');
  const match = text.match(/Payment for\s+([^:]+)/i);
  if (match?.[1]) return match[1].trim();
  if (text) return text.length > 36 ? `${text.slice(0, 35)}…` : text;
  return 'Expense';
}

async function hydrateAccounts(ids) {
  if (!ids.length) return new Map();
  const rows = await centralPrisma.customer.findMany({
    where: { cus_id: { in: ids } },
    include: {
      branch: { select: { branch_code: true, branch_name: true } },
      customer_category: { select: { cus_cat_title: true } },
    },
  });
  return new Map(rows.map((c) => [c.cus_id, c]));
}

export async function getExpenseAnalytics({ branchId, dateRange, fromDate, toDate, detailed = false }) {
  const where = {
    ...ledgerBaseWhere(branchId, dateRange),
    ...EXPENSE_LEDGER_WHERE,
  };
  const unpaidWhere = {
    is_paid: false,
    ...(branchId ? { branch_id: branchId } : {}),
    ...(dateRange ? { created_at: dateRange } : {}),
  };

  const [branches, entries, unpaid] = await Promise.all([
    loadBranchOptions(branchId),
    loadLedger(where, { take: 2500 }),
    centralPrisma.expense.findMany({
      where: unpaidWhere,
      include: {
        branch: { select: { branch_code: true, branch_name: true } },
        expense_title: { select: { title: true } },
      },
      take: 500,
    }),
  ]);

  const settledByKey = new Map();
  entries.forEach((e) => {
    const title = expenseTitle(e.details);
    const key = branchId ? title : `${title} - ${e.branch?.branch_name || branchLabel({ branch_id: e.branch_id })}`;
    const prev = settledByKey.get(key) || { settled: 0, expense: 0 };
    const amt = expenseAmount(e);
    prev.settled += amt;
    prev.expense += amt;
    settledByKey.set(key, prev);
  });
  unpaid.forEach((e) => {
    const title = e.expense_title?.title || e.exp_title || 'Unpaid expense';
    const key = branchId ? title : `${title} - ${e.branch?.branch_name || `Branch ${e.branch_id}`}`;
    const prev = settledByKey.get(key) || { settled: 0, expense: 0 };
    prev.expense += num(e.exp_amount);
    settledByKey.set(key, prev);
  });

  const chart = [...settledByKey.entries()]
    .map(([label, v]) => ({
      label,
      value: v.expense,
      purchased: v.expense,
      received: v.settled,
      expense: v.expense,
      settled: v.settled,
      pending: Math.max(v.expense - v.settled, 0),
    }))
    .sort((a, b) => b.expense - a.expense);

  const settled = entries.reduce((s, e) => s + expenseAmount(e), 0);
  const pending = unpaid.reduce((s, e) => s + num(e.exp_amount), 0);

  return {
    summary: {
      total: settled + pending,
      settled,
      pending,
      count: entries.length + unpaid.length,
      label: 'Expenses',
    },
    series: [
      { key: 'expense', label: 'Expense', color: '#be123c' },
      { key: 'settled', label: 'Settled', color: '#047857' },
    ],
    chart,
    rows: detailed
      ? [
          ...entries.map((e) => ({
            id: `L-${e.l_id}`,
            branch_code: e.branch?.branch_code || '—',
            branch_name: e.branch?.branch_name || '—',
            date: e.created_at,
            title: expenseTitle(e.details),
            detail: e.details || '—',
            amount: expenseAmount(e),
            settled: expenseAmount(e),
            paid: true,
          })),
          ...unpaid.map((e) => ({
            id: `U-${e.exp_id}`,
            branch_code: e.branch?.branch_code || '—',
            branch_name: e.branch?.branch_name || '—',
            date: e.created_at,
            title: e.expense_title?.title || e.exp_title || 'Expense',
            detail: e.exp_detail || 'Unpaid',
            amount: num(e.exp_amount),
            settled: 0,
            paid: false,
          })),
        ]
      : [],
  };
}

export async function getTopCustomersByBalance({ branchId, limit = 12, detailed = false }) {
  const skipIds = await skipCategoryIds();
  const take = Math.min(Math.max(parseInt(limit, 10) || 12, 5), 50);
  const where = {
    ...(branchId ? { branch_id: branchId } : {}),
    ...customerRecordFilter(skipIds),
    cus_balance: { gt: 0 },
  };

  const customers = await centralPrisma.customer.findMany({
    where,
    include: {
      branch: { select: { branch_code: true, branch_name: true } },
      customer_category: { select: { cus_cat_title: true } },
    },
    orderBy: { cus_balance: 'desc' },
    take,
  });

  const total = customers.reduce((s, c) => s + num(c.cus_balance), 0);

  return {
    summary: { total, count: customers.length, label: 'Pending receivable' },
    chart: customers.map((c) => ({
      label: c.cus_name,
      value: num(c.cus_balance),
      branch_code: c.branch?.branch_code,
    })),
    rows: detailed
      ? customers.map((c) => ({
          id: c.cus_id,
          branch_code: c.branch?.branch_code || '—',
          branch_name: c.branch?.branch_name || '—',
          customer: c.cus_name,
          phone: c.cus_phone_no || '—',
          category: c.customer_category?.cus_cat_title || '—',
          balance: num(c.cus_balance),
        }))
      : [],
  };
}

export async function getTopSuppliersByBalance({ branchId, limit = 12, detailed = false }) {
  const skipIds = await skipCategoryIds();
  const take = Math.min(Math.max(parseInt(limit, 10) || 12, 5), 50);
  let where = {
    ...(branchId ? { branch_id: branchId } : {}),
    ...supplierRecordFilter(skipIds),
    cus_balance: { lt: 0 },
  };

  let suppliers = await centralPrisma.customer.findMany({
    where,
    include: {
      branch: { select: { branch_code: true, branch_name: true } },
      customer_category: { select: { cus_cat_title: true } },
    },
    orderBy: { cus_balance: 'asc' },
    take,
  });

  if (!suppliers.length) {
    suppliers = await centralPrisma.customer.findMany({
      where: {
        ...(branchId ? { branch_id: branchId } : {}),
        ...(skipIds.length ? { cus_category: { notIn: skipIds } } : {}),
        cus_balance: { lt: 0 },
      },
      include: {
        branch: { select: { branch_code: true, branch_name: true } },
        customer_category: { select: { cus_cat_title: true } },
      },
      orderBy: { cus_balance: 'asc' },
      take,
    });
  }

  const total = suppliers.reduce((s, c) => s + Math.abs(num(c.cus_balance)), 0);

  return {
    summary: { total, count: suppliers.length, label: 'To pay suppliers' },
    chart: suppliers.map((c) => ({
      label: c.cus_name,
      value: Math.abs(num(c.cus_balance)),
      branch_code: c.branch?.branch_code,
    })),
    rows: detailed
      ? suppliers.map((c) => ({
          id: c.cus_id,
          branch_code: c.branch?.branch_code || '—',
          branch_name: c.branch?.branch_name || '—',
          customer: c.cus_name,
          phone: c.cus_phone_no || '—',
          category: c.customer_category?.cus_cat_title || '—',
          balance: Math.abs(num(c.cus_balance)),
        }))
      : [],
  };
}

export async function getCustomerActivity({ branchId, dateRange, limit, detailed = false }) {
  const take = invoiceChartLimit(limit, 12);
  const skipIds = await skipCategoryIds();
  const [invoices, received] = await Promise.all([
    loadSaleInvoices({ branchId, dateRange }),
    centralPrisma.ledger.findMany({
      where: { ...ledgerBaseWhere(branchId, dateRange), ...customerAccountFilter(skipIds), ...RECEIVE_LEDGER_WHERE },
      select: { cus_id: true, credit_amount: true },
      take: 4000,
    }),
  ]);

  const map = new Map();
  invoices.forEach((sale) => {
    const t = saleInvoiceTotals(sale);
    const prev = map.get(sale.cus_id) || { purchased: 0, received: 0, bills: 0 };
    prev.purchased += t.items;
    prev.bills += 1;
    map.set(sale.cus_id, prev);
  });
  received.forEach((e) => {
    const prev = map.get(e.cus_id) || { purchased: 0, received: 0, bills: 0 };
    prev.received += num(e.credit_amount);
    map.set(e.cus_id, prev);
  });

  const ranked = [...map.entries()]
    .map(([cus_id, v]) => ({ cus_id, ...v, pending: v.purchased - v.received }))
    .sort((a, b) => b.purchased - a.purchased)
    .slice(0, take);

  const accounts = await hydrateAccounts(ranked.map((r) => r.cus_id));
  const rows = ranked.map((r) => {
    const c = accounts.get(r.cus_id);
    return {
      id: r.cus_id,
      customer: c?.cus_name || `Account #${r.cus_id}`,
      branch_code: c?.branch?.branch_code || '—',
      branch_name: c?.branch?.branch_name || '—',
      purchased: r.purchased,
      received: r.received,
      pending: r.pending,
      bills: r.bills,
    };
  });

  const purchased = rows.reduce((s, r) => s + r.purchased, 0);
  const receivedTotal = rows.reduce((s, r) => s + r.received, 0);

  return {
    summary: {
      total: purchased,
      received: receivedTotal,
      pending: purchased - receivedTotal,
      count: rows.length,
      label: 'Purchased from us',
    },
    series: [
      { key: 'purchased', label: 'Purchased', color: '#4338ca' },
      { key: 'received', label: 'Received', color: '#047857' },
    ],
    chart: rows.map((r) => ({
      label: r.customer,
      value: r.purchased,
      purchased: r.purchased,
      received: r.received,
      pending: r.pending,
    })),
    rows: detailed ? rows : [],
  };
}

export async function getSupplierActivity({ branchId, dateRange, limit, detailed = false }) {
  const take = invoiceChartLimit(limit, 12);
  const skipIds = await skipCategoryIds();
  const [invoices, paid] = await Promise.all([
    loadPurchaseInvoices({ branchId, dateRange }),
    centralPrisma.ledger.findMany({
      where: { ...ledgerBaseWhere(branchId, dateRange), ...supplierAccountFilter(skipIds), ...PAY_LEDGER_WHERE },
      select: { cus_id: true, debit_amount: true },
      take: 4000,
    }),
  ]);

  const map = new Map();
  invoices.forEach((purchase) => {
    const t = purchaseInvoiceTotals(purchase);
    const prev = map.get(purchase.cus_id) || { purchased: 0, paid: 0, bills: 0 };
    prev.purchased += t.items;
    prev.bills += 1;
    map.set(purchase.cus_id, prev);
  });
  paid.forEach((e) => {
    const prev = map.get(e.cus_id) || { purchased: 0, paid: 0, bills: 0 };
    prev.paid += num(e.debit_amount);
    map.set(e.cus_id, prev);
  });

  const ranked = [...map.entries()]
    .map(([cus_id, v]) => ({ cus_id, ...v, pending: v.purchased - v.paid }))
    .sort((a, b) => b.purchased - a.purchased)
    .slice(0, take);

  const accounts = await hydrateAccounts(ranked.map((r) => r.cus_id));
  const rows = ranked.map((r) => {
    const c = accounts.get(r.cus_id);
    return {
      id: r.cus_id,
      customer: c?.cus_name || `Account #${r.cus_id}`,
      branch_code: c?.branch?.branch_code || '—',
      branch_name: c?.branch?.branch_name || '—',
      purchased: r.purchased,
      paid: r.paid,
      pending: r.pending,
      bills: r.bills,
    };
  });

  const purchased = rows.reduce((s, r) => s + r.purchased, 0);
  const paidTotal = rows.reduce((s, r) => s + r.paid, 0);

  return {
    summary: {
      total: purchased,
      paid: paidTotal,
      pending: purchased - paidTotal,
      count: rows.length,
      label: 'Purchased from suppliers',
    },
    series: [
      { key: 'purchased', label: 'Purchased', color: '#0f766e' },
      { key: 'paid', label: 'Paid', color: '#b45309' },
    ],
    chart: rows.map((r) => ({
      label: r.customer,
      value: r.purchased,
      purchased: r.purchased,
      paid: r.paid,
      pending: r.pending,
    })),
    rows: detailed ? rows : [],
  };
}

export async function getHqTypedReport(type, params) {
  switch (type) {
    case 'sales':
      return getSalesAnalytics(params);
    case 'purchases':
      return getPurchaseAnalytics(params);
    case 'payments':
      return getPaymentAnalytics(params);
    case 'profit':
      return getProfitAnalytics(params);
    case 'expenses':
      return getExpenseAnalytics(params);
    case 'customers-balance':
      return getTopCustomersByBalance(params);
    case 'suppliers-balance':
      return getTopSuppliersByBalance(params);
    case 'customers-activity':
    case 'customers-supplies':
      return getCustomerActivity(params);
    case 'suppliers-activity':
      return getSupplierActivity(params);
    default:
      return null;
  }
}
