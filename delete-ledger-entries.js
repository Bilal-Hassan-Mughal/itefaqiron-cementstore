/**
 * Delete Ledger Entries - Purchase, Order/Subscription, and Sales
 * Provides options to delete ledger records by transaction type
 */

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');
const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function deletePurchaseLedgers() {
  try {
    console.log('\n📦 Deleting PURCHASE ledger entries...\n');

    const purchaseDeletions = await prisma.ledger.deleteMany({
      where: {
        trnx_type: 'PURCHASE'
      }
    });

    console.log(`✅ Deleted ${purchaseDeletions.count} PURCHASE ledger entries`);

    const purchaseReturnDeletions = await prisma.ledger.deleteMany({
      where: {
        trnx_type: 'PURCHASE_RETURN'
      }
    });

    console.log(`✅ Deleted ${purchaseReturnDeletions.count} PURCHASE_RETURN ledger entries`);

    return purchaseDeletions.count + purchaseReturnDeletions.count;
  } catch (error) {
    console.error('❌ Error deleting purchase ledger entries:', error);
    return 0;
  }
}

async function deleteOrderLedgers() {
  try {
    console.log('\n📋 Deleting ORDER/SUBSCRIPTION ledger entries...\n');

    const subscriptionDeletions = await prisma.ledger.deleteMany({
      where: {
        trnx_type: 'SUBSCRIPTION'
      }
    });

    console.log(`✅ Deleted ${subscriptionDeletions.count} SUBSCRIPTION ledger entries`);

    return subscriptionDeletions.count;
  } catch (error) {
    console.error('❌ Error deleting order ledger entries:', error);
    return 0;
  }
}

async function deleteSalesLedgers() {
  try {
    console.log('\n💰 Deleting SALES ledger entries...\n');

    const saleDeletions = await prisma.ledger.deleteMany({
      where: {
        trnx_type: 'SALE'
      }
    });

    console.log(`✅ Deleted ${saleDeletions.count} SALE ledger entries`);

    const returnDeletions = await prisma.ledger.deleteMany({
      where: {
        trnx_type: 'SALE_RETURN'
      }
    });

    console.log(`✅ Deleted ${returnDeletions.count} SALE_RETURN ledger entries`);

    const cashPaymentDeletions = await prisma.ledger.deleteMany({
      where: {
        trnx_type: 'CASH_PAYMENT'
      }
    });

    console.log(`✅ Deleted ${cashPaymentDeletions.count} CASH_PAYMENT ledger entries`);

    const bankPaymentDeletions = await prisma.ledger.deleteMany({
      where: {
        trnx_type: 'BANK_PAYMENT'
      }
    });

    console.log(`✅ Deleted ${bankPaymentDeletions.count} BANK_PAYMENT ledger entries`);

    return saleDeletions.count + returnDeletions.count + cashPaymentDeletions.count + bankPaymentDeletions.count;
  } catch (error) {
    console.error('❌ Error deleting sales ledger entries:', error);
    return 0;
  }
}

async function deleteAllLedgers() {
  try {
    console.log('\n🗑️ Deleting ALL ledger entries...\n');

    let total = 0;
    total += await deletePurchaseLedgers();
    total += await deleteOrderLedgers();
    total += await deleteSalesLedgers();

    console.log(`\n📊 Total ledger entries deleted: ${total}`);
    return total;
  } catch (error) {
    console.error('❌ Error deleting all ledger entries:', error);
  }
}

async function showMenu() {
  console.log('\n========================================');
  console.log('   LEDGER ENTRIES DELETION OPTIONS');
  console.log('========================================');
  console.log('1. Delete PURCHASE ledger entries');
  console.log('2. Delete ORDER/SUBSCRIPTION ledger entries');
  console.log('3. Delete SALES ledger entries');
  console.log('4. Delete ALL ledger entries');
  console.log('5. Exit');
  console.log('========================================\n');

  const choice = await question('Enter your choice (1-5): ');

  switch (choice.trim()) {
    case '1':
      await deletePurchaseLedgers();
      break;
    case '2':
      await deleteOrderLedgers();
      break;
    case '3':
      await deleteSalesLedgers();
      break;
    case '4':
      const confirmation = await question('⚠️  Are you sure you want to delete ALL ledger entries? (yes/no): ');
      if (confirmation.toLowerCase() === 'yes' || confirmation.toLowerCase() === 'y') {
        await deleteAllLedgers();
      } else {
        console.log('❌ Deletion cancelled');
      }
      break;
    case '5':
      console.log('👋 Exiting...');
      rl.close();
      await prisma.$disconnect();
      process.exit(0);
    default:
      console.log('❌ Invalid choice. Please try again.');
  }

  const continueChoice = await question('\nDo you want to continue? (yes/no): ');
  if (continueChoice.toLowerCase() === 'yes' || continueChoice.toLowerCase() === 'y') {
    await showMenu();
  } else {
    console.log('👋 Exiting...');
    rl.close();
    await prisma.$disconnect();
  }
}

// Start the menu
showMenu().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
