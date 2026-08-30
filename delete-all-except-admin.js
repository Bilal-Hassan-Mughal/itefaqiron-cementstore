#!/usr/bin/env node

/**
 * Delete All Data Except Admin Users
 * Wipes every table in FK-safe order, but keeps users with role ADMIN or SUPER_ADMIN.
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const forceDelete = process.argv.includes('--force');

async function getCounts() {
  const models = [
    'stockTransferDetail', 'saleReturnDetail', 'purchaseReturnDetail', 'saleDetail',
    'purchaseDetail', 'holdBillDetail', 'journalDetail', 'dayEndDetail',
    'splitPayment', 'ledger', 'expense', 'saleReturn', 'purchaseReturn',
    'sale', 'purchase', 'holdBill', 'journal', 'dayEnd', 'stockTransfer',
    'draftSale', 'subscription', 'storeStock',
    'paymentDetail', 'payment',
    'product', 'subCategory', 'categories', 'customer', 'customerCategory',
    'customerType', 'city', 'expenseTitle', 'vehicle', 'loader', 'cargo',
    'package', 'store', 'users'
  ];

  const counts = {};
  for (const model of models) {
    try {
      counts[model] = await prisma[model].count();
    } catch {
      counts[model] = null;
    }
  }
  return counts;
}

async function run() {
  console.log('\n╔════════════════════════════════════════════════════╗');
  console.log('║     DELETE ALL DATA (KEEP ADMIN USERS)             ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  const initial = await getCounts();

  console.log('📊 Current record counts:');
  for (const [model, count] of Object.entries(initial)) {
    if (count !== null) {
      const label = model.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      console.log(`   • ${label}: ${count}`);
    }
  }

  const adminCount = await prisma.users.count({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } }
  });
  console.log(`\n🔒 Admin users that will be KEPT: ${adminCount}`);

  if (!forceDelete) {
    console.log('\n⚠️  This will DELETE ALL DATA except admin users.');
    console.log('   Run with --force to proceed:');
    console.log('   node delete-all-except-admin.js --force\n');
    await prisma.$disconnect();
    return;
  }

  console.log('\n🗑️  Deleting in FK-safe order...\n');
  let total = 0;

  const groups = [
    // child / detail tables first
    ['stockTransferDetail', 'saleReturnDetail', 'purchaseReturnDetail', 'saleDetail',
     'purchaseDetail', 'holdBillDetail', 'journalDetail', 'dayEndDetail', 'paymentDetail'],
    // transaction tables
    ['splitPayment', 'ledger', 'expense', 'saleReturn', 'purchaseReturn',
     'sale', 'purchase', 'holdBill', 'journal', 'dayEnd', 'stockTransfer', 'payment'],
    // other data
    ['draftSale', 'subscription', 'storeStock'],
    // master data — customer before customerCategory/customerType (FK dependency)
    ['product', 'subCategory', 'categories', 'customer', 'customerCategory',
     'customerType', 'city', 'expenseTitle', 'vehicle', 'loader', 'cargo', 'package', 'store'],
  ];

  for (const group of groups) {
    for (const model of group) {
      if (initial[model] === null) continue;
      try {
        const { count } = await prisma[model].deleteMany({});
        const label = model.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        console.log(`✅ Deleted ${count} ${label.toLowerCase()}`);
        total += count;
      } catch (e) {
        console.log(`⚠️  Could not delete ${model}: ${e.message}`);
      }
    }
  }

  // Delete non-admin users only
  try {
    const { count } = await prisma.users.deleteMany({
      where: { role: { notIn: ['SUPER_ADMIN', 'ADMIN'] } }
    });
    console.log(`✅ Deleted ${count} non-admin users`);
    total += count;
  } catch (e) {
    console.log(`⚠️  Could not delete non-admin users: ${e.message}`);
  }

  console.log(`\n📊 Total records deleted: ${total}`);

  // Verify
  const remaining = await prisma.users.findMany({
    where: { role: { in: ['SUPER_ADMIN', 'ADMIN'] } },
    select: { user_id: true, full_name: true, email: true, role: true }
  });

  console.log(`\n🔒 Admin users retained (${remaining.length}):`);
  for (const u of remaining) {
    console.log(`   • [${u.role}] ${u.full_name} <${u.email}>`);
  }

  console.log('\n✅ Done.\n');
  await prisma.$disconnect();
}

run().catch(async e => {
  console.error('\n❌ Error:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
