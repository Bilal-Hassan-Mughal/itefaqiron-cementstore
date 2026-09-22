/**
 * Idempotent seed for HQ + Main Branch login accounts.
 * Usage: node prisma/seed-credentials.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

const HQ_USERS = [
  {
    full_name: 'HQ Super Admin',
    email: 'superadmin@itefaqbuilders.com',
    password: 'Admin@123',
    role: 'HQ_SUPER_ADMIN',
  },
  {
    full_name: 'HQ Administrator',
    email: 'hq@itefaqbuilders.com',
    password: 'Admin@123',
    role: 'SUPER_ADMIN',
  },
];

const MAIN_BRANCH_ADMIN = {
  full_name: 'Main Branch Admin',
  email: 'main@itefaqbuilders.com',
  password: 'Admin@123',
  role: 'BRANCH_SUPER_ADMIN',
};

async function ensureMainBranch() {
  let branch = await prisma.branch.findUnique({ where: { branch_code: 'MAIN' } });
  if (!branch) {
    branch = await prisma.branch.create({
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
        provision_message: 'Main branch — shared tables',
      },
    });
    console.log(`✅ Created Main Branch (id=${branch.branch_id}, code=MAIN)`);
  } else {
    console.log(`ℹ️  Main Branch already exists (id=${branch.branch_id}, code=MAIN)`);
  }
  return branch;
}

async function upsertUser({ full_name, email, password, role, branch_id = null }) {
  const emailNorm = email.trim().toLowerCase();
  const hashedPassword = await bcrypt.hash(password, 10);
  const existing = await prisma.users.findUnique({ where: { email: emailNorm } });

  const data = {
    full_name,
    email: emailNorm,
    password: hashedPassword,
    role,
    branch_id,
    is_verified: true,
    status: 'ACTIVE',
  };

  if (existing) {
    await prisma.users.update({ where: { email: emailNorm }, data });
    return { action: 'updated', email: emailNorm };
  }
  await prisma.users.create({ data });
  return { action: 'created', email: emailNorm };
}

async function main() {
  console.log('🔐 Checking & seeding HQ + Main Branch credentials...\n');

  const mainBranch = await ensureMainBranch();

  console.log('\n--- Head Office accounts ---');
  for (const u of HQ_USERS) {
    const result = await upsertUser({ ...u, branch_id: null });
    console.log(`${result.action === 'created' ? '✅ Created' : '🔄 Updated'} ${u.role}: ${result.email}`);
  }

  console.log('\n--- Main Branch account ---');
  const mainResult = await upsertUser({
    ...MAIN_BRANCH_ADMIN,
    branch_id: mainBranch.branch_id,
  });
  console.log(
    `${mainResult.action === 'created' ? '✅ Created' : '🔄 Updated'} ${MAIN_BRANCH_ADMIN.role}: ${mainResult.email}`
  );

  await prisma.users.updateMany({
    where: { role: { in: ['SUPER_ADMIN', 'HQ_SUPER_ADMIN'] } },
    data: { branch_id: null },
  });

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('LOGIN CREDENTIALS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  console.log('🏢 HEAD OFFICE (http://localhost:3000/?tab=hq)');
  console.log('   Primary:');
  console.log(`     Email:    ${HQ_USERS[0].email}`);
  console.log(`     Password: ${HQ_USERS[0].password}`);
  console.log(`     Role:     ${HQ_USERS[0].role}`);
  console.log('   Secondary:');
  console.log(`     Email:    ${HQ_USERS[1].email}`);
  console.log(`     Password: ${HQ_USERS[1].password}`);
  console.log(`     Role:     ${HQ_USERS[1].role}\n`);

  console.log('🏪 MAIN BRANCH (http://localhost:3000/ → Branch Login)');
  console.log(`     Branch Code: MAIN`);
  console.log(`     Email:       ${MAIN_BRANCH_ADMIN.email}`);
  console.log(`     Password:    ${MAIN_BRANCH_ADMIN.password}`);
  console.log(`     Role:        ${MAIN_BRANCH_ADMIN.role}\n`);

  console.log('🎉 Credentials check complete.\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
