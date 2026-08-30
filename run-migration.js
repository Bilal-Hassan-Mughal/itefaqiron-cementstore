/**
 * Direct Database Migration - Add advance_payment column
 * Uses Prisma's raw query capability to execute the SQL directly
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Starting migration...\n');

    // Check if column already exists
    console.log('📋 Checking if column already exists...');
    const [checkResult] = await prisma.$queryRaw`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'sales' 
      AND COLUMN_NAME = 'advance_payment'
    `;

    if (checkResult && checkResult.COLUMN_NAME) {
      console.log('⚠️  Column advance_payment already exists!\n');
      await prisma.$disconnect();
      process.exit(0);
    }

    // Add the column
    console.log('➕ Adding advance_payment column...');
    await prisma.$executeRaw`
      ALTER TABLE sales 
      ADD COLUMN advance_payment DOUBLE NOT NULL DEFAULT 0 
      AFTER bank_title
    `;

    console.log('✅ Column added successfully!\n');

    // Verify the column
    console.log('📋 Verifying column structure...');
    const columns = await prisma.$queryRaw`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, ORDINAL_POSITION
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'sales'
      AND ORDINAL_POSITION BETWEEN 8 AND 12
      ORDER BY ORDINAL_POSITION
    `;

    console.log('\nRecent columns in sales table:');
    console.log('─'.repeat(60));
    console.log('Position | Column Name | Type | Nullable | Default');
    console.log('─'.repeat(60));
    
    columns.forEach(col => {
      console.log(
        `${col.ORDINAL_POSITION.toString().padEnd(8)} | ` +
        `${col.COLUMN_NAME.padEnd(11)} | ` +
        `${col.COLUMN_TYPE.padEnd(6)} | ` +
        `${col.IS_NULLABLE.padEnd(8)} | ` +
        `${col.COLUMN_DEFAULT || 'NULL'}`
      );
    });

    console.log('─'.repeat(60));
    console.log('\n✅ Migration completed successfully!');
    console.log('🚀 You can now restart your application.\n');

    await prisma.$disconnect();
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

runMigration();
