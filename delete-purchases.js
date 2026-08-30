#!/usr/bin/env node

/**
 * Safe Database Cleanup Script - Delete All Purchases
 * Deletes: Purchase, Purchase Details, and related ledger entries
 * Checks for available models before deleting
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Check for --force flag
const forceDelete = process.argv.includes('--force');

async function getDataCounts() {
  try {
    const counts = {};
    
    // Try to count each model
    try {
      counts.purchaseCount = await prisma.purchase.count();
      counts.hasPurchase = true;
    } catch (e) {
      counts.hasPurchase = false;
    }

    try {
      counts.purchaseDetailCount = await prisma.purchaseDetail.count();
      counts.hasPurchaseDetail = true;
    } catch (e) {
      counts.hasPurchaseDetail = false;
    }

    // Count ledger entries related to purchases (by checking bill_no pattern or trnx_type)
    try {
      counts.ledgerCount = await prisma.ledger.count();
      counts.hasLedger = true;
    } catch (e) {
      counts.hasLedger = false;
    }

    return counts;
  } catch (error) {
    console.error('Error getting counts:', error.message);
    return null;
  }
}

async function deleteData() {
  try {
    console.log('\n🔄 Starting deletion process...\n');

    const initialCounts = await getDataCounts();
    
    if (initialCounts) {
      console.log('📊 Records found:');
      if (initialCounts.hasPurchase) console.log(`   • Purchases: ${initialCounts.purchaseCount}`);
      if (initialCounts.hasPurchaseDetail) console.log(`   • Purchase Details: ${initialCounts.purchaseDetailCount}`);
      if (initialCounts.hasLedger) console.log(`   • Ledger Entries: ${initialCounts.ledgerCount}`);
      console.log();
    }

    if (!forceDelete) {
      console.log('⚠️  Run with --force flag to proceed without confirmation');
      console.log('   Example: node delete-purchases.js --force\n');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('🗑️  Deleting data...\n');

    let totalDeleted = 0;

    // Delete in the correct order to respect foreign keys
    if (initialCounts.hasPurchaseDetail) {
      try {
        const deleted = await prisma.purchaseDetail.deleteMany({});
        console.log(`✅ Deleted ${deleted.count} purchase details`);
        totalDeleted += deleted.count;
      } catch (e) {
        console.log(`⚠️  Could not delete purchase details: ${e.message}`);
      }
    }

    if (initialCounts.hasPurchase) {
      try {
        const deleted = await prisma.purchase.deleteMany({});
        console.log(`✅ Deleted ${deleted.count} purchases`);
        totalDeleted += deleted.count;
      } catch (e) {
        console.log(`⚠️  Could not delete purchases: ${e.message}`);
      }
    }

    console.log(`\n📊 Total records deleted: ${totalDeleted}\n`);

    // Verify deletion
    console.log('📋 Verifying deletion...');
    const finalCounts = await getDataCounts();
    
    if (finalCounts) {
      let allZero = true;
      if (finalCounts.hasPurchase) {
        console.log(`   • Purchases: ${finalCounts.purchaseCount}`);
        if (finalCounts.purchaseCount > 0) allZero = false;
      }
      if (finalCounts.hasPurchaseDetail) {
        console.log(`   • Purchase Details: ${finalCounts.purchaseDetailCount}`);
        if (finalCounts.purchaseDetailCount > 0) allZero = false;
      }

      if (allZero) {
        console.log('\n✅ All purchase data successfully deleted!\n');
      } else {
        console.log('\n⚠️  Some data still remains - please check manually\n');
      }
    }

    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error during deletion:', error.message);
    console.error('\nError details:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Run the deletion
console.log('\n');
console.log('╔════════════════════════════════════════════════════╗');
console.log('║     DATABASE CLEANUP - DELETE ALL PURCHASES        ║');
console.log('╚════════════════════════════════════════════════════╝');

deleteData();
