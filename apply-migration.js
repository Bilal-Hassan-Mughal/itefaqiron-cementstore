#!/usr/bin/env node

/**
 * Apply Migration: Fix Labour and Shipping Amount Column Types
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  try {
    console.log('\n' + '='.repeat(80));
    console.log('🔧 MIGRATION: Fix labour_charges and shipping_amount types');
    console.log('='.repeat(80) + '\n');

    console.log('📝 Step 1: Altering labour_charges column from DECIMAL to DOUBLE...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE sales MODIFY COLUMN labour_charges DOUBLE NOT NULL DEFAULT 0
    `);
    console.log('✅ labour_charges column updated\n');

    console.log('📝 Step 2: Altering shipping_amount column from DECIMAL to DOUBLE...');
    await prisma.$executeRawUnsafe(`
      ALTER TABLE sales MODIFY COLUMN shipping_amount DOUBLE NOT NULL DEFAULT 0
    `);
    console.log('✅ shipping_amount column updated\n');

    console.log('📝 Step 3: Verifying column types...');
    const result = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_DEFAULT, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'sales'
      AND COLUMN_NAME IN ('labour_charges', 'shipping_amount')
    `);

    console.log('\n✅ Column Information:');
    result.forEach(col => {
      console.log(`  ${col.COLUMN_NAME}:`);
      console.log(`    Type: ${col.DATA_TYPE}`);
      console.log(`    Default: ${col.COLUMN_DEFAULT}`);
      console.log(`    Nullable: ${col.IS_NULLABLE}`);
    });

    console.log('\n' + '='.repeat(80));
    console.log('🎉 Migration completed successfully!');
    console.log('='.repeat(80) + '\n');

    console.log('📋 Summary:');
    console.log('  ✅ labour_charges: Changed from DECIMAL to DOUBLE');
    console.log('  ✅ shipping_amount: Changed from DECIMAL to DOUBLE');
    console.log('  ✅ Future API responses will return numeric values instead of objects\n');

    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ MIGRATION ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
})();
