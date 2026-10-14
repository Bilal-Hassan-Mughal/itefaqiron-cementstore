const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditLedger() {
  console.log('Starting Ledger Audit...');
  const customers = await prisma.customer.findMany({
    select: {
      cus_id: true,
      cus_name: true,
    },
  });

  const report = [];

  for (const customer of customers) {
    console.log(`Auditing Customer: ${customer.cus_name} (ID: ${customer.cus_id})...`);
    const ledgerEntries = await prisma.ledger.findMany({
      where: { cus_id: customer.cus_id },
      orderBy: { l_id: 'asc' },
    });

    if (ledgerEntries.length === 0) continue;

    let previousClosingBalance = 0;

    for (let i = 0; i < ledgerEntries.length; i++) {
      const entry = ledgerEntries[i];
      const { l_id, opening_balance, debit_amount, credit_amount, closing_balance } = entry;

      // 1. Check if opening balance matches previous closing balance
      if (Math.abs(opening_balance - previousClosingBalance) > 0.01) {
        report.push({
          cus_id: customer.cus_id,
          cus_name: customer.cus_name,
          l_id: l_id,
          error: 'Opening balance mismatch',
          expected: previousClosingBalance,
          actual: opening_balance,
          diff: opening_balance - previousClosingBalance,
        });
      }

      // 2. Check if closing balance is correctly calculated: OB + Debit - Credit
      const calculatedClosing = opening_balance + debit_amount - credit_amount;
      if (Math.abs(closing_balance - calculatedClosing) > 0.01) {
        report.push({
          cus_id: customer.cus_id,
          cus_name: customer.cus_name,
          l_id: l_id,
          error: 'Closing balance math error',
          expected: calculatedClosing,
          actual: closing_balance,
          diff: closing_balance - calculatedClosing,
        });
      }

      previousClosingBalance = closing_balance;
    }
  }

  if (report.length === 0) {
    console.log('Audit complete. No gaps or math errors found in any account ledger.');
  } else {
    console.log(`Audit complete. Found ${report.length} discrepancies.`);
    console.log('--- DETAILED DISCREPANCY REPORT ---');
    console.table(report);
    
    // Also save to a file for easier viewing if it's long
    const fs = require('fs');
    fs.writeFileSync('ledger-audit-report.json', JSON.stringify(report, null, 2));
    console.log('Full report saved to ledger-audit-report.json');
  }

  await prisma.$disconnect();
}

auditLedger().catch((e) => {
  console.error(e);
  process.exit(1);
});
