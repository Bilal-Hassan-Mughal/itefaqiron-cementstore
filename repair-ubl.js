const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function repairUblLedger() {
  const UBL_BANK_ID = 1650;
  const INITIAL_OPENING_BALANCE = 4020885;
  
  console.log(`Starting REPAIR for Ubl bank (ID: ${UBL_BANK_ID})...`);
  console.log(`Setting initial opening balance to: ${INITIAL_OPENING_BALANCE}`);

  const ledgerEntries = await prisma.ledger.findMany({
    where: { cus_id: UBL_BANK_ID },
    orderBy: { l_id: 'asc' },
  });

  if (ledgerEntries.length === 0) {
    console.log('No ledger entries found to repair.');
    await prisma.$disconnect();
    return;
  }

  let runningBalance = INITIAL_OPENING_BALANCE;
  const updates = [];

  for (let i = 0; i < ledgerEntries.length; i++) {
    const entry = ledgerEntries[i];
    const newOpening = runningBalance;
    const newClosing = newOpening + entry.debit_amount - entry.credit_amount;

    // Only update if there's actually a change to reduce DB load, 
    // but usually in a full recalculation, most will change.
    if (Math.abs(entry.opening_balance - newOpening) > 0.01 || Math.abs(entry.closing_balance - newClosing) > 0.01) {
      updates.push({
        l_id: entry.l_id,
        opening_balance: newOpening,
        closing_balance: newClosing
      });
    }

    runningBalance = newClosing;
  }

  console.log(`Calculated repairs for ${updates.length} out of ${ledgerEntries.length} entries.`);

  if (updates.length > 0) {
    console.log('Applying updates to database...');
    
    // Using a transaction to ensure all or nothing
    await prisma.$transaction(
      updates.map(u => 
        prisma.ledger.update({
          where: { l_id: u.l_id },
          data: {
            opening_balance: u.opening_balance,
            closing_balance: u.closing_balance
          }
        })
      )
    );
    
    console.log('Successfully updated all Ubl bank ledger entries.');
  } else {
    console.log('All entries already match the provided opening balance and math. No updates needed.');
  }

  console.log('\n--- FINAL STATUS ---');
  console.log(`New Final Balance for Ubl bank: ${runningBalance}`);
  
  await prisma.$disconnect();
}

repairUblLedger().catch((e) => {
  console.error('Error during repair:', e);
  process.exit(1);
});
