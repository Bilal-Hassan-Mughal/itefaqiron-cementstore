/**
 * 10 purchases + 10 sales on DEMO branch (10) via live API — mixed payments, ledger aligned.
 * Requires: npm run dev (port 3000), seeded products/accounts.
 *
 *   node scripts/seed-demo-real-transactions.js
 */
/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const API_BASE = process.env.API_BASE || 'http://127.0.0.1:3000';
const BRANCH_ID = process.env.BRANCH_ID || '10';

const HEADERS = {
  'Content-Type': 'application/json',
  'x-branch-id': BRANCH_ID,
  'x-user-json': JSON.stringify({
    user_id: 29,
    branch_id: Number(BRANCH_ID),
    role: 'BRANCH_SUPER_ADMIN',
    email: 'demo@gmail.com',
  }),
};

function money(n) {
  return Number(parseFloat(n).toFixed(2));
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path} ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

function dateOct2026(day, hour = 10, minute = 0) {
  return new Date(2026, 9, day, hour, minute, 0);
}

async function backdatePurchase(purId, date) {
  const idStr = String(purId);
  await prisma.purchase.update({ where: { pur_id: purId }, data: { created_at: date, updated_at: date } });
  await prisma.purchaseDetail.updateMany({ where: { pur_id: purId }, data: { created_at: date, updated_at: date } });
  await prisma.ledger.updateMany({
    where: {
      OR: [{ bill_no: idStr }, { bill_no: `PUR-${idStr}` }, { bill_no: `PURCHASE-${idStr}` }],
    },
    data: { created_at: date, updated_at: date },
  });
}

async function backdateSale(saleId, date) {
  const idStr = String(saleId);
  await prisma.sale.update({ where: { sale_id: saleId }, data: { created_at: date, updated_at: date } });
  await prisma.saleDetail.updateMany({ where: { sale_id: saleId }, data: { created_at: date, updated_at: date } });
  await prisma.ledger.updateMany({ where: { bill_no: idStr }, data: { created_at: date, updated_at: date } });
}

const compareChronologically = (a, b) => {
  const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (timeA !== timeB) return timeA - timeB;
  return (a.l_id || 0) - (b.l_id || 0);
};

function calculateClosingBalance(opening, debit = 0, credit = 0) {
  return money(parseFloat(opening) + parseFloat(debit) - parseFloat(credit));
}

async function recalculateCustomerLedger(cusId) {
  const rawEntries = await prisma.ledger.findMany({ where: { cus_id: cusId } });
  if (!rawEntries.length) return;
  const sorted = [...rawEntries].sort(compareChronologically);
  let running = parseFloat(sorted[0].opening_balance || 0);
  for (const entry of sorted) {
    const opening = running;
    const closing = calculateClosingBalance(opening, entry.debit_amount, entry.credit_amount);
    await prisma.ledger.update({
      where: { l_id: entry.l_id },
      data: { opening_balance: opening, closing_balance: closing },
    });
    running = closing;
  }
  await prisma.customer.update({ where: { cus_id: cusId }, data: { cus_balance: running } });
}

async function loadDemoContext() {
  const branchId = parseInt(BRANCH_ID, 10);
  const store = await prisma.store.findFirst({ where: { branch_id: branchId } });
  if (!store) throw new Error(`No store for branch ${branchId}`);

  const products = await prisma.product.findMany({
    where: { branch_id: branchId },
    orderBy: { pro_id: 'asc' },
  });
  if (products.length < 3) throw new Error('Run npm run db:seed:demo-products first');

  const supplierCat = await prisma.customerCategory.findFirst({
    where: { cus_cat_title: { contains: 'Supplier' } },
  });
  let suppliers = supplierCat
    ? await prisma.customer.findMany({
        where: { branch_id: branchId, cus_category: supplierCat.cus_cat_id },
      })
    : [];
  if (!suppliers.length) {
    suppliers = await prisma.customer.findMany({
      where: { branch_id: branchId, cus_name: { contains: 'Supplier' } },
    });
  }
  if (!suppliers.length) throw new Error('No supplier accounts on DEMO branch');

  let buyers = await prisma.customer.findMany({
    where: {
      branch_id: branchId,
      OR: [
        { cus_name: { contains: 'Demo —' } },
        { cus_name: { contains: 'Walk-in' } },
        { cus_name: { contains: 'Zain' } },
      ],
    },
  });
  if (!buyers.length) throw new Error('Run npm run db:seed:sales-buyers first');

  const bankAccount = await prisma.customer.findFirst({
    where: { branch_id: branchId, cus_name: 'Meezan Bank Ltd (Demo Sales)' },
  });

  return { store, products, suppliers, buyers, bankAccount };
}

function line(pro, qnty, useSalePrice = false) {
  const rate = money(useSalePrice ? pro.pro_sale_price : pro.pro_cost_price);
  const q = Number(qnty);
  return {
    pro_id: pro.pro_id,
    qnty: q,
    unit: pro.pro_unit || 'pcs',
    unit_rate: rate,
    total_amount: money(q * rate),
  };
}

function sumLines(lines) {
  return money(lines.reduce((s, l) => s + l.total_amount, 0));
}

function productAt(products, index) {
  return products[index % products.length];
}

function buildPurchases(ctx) {
  const { store, products, suppliers, bankAccount } = ctx;
  const specs = [
    { day: 1, lines: [[0, 50]], pay: 'cash_full', inv: 'DEMO-INV-P-001' },
    { day: 2, lines: [[3, 200]], pay: 'cash_full', inv: 'DEMO-INV-P-002' },
    { day: 3, lines: [[0, 30], [1, 20]], pay: 'credit', inv: 'DEMO-INV-P-003' },
    { day: 4, lines: [[4, 100]], pay: 'bank_full', inv: 'DEMO-INV-P-004' },
    { day: 5, lines: [[2, 8]], pay: 'cash_full', inv: 'DEMO-INV-P-005' },
    { day: 6, lines: [[3, 150], [4, 80]], pay: 'split', inv: 'DEMO-INV-P-006' },
    { day: 7, lines: [[5, 12]], pay: 'credit', inv: 'DEMO-INV-P-007' },
    { day: 8, lines: [[6, 25]], pay: 'cash_partial', inv: 'DEMO-INV-P-008' },
    { day: 9, lines: [[7, 200]], pay: 'bank_full', inv: 'DEMO-INV-P-009' },
    { day: 10, lines: [[8, 15], [0, 10]], pay: 'cash_full', inv: 'DEMO-INV-P-010' },
  ];

  return specs.map((spec, idx) => {
    const details = spec.lines.map(([pi, q]) => line(productAt(products, pi), q, false));
    const total = sumLines(details);
    let cash = 0;
    let bank = 0;
    if (spec.pay === 'cash_full') cash = total;
    else if (spec.pay === 'bank_full') bank = total;
    else if (spec.pay === 'split') {
      cash = money(total * 0.4);
      bank = money(total - cash);
    } else if (spec.pay === 'cash_partial') cash = money(total * 0.6);

    return {
      date: dateOct2026(spec.day, 9 + (idx % 4), 10 + idx),
      body: {
        cus_id: suppliers[idx % suppliers.length].cus_id,
        store_id: store.storeid,
        invoice_number: spec.inv,
        purchase_details: details,
        total_amount: total,
        net_total: total,
        discount: 0,
        payment: money(cash + bank),
        payment_type: bank > 0 ? 'BANK_TRANSFER' : 'CASH',
        cash_payment: cash,
        bank_payment: bank,
        bank_account_id: bank > 0 ? bankAccount?.cus_id : null,
      },
    };
  });
}

function buildSales(ctx) {
  const { store, products, buyers, bankAccount } = ctx;
  const specs = [
    { day: 1, lines: [[3, 40]], pay: 'cash_full', ref: 'DEMO-BILL-S-001' },
    { day: 2, lines: [[0, 500]], pay: 'cash_full', ref: 'DEMO-BILL-S-002' },
    { day: 3, lines: [[4, 60]], pay: 'credit', ref: 'DEMO-BILL-S-003' },
    { day: 4, lines: [[1, 300]], pay: 'bank_full', ref: 'DEMO-BILL-S-004' },
    { day: 5, lines: [[3, 25]], pay: 'cash_full', ref: 'DEMO-BILL-S-005' },
    { day: 6, lines: [[5, 3], [6, 10]], pay: 'split', ref: 'DEMO-BILL-S-006' },
    { day: 7, lines: [[2, 2]], pay: 'credit', ref: 'DEMO-BILL-S-007' },
    { day: 8, lines: [[7, 80]], pay: 'cash_partial', ref: 'DEMO-BILL-S-008' },
    { day: 9, lines: [[8, 40]], pay: 'bank_full', ref: 'DEMO-BILL-S-009' },
    { day: 10, lines: [[0, 200], [4, 20]], pay: 'cash_full', ref: 'DEMO-BILL-S-010' },
  ];

  return specs.map((spec, idx) => {
    const details = spec.lines.map(([pi, q]) => line(productAt(products, pi), q, true));
    const total = sumLines(details);
    let cash = 0;
    let bank = 0;
    if (spec.pay === 'cash_full') cash = total;
    else if (spec.pay === 'bank_full') bank = total;
    else if (spec.pay === 'split') {
      bank = money(total * 0.5);
      cash = money(total - bank);
    } else if (spec.pay === 'cash_partial') cash = money(total * 0.5);

    return {
      date: dateOct2026(spec.day, 11 + (idx % 3), 20 + idx),
      body: {
        cus_id: buyers[idx % buyers.length].cus_id,
        store_id: store.storeid,
        total_amount: total,
        discount: 0,
        payment: money(cash + bank),
        payment_type: bank > 0 ? 'BANK_TRANSFER' : 'CASH',
        cash_payment: cash,
        bank_payment: bank,
        bankAccountId: bank > 0 ? bankAccount?.cus_id : null,
        bank_account_id: bank > 0 ? bankAccount?.cus_id : null,
        bill_type: 'BILL',
        reference: spec.ref,
        sale_details: details,
      },
    };
  });
}

async function ensureApiReady() {
  const res = await fetch(`${API_BASE}/api/products?dropdown=true`, { headers: HEADERS });
  if (!res.ok) throw new Error(`API not ready (${res.status}). Run npm run dev.`);
}

async function main() {
  console.log('\n=== DEMO real transactions (10 purchases + 10 sales) ===\n');
  await ensureApiReady();
  const ctx = await loadDemoContext();
  console.log(`Store: ${ctx.store.store_name} (${ctx.store.storeid})`);
  console.log(`Products: ${ctx.products.length}, Suppliers: ${ctx.suppliers.length}, Buyers: ${ctx.buyers.length}\n`);

  const touched = new Set();
  const purchases = buildPurchases(ctx);
  const sales = buildSales(ctx);
  const timeline = [
    ...purchases.map((p) => ({ type: 'purchase', ...p })),
    ...sales.map((s) => ({ type: 'sale', ...s })),
  ].sort((a, b) => a.date - b.date);

  let ok = 0;
  let fail = 0;

  for (const row of timeline) {
    try {
      if (row.type === 'purchase') {
        const created = await apiPost('/api/purchases', row.body);
        const purId = created.pur_id ?? created.purchase?.pur_id;
        if (!purId) throw new Error('No pur_id in response');
        await backdatePurchase(purId, row.date);
        touched.add(row.body.cus_id);
        console.log(`✓ Purchase #${purId} ${row.body.invoice_number} Rs ${row.body.total_amount} paid ${row.body.payment}`);
      } else {
        const created = await apiPost('/api/sales', row.body);
        const saleId = created.sale_id ?? created.sale?.sale_id;
        if (!saleId) throw new Error('No sale_id in response');
        await backdateSale(saleId, row.date);
        touched.add(row.body.cus_id);
        console.log(`✓ Sale #${saleId} ${row.body.reference} Rs ${row.body.total_amount} paid ${row.body.payment}`);
      }
      ok += 1;
    } catch (e) {
      fail += 1;
      console.error(`✗ ${row.type}:`, e.message);
    }
  }

  if (ctx.bankAccount) touched.add(ctx.bankAccount.cus_id);
  const cashAccounts = await prisma.customer.findMany({
    where: {
      branch_id: parseInt(BRANCH_ID, 10),
      OR: [{ cus_name: { contains: 'Cash' } }, { cus_name: { contains: 'cash' } }],
    },
    select: { cus_id: true },
  });
  cashAccounts.forEach((c) => touched.add(c.cus_id));

  console.log('\nRecalculating ledgers...');
  for (const cusId of touched) {
    await recalculateCustomerLedger(cusId);
  }

  const branchId = parseInt(BRANCH_ID, 10);
  const counts = {
    purchases: await prisma.purchase.count({ where: { branch_id: branchId } }),
    sales: await prisma.sale.count({ where: { branch_id: branchId } }),
    ledger: await prisma.ledger.count(),
  };

  console.log('\nDone:', { ok, fail, ...counts, accountsRecalc: touched.size });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
