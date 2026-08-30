#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const nameArg = process.argv.find(a => a.startsWith('--name='));
const phoneArg = process.argv.find(a => a.startsWith('--phone='));

const name = nameArg ? nameArg.split('=')[1] : null;
const phone = phoneArg ? phoneArg.split('=')[1] : null;

(async () => {
  try {
    const where = {};
    if (name && phone) {
      where.OR = [
        { cus_name: { contains: name } },
        { cus_phone_no: { contains: phone } },
      ];
    } else if (name) {
      where.cus_name = { contains: name };
    } else if (phone) {
      where.cus_phone_no = { contains: phone };
    } else {
      console.error('Usage: node scripts/find-customers.js --name="name" --phone="phone"');
      process.exit(1);
    }

    const customers = await prisma.customer.findMany({ where, orderBy: { created_at: 'desc' } });
    if (!customers || customers.length === 0) {
      console.log('No customers found matching query');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log(`Found ${customers.length} customers:`);
    for (const c of customers) {
      console.log(`  • ID=${c.cus_id}  Name=${c.cus_name}  Phone=${c.cus_phone_no}  Balance=${c.cus_balance}`);
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error searching customers:', err);
    await prisma.$disconnect();
    process.exit(1);
  }
})();
