const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function runMigration() {
  try {
    console.log('🔄 Checking database columns for size...\n');

    // 1. Check sale_details table
    const [checkSaleDetails] = await prisma.$queryRaw`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sale_details' 
      AND COLUMN_NAME = 'size'
    `;

    if (checkSaleDetails && checkSaleDetails.COLUMN_NAME) {
      console.log('✅ Column size already exists in sale_details table.');
    } else {
      console.log('➕ Adding size column to sale_details table...');
      await prisma.$executeRawUnsafe(`
        ALTER TABLE sale_details 
        ADD COLUMN size VARCHAR(255) NULL AFTER vehicle_no
      `);
      console.log('✅ Column size added to sale_details table successfully!');
    }

    // 2. Check hold_bill_details table if it exists
    try {
      const [checkHoldDetails] = await prisma.$queryRaw`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'hold_bill_details' 
        AND COLUMN_NAME = 'size'
      `;

      if (checkHoldDetails && checkHoldDetails.COLUMN_NAME) {
        console.log('✅ Column size already exists in hold_bill_details table.');
      } else {
        console.log('➕ Adding size column to hold_bill_details table...');
        await prisma.$executeRawUnsafe(`
          ALTER TABLE hold_bill_details 
          ADD COLUMN size VARCHAR(255) NULL AFTER vehicle_no
        `);
        console.log('✅ Column size added to hold_bill_details table successfully!');
      }
    } catch (e) {
      console.log('ℹ️ hold_bill_details check/alter skipped:', e.message);
    }

    console.log('\n🎉 Database migration complete!');
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

runMigration();
