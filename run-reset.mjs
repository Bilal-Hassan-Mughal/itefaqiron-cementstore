import { PrismaClient } from './src/generated/prisma/index.js';

const prisma = new PrismaClient();

async function reset() {
  console.log('⚠️  Starting data reset...\n');

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');

  // 1. Sales-related
  console.log('🗑️  Deleting split_payments...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE split_payments');
  console.log('🗑️  Deleting sale_return_details...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE sale_return_details');
  console.log('🗑️  Deleting sale_returns...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE sale_returns');
  console.log('🗑️  Deleting sale_details...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE sale_details');
  console.log('🗑️  Deleting draft_sales...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE draft_sales');
  console.log('🗑️  Deleting hold_bill_details...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE hold_bill_details');
  console.log('🗑️  Deleting hold_bills...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE hold_bills');
  console.log('🗑️  Deleting sales (includes orders & quotations)...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE sales');

  // 2. Purchases
  console.log('🗑️  Deleting purchase_return_details...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE purchase_return_details');
  console.log('🗑️  Deleting purchase_returns...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE purchase_returns');
  console.log('🗑️  Deleting purchase_details...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE purchase_details');
  console.log('🗑️  Deleting purchases...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE purchases');

  // 3. Ledger
  console.log('🗑️  Deleting ledger entries...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE ledger');

  // 4. Journals
  console.log('🗑️  Deleting journal_details...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE journal_details');
  console.log('🗑️  Deleting journals...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE journals');

  // 5. Day ends
  console.log('🗑️  Deleting day_end_details...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE day_end_details');
  console.log('🗑️  Deleting day_ends...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE day_ends');

  // 6. Payments
  console.log('🗑️  Deleting payment_details...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE payment_details');
  console.log('🗑️  Deleting payments...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE payments');

  // 7. Stock transfers
  console.log('🗑️  Deleting stock_transfer_details...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE stock_transfer_details');
  console.log('🗑️  Deleting stock_transfers...');
  await prisma.$executeRawUnsafe('TRUNCATE TABLE stock_transfers');

  // 8. Customer balances → 0
  console.log('💰 Setting all customer balances to 0...');
  const cusResult = await prisma.$executeRawUnsafe('UPDATE customers SET cus_balance = 0');
  console.log(`   ✅ ${cusResult} customers updated`);

  // 9. Store-wise stock → 100
  console.log('📦 Setting all store stock to 100...');
  const storeStockResult = await prisma.$executeRawUnsafe('UPDATE store_stocks SET stock_quantity = 100');
  console.log(`   ✅ ${storeStockResult} store stock rows updated`);

  // 10. Product global stock → 100
  console.log('📦 Setting all product stock to 100...');
  const productResult = await prisma.$executeRawUnsafe('UPDATE products SET pro_stock_qnty = 100');
  console.log(`   ✅ ${productResult} products updated`);

  await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\n✅ Reset complete!');
  await prisma.$disconnect();
}

reset().catch(e => {
  console.error('❌ Error:', e.message);
  prisma.$disconnect();
  process.exit(1);
});
