/**
 * Recalculate ALL balances for Cash Account ledger entries.
 * 
 * Logic: opening_balance + debit_amount - credit_amount = closing_balance
 * Each entry's opening = previous entry's closing.
 * First entry starts from its current opening_balance.
 *
 * Usage:  node recalculate-cash-balances.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('  RECALCULATE CASH ACCOUNT BALANCES');
  console.log('═══════════════════════════════════════════════');

  // Find Cash Account
  const cashCustomer = await prisma.customer.findFirst({
    where: { cus_name: 'Cash Account' },
  });

  if (!cashCustomer) {
    console.error('❌ Could not find "Cash Account". Aborting.');
    return;
  }

  console.log(`✅ Cash Account: cus_id = ${cashCustomer.cus_id}, current balance = ${cashCustomer.cus_balance}`);

  // Fetch ALL entries ordered chronologically
  const allEntries = await prisma.ledger.findMany({
    where: { cus_id: cashCustomer.cus_id },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
  });

  console.log(`📋 Total entries: ${allEntries.length}`);

  // Recalculate running balances
  // First entry's opening stays as-is (usually 0 or initial balance)
  let runningBalance = allEntries.length > 0 ? allEntries[0].opening_balance : 0;

  for (const entry of allEntries) {
    entry.opening_balance = runningBalance;
    entry.closing_balance = runningBalance + entry.debit_amount - entry.credit_amount;
    runningBalance = entry.closing_balance;
  }

  const finalBalance = allEntries.length > 0 ? allEntries[allEntries.length - 1].closing_balance : 0;

  // Show last 20 entries
  console.log('\nLast 20 entries after recalculation:');
  console.log('┌──────┬──────────────┬──────────────┬──────────────┬──────────────┬───────────────┐');
  console.log('│ l_id │  Opening Bal │    Debit     │    Credit    │  Closing Bal │  Details      │');
  console.log('├──────┼──────────────┼──────────────┼──────────────┼──────────────┼───────────────┤');
  const last20 = allEntries.slice(-20);
  for (const e of last20) {
    console.log(
      `│ ${String(e.l_id).padStart(4)} │ ${String(e.opening_balance.toFixed(2)).padStart(12)} │ ${String(e.debit_amount.toFixed(2)).padStart(12)} │ ${String(e.credit_amount.toFixed(2)).padStart(12)} │ ${String(e.closing_balance.toFixed(2)).padStart(12)} │ ${(e.details || '').slice(0, 13).padEnd(13)} │`
    );
  }
  console.log('└──────┴──────────────┴──────────────┴──────────────┴──────────────┴───────────────┘');

  console.log(`\n📊 Final balance: ${finalBalance.toFixed(2)} (was: ${cashCustomer.cus_balance})`);

  // Write to database
  console.log('\n🔄 Writing to database...');

  const CHUNK_SIZE = 80;
  let updatedCount = 0;

  for (let i = 0; i < allEntries.length; i += CHUNK_SIZE) {
    const chunk = allEntries.slice(i, i + CHUNK_SIZE);
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

    updatedCount += chunk.length;
    console.log(`   ✅ Updated: ${updatedCount} / ${allEntries.length}`);
  }

  // Update customer balance
  await prisma.$executeRawUnsafe(
    `UPDATE customers SET cus_balance = ${finalBalance} WHERE cus_id = ${cashCustomer.cus_id}`
  );

  console.log(`\n✅ DONE!`);
  console.log(`   • ${allEntries.length} entries had balances recalculated`);
  console.log(`   • Cash Account balance updated: ${cashCustomer.cus_balance} → ${finalBalance.toFixed(2)}`);
}

main()
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
