const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const compareChronologically = (a, b) => {
  const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (timeA !== timeB) return timeA - timeB;

  const billA = parseInt(a.bill_no) || 0;
  const billB = parseInt(b.bill_no) || 0;
  if (billA !== billB) return billA - billB;

  return (a.l_id || 0) - (b.l_id || 0);
};

function calculateClosingBalance(openingBalance, debitAmount = 0, creditAmount = 0) {
  const opening = parseFloat(openingBalance || 0);
  const debit = parseFloat(debitAmount || 0);
  const credit = parseFloat(creditAmount || 0);
  return Number((opening + debit - credit).toFixed(2));
}

async function fixSale309() {
  const saleId = 309;
  const cusId = 537; // old cash 1

  const sale = await prisma.sale.findUnique({
    where: { sale_id: saleId },
    include: { customer: true }
  });

  if (!sale) throw new Error('Sale 309 not found');

  const existing = await prisma.ledger.findFirst({
    where: {
      cus_id: cusId,
      bill_no: String(saleId),
      ledger_type: 'Sale'
    }
  });

  if (existing) {
    console.log('Ledger entry already exists:', existing.l_id);
    return;
  }

  const maxLedger = await prisma.ledger.findFirst({
    orderBy: { l_id: 'desc' },
    select: { l_id: true }
  });
  let nextLId = (maxLedger?.l_id || 0) + 1;

  const totalAmount = parseFloat(sale.total_amount || 10900);
  const paymentAmount = parseFloat(sale.payment || 10900);

  // 1. Customer Debit Entry (Sale Bill)
  const debitEntry = await prisma.ledger.create({
    data: {
      l_id: nextLId++,
      branch_id: sale.branch_id || 1,
      cus_id: cusId,
      opening_balance: 46600,
      debit_amount: totalAmount,
      credit_amount: 0,
      closing_balance: 46600 + totalAmount,
      bill_no: String(saleId),
      trnx_type: 'DEBIT',
      details: 'Sale Bill - BILL - Customer Account (Debit)',
      payments: 0,
      cash_payment: 0,
      bank_payment: 0,
      updated_by: sale.updated_by || null,
      ledger_type: 'Sale',
      created_at: sale.created_at
    }
  });
  console.log('✅ Created Customer Debit Entry for Sale 309:', debitEntry.l_id);

  // 2. Customer Credit Entry (Payment Received)
  const creditEntry = await prisma.ledger.create({
    data: {
      l_id: nextLId++,
      branch_id: sale.branch_id || 1,
      cus_id: cusId,
      opening_balance: 46600 + totalAmount,
      debit_amount: 0,
      credit_amount: paymentAmount,
      closing_balance: 46600,
      bill_no: String(saleId),
      trnx_type: 'CREDIT',
      details: `Payment Received - BILL - Customer Account (Credit) [Cash: ${paymentAmount}]`,
      payments: 0,
      cash_payment: paymentAmount,
      bank_payment: 0,
      updated_by: sale.updated_by || null,
      ledger_type: 'Sale',
      created_at: new Date(new Date(sale.created_at).getTime() + 1000)
    }
  });
  console.log('✅ Created Customer Credit Entry for Sale 309:', creditEntry.l_id);

  // Rebalance customer 537 chronologically
  const allEntries = await prisma.ledger.findMany({
    where: { cus_id: cusId }
  });

  allEntries.sort(compareChronologically);
  console.log(`Rebalancing old cash 1: ${allEntries.length} entries`);

  let currentBalance = parseFloat(allEntries[0].opening_balance || 0);
  const updates = [];

  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];
    const open = currentBalance;
    const debit = parseFloat(entry.debit_amount || 0);
    const credit = parseFloat(entry.credit_amount || 0);
    const close = calculateClosingBalance(open, debit, credit);

    if (entry.opening_balance !== open || entry.closing_balance !== close) {
      updates.push({
        l_id: entry.l_id,
        opening_balance: open,
        closing_balance: close
      });
    }

    currentBalance = close;
  }

  console.log(`Entries needing update for old cash 1: ${updates.length}`);

  for (let i = 0; i < updates.length; i += 50) {
    const chunk = updates.slice(i, i + 50);
    const ids = chunk.map((e) => e.l_id).join(',');
    let openCases = '';
    let closeCases = '';
    for (const e of chunk) {
      openCases  += ` WHEN ${e.l_id} THEN ${e.opening_balance}`;
      closeCases += ` WHEN ${e.l_id} THEN ${e.closing_balance}`;
    }
    await prisma.$executeRawUnsafe(
      `UPDATE ledger SET opening_balance = CASE l_id ${openCases} END, closing_balance = CASE l_id ${closeCases} END WHERE l_id IN (${ids})`
    );
  }

  await prisma.$executeRawUnsafe(
    `UPDATE customers SET cus_balance = ${currentBalance} WHERE cus_id = ${cusId}`
  );

  console.log(`Finished! Final balance for old cash 1: ${currentBalance}`);
}

fixSale309()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    return prisma.$disconnect();
  });

