const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function confirmMissingEntries() {
  const UBL_BANK_ID = 1650;
  const missingPayments = [181, 457, 1161, 1784, 2090, 2446, 3914, 4100];
  const missingSale = 460;

  console.log(`Checking details for missing entries to confirm Ubl bank (ID: ${UBL_BANK_ID}) involvement...\n`);

  console.log('--- PAYMENTS ---');
  const payments = await prisma.payment.findMany({
    where: { payment_id: { in: missingPayments } },
    select: {
      payment_id: true,
      bank_account_id: true,
      account_id: true,
      total_amount: true,
      bank_amount: true,
      description: true
    }
  });

  payments.forEach(p => {
    const involvesUbl = (p.bank_account_id === UBL_BANK_ID || p.account_id === UBL_BANK_ID);
    console.log(`Payment ID ${p.payment_id}: Amount ${p.total_amount}, Bank Account ID: ${p.bank_account_id}, Account ID: ${p.account_id} | Involves UBL? ${involvesUbl}`);
    console.log(`  Description: ${p.description}`);
  });

  console.log('\n--- SALE ---');
  const sale = await prisma.sale.findUnique({
    where: { sale_id: missingSale },
    select: {
      sale_id: true,
      bank_payment: true,
      bank_title: true,
      reference: true
    }
  });

  if (sale) {
    console.log(`Sale ID ${sale.sale_id}: Bank Payment ${sale.bank_payment}, Bank Title: "${sale.bank_title}"`);
  }

  await prisma.$disconnect();
}

confirmMissingEntries().catch(e => {
  console.error(e);
  process.exit(1);
});
