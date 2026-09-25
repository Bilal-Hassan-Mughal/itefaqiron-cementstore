const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSizeField() {
  try {
    console.log('🧪 Verifying size field in database...');
    
    // Check table structure
    const columns = await prisma.$queryRaw`
      SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'sale_details'
      AND COLUMN_NAME = 'size'
    `;

    console.log('📋 Column info:', columns);

    if (columns && columns.length > 0) {
      console.log('✅ SUCCESS: size column verified in database!');
    } else {
      console.error('❌ ERROR: size column not found in sale_details table');
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('❌ Test failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

testSizeField();
