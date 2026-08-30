/**
 * Run BEFORE `npx prisma db push` on an existing database.
 * Creates branches table + Main Branch row so FK defaults (branch_id=1) succeed.
 *
 * Usage: node scripts/pre-branch-push.js && npx prisma db push && npm run db:branches
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('🏢 Pre-push branch bootstrap...');

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS \`branches\` (
      \`branch_id\` INT NOT NULL AUTO_INCREMENT,
      \`branch_code\` VARCHAR(20) NOT NULL,
      \`branch_name\` VARCHAR(191) NOT NULL,
      \`address\` VARCHAR(191) NULL,
      \`phone\` VARCHAR(191) NULL,
      \`status\` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`updated_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE INDEX \`branches_branch_code_key\`(\`branch_code\`),
      PRIMARY KEY (\`branch_id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
  `);

  await prisma.$executeRawUnsafe(`
    INSERT INTO \`branches\` (\`branch_id\`, \`branch_code\`, \`branch_name\`, \`address\`, \`phone\`, \`status\`)
    VALUES (1, 'MAIN', 'Main Branch', 'Gujrat Sargodha Road, Pahrian Wali', '0346-7560306', 'ACTIVE')
    ON DUPLICATE KEY UPDATE branch_name = VALUES(branch_name)
  `);

  console.log('✅ branches table ready with Main Branch (id=1)');
  console.log('   Next: npx prisma db push');
  console.log('   Then: npm run db:branches');
}

main()
  .catch((e) => {
    console.error('❌ Pre-push bootstrap failed:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
