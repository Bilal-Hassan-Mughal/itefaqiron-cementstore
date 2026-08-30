/**
 * One-time / idempotent setup for multi-branch:
 * 1. Ensures Main Branch exists (id=1)
 * 2. Backfills branch_id=1 on all branch-owned tables
 * 3. Sets HQ users (SUPER_ADMIN) to branch_id NULL; others to branch 1
 *
 * Run after: npx prisma db push
 * Usage: node scripts/setup-branches.js
 */
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const BACKFILL_TABLES = [
  'customer_categories',
  'customer_types',
  'cities',
  'customers',
  'categories',
  'sub_categories',
  'products',
  'ledger',
  'expense_titles',
  'expenses',
  'sales',
  'purchases',
  'purchase_returns',
  'sale_returns',
  'hold_bills',
  'day_ends',
  'journals',
  'payments',
  'stores',
  'stock_transfers',
  'draft_sales',
  'vehicles',
  'loaders',
  'cargo',
  'packages',
  'subscriptions',
  'employees',
  'hr_settings',
];

async function main() {
  console.log('🏢 Branch setup starting...\n');

  let mainBranch = await prisma.branch.findUnique({ where: { branch_code: 'MAIN' } });
  if (!mainBranch) {
    mainBranch = await prisma.branch.create({
      data: {
        branch_code: 'MAIN',
        branch_name: 'Main Branch',
        address: 'Gujrat Sargodha Road, Pahrian Wali',
        phone: '0346-7560306',
        status: 'ACTIVE',
        isolation_mode: 'SHARED',
        table_prefix: 'main',
        tables_provisioned: true,
        provision_status: 'ACTIVE',
        provision_message: 'Legacy shared tables (sales, customers, …)',
      },
    });
    console.log('✅ Created Main Branch (id=%s)', mainBranch.branch_id);
  } else {
    console.log('ℹ️  Main Branch already exists (id=%s)', mainBranch.branch_id);
  }

  const branchId = mainBranch.branch_id;

  for (const table of BACKFILL_TABLES) {
    try {
      const result = await prisma.$executeRawUnsafe(
        `UPDATE \`${table}\` SET branch_id = ? WHERE branch_id IS NULL OR branch_id = 0`,
        branchId
      );
      console.log('  ↳ %s: updated %s rows', table, result);
    } catch (e) {
      if (e.message?.includes("Unknown column 'branch_id'")) {
        console.log('  ⚠️  %s: branch_id column not present yet — run prisma db push first', table);
      } else {
        console.warn('  ⚠️  %s: %s', table, e.message);
      }
    }
  }

  const hqUpdate = await prisma.users.updateMany({
    where: { role: { in: ['SUPER_ADMIN', 'HQ_SUPER_ADMIN'] } },
    data: { branch_id: null },
  });
  console.log('\n✅ HQ users set to branch_id=NULL: %s', hqUpdate.count);

  const branchUsers = await prisma.users.updateMany({
    where: {
      role: { notIn: ['SUPER_ADMIN', 'HQ_SUPER_ADMIN'] },
      branch_id: null,
    },
    data: { branch_id: branchId },
  });
  console.log('✅ Branch users assigned to Main Branch: %s', branchUsers.count);

  console.log('\n🎉 Branch setup complete.');
  console.log('   Main Branch id: %s (%s)', mainBranch.branch_id, mainBranch.branch_code);
}

main()
  .catch((e) => {
    console.error('❌ Setup failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
