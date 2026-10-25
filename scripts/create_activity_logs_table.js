const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Connecting to database...');
  const sql = `
    CREATE TABLE IF NOT EXISTS \`activity_logs\` (
      \`log_id\` INT NOT NULL AUTO_INCREMENT,
      \`branch_id\` INT NULL,
      \`user_id\` INT NULL,
      \`user_name\` VARCHAR(128) NULL,
      \`role\` VARCHAR(50) NULL,
      \`action\` VARCHAR(50) NOT NULL,
      \`module\` VARCHAR(100) NOT NULL,
      \`entity_id\` VARCHAR(100) NULL,
      \`description\` TEXT NULL,
      \`details\` JSON NULL,
      \`ip_address\` VARCHAR(64) NULL,
      \`user_agent\` VARCHAR(255) NULL,
      \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (\`log_id\`),
      INDEX \`activity_logs_branch_id_fkey\` (\`branch_id\`),
      INDEX \`activity_logs_user_id_idx\` (\`user_id\`),
      INDEX \`activity_logs_action_idx\` (\`action\`),
      INDEX \`activity_logs_module_idx\` (\`module\`),
      INDEX \`activity_logs_created_at_idx\` (\`created_at\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `;
  await prisma.$executeRawUnsafe(sql);
  console.log('SUCCESS: activity_logs table created successfully!');
}

main()
  .catch((e) => console.error('Migration error:', e.message))
  .finally(() => prisma.$disconnect());
