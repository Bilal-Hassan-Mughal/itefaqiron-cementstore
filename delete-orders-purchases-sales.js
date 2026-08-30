#!/usr/bin/env node

/**
 * delete-orders-purchases-sales.js
 * -------------------------------
 * Safe cleanup script that deletes Orders, Purchases, Sales and related child records
 * Usage: node delete-orders-purchases-sales.js --force
 * The script is intentionally conservative: it lists counts first and requires --force.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const forceDelete = process.argv.includes('--force');

async function getCounts() {
  const c = {};

  try { c.orderDetail = await prisma.orderDetail.count(); c.hasOrderDetail = true; } catch { c.hasOrderDetail = false; }
  try { c.order = await prisma.order.count(); c.hasOrder = true; } catch { c.hasOrder = false; }

  try { c.purchaseDetail = await prisma.purchaseDetail.count(); c.hasPurchaseDetail = true; } catch { c.hasPurchaseDetail = false; }
  try { c.purchase = await prisma.purchase.count(); c.hasPurchase = true; } catch { c.hasPurchase = false; }

  try { c.saleDetail = await prisma.saleDetail.count(); c.hasSaleDetail = true; } catch { c.hasSaleDetail = false; }
  try { c.splitPayment = await prisma.splitPayment.count(); c.hasSplitPayment = true; } catch { c.hasSplitPayment = false; }
  try { c.sale = await prisma.sale.count(); c.hasSale = true; } catch { c.hasSale = false; }

  try { c.ledger = await prisma.ledger.count(); c.hasLedger = true; } catch { c.hasLedger = false; }

  try { c.customersWithBalance = await prisma.customer.count({ where: { cus_balance: { not: 0 } } }); } catch { c.customersWithBalance = 0; }

  return c;
}

async function deleteAll() {
  console.log('\n🔍 Gathering record counts...\n');
  const counts = await getCounts();

  console.log('📊 Found:');
  if (counts.hasOrderDetail) console.log(`  • Order details:    ${counts.orderDetail}`);
  if (counts.hasOrder) console.log(`  • Orders:           ${counts.order}`);
  if (counts.hasPurchaseDetail) console.log(`  • Purchase details: ${counts.purchaseDetail}`);
  if (counts.hasPurchase) console.log(`  • Purchases:        ${counts.purchase}`);
  if (counts.hasSaleDetail) console.log(`  • Sale details:     ${counts.saleDetail}`);
  if (counts.hasSplitPayment) console.log(`  • Split payments:   ${counts.splitPayment}`);
  if (counts.hasSale) console.log(`  • Sales:            ${counts.sale}`);
  if (counts.hasLedger) console.log(`  • Ledger entries:   ${counts.ledger}`);
  console.log(`  • Customers with non-zero balance: ${counts.customersWithBalance}`);

  if (!forceDelete) {
    console.log('\n⚠️  Script requires --force to actually delete.');
    console.log('   Example: node delete-orders-purchases-sales.js --force\n');
    await prisma.$disconnect();
    process.exit(0);
  }

  console.log('\n🗑️  Deleting records (respecting FK order)...\n');
  let total = 0;

  // Orders
  if (counts.hasOrderDetail) {
    const res = await prisma.orderDetail.deleteMany({});
    console.log(`✅ Deleted ${res.count} order details`);
    total += res.count;
  }
  if (counts.hasOrder) {
    const res = await prisma.order.deleteMany({});
    console.log(`✅ Deleted ${res.count} orders`);
    total += res.count;
  }

  // Purchases
  if (counts.hasPurchaseDetail) {
    const res = await prisma.purchaseDetail.deleteMany({});
    console.log(`✅ Deleted ${res.count} purchase details`);
    total += res.count;
  }
  if (counts.hasPurchase) {
    const res = await prisma.purchase.deleteMany({});
    console.log(`✅ Deleted ${res.count} purchases`);
    total += res.count;
  }

  // Sales
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
  if (counts.hasSale) {
    const res = await prisma.sale.deleteMany({});
    console.log(`✅ Deleted ${res.count} sales`);
    total += res.count;
  }

  // Ledger entries (optional cleanup)
  if (counts.hasLedger) {
    const res = await prisma.ledger.deleteMany({});
    console.log(`✅ Deleted ${res.count} ledger entries`);
    total += res.count;
  }

  // Reset all customer balances to 0
  const balanceRes = await prisma.customer.updateMany({ where: { cus_balance: { not: 0 } }, data: { cus_balance: 0 } });
  console.log(`✅ Reset ${balanceRes.count} customer balances to 0`);

  console.log(`\n📊 Total deleted: ${total}\n`);

  // Quick verification
  const after = await getCounts();
  const remaining = [];
  if (after.hasOrder && after.order > 0) remaining.push(`orders:${after.order}`);
  if (after.hasOrderDetail && after.orderDetail > 0) remaining.push(`orderDetails:${after.orderDetail}`);
  if (after.hasPurchase && after.purchase > 0) remaining.push(`purchases:${after.purchase}`);
  if (after.hasPurchaseDetail && after.purchaseDetail > 0) remaining.push(`purchaseDetails:${after.purchaseDetail}`);
  if (after.hasSale && after.sale > 0) remaining.push(`sales:${after.sale}`);
  if (after.hasSaleDetail && after.saleDetail > 0) remaining.push(`saleDetails:${after.saleDetail}`);
  if (after.hasSplitPayment && after.splitPayment > 0) remaining.push(`splitPayments:${after.splitPayment}`);
  if (after.hasLedger && after.ledger > 0) remaining.push(`ledger:${after.ledger}`);

  if (remaining.length === 0) {
    console.log('✅ Verification passed — no remaining records found for target models.');
  } else {
    console.log('⚠️  Verification found remaining records:', remaining.join(', '));
  }

  await prisma.$disconnect();
  process.exit(0);
}

// Run
console.log('\n╔════════════════════════════════════════╗');
console.log('║  DELETE — Orders, Purchases & Sales   ║');
console.log('╚════════════════════════════════════════╝\n');

deleteAll().catch(async (err) => {
  console.error('❌ Error:', err.message || err);
  await prisma.$disconnect();
  process.exit(1);
});
