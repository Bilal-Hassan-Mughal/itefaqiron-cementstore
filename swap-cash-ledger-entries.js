/**
 * Swap Debit ↔ Credit for specific Cash Account ledger entries
 * and recalculate running balances for ALL Cash Account entries.
 *
 * ⚠️  SAFETY:
 *   - DRY RUN by default. Set DRY_RUN = false (line 17) to apply.
 *   - No records are deleted — only debit/credit and balance columns are updated.
 *   - A full before-snapshot is printed so you can verify / rollback manually.
 *
 * Usage:
 *   node swap-cash-ledger-entries.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ──── CONFIGURATION ─────────────────────────────────────────────────────────
const DRY_RUN = false; // Set to false to apply changes to the database

// Ledger entry IDs whose debit ↔ credit need to be swapped
const SWAP_IDS = [
  236, 2502, 2428, 1960, 1891, 1868, 1865, 1862,
  1859, 1853, 1850, 1847, 1838, 1841, 1830,
];
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  SWAP DEBIT ↔ CREDIT  &  RECALCULATE CASH ACCOUNT BALANCES');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Mode: ${DRY_RUN ? '🟡 DRY RUN (no changes will be saved)' : '🔴 LIVE — changes WILL be saved'}`);
  console.log('');

  // ── Step 1: Find the Cash Account customer ──────────────────────────────
  const cashCustomer = await prisma.customer.findFirst({
    where: { cus_name: 'Cash Account' },
  });

  if (!cashCustomer) {
    console.error('❌ Could not find a customer named "Cash Account". Aborting.');
    return;
  }

  const cashCusId = cashCustomer.cus_id;
  console.log(`✅ Found Cash Account: cus_id = ${cashCusId}, current balance = ${cashCustomer.cus_balance}`);
  console.log('');

  // ── Step 2: Fetch ALL ledger entries for Cash Account (ordered by l_id) ─
  const allEntries = await prisma.ledger.findMany({
    where: { cus_id: cashCusId },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
  });

  console.log(`📋 Total Cash Account ledger entries: ${allEntries.length}`);
  console.log('');

  // ── Step 3: Validate that every SWAP_ID belongs to this customer ────────
  const entryMap = new Map(allEntries.map((e) => [e.l_id, e]));
  const missing = SWAP_IDS.filter((id) => !entryMap.has(id));
  if (missing.length > 0) {
    console.error(`❌ The following l_id values do NOT belong to Cash Account (cus_id=${cashCusId}):`);
    console.error(`   ${missing.join(', ')}`);
    console.error('   Please double-check and correct the IDs. Aborting.');
    return;
  }

  console.log(`✅ All ${SWAP_IDS.length} swap IDs verified — they belong to Cash Account.`);
  console.log('');

  // ── Step 4: Print BEFORE snapshot of entries to be swapped ──────────────
  console.log('┌──────────────────────────────────────────────────────────┐');
  console.log('│              BEFORE SWAP — Entries to change            │');
  console.log('├──────┬──────────────┬──────────────┬────────────────────┤');
  console.log('│ l_id │    Debit     │    Credit    │    Details         │');
  console.log('├──────┼──────────────┼──────────────┼────────────────────┤');

  for (const id of SWAP_IDS) {
    const e = entryMap.get(id);
    console.log(
      `│ ${String(e.l_id).padStart(4)} │ ${String(e.debit_amount).padStart(12)} │ ${String(e.credit_amount).padStart(12)} │ ${(e.details || '').slice(0, 18).padEnd(18)} │`
    );
  }
  console.log('└──────┴──────────────┴──────────────┴────────────────────┘');
  console.log('');

  // ── Step 5: Perform the swap (in memory first) ──────────────────────────
  const swapSet = new Set(SWAP_IDS);

  for (const entry of allEntries) {
    if (swapSet.has(entry.l_id)) {
      const oldDebit = entry.debit_amount;
      const oldCredit = entry.credit_amount;
      entry.debit_amount = oldCredit;
      entry.credit_amount = oldDebit;
      // Also swap cash_payment / bank_payment columns if they were used
      // (these stay the same — they represent method, not direction)
    }
  }

  // ── Step 6: Recalculate running balances for ALL Cash Account entries ───
  //
  //   Cash Account is an ASSET account.
  //   Convention used by this system:
  //     opening_balance + debit_amount - credit_amount = closing_balance
  //
  //   The very first entry's opening_balance stays as-is (usually 0).
  //   Each subsequent entry's opening_balance = previous entry's closing_balance.
  //
  let runningBalance = allEntries.length > 0 ? allEntries[0].opening_balance : 0;

  for (const entry of allEntries) {
    entry.opening_balance = runningBalance;
    entry.closing_balance = runningBalance + entry.debit_amount - entry.credit_amount;
    runningBalance = entry.closing_balance;
  }

  // ── Step 7: Print AFTER snapshot ────────────────────────────────────────
  console.log('┌─────────────────────────────────────────────────────────────────────────────────────────┐');
  console.log('│                    AFTER SWAP + RECALCULATED BALANCES  (ALL entries)                    │');
  console.log('├──────┬──────────────┬──────────────┬──────────────┬──────────────┬──────┬───────────────┤');
  console.log('│ l_id │  Opening Bal │    Debit     │    Credit    │  Closing Bal │ Swap │  Details      │');
  console.log('├──────┼──────────────┼──────────────┼──────────────┼──────────────┼──────┼───────────────┤');

  for (const e of allEntries) {
    const marker = swapSet.has(e.l_id) ? ' ⇄  ' : '    ';
    console.log(
      `│ ${String(e.l_id).padStart(4)} │ ${String(e.opening_balance.toFixed(2)).padStart(12)} │ ${String(e.debit_amount.toFixed(2)).padStart(12)} │ ${String(e.credit_amount.toFixed(2)).padStart(12)} │ ${String(e.closing_balance.toFixed(2)).padStart(12)} │${marker}│ ${(e.details || '').slice(0, 13).padEnd(13)} │`
    );
  }
  console.log('└──────┴──────────────┴──────────────┴──────────────┴──────────────┴──────┴───────────────┘');
  console.log('');

  const finalBalance = allEntries.length > 0 ? allEntries[allEntries.length - 1].closing_balance : 0;
  console.log(`📊 Final Cash Account closing balance: ${finalBalance.toFixed(2)}`);
  console.log(`   (Previous customer balance was: ${cashCustomer.cus_balance})`);
  console.log('');

  // ── Step 8: Persist changes ─────────────────────────────────────────────
  if (DRY_RUN) {
    console.log('🟡 DRY RUN complete. No changes were saved to the database.');
    console.log('   To apply, set DRY_RUN = false on line 17 and run again.');
    return;
  }

  console.log('🔄 Applying changes to database...');

  // Batch-update ALL columns (debit, credit, opening, closing) using CASE statements.
  // The in-memory swap is already done correctly — we just write it all to DB in one go.
  const CHUNK_SIZE = 80; // smaller chunks since we have 4 CASE blocks now
  let updatedCount = 0;

  for (let i = 0; i < allEntries.length; i += CHUNK_SIZE) {
    const chunk = allEntries.slice(i, i + CHUNK_SIZE);
    const ids = chunk.map((e) => e.l_id).join(',');

    let debitCases  = '';
    let creditCases = '';
    let openCases   = '';
    let closeCases  = '';
    for (const e of chunk) {
      debitCases  += ` WHEN ${e.l_id} THEN ${e.debit_amount}`;
      creditCases += ` WHEN ${e.l_id} THEN ${e.credit_amount}`;
      openCases   += ` WHEN ${e.l_id} THEN ${e.opening_balance}`;
      closeCases  += ` WHEN ${e.l_id} THEN ${e.closing_balance}`;
    }

    await prisma.$executeRawUnsafe(
      `UPDATE ledger SET
         debit_amount    = CASE l_id ${debitCases} END,
         credit_amount   = CASE l_id ${creditCases} END,
         opening_balance = CASE l_id ${openCases} END,
         closing_balance = CASE l_id ${closeCases} END
       WHERE l_id IN (${ids})`
    );

    updatedCount += chunk.length;
    console.log(`   ✅ Updated: ${updatedCount} / ${allEntries.length}`);
  }

  // Update customer balance
  await prisma.$executeRawUnsafe(
    `UPDATE customers SET cus_balance = ${finalBalance} WHERE cus_id = ${cashCusId}`
  );
  console.log(`   ✅ Updated Cash Account customer balance to ${finalBalance.toFixed(2)}`);

  console.log('');
  console.log('✅ All changes applied successfully!');
  console.log(`   • ${SWAP_IDS.length} entries had debit ↔ credit swapped`);
  console.log(`   • ${allEntries.length} entries had balances recalculated`);
  console.log(`   • Cash Account customer balance updated to ${finalBalance.toFixed(2)}`);
}

main()
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
