const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function inspectAllTodayPayments() {
  const todayStart = new Date('2026-09-22T19:00:00.000Z');
  const todayEnd = new Date('2026-09-23T18:59:59.999Z');

  const payments = await prisma.payment.findMany({
    where: {
      created_at: { gte: todayStart, lte: todayEnd }
    },
    include: {
      account: { select: { cus_name: true } },
      cash_account: { select: { cus_name: true } },
      bank_account: { select: { cus_name: true } }
    },
    orderBy: { payment_id: 'asc' }
  });

  console.log(`=== ALL PAYMENTS TABLE ENTRIES TODAY (${payments.length}) ===\n`);
  for (const p of payments) {
    console.log(`PAY-${p.payment_id} | Type: ${p.payment_type.padEnd(7)} | Amount: ${Number(p.total_amount).toFixed(2).padStart(10)} | CashAmt: ${Number(p.cash_amount).toFixed(2).padStart(10)} | BankAmt: ${Number(p.bank_amount).toFixed(2).padStart(10)} | Account: ${(p.account?.cus_name || '').slice(0, 30).padEnd(30)} | CashAcc: ${p.cash_account?.cus_name || 'None'} | BankAcc: ${p.bank_account?.cus_name || 'None'}`);
    console.log(`    Desc: "${p.description}"`);
  }

  await prisma.$disconnect();
}

inspectAllTodayPayments().catch(console.error);
