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

async function addMissingSale562() {
  const saleId = 562;
  const cusId = 876;

  const sale = await prisma.sale.findUnique({
    where: { sale_id: saleId },
    include: { customer: true }
  });

  if (!sale) {
    throw new Error(`Sale ${saleId} not found!`);
  }

  // Check if entry already exists
  const existing = await prisma.ledger.findFirst({
    where: {
      cus_id: cusId,
      bill_no: saleId.toString(),
      trnx_type: 'DEBIT'
    }
  });

  if (existing) {
    console.log(`Ledger entry already exists for sale ${saleId}: l_id=${existing.l_id}`);
    return;
  }

  const maxLedger = await prisma.ledger.findFirst({
    orderBy: { l_id: 'desc' },
    select: { l_id: true }
  });
  const nextLId = (maxLedger?.l_id || 0) + 1;

  const debitAmount = parseFloat(sale.total_amount);
  const discountAmount = parseFloat(sale.discount || 0);
  let billDetails = `Sale Bill - ${sale.bill_type || 'BILL'} - Customer Account (Debit)`;
  if (discountAmount > 0) {
    billDetails += ` [Discount Applied: ${discountAmount}]`;
  }

  const createdEntry = await prisma.ledger.create({
    data: {
      l_id: nextLId,
      branch_id: sale.branch_id || 1,
      cus_id: cusId,
      opening_balance: 0,
      debit_amount: debitAmount,
      credit_amount: 0,
      closing_balance: debitAmount,
      bill_no: sale.sale_id.toString(),
      trnx_type: 'DEBIT',
      details: billDetails,
      payments: 0,
      cash_payment: 0,
      bank_payment: 0,
      updated_by: sale.updated_by || 6,
      ledger_type: 'Sale',
      created_at: sale.created_at
    }
  });

  console.log(`✅ Created ledger entry for Sale ${saleId} (Bill #${sale.bill_number}):`, {
    l_id: createdEntry.l_id,
    bill_no: createdEntry.bill_no,
    debit: createdEntry.debit_amount,
    created_at: createdEntry.created_at
  });

  // Recalculate customer 876 chronological balance chain
  console.log(`\nRecalculating ledger balance chain for customer ${cusId}...`);
  const allEntries = await prisma.ledger.findMany({
    where: { cus_id: cusId }
  });

  allEntries.sort(compareChronologically);
  console.log(`Total entries: ${allEntries.length}`);

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

  console.log(`Entries needing balance update: ${updates.length}`);

  // Bulk update using CASE WHEN chunks
  const CHUNK_SIZE = 50;
  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    const ids = chunk.map((e) => e.l_id).join(',');

    let openCases = '';
    let closeCases = '';
    for (const e of chunk) {
      openCases  += ` WHEN ${e.l_id} THEN ${e.opening_balance}`;
      closeCases += ` WHEN ${e.l_id} THEN ${e.closing_balance}`;
    }

    await prisma.$executeRawUnsafe(
      `UPDATE ledger SET
         opening_balance = CASE l_id ${openCases} END,
         closing_balance = CASE l_id ${closeCases} END
       WHERE l_id IN (${ids})`
    );
    console.log(`Updated chunk ${i + 1} to ${Math.min(i + CHUNK_SIZE, updates.length)}`);
  }

  // Update customer balance in customers table
  await prisma.$executeRawUnsafe(
    `UPDATE customers SET cus_balance = ${currentBalance} WHERE cus_id = ${cusId}`
  );

  console.log(`\n✅ Finished successfully!`);
  console.log(`Customer ${cusId} ("${sale.customer.cus_name}") final balance: ${currentBalance}`);
}

addMissingSale562()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
