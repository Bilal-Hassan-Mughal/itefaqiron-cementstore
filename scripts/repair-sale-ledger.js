/**
 * Backfill missing Sale ledger for one sale_id, then recalc customer balance chain.
 * Usage: node scripts/repair-sale-ledger.js 443
 *        node scripts/repair-sale-ledger.js 443 --dry-run
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const DRY = process.argv.includes('--dry-run');
const saleId = parseInt(process.argv[2], 10);

const compareChronologically = (a, b) => {
  const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (timeA !== timeB) return timeA - timeB;
  const billA = parseInt(String(a.bill_no || '').replace(/\D/g, ''), 10) || 0;
  const billB = parseInt(String(b.bill_no || '').replace(/\D/g, ''), 10) || 0;
  if (billA !== billB) return billA - billB;
  return (a.l_id || 0) - (b.l_id || 0);
};

async function recalculateLedgerBalances(cus_id) {
  const entries = await prisma.ledger.findMany({
    where: { cus_id },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
  });
  entries.sort(compareChronologically);

  let runningBalance = 0;
  const updates = [];
  if (entries.length > 0) {
    runningBalance = parseFloat(entries[0].opening_balance || 0);
    for (const entry of entries) {
      const opening = runningBalance;
      const debit = parseFloat(entry.debit_amount || 0);
      const credit = parseFloat(entry.credit_amount || 0);
      const closing = Number((opening + debit - credit).toFixed(2));
      if (
        Math.abs(parseFloat(entry.opening_balance) - opening) > 0.01 ||
        Math.abs(parseFloat(entry.closing_balance) - closing) > 0.01
      ) {
        updates.push({ l_id: entry.l_id, opening_balance: opening, closing_balance: closing });
      }
      runningBalance = closing;
    }
  }

  for (let i = 0; i < updates.length; i += 50) {
    const chunk = updates.slice(i, i + 50);
    const ids = chunk.map((e) => e.l_id).join(',');
    let openCases = '';
    let closeCases = '';
    for (const e of chunk) {
      openCases += ` WHEN ${e.l_id} THEN ${e.opening_balance}`;
      closeCases += ` WHEN ${e.l_id} THEN ${e.closing_balance}`;
    }
    await prisma.$executeRawUnsafe(
      `UPDATE ledger SET
         opening_balance = CASE l_id ${openCases} END,
         closing_balance = CASE l_id ${closeCases} END
       WHERE l_id IN (${ids})`
    );
  }

  await prisma.customer.update({
    where: { cus_id },
    data: { cus_balance: Number(runningBalance.toFixed(2)) },
  });

  return { entries: entries.length, updates: updates.length, finalBalance: runningBalance };
}

async function main() {
  if (!saleId || Number.isNaN(saleId)) {
    console.error('Usage: node scripts/repair-sale-ledger.js <sale_id> [--dry-run]');
    process.exit(1);
  }

  const sale = await prisma.sale.findUnique({
    where: { sale_id: saleId },
    include: { customer: { select: { cus_id: true, cus_name: true, cus_balance: true } } },
  });

  if (!sale) {
    console.error(`Sale ${saleId} not found`);
    process.exit(1);
  }

  const billNo = String(saleId);
  const existing = await prisma.ledger.findFirst({
    where: {
      bill_no: billNo,
      cus_id: sale.cus_id,
      ledger_type: 'Sale',
      trnx_type: 'DEBIT',
    },
  });

  if (existing) {
    console.log(`Sale ledger debit already exists l_id=${existing.l_id}. Running recalc only.`);
    if (!DRY) {
      const r = await recalculateLedgerBalances(sale.cus_id);
      console.log('Recalc:', r);
    }
    return;
  }

  const totalAmount = parseFloat(sale.total_amount || 0);
  const cashAmount = parseFloat(sale.cash_payment || 0);
  const bankAmount = parseFloat(sale.bank_payment || 0);
  const discountAmount = parseFloat(sale.discount || 0);

  let billDetails = `Sale Bill - ${sale.bill_type || 'BILL'} - Customer Account (Debit)`;
  if (discountAmount > 0) {
    billDetails += ` [Discount Applied: ${discountAmount}]`;
  }

  const maxLedger = await prisma.ledger.findFirst({
    orderBy: { l_id: 'desc' },
    select: { l_id: true },
  });
  const nextLId = (maxLedger?.l_id || 0) + 1;

  const rowsToCreate = [];

  const priorEntries = await prisma.ledger.findMany({
    where: {
      cus_id: sale.cus_id,
      created_at: { lt: sale.created_at },
    },
    orderBy: [{ created_at: 'desc' }, { l_id: 'desc' }],
    take: 1,
  });
  const openingAtSale =
    priorEntries.length > 0
      ? parseFloat(priorEntries[0].closing_balance || 0)
      : parseFloat(sale.previous_balance || 0);

  const debitClosing = Number((openingAtSale + totalAmount).toFixed(2));

  rowsToCreate.push({
    l_id: nextLId,
    branch_id: sale.branch_id || 1,
    cus_id: sale.cus_id,
    opening_balance: openingAtSale,
    debit_amount: totalAmount,
    credit_amount: 0,
    closing_balance: debitClosing,
    bill_no: billNo,
    trnx_type: 'DEBIT',
    details: billDetails,
    payments: 0,
    cash_payment: 0,
    bank_payment: 0,
    updated_by: sale.updated_by || 6,
    ledger_type: 'Sale',
    created_at: sale.created_at,
  });

  const totalPayment = cashAmount + bankAmount;
  if (totalPayment > 0) {
    const paymentParts = [];
    if (cashAmount > 0) paymentParts.push(`Cash: ${cashAmount}`);
    if (bankAmount > 0) paymentParts.push(`Bank (${sale.bank_title || 'Bank'}): ${bankAmount}`);
    rowsToCreate.push({
      l_id: nextLId + 1,
      branch_id: sale.branch_id || 1,
      cus_id: sale.cus_id,
      opening_balance: 0,
      debit_amount: 0,
      credit_amount: totalPayment,
      closing_balance: -totalPayment,
      bill_no: billNo,
      trnx_type: 'CREDIT',
      details: `Payment Received - ${sale.bill_type || 'BILL'} - Customer Account (Credit) [${paymentParts.join(', ')}]`,
      payments: totalPayment,
      cash_payment: cashAmount,
      bank_payment: bankAmount,
      updated_by: sale.updated_by || 6,
      ledger_type: 'Sale',
      created_at: sale.created_at,
    });
  }

  console.log('Sale', saleId, sale.customer?.cus_name, '| amount', totalAmount, '| payment', totalPayment);
  console.log('Will create', rowsToCreate.length, 'ledger row(s) at', sale.created_at.toISOString());
  rowsToCreate.forEach((r) => console.log(' ', r.trnx_type, r.debit_amount, r.credit_amount, r.details.slice(0, 60)));

  if (DRY) {
    console.log('Dry run — no changes written.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const row of rowsToCreate) {
      await tx.ledger.create({ data: row });
    }
  });

  console.log('Created ledger rows. Recalculating customer', sale.cus_id, '...');
  const before = parseFloat(sale.customer?.cus_balance || 0);
  const result = await recalculateLedgerBalances(sale.cus_id);
  console.log('Recalc done:', result);
  console.log(`Customer balance: ${before} → ${result.finalBalance}`);

  const verify = await prisma.ledger.findMany({
    where: { bill_no: billNo, cus_id: sale.cus_id, ledger_type: 'Sale' },
    orderBy: { l_id: 'asc' },
  });
  console.log('\nVerify bill_no', billNo, 'on customer:');
  verify.forEach((r) =>
    console.log(`  l_id ${r.l_id} ${r.trnx_type} Dr ${r.debit_amount} Cr ${r.credit_amount} open ${r.opening_balance} close ${r.closing_balance}`)
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
