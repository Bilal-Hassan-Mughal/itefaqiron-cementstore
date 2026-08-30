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

async function recalculateCustomerLedger(targetCusId) {
  const cusId = parseInt(targetCusId);
  if (isNaN(cusId)) {
    console.error('❌ Please provide a valid customer ID, e.g. node scripts/recalculate-customer-ledger.js 16');
    process.exit(1);
  }

  console.log(`\n========================================`);
  console.log(`🔄 RECALCULATING LEDGER FOR CUSTOMER ID: ${cusId}`);
  console.log(`========================================\n`);

  const customer = await prisma.customer.findUnique({
    where: { cus_id: cusId },
    include: { customer_category: true }
  });

  if (!customer) {
    console.error(`❌ Customer ID ${cusId} not found in database.`);
    process.exit(1);
  }

  const catTitle = (customer.customer_category?.cus_cat_title || '').toLowerCase();
  const isSupplier = catTitle.includes('supplier') || catTitle.includes('creditor');
  const accountNature = isSupplier ? 'PAYABLE' : 'RECEIVABLE';

  console.log(`👤 Customer Name: "${customer.cus_name}"`);
  console.log(`🏷️  Category: "${customer.customer_category?.cus_cat_title || 'N/A'}" (${accountNature})`);
  console.log(`💰 Current Stored Balance: ${customer.cus_balance}`);

  const rawEntries = await prisma.ledger.findMany({
    where: { cus_id: cusId }
  });

  if (rawEntries.length === 0) {
    console.log(`⚠️ No ledger entries found for customer ${cusId}.`);
    process.exit(0);
  }

  // Sort chronologically
  const sortedEntries = [...rawEntries].sort(compareChronologically);
  console.log(`\nFound ${sortedEntries.length} ledger entries. Recalculating chain balance...\n`);

  let currentBalance = parseFloat(sortedEntries[0].opening_balance || 0);
  console.log(`Initial Opening Balance: ${currentBalance}`);

  const updates = [];

  for (let i = 0; i < sortedEntries.length; i++) {
    const entry = sortedEntries[i];
    const opening = currentBalance;
    const debit = parseFloat(entry.debit_amount || 0);
    const credit = parseFloat(entry.credit_amount || 0);
    const closing = calculateClosingBalance(opening, debit, credit, accountNature);

    updates.push({
      l_id: entry.l_id,
      cus_id: cusId,
      old_opening: entry.opening_balance,
      old_closing: entry.closing_balance,
      new_opening: opening,
      new_closing: closing,
      debit,
      credit,
      bill_no: entry.bill_no,
      details: entry.details,
      created_at: entry.created_at
    });

    currentBalance = closing;
  }

  // Execute database transaction to update all entries and customer balance
  console.log(`Updating ${updates.length} entries in database...`);

  await prisma.$transaction(async (tx) => {
    for (const update of updates) {
      await tx.ledger.update({
        where: { l_id: update.l_id },
        data: {
          opening_balance: update.new_opening,
          closing_balance: update.new_closing
        }
      });
    }

    await tx.customer.update({
      where: { cus_id: cusId },
      data: {
        cus_balance: currentBalance
      }
    });
  }, { timeout: 60000, maxWait: 10000 });

  console.log(`\n========================================`);
  console.log(`✅ RECALCULATION COMPLETED FOR CUSTOMER ID ${cusId}`);
  console.log(`========================================`);
  console.log(`Total Entries Updated: ${updates.length}`);
  console.log(`Original Stored Balance: ${customer.cus_balance}`);
  console.log(`New Corrected Balance:  ${currentBalance}\n`);

  console.log(`Last 5 Entries Log:`);
  const last5 = updates.slice(-5);
  last5.forEach((u, idx) => {
    console.log(` [${updates.length - last5.length + idx + 1}] ID:${u.l_id} | Bill:${u.bill_no} | Debit:${u.debit} | Credit:${u.credit} | Open:${u.new_opening} -> Close:${u.new_closing}`);
  });

  await prisma.$disconnect();
}

const targetId = process.argv[2] || 16;
recalculateCustomerLedger(targetId).catch(async (err) => {
  console.error('❌ Error during recalculation:', err);
  await prisma.$disconnect();
  process.exit(1);
});
