#!/usr/bin/env node

/**
 * Complete Database Wipe Script
 * Deletes ALL data from ALL tables in the correct order
 * Lists every data entry deleted
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Check for --force flag
const forceDelete = process.argv.includes('--force');

async function getAllDataCounts() {
  try {
    const counts = {};

    // List of all models in the schema
    const models = [
      'stockTransferDetail',
      'saleReturnDetail',
      'purchaseReturnDetail',
      'saleDetail',
      'purchaseDetail',
      'holdBillDetail',
      'journalDetail',
      'dayEndDetail',
      'splitPayment',
      'ledger',
      'expense',
      'saleReturn',
      'purchaseReturn',
      'sale',
      'purchase',
      'holdBill',
      'journal',
      'dayEnd',
      'stockTransfer',
      'draftSale',
      'subscription',
      'storeStock',
      'product',
      'subCategory',
      'categories',
      'customer',
      'customerCategory',
      'customerType',
      'city',
      'expenseTitle',
      'vehicle',
      'loader',
      'cargo',
      'package',
      'store',
      'users'
    ];

    for (const model of models) {
      try {
        counts[`${model}Count`] = await prisma[model].count();
        counts[`has${model.charAt(0).toUpperCase() + model.slice(1)}`] = true;
      } catch (e) {
        counts[`has${model.charAt(0).toUpperCase() + model.slice(1)}`] = false;
      }
    }

    return counts;
  } catch (error) {
    console.error('Error getting counts:', error.message);
    return null;
  }
}

async function deleteAllData() {
  try {
    console.log('\n🔄 Starting complete database wipe...\n');

    const initialCounts = await getAllDataCounts();

    if (initialCounts) {
      console.log('📊 Current database records:');
      const models = [
        'stockTransferDetail', 'saleReturnDetail', 'purchaseReturnDetail', 'saleDetail',
        'purchaseDetail', 'holdBillDetail', 'journalDetail', 'dayEndDetail', 'splitPayment',
        'ledger', 'expense', 'saleReturn', 'purchaseReturn', 'sale', 'purchase', 'holdBill',
        'journal', 'dayEnd', 'stockTransfer', 'draftSale', 'subscription', 'storeStock',
        'product', 'subCategory', 'categories', 'customer', 'customerCategory', 'customerType',
        'city', 'expenseTitle', 'vehicle', 'loader', 'cargo', 'package', 'store', 'users'
      ];

      for (const model of models) {
        const hasModel = initialCounts[`has${model.charAt(0).toUpperCase() + model.slice(1)}`];
        if (hasModel) {
          const count = initialCounts[`${model}Count`];
          const displayName = model.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          console.log(`   • ${displayName}: ${count}`);
        }
      }
      console.log();
    }

    if (!forceDelete) {
      console.log('⚠️  This will DELETE ALL DATA from the entire database!');
      console.log('⚠️  Run with --force flag to proceed without confirmation');
      console.log('   Example: node delete-all-project-data.js --force\n');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('🗑️  Deleting all data in correct order...\n');

    let totalDeleted = 0;
    const deletedCounts = {};

    // Delete in dependency order (child tables first)

    // Detail tables
    const detailModels = [
      'stockTransferDetail', 'saleReturnDetail', 'purchaseReturnDetail', 'saleDetail',
      'purchaseDetail', 'holdBillDetail', 'journalDetail', 'dayEndDetail'
    ];

    for (const model of detailModels) {
      const hasModel = initialCounts[`has${model.charAt(0).toUpperCase() + model.slice(1)}`];
      if (hasModel) {
        try {
          const deleted = await prisma[model].deleteMany({});
          const displayName = model.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          console.log(`✅ Deleted ${deleted.count} ${displayName.toLowerCase()}`);
          deletedCounts[model] = deleted.count;
          totalDeleted += deleted.count;
        } catch (e) {
          console.log(`⚠️  Could not delete ${model}: ${e.message}`);
        }
      }
    }

    // Transaction tables
    const transactionModels = ['splitPayment', 'ledger', 'expense', 'saleReturn', 'purchaseReturn', 'sale', 'purchase', 'holdBill', 'journal', 'dayEnd', 'stockTransfer'];

    for (const model of transactionModels) {
      const hasModel = initialCounts[`has${model.charAt(0).toUpperCase() + model.slice(1)}`];
      if (hasModel) {
        try {
          const deleted = await prisma[model].deleteMany({});
          const displayName = model.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          console.log(`✅ Deleted ${deleted.count} ${displayName.toLowerCase()}`);
          deletedCounts[model] = deleted.count;
          totalDeleted += deleted.count;
        } catch (e) {
          console.log(`⚠️  Could not delete ${model}: ${e.message}`);
        }
      }
    }

    // Other data tables
    const otherModels = ['draftSale', 'subscription', 'storeStock'];

    for (const model of otherModels) {
      const hasModel = initialCounts[`has${model.charAt(0).toUpperCase() + model.slice(1)}`];
      if (hasModel) {
        try {
          const deleted = await prisma[model].deleteMany({});
          const displayName = model.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          console.log(`✅ Deleted ${deleted.count} ${displayName.toLowerCase()}`);
          deletedCounts[model] = deleted.count;
          totalDeleted += deleted.count;
        } catch (e) {
          console.log(`⚠️  Could not delete ${model}: ${e.message}`);
        }
      }
    }

    // Master data tables
    const masterModels = ['product', 'subCategory', 'categories', 'customer', 'customerCategory', 'customerType', 'city', 'expenseTitle', 'vehicle', 'loader', 'cargo', 'package', 'store'];

    for (const model of masterModels) {
      const hasModel = initialCounts[`has${model.charAt(0).toUpperCase() + model.slice(1)}`];
      if (hasModel) {
        try {
          const deleted = await prisma[model].deleteMany({});
          const displayName = model.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
          console.log(`✅ Deleted ${deleted.count} ${displayName.toLowerCase()}`);
          deletedCounts[model] = deleted.count;
          totalDeleted += deleted.count;
        } catch (e) {
          console.log(`⚠️  Could not delete ${model}: ${e.message}`);
        }
      }
    }

    // Users last
    if (initialCounts.hasUsers) {
      try {
        const deleted = await prisma.users.deleteMany({});
        console.log(`✅ Deleted ${deleted.count} users`);
        deletedCounts.users = deleted.count;
        totalDeleted += deleted.count;
      } catch (e) {
        console.log(`⚠️  Could not delete users: ${e.message}`);
      }
    }

    console.log(`\n📊 Total records deleted: ${totalDeleted}\n`);

    // Detailed summary
    console.log('📋 Detailed deletion summary:');
    for (const [model, count] of Object.entries(deletedCounts)) {
      const displayName = model.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
      console.log(`   • ${displayName}: ${count} records deleted`);
    }
    console.log();

    // Verify deletion
    console.log('📋 Verifying complete wipe...');
    const finalCounts = await getAllDataCounts();

    if (finalCounts) {
      let allZero = true;
      const models = [
        'stockTransferDetail', 'saleReturnDetail', 'purchaseReturnDetail', 'saleDetail',
        'purchaseDetail', 'holdBillDetail', 'journalDetail', 'dayEndDetail', 'splitPayment',
        'ledger', 'expense', 'saleReturn', 'purchaseReturn', 'sale', 'purchase', 'holdBill',
        'journal', 'dayEnd', 'stockTransfer', 'draftSale', 'subscription', 'storeStock',
        'product', 'subCategory', 'categories', 'customer', 'customerCategory', 'customerType',
        'city', 'expenseTitle', 'vehicle', 'loader', 'cargo', 'package', 'store', 'users'
      ];

      for (const model of models) {
        const hasModel = finalCounts[`has${model.charAt(0).toUpperCase() + model.slice(1)}`];
        if (hasModel) {
          const count = finalCounts[`${model}Count`];
          if (count > 0) {
            allZero = false;
            const displayName = model.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
            console.log(`   ⚠️  ${displayName}: ${count} records still exist`);
          }
        }
      }

      if (allZero) {
        console.log('\n✅ Complete database wipe successful! All data deleted.\n');
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
console.log('║         COMPLETE DATABASE WIPE SCRIPT              ║');
console.log('║     DELETES ALL DATA FROM ALL TABLES               ║');
console.log('╚════════════════════════════════════════════════════╝');

deleteAllData();