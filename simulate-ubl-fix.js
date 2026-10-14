const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulateUblRecalculation() {
  const UBL_BANK_ID = 1650;
  const INITIAL_OPENING_BALANCE = 4020885;
  const missingPaymentIds = [181, 457, 1161, 1784, 2090, 2446, 3914, 4100];
  const missingSaleId = 460;

  console.log(`Simulating Ubl bank (ID: ${UBL_BANK_ID}) recalculation with missing entries...`);

  // 1. Fetch current ledger entries
  const currentLedger = await prisma.ledger.findMany({
    where: { cus_id: UBL_BANK_ID },
    orderBy: { created_at: 'asc' },
  });

  // 2. Fetch missing payments
  const missingPayments = await prisma.payment.findMany({
    where: { payment_id: { in: missingPaymentIds } },
  });

  // 3. Fetch missing sale
  const missingSale = await prisma.sale.findUnique({
    where: { sale_id: missingSaleId },
  });

  // 4. Combine all transactions for simulation
  let allTransactions = [];

  // Add existing ledger entries
  currentLedger.forEach(l => {
    allTransactions.push({
      date: l.created_at,
      debit: l.debit_amount,
      credit: l.credit_amount,
      source: 'Existing Ledger',
      ref: l.bill_no || `LID-${l.l_id}`
    });
  });

  // Add missing payments
  missingPayments.forEach(p => {
    // We need to determine if it's a debit or credit for UBL
    // Based on the confirm-missing-details.js output:
    // Some are receiving (debit to bank), some are payments (credit to bank)
    let debit = 0;
    let credit = 0;
    
    if (p.payment_type === 'RECEIVE') {
      debit = Number(p.total_amount);
    } else {
      credit = Number(p.total_amount);
    }

    allTransactions.push({
      date: p.payment_date || p.created_at,
      debit: debit,
      credit: credit,
      source: 'Missing Payment',
      ref: `PAY-${p.payment_id}`
    });
  });

  // Add missing sale
  if (missingSale) {
    allTransactions.push({
      date: missingSale.created_at,
      debit: Number(missingSale.bank_payment),
      credit: 0,
      source: 'Missing Sale',
      ref: `SALE-${missingSale.sale_id}`
    });
  }

  // 5. Sort all transactions by date
  allTransactions.sort((a, b) => new Date(a.date) - new Date(b.date));

  // 6. Run simulation
  let simulatedBalance = INITIAL_OPENING_BALANCE;
  
  console.log(`\nStarting Simulation (Initial: ${INITIAL_OPENING_BALANCE})`);
  
  for (const tx of allTransactions) {
    simulatedBalance = simulatedBalance + tx.debit - tx.credit;
  }

  console.log('\n--- SIMULATION RESULT ---');
  console.log(`Current Database Final Balance: ${currentLedger[currentLedger.length - 1].closing_balance}`);
  console.log(`Simulated Final Balance (Fix):  ${simulatedBalance}`);
  console.log(`Net Change:                     ${simulatedBalance - currentLedger[currentLedger.length - 1].closing_balance}`);

  await prisma.$disconnect();
}

simulateUblRecalculation().catch(e => {
  console.error(e);
  process.exit(1);
});
