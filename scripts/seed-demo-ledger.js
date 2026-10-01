/**
 * Seed demo_ledger for ALL accounts in DEMO branch (demo_* tables only).
 * Does not modify application source code.
 *
 * Usage:
 *   node scripts/seed-demo-ledger.js
 *   node scripts/seed-demo-ledger.js --reset   # clear demo_ledger first
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PREFIX = 'demo';
const BRANCH_CODE = 'DEMO';

function tbl(base) {
  return `\`${PREFIX}_${base}\``;
}

function num(v) {
  return Number(parseFloat(v || 0).toFixed(2));
}

function closing(opening, debit, credit) {
  return num(opening + debit - credit);
}

async function resolveDemoBranch() {
  const branch = await prisma.branch.findUnique({ where: { branch_code: BRANCH_CODE } });
  if (!branch) throw new Error('DEMO branch not found');
  return branch;
}

async function loadCustomers(branchId) {
  return prisma.$queryRawUnsafe(`
    SELECT c.cus_id, c.cus_name, c.cus_balance, c.cus_category, c.cus_type,
           cat.cus_cat_title
    FROM ${tbl('customers')} c
    LEFT JOIN ${tbl('customer_categories')} cat ON cat.cus_cat_id = c.cus_category
    WHERE c.branch_id = ?
    ORDER BY c.cus_id
  `, branchId);
}

async function loadPurchases(branchId) {
  return prisma.$queryRawUnsafe(`
    SELECT pur_id, cus_id, net_total, total_amount, invoice_number, created_at
    FROM ${tbl('purchases')}
    WHERE branch_id = ?
    ORDER BY created_at ASC, pur_id ASC
  `, branchId);
}

async function loadSales(branchId) {
  return prisma.$queryRawUnsafe(`
    SELECT sale_id, cus_id, total_amount, reference, created_at
    FROM ${tbl('sales')}
    WHERE branch_id = ?
    ORDER BY created_at ASC, sale_id ASC
  `, branchId);
}

function demoOpeningAmount(customer) {
  const bal = num(customer.cus_balance);
  if (bal !== 0) return { debit: bal > 0 ? bal : 0, credit: bal < 0 ? Math.abs(bal) : 0 };

  const title = String(customer.cus_cat_title || '').toLowerCase();
  if (title.includes('supplier') || title.includes('creditor')) {
    return { debit: 0, credit: 25000 };
  }
  if (title.includes('bank')) {
    return { debit: 500000, credit: 0 };
  }
  if (title.includes('cash')) {
    return { debit: 150000, credit: 0 };
  }
  if (title.includes('customer') || title.includes('debtor')) {
    return { debit: 15000, credit: 0 };
  }
  if (title.includes('expense')) {
    return { debit: 5000, credit: 0 };
  }
  if (title.includes('capital')) {
    return { debit: 0, credit: 800000 };
  }
  return { debit: 1000, credit: 0 };
}

async function insertLedgerRow(branchId, row) {
  await prisma.$executeRawUnsafe(
    `INSERT INTO ${tbl('ledger')}
      (branch_id, cus_id, opening_balance, debit_amount, credit_amount, closing_balance,
       bill_no, trnx_type, details, payments, cash_payment, bank_payment, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, ?)`,
    branchId,
    row.cus_id,
    row.opening,
    row.debit,
    row.credit,
    row.closing,
    row.bill_no,
    row.trnx_type,
    row.details,
    row.created_at,
    row.created_at
  );
}

async function updateCustomerBalance(cusId, balance) {
  await prisma.$executeRawUnsafe(
    `UPDATE ${tbl('customers')} SET cus_balance = ?, updated_at = NOW(3) WHERE cus_id = ?`,
    balance,
    cusId
  );
}

async function main() {
  const reset = process.argv.includes('--reset');
  const branch = await resolveDemoBranch();
  const branchId = branch.branch_id;

  console.log(`\nDEMO ledger seed (branch_id=${branchId}, ${PREFIX}_* tables)\n`);

  if (reset) {
    await prisma.$executeRawUnsafe(`DELETE FROM ${tbl('ledger')} WHERE branch_id = ?`, branchId);
    console.log('Cleared demo_ledger');
  }

  const existing = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM ${tbl('ledger')} WHERE branch_id = ?`,
    branchId
  );
  if (Number(existing[0].c) > 0 && !reset) {
    console.log(`demo_ledger already has ${existing[0].c} rows. Use --reset to rebuild.`);
    return;
  }

  const customers = await loadCustomers(branchId);
  const purchases = await loadPurchases(branchId);
  const sales = await loadSales(branchId);

  const balanceByCus = new Map();
  for (const c of customers) balanceByCus.set(c.cus_id, 0);

  const events = [];

  for (const c of customers) {
    const { debit, credit } = demoOpeningAmount(c);
    if (debit === 0 && credit === 0) continue;
    events.push({
      at: new Date('2026-09-01T10:00:00.000Z'),
      kind: 'opening',
      cus_id: c.cus_id,
      cus_name: c.cus_name,
      debit,
      credit,
      bill_no: `DEMO-OB-${c.cus_id}`,
      trnx_type: debit > 0 ? 'DEBIT' : 'CREDIT',
      details: `Demo opening balance — ${c.cus_name}`,
    });
  }

  for (const p of purchases) {
    const amount = num(p.net_total || p.total_amount);
    if (amount <= 0) continue;
    events.push({
      at: p.created_at ? new Date(p.created_at) : new Date(),
      kind: 'purchase',
      cus_id: p.cus_id,
      debit: 0,
      credit: amount,
      bill_no: String(p.pur_id),
      trnx_type: 'CREDIT',
      details: `Purchase Invoice${p.invoice_number ? ` #${p.invoice_number}` : ''} (demo seed)`,
    });
  }

  for (const s of sales) {
    const amount = num(s.total_amount);
    if (amount <= 0) continue;
    events.push({
      at: s.created_at ? new Date(s.created_at) : new Date(),
      kind: 'sale',
      cus_id: s.cus_id,
      debit: amount,
      credit: 0,
      bill_no: String(s.sale_id),
      trnx_type: 'DEBIT',
      details: `Sale Bill${s.reference ? ` — ${s.reference}` : ''} (demo seed)`,
    });
  }

  events.sort((a, b) => a.at.getTime() - b.at.getTime());

  let inserted = 0;
  for (const ev of events) {
    const opening = balanceByCus.get(ev.cus_id) ?? 0;
    const debit = num(ev.debit);
    const credit = num(ev.credit);
    const close = closing(opening, debit, credit);

    await insertLedgerRow(branchId, {
      cus_id: ev.cus_id,
      opening,
      debit,
      credit,
      closing: close,
      bill_no: ev.bill_no,
      trnx_type: ev.trnx_type,
      details: ev.details,
      created_at: ev.at,
    });

    balanceByCus.set(ev.cus_id, close);
    inserted += 1;
  }

  // Ensure every account has at least one ledger row (for "All Accounts" lists)
  const withRows = await prisma.$queryRawUnsafe(
    `SELECT DISTINCT cus_id FROM ${tbl('ledger')} WHERE branch_id = ?`,
    branchId
  );
  const hasLedger = new Set(withRows.map((r) => r.cus_id));

  for (const c of customers) {
    if (hasLedger.has(c.cus_id)) {
      await updateCustomerBalance(c.cus_id, balanceByCus.get(c.cus_id) ?? 0);
      continue;
    }

    const opening = balanceByCus.get(c.cus_id) ?? 0;
    await insertLedgerRow(branchId, {
      cus_id: c.cus_id,
      opening,
      debit: 0,
      credit: 0,
      closing: opening,
      bill_no: `DEMO-INIT-${c.cus_id}`,
      trnx_type: 'DEBIT',
      details: `Demo account initialized — ${c.cus_name}`,
      created_at: new Date(),
    });
    hasLedger.add(c.cus_id);
    inserted += 1;
    await updateCustomerBalance(c.cus_id, opening);
  }

  for (const [cusId, bal] of balanceByCus.entries()) {
    await updateCustomerBalance(cusId, bal);
  }

  const totalLedger = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*) AS c FROM ${tbl('ledger')} WHERE branch_id = ?`,
    branchId
  );
  const accountsWithLedger = await prisma.$queryRawUnsafe(
    `SELECT COUNT(DISTINCT cus_id) AS c FROM ${tbl('ledger')} WHERE branch_id = ?`,
    branchId
  );

  console.log(`Inserted ${inserted} ledger rows.`);
  console.log(`demo_ledger total: ${totalLedger[0].c}`);
  console.log(`Accounts with ledger: ${accountsWithLedger[0].c} / ${customers.length}`);
  console.log('\nDone. Log in to branch DEMO and open Finance → Ledger (All Accounts).\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e.message || e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
