#!/usr/bin/env node

/**
 * Database Cleanup Script - Delete All Ledger Entries and Orders
 * ⚠️  WARNING: This is a destructive operation - it will delete data permanently
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');

const prisma = new PrismaClient();

// Create readline interface for user confirmation
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function getDataCounts() {
  try {
    const ledgerCount = await prisma.ledger.count();
    const orderCount = await prisma.order.count();
    const orderDetailCount = await prisma.orderDetail.count();
    
    return { ledgerCount, orderCount, orderDetailCount };
  } catch (error) {
    return null;
  }
}

async function deleteData() {
  try {
    console.log('\n🔄 Starting deletion process...\n');

    // Get initial counts
    const initialCounts = await getDataCounts();
    
    if (initialCounts) {
      console.log('📊 Records to be deleted:');
      console.log(`   • Ledger Entries: ${initialCounts.ledgerCount}`);
      console.log(`   • Orders: ${initialCounts.orderCount}`);
      console.log(`   • Order Details: ${initialCounts.orderDetailCount}`);
      console.log();
    }

    // Ask for confirmation
    const confirmDelete = await askQuestion('⚠️  Are you SURE you want to delete ALL ledger entries and orders? (yes/no): ');
    
    if (confirmDelete.toLowerCase() !== 'yes') {
      console.log('\n❌ Operation cancelled - no data was deleted.\n');
      await prisma.$disconnect();
      process.exit(0);
    }

    // Final confirmation
    const finalConfirm = await askQuestion('⚠️  This action CANNOT be undone! Type "DELETE ALL" to confirm: ');
    
    if (finalConfirm !== 'DELETE ALL') {
      console.log('\n❌ Operation cancelled - no data was deleted.\n');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('\n🗑️  Deleting data...\n');

    // Delete in the correct order to respect foreign keys
    // 1. Delete order details first
    const deletedOrderDetails = await prisma.orderDetail.deleteMany({});
    console.log(`✅ Deleted ${deletedOrderDetails.count} order details`);

    // 2. Delete orders
    const deletedOrders = await prisma.order.deleteMany({});
    console.log(`✅ Deleted ${deletedOrders.count} orders`);

    // 3. Delete ledger entries
    const deletedLedgers = await prisma.ledger.deleteMany({});
    console.log(`✅ Deleted ${deletedLedgers.count} ledger entries`);

    console.log('\n✅ All data deleted successfully!\n');

    // Verify deletion
    console.log('📊 Verifying deletion...');
    const finalCounts = await getDataCounts();
    
    if (finalCounts) {
      console.log(`   • Ledger Entries: ${finalCounts.ledgerCount}`);
      console.log(`   • Orders: ${finalCounts.orderCount}`);
      console.log(`   • Order Details: ${finalCounts.orderDetailCount}`);
    }

    console.log('\n🎉 Cleanup completed!\n');
    
    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error during deletion:', error.message);
    console.error('\nError details:', error);
    await prisma.$disconnect();
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the deletion
console.log('\n');
console.log('╔════════════════════════════════════════════════════╗');
console.log('║   DATABASE CLEANUP - DELETE LEDGERS & ORDERS       ║');
console.log('╚════════════════════════════════════════════════════╝');

deleteData();
