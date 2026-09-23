const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function recalculateCashAccount() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  RECALCULATE CASH ACCOUNT LEDGER RUNNING BALANCES');
  console.log('═══════════════════════════════════════════════════════════');

  // 1. Locate Cash Account
  const cashCustomer = await prisma.customer.findFirst({
    where: { cus_name: 'Cash Account' }
  });

  if (!cashCustomer) {
    console.error('❌ Could not find Cash Account in customers table.');
    return;
  }

  const cusId = cashCustomer.cus_id;
  console.log(`✅ Cash Account Found: cus_id = ${cusId}, current balance = ${cashCustomer.cus_balance}`);

  // 2. Fetch all entries ordered chronologically
  const entries = await prisma.ledger.findMany({
    where: { cus_id: cusId },
    orderBy: [
      { created_at: 'asc' },
      { l_id: 'asc' }
    ]
  });

  console.log(`📋 Total entries found: ${entries.length}`);

  if (entries.length === 0) {
    console.log('No entries to recalculate.');
    return;
  }

  // Initial opening balance from the very first entry
  const initialOpening = Number(entries[0].opening_balance);
  console.log(`📌 Starting Opening Balance (from Entry #1, l_id ${entries[0].l_id}): PKR ${initialOpening.toFixed(2)}`);

  // 3. Compute continuous running balances
  let runningBalance = initialOpening;
  let totalDebit = 0;
  let totalCredit = 0;
  let changedEntries = 0;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const prevClosing = runningBalance;
    const debit = Number(entry.debit_amount || 0);
    const credit = Number(entry.credit_amount || 0);
    totalDebit += debit;
    totalCredit += credit;

    const newOpening = prevClosing;
    const newClosing = Math.round((newOpening + debit - credit) * 100) / 100;

    if (Math.abs(Number(entry.opening_balance) - newOpening) > 0.001 ||
        Math.abs(Number(entry.closing_balance) - newClosing) > 0.001) {
      changedEntries++;
    }

    entry.new_opening = newOpening;
    entry.new_closing = newClosing;
    runningBalance = newClosing;
  }

  const finalBalance = runningBalance;
  console.log(`\n📊 Recalculation Results:`);
  console.log(`   • Total Cash In (Debits):   PKR ${totalDebit.toFixed(2)}`);
  console.log(`   • Total Cash Out (Credits): PKR ${totalCredit.toFixed(2)}`);
  console.log(`   • Net Cash Flow:            PKR ${(totalDebit - totalCredit).toFixed(2)}`);
  console.log(`   • Entries needing update:   ${changedEntries} / ${entries.length}`);
  console.log(`   • Current Customer Balance: PKR ${cashCustomer.cus_balance}`);
  console.log(`   • New Correct Balance:      PKR ${finalBalance.toFixed(2)}`);
  console.log(`   • Total Adjustment:         PKR ${(finalBalance - Number(cashCustomer.cus_balance)).toFixed(2)}`);

  // 4. Update the database in batches
  console.log('\n🔄 Writing updated balances to database in batches...');
  const BATCH_SIZE = 100;
  let updatedCount = 0;

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const chunk = entries.slice(i, i + BATCH_SIZE);
    
    // Only update entries whose values actually changed
    const dirty = chunk.filter(e => 
      Math.abs(Number(e.opening_balance) - e.new_opening) > 0.001 ||
      Math.abs(Number(e.closing_balance) - e.new_closing) > 0.001
    );

    if (dirty.length > 0) {
      const ids = dirty.map(e => e.l_id).join(',');
      let openCases = '';
      let closeCases = '';
      for (const e of dirty) {
        openCases  += ` WHEN ${e.l_id} THEN ${e.new_opening}`;
        closeCases += ` WHEN ${e.l_id} THEN ${e.new_closing}`;
      }

      await prisma.$executeRawUnsafe(
        `UPDATE ledger SET
           opening_balance = CASE l_id ${openCases} END,
           closing_balance = CASE l_id ${closeCases} END
         WHERE l_id IN (${ids})`
      );
      updatedCount += dirty.length;
    }

    process.stdout.write(`   Processed: ${Math.min(i + BATCH_SIZE, entries.length)} / ${entries.length} entries...\r`);
  }

  console.log(`\n✅ Database update complete! Total updated ledger rows: ${updatedCount}`);

  // 5. Update customers table
  console.log(`\n🔄 Updating customers table cus_balance for Cash Account...`);
  await prisma.$executeRawUnsafe(
    `UPDATE customers SET cus_balance = ${finalBalance} WHERE cus_id = ${cusId}`
  );
  console.log(`✅ customers table updated: cus_id ${cusId} -> cus_balance = ${finalBalance.toFixed(2)}`);

  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  CASH ACCOUNT RECALCULATION SUCCESSFULLY COMPLETED');
  console.log('═══════════════════════════════════════════════════════════\n');

  await prisma.$disconnect();
}

recalculateCashAccount().catch((err) => {
  console.error('Fatal error during recalculation:', err);
  process.exit(1);
});
