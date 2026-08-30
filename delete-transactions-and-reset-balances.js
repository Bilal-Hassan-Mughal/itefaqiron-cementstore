#!/usr/bin/env node

/**
 * delete-transactions-and-reset-balances.js
 * -----------------------------------------
 * Database cleanup script that deletes Sales, Orders, Purchases, Ledgers, Payments,
 * Returns, Day-Ends, Journals, and related records, and resets all customer balances to 0.
 * 
 * Usage: node delete-transactions-and-reset-balances.js --force
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const forceDelete = process.argv.includes('--force');

async function getCounts() {
  const c = {};

  const models = [
    'dayEndDetail',
    'dayEnd',
    'journalDetail',
    'journal',
    'purchaseReturnDetail',
    'purchaseReturn',
    'saleReturnDetail',
    'saleReturn',
    'splitPayment',
    'saleDetail',
    'sale',
    'purchaseDetail',
    'purchase',
    'paymentDetail',
    'payment',
    'ledger',
    'holdBillDetail',
    'holdBill',
    'draftSale',
    'subscription'
  ];

  for (const model of models) {
    try {
      c[model] = await prisma[model].count();
      c[`has_${model}`] = true;
    } catch (err) {
      c[model] = 0;
      c[`has_${model}`] = false;
    }
  }

  try {
    c.customersWithBalance = await prisma.customer.count({ where: { cus_balance: { not: 0 } } });
  } catch {
    c.customersWithBalance = 0;
  }

  return c;
}

async function executeCleanup() {
  console.log('\n🔍 Gathering record counts...\n');
  const counts = await getCounts();

  console.log('📊 Current Transaction Counts in Database:');
  const models = [
    'dayEndDetail', 'dayEnd', 'journalDetail', 'journal',
    'purchaseReturnDetail', 'purchaseReturn', 'saleReturnDetail', 'saleReturn',
    'splitPayment', 'saleDetail', 'sale', 'purchaseDetail', 'purchase',
    'paymentDetail', 'payment', 'ledger', 'holdBillDetail', 'holdBill',
    'draftSale', 'subscription'
  ];

  for (const model of models) {
    if (counts[`has_${model}`]) {
      const displayName = model.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`  • ${displayName.padEnd(25)}: ${counts[model]}`);
    }
  }
  console.log(`  • Customers with non-zero balance : ${counts.customersWithBalance}`);

  if (!forceDelete) {
    console.log('\n⚠️  DRY RUN: No records were deleted.');
    console.log('   To delete all transactions and reset customer balances to 0, run with --force:');
    console.log('   node delete-transactions-and-reset-balances.js --force\n');
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log('\n🗑️  Deleting records (respecting FK order)...\n');
  let total = 0;

  // 1. Day-end details & Day-ends
  if (counts.has_dayEndDetail && counts.dayEndDetail > 0) {
    const res = await prisma.dayEndDetail.deleteMany({});
    console.log(`✅ Deleted ${res.count} day end details`);
    total += res.count;
  }
  if (counts.has_dayEnd && counts.dayEnd > 0) {
    const res = await prisma.dayEnd.deleteMany({});
    console.log(`✅ Deleted ${res.count} day ends`);
    total += res.count;
  }

  // 2. Journal details & Journals
  if (counts.has_journalDetail && counts.journalDetail > 0) {
    const res = await prisma.journalDetail.deleteMany({});
    console.log(`✅ Deleted ${res.count} journal details`);
    total += res.count;
  }
  if (counts.has_journal && counts.journal > 0) {
    const res = await prisma.journal.deleteMany({});
    console.log(`✅ Deleted ${res.count} journals`);
    total += res.count;
  }

  // 3. Purchase return details & Purchase returns
  if (counts.has_purchaseReturnDetail && counts.purchaseReturnDetail > 0) {
    const res = await prisma.purchaseReturnDetail.deleteMany({});
    console.log(`✅ Deleted ${res.count} purchase return details`);
    total += res.count;
  }
  if (counts.has_purchaseReturn && counts.purchaseReturn > 0) {
    const res = await prisma.purchaseReturn.deleteMany({});
    console.log(`✅ Deleted ${res.count} purchase returns`);
    total += res.count;
  }

  // 4. Sale return details & Sale returns
  if (counts.has_saleReturnDetail && counts.saleReturnDetail > 0) {
    const res = await prisma.saleReturnDetail.deleteMany({});
    console.log(`✅ Deleted ${res.count} sale return details`);
    total += res.count;
  }
  if (counts.has_saleReturn && counts.saleReturn > 0) {
    const res = await prisma.saleReturn.deleteMany({});
    console.log(`✅ Deleted ${res.count} sale returns`);
    total += res.count;
  }

  // 5. Split payments & Sale details & Sales (Sales & Orders)
  if (counts.has_splitPayment && counts.splitPayment > 0) {
    const res = await prisma.splitPayment.deleteMany({});
    console.log(`✅ Deleted ${res.count} split payments`);
    total += res.count;
  }
  if (counts.has_saleDetail && counts.saleDetail > 0) {
    const res = await prisma.saleDetail.deleteMany({});
    console.log(`✅ Deleted ${res.count} sale details`);
    total += res.count;
  }
  if (counts.has_sale && counts.sale > 0) {
    const res = await prisma.sale.deleteMany({});
    console.log(`✅ Deleted ${res.count} sales/orders`);
    total += res.count;
  }

  // 6. Purchase details & Purchases
  if (counts.has_purchaseDetail && counts.purchaseDetail > 0) {
    const res = await prisma.purchaseDetail.deleteMany({});
    console.log(`✅ Deleted ${res.count} purchase details`);
    total += res.count;
  }
  if (counts.has_purchase && counts.purchase > 0) {
    const res = await prisma.purchase.deleteMany({});
    console.log(`✅ Deleted ${res.count} purchases`);
    total += res.count;
  }

  // 7. Payment details & Payments
  if (counts.has_paymentDetail && counts.paymentDetail > 0) {
    const res = await prisma.paymentDetail.deleteMany({});
    console.log(`✅ Deleted ${res.count} payment details`);
    total += res.count;
  }
  if (counts.has_payment && counts.payment > 0) {
    const res = await prisma.payment.deleteMany({});
    console.log(`✅ Deleted ${res.count} payments`);
    total += res.count;
  }

  // 8. Ledger entries
  if (counts.has_ledger && counts.ledger > 0) {
    const res = await prisma.ledger.deleteMany({});
    console.log(`✅ Deleted ${res.count} ledger entries`);
    total += res.count;
  }

  // 9. Hold bill details & Hold bills & Draft sales
  if (counts.has_holdBillDetail && counts.holdBillDetail > 0) {
    const res = await prisma.holdBillDetail.deleteMany({});
    console.log(`✅ Deleted ${res.count} hold bill details`);
    total += res.count;
  }
  if (counts.has_holdBill && counts.holdBill > 0) {
    const res = await prisma.holdBill.deleteMany({});
    console.log(`✅ Deleted ${res.count} hold bills`);
    total += res.count;
  }
  if (counts.has_draftSale && counts.draftSale > 0) {
    const res = await prisma.draftSale.deleteMany({});
    console.log(`✅ Deleted ${res.count} draft sales`);
    total += res.count;
  }

  // 10. Subscriptions
  if (counts.has_subscription && counts.subscription > 0) {
    const res = await prisma.subscription.deleteMany({});
    console.log(`✅ Deleted ${res.count} subscriptions`);
    total += res.count;
  }

  // 11. Reset all customer balances to 0
  const balanceRes = await prisma.customer.updateMany({
    where: { cus_balance: { not: 0 } },
    data: { cus_balance: 0 }
  });
  console.log(`✅ Reset ${balanceRes.count} customer balances to 0`);

  console.log(`\n📊 Total deleted records: ${total}\n`);

  // Verification
  console.log('📋 Verifying deletion...');
  const after = await getCounts();
  const remaining = [];
  for (const model of models) {
    if (after[`has_${model}`] && after[model] > 0) {
      remaining.push(`${model}:${after[model]}`);
    }
  }
  if (after.customersWithBalance > 0) {
    remaining.push(`customersWithBalance:${after.customersWithBalance}`);
  }

  if (remaining.length === 0) {
    console.log('✅ Verification passed — all transaction tables are completely empty and customer balances are reset.');
  } else {
    console.log('⚠️  Verification warning — some records still remain:', remaining.join(', '));
  }

  await prisma.$disconnect();
  process.exit(0);
}

console.log('\n╔═══════════════════════════════════════════════════════╗');
console.log('║  DB RESET: Sales, Orders, Purchases, Ledgers, & Bal   ║');
console.log('╚═══════════════════════════════════════════════════════╝\n');

executeCleanup().catch(async (err) => {
  console.error('❌ Error:', err.message || err);
  await prisma.$disconnect();
  process.exit(1);
});
