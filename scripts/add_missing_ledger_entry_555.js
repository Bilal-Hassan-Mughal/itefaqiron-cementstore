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

async function addMissingSale555() {
  const saleId = 555;
  const cusId = 22;

  const sale = await prisma.sale.findUnique({
    where: { sale_id: saleId },
    include: { customer: true }
  });

  if (!sale) {
    throw new Error(`Sale ${saleId} not found!`);
  }

  const maxLedger = await prisma.ledger.findFirst({
    orderBy: { l_id: 'desc' },
    select: { l_id: true }
  });
  let nextLId = (maxLedger?.l_id || 0) + 1;

  const totalAmount = parseFloat(sale.total_amount); // 9650
  const discountAmount = parseFloat(sale.discount || 0);

  let billDetails = `Sale Bill - ${sale.bill_type || 'BILL'} - Customer Account (Debit)`;
  if (discountAmount > 0) {
    billDetails += ` [Discount Applied: ${discountAmount}]`;
  }

  // 1. Ensure Customer DEBIT entry exists
  let debitEntry = await prisma.ledger.findFirst({
    where: {
      cus_id: cusId,
      bill_no: saleId.toString(),
      trnx_type: 'DEBIT'
    }
  });

  if (!debitEntry) {
    debitEntry = await prisma.ledger.create({
      data: {
        l_id: nextLId++,
        branch_id: sale.branch_id || 1,
        cus_id: cusId,
        opening_balance: 0,
        debit_amount: totalAmount,
        credit_amount: 0,
        closing_balance: totalAmount,
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
    console.log(`✅ Created Customer Debit Entry: l_id = ${debitEntry.l_id}`);
  } else {
    console.log(`Customer Debit Entry already exists: l_id = ${debitEntry.l_id}`);
  }

  // Recalculate customer 22 balance chain
  console.log(`\nRecalculating Customer ${cusId} (${sale.customer.cus_name})...`);
  const allEntries = await prisma.ledger.findMany({
    where: { cus_id: cusId }
  });

  allEntries.sort(compareChronologically);
  console.log(`Total entries for customer ${cusId}: ${allEntries.length}`);

  // Initial opening balance is from the very first entry (l_id 143: opening_balance 494972)
  let currentRunning = parseFloat(allEntries[0].opening_balance || 494972);
  const updates = [];

  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];
    const op = currentRunning;
    const cl = calculateClosingBalance(op, entry.debit_amount, entry.credit_amount);

    if (Math.abs(Number(entry.opening_balance) - op) > 0.001 || Math.abs(Number(entry.closing_balance) - cl) > 0.001) {
      updates.push({
        l_id: entry.l_id,
        opening_balance: op,
        closing_balance: cl
      });
    }

    currentRunning = cl;
  }

  console.log(`Entries needing update for customer ${cusId}: ${updates.length}`);

  const CHUNK_SIZE = 50;
  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    const whenOpening = chunk.map(u => `WHEN ${u.l_id} THEN ${u.opening_balance}`).join(' ');
    const whenClosing = chunk.map(u => `WHEN ${u.l_id} THEN ${u.closing_balance}`).join(' ');
    const ids = chunk.map(u => u.l_id).join(', ');

    await prisma.$executeRawUnsafe(`
      UPDATE ledger
      SET opening_balance = CASE l_id ${whenOpening} END,
          closing_balance = CASE l_id ${whenClosing} END
      WHERE l_id IN (${ids})
    `);
  }

  await prisma.customer.update({
    where: { cus_id: cusId },
    data: { cus_balance: currentRunning }
  });

  console.log(`\n✅ Finished successfully!`);
  console.log(`Customer ${cusId} final balance: ${currentRunning}`);
}

addMissingSale555()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
