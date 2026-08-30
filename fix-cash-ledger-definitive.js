/**
 * DEFINITIVE FIX: Set explicit debit/credit values for Cash Account entries
 * and recalculate all running balances.
 *
 * This does NOT "swap" — it sets each entry to its CORRECT target value,
 * so it's safe to run multiple times and always produces the same result.
 *
 * Usage:  node fix-cash-ledger-definitive.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DRY_RUN = false;

// ── TARGET VALUES ───────────────────────────────────────────────────────────
// Based on the original (incorrect) values from the database,
// each entry below specifies what it SHOULD be after correction.
//
//   Original: debit=77000, credit=0     → Target: debit=0, credit=77000
//   Original: debit=0,     credit=50000 → Target: debit=50000, credit=0
//   etc.
const TARGET_VALUES = [
  { l_id: 236,  debit_amount: 0,     credit_amount: 77000 },
  { l_id: 2502, debit_amount: 50000, credit_amount: 0     },
  { l_id: 2428, debit_amount: 0,     credit_amount: 70000 },
  { l_id: 1960, debit_amount: 42900, credit_amount: 0     },
  { l_id: 1891, debit_amount: 70500, credit_amount: 0     },
  { l_id: 1868, debit_amount: 1050,  credit_amount: 0     },
  { l_id: 1865, debit_amount: 6100,  credit_amount: 0     },
  { l_id: 1862, debit_amount: 4035,  credit_amount: 0     },
  { l_id: 1859, debit_amount: 1250,  credit_amount: 0     },
  { l_id: 1853, debit_amount: 2860,  credit_amount: 0     },
  { l_id: 1850, debit_amount: 1550,  credit_amount: 0     },
  { l_id: 1847, debit_amount: 4000,  credit_amount: 0     },
  { l_id: 1838, debit_amount: 0,     credit_amount: 18000 },
  { l_id: 1841, debit_amount: 7500,  credit_amount: 0     },
  { l_id: 1830, debit_amount: 1400,  credit_amount: 0     },
];

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DEFINITIVE FIX: SET CORRECT DEBIT/CREDIT VALUES');
  console.log('  & RECALCULATE CASH ACCOUNT BALANCES');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  Mode: ${DRY_RUN ? '🟡 DRY RUN' : '🔴 LIVE'}`);
  console.log('');

  // ── Step 1: Find Cash Account ──────────────────────────────────────────
  const cashCustomer = await prisma.customer.findFirst({
    where: { cus_name: 'Cash Account' },
  });

  if (!cashCustomer) {
    console.error('❌ Could not find "Cash Account". Aborting.');
    return;
  }

  const cashCusId = cashCustomer.cus_id;
  console.log(`✅ Cash Account: cus_id = ${cashCusId}, balance = ${cashCustomer.cus_balance}`);

  // ── Step 2: Fetch ALL Cash Account ledger entries ──────────────────────
  const allEntries = await prisma.ledger.findMany({
    where: { cus_id: cashCusId },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
  });

  console.log(`📋 Total entries: ${allEntries.length}`);

  // ── Step 3: Verify target IDs belong to Cash Account ───────────────────
  const entryMap = new Map(allEntries.map((e) => [e.l_id, e]));
  const targetIds = TARGET_VALUES.map((t) => t.l_id);
  const missing = targetIds.filter((id) => !entryMap.has(id));
  if (missing.length > 0) {
    console.error(`❌ IDs not in Cash Account: ${missing.join(', ')}. Aborting.`);
    return;
  }
  console.log(`✅ All ${TARGET_VALUES.length} target IDs verified.`);

  // ── Step 4: Show BEFORE state of target entries ────────────────────────
  console.log('');
  console.log('BEFORE (current DB state):');
  console.log('┌──────┬──────────────┬──────────────┐');
  console.log('│ l_id │    Debit     │    Credit    │');
  console.log('├──────┼──────────────┼──────────────┤');
  for (const t of TARGET_VALUES) {
    const e = entryMap.get(t.l_id);
    const debitMatch = e.debit_amount === t.debit_amount ? ' ✓' : ' ✗';
    const creditMatch = e.credit_amount === t.credit_amount ? ' ✓' : ' ✗';
    console.log(
      `│ ${String(e.l_id).padStart(4)} │ ${String(e.debit_amount).padStart(10)}${debitMatch} │ ${String(e.credit_amount).padStart(10)}${creditMatch} │`
    );
  }
  console.log('└──────┴──────────────┴──────────────┘');
  console.log('(✓ = already correct, ✗ = needs change)');

  // ── Step 5: Apply target values in memory ──────────────────────────────
  const targetMap = new Map(TARGET_VALUES.map((t) => [t.l_id, t]));
  let changedCount = 0;

  for (const entry of allEntries) {
    const target = targetMap.get(entry.l_id);
    if (target) {
      if (entry.debit_amount !== target.debit_amount || entry.credit_amount !== target.credit_amount) {
        changedCount++;
      }
      entry.debit_amount = target.debit_amount;
      entry.credit_amount = target.credit_amount;
    }
  }

  console.log(`\n📝 ${changedCount} entries need debit/credit changes.`);

  // ── Step 6: Recalculate running balances ───────────────────────────────
  let runningBalance = allEntries.length > 0 ? allEntries[0].opening_balance : 0;

  for (const entry of allEntries) {
    entry.opening_balance = runningBalance;
    entry.closing_balance = runningBalance + entry.debit_amount - entry.credit_amount;
    runningBalance = entry.closing_balance;
  }

  const finalBalance = allEntries.length > 0 ? allEntries[allEntries.length - 1].closing_balance : 0;

  // ── Step 7: Show AFTER state of target entries ─────────────────────────
  console.log('');
  console.log('AFTER (target values):');
  console.log('┌──────┬──────────────┬──────────────┬──────────────┬──────────────┐');
  console.log('│ l_id │  Opening Bal │    Debit     │    Credit    │  Closing Bal │');
  console.log('├──────┼──────────────┼──────────────┼──────────────┼──────────────┤');
  for (const t of TARGET_VALUES) {
    const e = entryMap.get(t.l_id);
    console.log(
      `│ ${String(e.l_id).padStart(4)} │ ${String(e.opening_balance.toFixed(2)).padStart(12)} │ ${String(e.debit_amount.toFixed(2)).padStart(12)} │ ${String(e.credit_amount.toFixed(2)).padStart(12)} │ ${String(e.closing_balance.toFixed(2)).padStart(12)} │`
    );
  }
  console.log('└──────┴──────────────┴──────────────┴──────────────┴──────────────┘');

  console.log(`\n📊 Final balance: ${finalBalance.toFixed(2)} (was: ${cashCustomer.cus_balance})`);

  // ── Step 8: Write to database ──────────────────────────────────────────
  if (DRY_RUN) {
    console.log('\n🟡 DRY RUN — no changes saved.');
    return;
  }

  console.log('\n🔄 Writing to database...');

  const CHUNK_SIZE = 80;
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

  await prisma.$executeRawUnsafe(
    `UPDATE customers SET cus_balance = ${finalBalance} WHERE cus_id = ${cashCusId}`
  );

  console.log(`\n✅ DONE!`);
  console.log(`   • ${changedCount} entries had debit/credit corrected`);
  console.log(`   • ${allEntries.length} entries had balances recalculated`);
  console.log(`   • Cash Account balance: ${finalBalance.toFixed(2)}`);
}

main()
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
