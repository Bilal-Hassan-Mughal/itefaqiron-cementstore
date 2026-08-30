const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/** Default Head Office login — change after first sign-in in production */
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

async function upsertHqUser({ full_name, email, password, role }) {
  const emailNorm = email.trim().toLowerCase();
  const hashedPassword = await bcrypt.hash(password, 10);
  const existing = await prisma.users.findUnique({ where: { email: emailNorm } });

  const data = {
    full_name,
    email: emailNorm,
    password: hashedPassword,
    role,
    branch_id: null,
    is_verified: true,
    status: 'ACTIVE',
  };

  if (existing) {
    await prisma.users.update({ where: { email: emailNorm }, data });
    console.log(`🔄 Updated ${role}: ${emailNorm}`);
  } else {
    await prisma.users.create({ data });
    console.log(`✅ Created ${role}: ${emailNorm}`);
  }
}

async function main() {
  console.log('🌱 Seeding Head Office login accounts...\n');

  for (const u of HQ_USERS) {
    try {
      await upsertHqUser(u);
    } catch (err) {
      console.error(`❌ Failed ${u.email}:`, err.message);
      throw err;
    }
  }

  // HQ accounts must never be tied to a branch
  await prisma.users.updateMany({
    where: { role: { in: ['SUPER_ADMIN', 'HQ_SUPER_ADMIN'] } },
    data: { branch_id: null },
  });

  // Branch users must not use HQ roles
  await prisma.users.updateMany({
    where: {
      branch_id: { not: null },
      role: { in: ['SUPER_ADMIN', 'HQ_SUPER_ADMIN'] },
    },
    data: { role: 'BRANCH_SUPER_ADMIN' },
  });

  console.log('\n🎉 HQ seed completed.\n');
  console.log('Sign in at: http://localhost:3000/?tab=hq');
  console.log('Switch to the "Head Office" tab on the landing page.\n');
  console.log('Primary HQ account:');
  console.log(`  Email:    ${HQ_USERS[0].email}`);
  console.log(`  Password: ${HQ_USERS[0].password}`);
  console.log(`  Role:     ${HQ_USERS[0].role}`);
  console.log('\nSecondary HQ account:');
  console.log(`  Email:    ${HQ_USERS[1].email}`);
  console.log(`  Password: ${HQ_USERS[1].password}`);
  console.log(`  Role:     ${HQ_USERS[1].role}`);
  console.log('\nBranches are created from HQ Dashboard after login.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
