/**
 * Seed dummy purchases and sales across the last 3 months for report testing.
 *
 * Usage (dev server must be running on port 3000):
 *   node scripts/seed-dummy-purchases-sales.js
 *   node scripts/seed-dummy-purchases-sales.js --purchases=100 --sales=100
 *
 * Creates credit transactions (payment=0), backdates created_at, then recalculates ledgers.
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3000';
const BRANCH_ID = process.env.BRANCH_ID || '1';

function parseArgs() {
  const args = { purchases: 100, sales: 100 };
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--(purchases|sales)=(\d+)$/);
    if (m) args[m[1]] = parseInt(m[2], 10);
  }
  return args;
}

function randomInt(min, max) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function randomDate(year, month, maxDay) {
  const day = randomInt(1, maxDay);
  const hour = randomInt(9, 18);
  const minute = randomInt(0, 59);
  return new Date(year, month - 1, day, hour, minute, 0);
}

function pick(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function splitAcrossMonths(total, monthCount = 3) {
  const base = Math.floor(total / monthCount);
  const rem = total % monthCount;
  return Array.from({ length: monthCount }, (_, i) => base + (i < rem ? 1 : 0));
}

const MONTH_WINDOWS = [
  { label: 'July 2026', year: 2026, month: 7, maxDay: 31 },
  { label: 'August 2026', year: 2026, month: 8, maxDay: 31 },
  { label: 'September 2026', year: 2026, month: 9, maxDay: 7 },
];

function buildSchedule(purchaseCount, saleCount) {
  const purSplit = splitAcrossMonths(purchaseCount, MONTH_WINDOWS.length);
  const saleSplit = splitAcrossMonths(saleCount, MONTH_WINDOWS.length);
  const rows = [];

  MONTH_WINDOWS.forEach((win, idx) => {
    for (let i = 0; i < purSplit[idx]; i += 1) {
      rows.push({ type: 'purchase', date: randomDate(win.year, win.month, win.maxDay), monthLabel: win.label });
    }
    for (let i = 0; i < saleSplit[idx]; i += 1) {
      rows.push({ type: 'sale', date: randomDate(win.year, win.month, win.maxDay), monthLabel: win.label });
    }
  });

  rows.sort((a, b) => {
    const diff = a.date.getTime() - b.date.getTime();
    if (diff !== 0) return diff;
    if (a.type === b.type) return 0;
    return a.type === 'purchase' ? -1 : 1;
  });

  return rows;
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-branch-id': BRANCH_ID,
    },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${path} HTTP ${res.status}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function backdatePurchase(purId, date) {
  const idStr = String(purId);
  await prisma.purchase.update({
    where: { pur_id: purId },
    data: { created_at: date, updated_at: date },
  });
  await prisma.purchaseDetail.updateMany({
    where: { pur_id: purId },
    data: { created_at: date, updated_at: date },
  });
  await prisma.ledger.updateMany({
    where: {
      OR: [
        { bill_no: idStr },
        { bill_no: `PUR-${idStr}` },
        { bill_no: `PURCHASE-${idStr}` },
        { bill_no: `INC-${idStr}` },
        { bill_no: `incity-${idStr}` },
      ],
    },
    data: { created_at: date, updated_at: date },
  });
}

async function backdateSale(saleId, date) {
  const idStr = String(saleId);
  await prisma.sale.update({
    where: { sale_id: saleId },
    data: { created_at: date, updated_at: date },
  });
  await prisma.saleDetail.updateMany({
    where: { sale_id: saleId },
    data: { created_at: date, updated_at: date },
  });
  await prisma.ledger.updateMany({
    where: { bill_no: idStr },
    data: { created_at: date, updated_at: date },
  });
}

const compareChronologically = (a, b) => {
  const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (timeA !== timeB) return timeA - timeB;
  const billA = parseInt(String(a.bill_no || '').replace(/\D/g, ''), 10) || 0;
  const billB = parseInt(String(b.bill_no || '').replace(/\D/g, ''), 10) || 0;
  if (billA !== billB) return billA - billB;
  return (a.l_id || 0) - (b.l_id || 0);
};

function calculateClosingBalance(openingBalance, debitAmount = 0, creditAmount = 0) {
  const opening = parseFloat(openingBalance || 0);
  const debit = parseFloat(debitAmount || 0);
  const credit = parseFloat(creditAmount || 0);
  return Number((opening + debit - credit).toFixed(2));
}

async function recalculateCustomerLedger(cusId) {
  const customer = await prisma.customer.findUnique({
    where: { cus_id: cusId },
    include: { customer_category: true },
  });
  if (!customer) return;

  const rawEntries = await prisma.ledger.findMany({ where: { cus_id: cusId } });
  if (rawEntries.length === 0) return;

  const sortedEntries = [...rawEntries].sort(compareChronologically);
  let currentBalance = parseFloat(sortedEntries[0].opening_balance || 0);
  const updates = [];

  for (const entry of sortedEntries) {
    const opening = currentBalance;
    const debit = parseFloat(entry.debit_amount || 0);
    const credit = parseFloat(entry.credit_amount || 0);
    const closing = calculateClosingBalance(opening, debit, credit);
    updates.push({ l_id: entry.l_id, new_opening: opening, new_closing: closing });
    currentBalance = closing;
  }

  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      await tx.ledger.update({
        where: { l_id: update.l_id },
        data: {
          opening_balance: update.new_opening,
          closing_balance: update.new_closing,
        },
      });
    }
    await tx.customer.update({
      where: { cus_id: cusId },
      data: { cus_balance: currentBalance },
    });
  });
}

async function loadMasterData() {
  const categories = await prisma.customerCategory.findMany();
  const supplierCat = categories.find((c) => /supplier/i.test(c.cus_cat_title || ''));
  const customerCat = categories.find((c) => /^customer$/i.test(c.cus_cat_title || ''));

  const suppliers = supplierCat
    ? await prisma.customer.findMany({ where: { cus_category: supplierCat.cus_cat_id }, take: 20 })
    : [];
  const customers = customerCat
    ? await prisma.customer.findMany({ where: { cus_category: customerCat.cus_cat_id }, take: 20 })
    : [];

  const products = await prisma.product.findMany({ take: 50 });
  const stores = await prisma.store.findMany({ take: 10 });

  return { suppliers, customers, products, stores };
}

function buildPurchasePayload(supplier, store, product, seq) {
  const qnty = randomInt(5, 40);
  const unitRate = Number(parseFloat(product.pro_cost_price || 1000).toFixed(2));
  const total = Number((qnty * unitRate).toFixed(2));
  return {
    cus_id: supplier.cus_id,
    store_id: store.storeid,
    total_amount: total,
    net_total: total,
    discount: 0,
    payment: 0,
    payment_type: 'CASH',
    cash_payment: 0,
    bank_payment: 0,
    invoice_number: `DUMMY-P-${String(seq).padStart(4, '0')}`,
    purchase_details: [
      {
        pro_id: product.pro_id,
        qnty,
        unit: product.pro_unit || 'Bag',
        unit_rate: unitRate,
        total_amount: total,
      },
    ],
  };
}

function buildSalePayload(customer, store, product, seq) {
  const qnty = randomInt(2, 25);
  const unitRate = Number(parseFloat(product.pro_sale_price || product.pro_cost_price || 1200).toFixed(2));
  const total = Number((qnty * unitRate).toFixed(2));
  return {
    cus_id: customer.cus_id,
    store_id: store.storeid,
    total_amount: total,
    discount: 0,
    payment: 0,
    payment_type: 'CASH',
    cash_payment: 0,
    bank_payment: 0,
    bill_type: 'BILL',
    reference: `DUMMY-S-${String(seq).padStart(4, '0')}`,
    sale_details: [
      {
        pro_id: product.pro_id,
        qnty,
        unit: product.pro_unit || 'Bag',
        unit_rate: unitRate,
        total_amount: total,
      },
    ],
  };
}

async function ensureApiReady() {
  try {
    const res = await fetch(`${API_BASE}/api/products`, {
      headers: { 'x-branch-id': BRANCH_ID },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    throw new Error(
      `Cannot reach API at ${API_BASE}. Start the dev server first (npm run dev:next). ${err.message}`
    );
  }
}

async function main() {
  const { purchases: purchaseTarget, sales: saleTarget } = parseArgs();
  const totalTarget = purchaseTarget + saleTarget;

  console.log('\n========================================');
  console.log('  Dummy Purchases & Sales Seed');
  console.log('========================================');
  console.log(`Target: ${purchaseTarget} purchases + ${saleTarget} sales = ${totalTarget} entries`);
  console.log(`Months: July, August, September 2026`);
  console.log(`API: ${API_BASE} (branch ${BRANCH_ID})\n`);

  await ensureApiReady();

  const { suppliers, customers, products, stores } = await loadMasterData();
  if (suppliers.length === 0) throw new Error('No supplier accounts found. Run: npm run db:seed:main');
  if (customers.length === 0) throw new Error('No customer accounts found. Run: npm run db:seed:main');
  if (products.length === 0) throw new Error('No products found. Run: npm run db:seed:main');
  if (stores.length === 0) throw new Error('No stores found. Run: npm run db:seed:main');

  const schedule = buildSchedule(purchaseTarget, saleTarget);
  const touchedCustomers = new Set();
  let purSeq = 0;
  let saleSeq = 0;
  let ok = 0;
  let fail = 0;

  for (let i = 0; i < schedule.length; i += 1) {
    const row = schedule[i];
    const product = pick(products);
    const store = pick(stores);

    try {
      if (row.type === 'purchase') {
        purSeq += 1;
        const supplier = pick(suppliers);
        const payload = buildPurchasePayload(supplier, store, product, purSeq);
        const created = await apiPost('/api/purchases', payload);
        await backdatePurchase(created.pur_id, row.date);
        touchedCustomers.add(supplier.cus_id);
        if (i % 10 === 0 || i === schedule.length - 1) {
          console.log(`  [${i + 1}/${schedule.length}] Purchase #${created.pur_id} | ${row.monthLabel} | Rs ${payload.total_amount}`);
        }
      } else {
        saleSeq += 1;
        const customer = pick(customers);
        const payload = buildSalePayload(customer, store, product, saleSeq);
        const created = await apiPost('/api/sales', payload);
        await backdateSale(created.sale_id, row.date);
        touchedCustomers.add(customer.cus_id);
        if (i % 10 === 0 || i === schedule.length - 1) {
          console.log(`  [${i + 1}/${schedule.length}] Sale #${created.sale_id} | ${row.monthLabel} | Rs ${payload.total_amount}`);
        }
      }
      ok += 1;
    } catch (err) {
      fail += 1;
      console.error(`  FAIL [${i + 1}] ${row.type}:`, err.message);
    }
  }

  console.log('\nRecalculating ledgers for affected accounts...');
  for (const cusId of touchedCustomers) {
    await recalculateCustomerLedger(cusId);
  }

  const summary = {
    purchases: await prisma.purchase.count(),
    sales: await prisma.sale.count(),
    ledgerRows: await prisma.ledger.count(),
  };

  console.log('\n========================================');
  console.log('  Seed Complete');
  console.log('========================================');
  console.log(`Created OK: ${ok} | Failed: ${fail}`);
  console.log(`Purchases in DB: ${summary.purchases}`);
  console.log(`Sales in DB: ${summary.sales}`);
  console.log(`Ledger rows: ${summary.ledgerRows}`);
  console.log(`Recalculated ${touchedCustomers.size} customer/supplier accounts\n`);
}

main()
  .catch((err) => {
    console.error('\nSeed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
