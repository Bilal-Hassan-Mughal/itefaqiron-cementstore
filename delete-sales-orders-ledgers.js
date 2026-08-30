#!/usr/bin/env node

/**
 * delete-sales-orders-ledgers.js
 * -------------------------------
 * Database cleanup script that deletes Sales, Orders, Ledgers, Payments, Returns, and related records
 * and resets all customer balances to 0.
 * 
 * Usage: node delete-sales-orders-ledgers.js --force
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const forceDelete = process.argv.includes('--force');

async function getCounts() {
  const c = {};

  try { c.saleDetail = await prisma.saleDetail.count(); c.hasSaleDetail = true; } catch { c.hasSaleDetail = false; }
  try { c.splitPayment = await prisma.splitPayment.count(); c.hasSplitPayment = true; } catch { c.hasSplitPayment = false; }
  try { c.sale = await prisma.sale.count(); c.hasSale = true; } catch { c.hasSale = false; }

  try { c.saleReturnDetail = await prisma.saleReturnDetail.count(); c.hasSaleReturnDetail = true; } catch { c.hasSaleReturnDetail = false; }
  try { c.saleReturn = await prisma.saleReturn.count(); c.hasSaleReturn = true; } catch { c.hasSaleReturn = false; }

  try { c.ledger = await prisma.ledger.count(); c.hasLedger = true; } catch { c.hasLedger = false; }

  try { c.paymentDetail = await prisma.paymentDetail.count(); c.hasPaymentDetail = true; } catch { c.hasPaymentDetail = false; }
  try { c.payment = await prisma.payment.count(); c.hasPayment = true; } catch { c.hasPayment = false; }

  try { c.customersWithBalance = await prisma.customer.count({ where: { cus_balance: { not: 0 } } }); } catch { c.customersWithBalance = 0; }

  return c;
}

async function executeCleanup() {
  console.log('\n🔍 Gathering record counts...\n');
  const counts = await getCounts();

  console.log('📊 Current Database Status:');
  if (counts.hasSaleDetail) console.log(`  • Sale Details:       ${counts.saleDetail}`);
  if (counts.hasSplitPayment) console.log(`  • Split Payments:     ${counts.splitPayment}`);
  if (counts.hasSale) console.log(`  • Sales / Orders:     ${counts.sale}`);
  if (counts.hasSaleReturnDetail) console.log(`  • Sale Return Details:${counts.saleReturnDetail}`);
  if (counts.hasSaleReturn) console.log(`  • Sale Returns:       ${counts.saleReturn}`);
  if (counts.hasLedger) console.log(`  • Ledger Entries:     ${counts.ledger}`);
  if (counts.hasPaymentDetail) console.log(`  • Payment Details:    ${counts.paymentDetail}`);
  if (counts.hasPayment) console.log(`  • Payments:           ${counts.payment}`);
  console.log(`  • Customers with non-zero balance: ${counts.customersWithBalance}`);

  if (!forceDelete) {
    console.log('\n⚠️  DRY RUN: No records were deleted.');
    console.log('   To actually delete the data and reset balances, run with --force:');
    console.log('   node delete-sales-orders-ledgers.js --force\n');
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log('\n🗑️  Deleting records (respecting FK order)...\n');
  let total = 0;

  // 1. Delete Sale Return Details & Sale Returns
  if (counts.hasSaleReturnDetail) {
    const res = await prisma.saleReturnDetail.deleteMany({});
    console.log(`✅ Deleted ${res.count} sale return details`);
    total += res.count;
  }
  if (counts.hasSaleReturn) {
    const res = await prisma.saleReturn.deleteMany({});
    console.log(`✅ Deleted ${res.count} sale returns`);
    total += res.count;
  }

  // 2. Delete Sale Details & Split Payments
  if (counts.hasSaleDetail) {
    const res = await prisma.saleDetail.deleteMany({});
    console.log(`✅ Deleted ${res.count} sale details`);
    total += res.count;
  }
  if (counts.hasSplitPayment) {
    const res = await prisma.splitPayment.deleteMany({});
    console.log(`✅ Deleted ${res.count} split payments`);
    total += res.count;
  }

  // 3. Delete Sales and Orders (both reside in Sale table)
  if (counts.hasSale) {
    const res = await prisma.sale.deleteMany({});
    console.log(`✅ Deleted ${res.count} sales/orders`);
    total += res.count;
  }

  // 4. Delete Payment Details and Payments
  if (counts.hasPaymentDetail) {
    const res = await prisma.paymentDetail.deleteMany({});
    console.log(`✅ Deleted ${res.count} payment details`);
    total += res.count;
  }
  if (counts.hasPayment) {
    const res = await prisma.payment.deleteMany({});
    console.log(`✅ Deleted ${res.count} payments`);
    total += res.count;
  }

  // 5. Delete Ledger Entries
  if (counts.hasLedger) {
    const res = await prisma.ledger.deleteMany({});
    console.log(`✅ Deleted ${res.count} ledger entries`);
    total += res.count;
  }

  // 6. Reset all customer balances to 0
  const balanceRes = await prisma.customer.updateMany({
    where: { cus_balance: { not: 0 } },
    data: { cus_balance: 0 }
  });
  console.log(`✅ Reset ${balanceRes.count} customer balances to 0`);

  console.log(`\n📊 Total deleted records: ${total}\n`);

  // Quick verification
  console.log('📋 Verifying deletion...');
  const after = await getCounts();
  const remaining = [];
  if (after.hasSale && after.sale > 0) remaining.push(`sales/orders:${after.sale}`);
  if (after.hasSaleDetail && after.saleDetail > 0) remaining.push(`saleDetails:${after.saleDetail}`);
  if (after.hasSplitPayment && after.splitPayment > 0) remaining.push(`splitPayments:${after.splitPayment}`);
  if (after.hasSaleReturn && after.saleReturn > 0) remaining.push(`saleReturns:${after.saleReturn}`);
  if (after.hasSaleReturnDetail && after.saleReturnDetail > 0) remaining.push(`saleReturnDetails:${after.saleReturnDetail}`);
  if (after.hasLedger && after.ledger > 0) remaining.push(`ledger:${after.ledger}`);
  if (after.hasPayment && after.payment > 0) remaining.push(`payments:${after.payment}`);
  if (after.hasPaymentDetail && after.paymentDetail > 0) remaining.push(`paymentDetails:${after.paymentDetail}`);
  if (after.customersWithBalance > 0) remaining.push(`customersWithBalance:${after.customersWithBalance}`);

  if (remaining.length === 0) {
    console.log('✅ Verification passed — all target models are empty and customer balances are reset.');
  } else {
    console.log('⚠️  Verification found remaining records:', remaining.join(', '));
  }

  await prisma.$disconnect();
  process.exit(0);
}

console.log('\n╔════════════════════════════════════════════════════╗');
console.log('║  DB RESET: Sales, Orders, Ledgers, & Balances      ║');
console.log('╚════════════════════════════════════════════════════╝\n');

executeCleanup().catch(async (err) => {
  console.error('❌ Error:', err.message || err);
  await prisma.$disconnect();
  process.exit(1);
});
