#!/usr/bin/env node

/**
 * Safe Database Cleanup Script
 * Deletes: Orders, Ledger Entries, Sales, and related data
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
      counts.orderCount = await prisma.order.count();
      counts.hasOrder = true;
    } catch (e) {
      counts.hasOrder = false;
    }

    try {
      counts.orderDetailCount = await prisma.orderDetail.count();
      counts.hasOrderDetail = true;
    } catch (e) {
      counts.hasOrderDetail = false;
    }

    try {
      counts.saleCount = await prisma.sale.count();
      counts.hasSale = true;
    } catch (e) {
      counts.hasSale = false;
    }

    try {
      counts.saleDetailCount = await prisma.saleDetail.count();
      counts.hasSaleDetail = true;
    } catch (e) {
      counts.hasSaleDetail = false;
    }

    try {
      counts.ledgerCount = await prisma.ledger.count();
      counts.hasLedger = true;
    } catch (e) {
      counts.hasLedger = false;
    }

    try {
      counts.splitPaymentCount = await prisma.splitPayment.count();
      counts.hasSplitPayment = true;
    } catch (e) {
      counts.hasSplitPayment = false;
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
      if (initialCounts.hasOrder) console.log(`   • Orders: ${initialCounts.orderCount}`);
      if (initialCounts.hasOrderDetail) console.log(`   • Order Details: ${initialCounts.orderDetailCount}`);
      if (initialCounts.hasSale) console.log(`   • Sales: ${initialCounts.saleCount}`);
      if (initialCounts.hasSaleDetail) console.log(`   • Sale Details: ${initialCounts.saleDetailCount}`);
      if (initialCounts.hasSplitPayment) console.log(`   • Split Payments: ${initialCounts.splitPaymentCount}`);
      if (initialCounts.hasLedger) console.log(`   • Ledger Entries: ${initialCounts.ledgerCount}`);
      console.log();
    }

    if (!forceDelete) {
      console.log('⚠️  Run with --force flag to proceed without confirmation');
      console.log('   Example: node delete-all-data.js --force\n');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('🗑️  Deleting data...\n');

    let totalDeleted = 0;

    // Delete in the correct order to respect foreign keys
    if (initialCounts.hasOrderDetail) {
      try {
        const deleted = await prisma.orderDetail.deleteMany({});
        console.log(`✅ Deleted ${deleted.count} order details`);
        totalDeleted += deleted.count;
      } catch (e) {
        console.log(`⚠️  Could not delete order details: ${e.message}`);
      }
    }

    if (initialCounts.hasOrder) {
      try {
        const deleted = await prisma.order.deleteMany({});
        console.log(`✅ Deleted ${deleted.count} orders`);
        totalDeleted += deleted.count;
      } catch (e) {
        console.log(`⚠️  Could not delete orders: ${e.message}`);
      }
    }

    if (initialCounts.hasSaleDetail) {
      try {
        const deleted = await prisma.saleDetail.deleteMany({});
        console.log(`✅ Deleted ${deleted.count} sale details`);
        totalDeleted += deleted.count;
      } catch (e) {
        console.log(`⚠️  Could not delete sale details: ${e.message}`);
      }
    }

    if (initialCounts.hasSplitPayment) {
      try {
        const deleted = await prisma.splitPayment.deleteMany({});
        console.log(`✅ Deleted ${deleted.count} split payments`);
        totalDeleted += deleted.count;
      } catch (e) {
        console.log(`⚠️  Could not delete split payments: ${e.message}`);
      }
    }

    if (initialCounts.hasSale) {
      try {
        const deleted = await prisma.sale.deleteMany({});
        console.log(`✅ Deleted ${deleted.count} sales`);
        totalDeleted += deleted.count;
      } catch (e) {
        console.log(`⚠️  Could not delete sales: ${e.message}`);
      }
    }

    if (initialCounts.hasLedger) {
      try {
        const deleted = await prisma.ledger.deleteMany({});
        console.log(`✅ Deleted ${deleted.count} ledger entries`);
        totalDeleted += deleted.count;
      } catch (e) {
        console.log(`⚠️  Could not delete ledger entries: ${e.message}`);
      }
    }

    console.log(`\n📊 Total records deleted: ${totalDeleted}\n`);

    // Verify deletion
    console.log('📋 Verifying deletion...');
    const finalCounts = await getDataCounts();
    
    if (finalCounts) {
      let allZero = true;
      if (finalCounts.hasOrder) {
        console.log(`   • Orders: ${finalCounts.orderCount}`);
        if (finalCounts.orderCount > 0) allZero = false;
      }
      if (finalCounts.hasOrderDetail) {
        console.log(`   • Order Details: ${finalCounts.orderDetailCount}`);
        if (finalCounts.orderDetailCount > 0) allZero = false;
      }
      if (finalCounts.hasSale) {
        console.log(`   • Sales: ${finalCounts.saleCount}`);
        if (finalCounts.saleCount > 0) allZero = false;
      }
      if (finalCounts.hasSaleDetail) {
        console.log(`   • Sale Details: ${finalCounts.saleDetailCount}`);
        if (finalCounts.saleDetailCount > 0) allZero = false;
      }
      if (finalCounts.hasSplitPayment) {
        console.log(`   • Split Payments: ${finalCounts.splitPaymentCount}`);
        if (finalCounts.splitPaymentCount > 0) allZero = false;
      }
      if (finalCounts.hasLedger) {
        console.log(`   • Ledger Entries: ${finalCounts.ledgerCount}`);
        if (finalCounts.ledgerCount > 0) allZero = false;
      }

      if (allZero) {
        console.log('\n✅ All data successfully deleted!\n');
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
console.log('║        DATABASE CLEANUP - SAFE VERSION             ║');
console.log('║   (Orders, Sales, Ledgers, Split Payments)         ║');
console.log('╚════════════════════════════════════════════════════╝');

deleteData();
