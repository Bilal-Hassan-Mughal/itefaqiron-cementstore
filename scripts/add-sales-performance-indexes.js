const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addIndexSafely(tableName, indexName, sql) {
  try {
    const existing = await prisma.$queryRawUnsafe(`SHOW INDEX FROM \`${tableName}\` WHERE Key_name = '${indexName}'`);
    if (Array.isArray(existing) && existing.length > 0) {
      console.log(`ℹ️ Index ${indexName} already exists on ${tableName}`);
      return;
    }
    await prisma.$executeRawUnsafe(sql);
    console.log(`✅ Created index ${indexName} on ${tableName}`);
  } catch (err) {
    console.warn(`⚠️ Failed to create index ${indexName} on ${tableName}:`, err.message);
  }
}

async function main() {
  console.log('🚀 Adding performance indexes for instant sale saving...');

  await addIndexSafely(
    'sales',
    'sales_bill_type_bill_number_idx',
    'ALTER TABLE `sales` ADD INDEX `sales_bill_type_bill_number_idx` (`bill_type`, `bill_number`)'
  );

  await addIndexSafely(
    'sales',
    'sales_branch_bill_type_bill_number_idx',
    'ALTER TABLE `sales` ADD INDEX `sales_branch_bill_type_bill_number_idx` (`branch_id`, `bill_type`, `bill_number`)'
  );

  await addIndexSafely(
    'sales',
    'sales_created_at_idx',
    'ALTER TABLE `sales` ADD INDEX `sales_created_at_idx` (`created_at`)'
  );

  await addIndexSafely(
    'store_stocks',
    'store_id_pro_id',
    'ALTER TABLE `store_stocks` ADD UNIQUE INDEX `store_id_pro_id` (`store_id`, `pro_id`)'
  );

  console.log('🎉 Performance index setup complete!');
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
