/**
 * CLI: provision dedicated tables for a branch code.
 * Usage: node scripts/provision-branch-tables.js LHR
 */
require('dotenv').config();

async function main() {
  const code = process.argv[2];
  if (!code) {
    console.error('Usage: node scripts/provision-branch-tables.js <BRANCH_CODE>');
    process.exit(1);
  }

  const { PrismaClient } = await import('@prisma/client');
  const { provisionBranchStorage } = await import('../src/lib/db/provision-branch.js');

  const prisma = new PrismaClient();
  const branch = await prisma.branch.findUnique({ where: { branch_code: code.toUpperCase() } });
  if (!branch) {
    console.error(`Branch ${code} not found`);
    process.exit(1);
  }

  const result = await provisionBranchStorage(branch.branch_code, process.env.DATABASE_URL);
  await prisma.branch.update({
    where: { branch_id: branch.branch_id },
    data: {
      table_prefix: result.table_prefix,
      isolation_mode: result.isolation_mode,
      tables_provisioned: result.tables_provisioned,
      provision_status: result.provision_status,
      provision_message: result.provision_message,
      db_host: result.db_host,
      db_port: result.db_port,
      db_name: result.db_name,
      db_user: result.db_user,
      db_password: result.db_password,
    },
  });

  console.log('✅', result.provision_message);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
