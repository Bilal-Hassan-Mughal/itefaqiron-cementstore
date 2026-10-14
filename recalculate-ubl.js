const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function recalculateUbl() {
  const UBL_BANK_ID = 1650;
  const INITIAL_OPENING_BALANCE = 4020885;
  console.log(`Recalculating Ledger for Ubl bank (ID: ${UBL_BANK_ID}) with start balance ${INITIAL_OPENING_BALANCE}...`);

  const ledgerEntries = await prisma.ledger.findMany({
    where: { cus_id: UBL_BANK_ID },
    orderBy: { l_id: 'asc' },
  });

  if (ledgerEntries.length === 0) {
    console.log('No ledger entries found for Ubl bank.');
    await prisma.$disconnect();
    return;
  }

  let runningBalance = INITIAL_OPENING_BALANCE;
  const discrepancies = [];

  console.log('--- RECALCULATION START ---');
  for (let i = 0; i < ledgerEntries.length; i++) {
    const entry = ledgerEntries[i];
    const { l_id, opening_balance, debit_amount, credit_amount, closing_balance } = entry;

    const expectedOpening = runningBalance;
    const expectedClosing = expectedOpening + debit_amount - credit_amount;

    let hasError = false;
    let errorDetails = [];

    if (Math.abs(opening_balance - expectedOpening) > 0.01) {
      hasError = true;
      errorDetails.push(`Opening mismatch (Stored: ${opening_balance}, Expected: ${expectedOpening})`);
    }

    if (Math.abs(closing_balance - expectedClosing) > 0.01) {
      hasError = true;
      errorDetails.push(`Closing math error (Stored: ${closing_balance}, Expected: ${expectedClosing})`);
    }

    if (hasError) {
      discrepancies.push({
        l_id,
        stored_opening: opening_balance,
        expected_opening: expectedOpening,
        debit: debit_amount,
        credit: credit_amount,
        stored_closing: closing_balance,
        expected_closing: expectedClosing,
        errors: errorDetails.join(' | ')
      });
    }

    // Update running balance to the correct calculated value for the next entry
    runningBalance = expectedClosing;
  }

  if (discrepancies.length === 0) {
    console.log('Great! No discrepancies found in Ubl bank ledger.');
  } else {
    console.log(`Found ${discrepancies.length} discrepancies in Ubl bank ledger.`);
    console.table(discrepancies);
    
    // Calculate what the final balance should be vs what it currently is
    const currentStoredBalance = ledgerEntries[ledgerEntries.length - 1].closing_balance;
    console.log('\n--- BALANCE COMPARISON ---');
    console.log(`Current Stored Final Balance: ${currentStoredBalance}`);
    console.log(`Recalculated Final Balance:   ${runningBalance}`);
    console.log(`Total Difference:            ${runningBalance - currentStoredBalance}`);
  }

  await prisma.$disconnect();
}

recalculateUbl().catch((e) => {
  console.error(e);
  process.exit(1);
});
