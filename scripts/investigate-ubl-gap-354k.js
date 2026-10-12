const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const cusId = 1650;
const GAP = 354499.42;
const CLIENT = 3903403;
const SYSTEM = 3548903.58;

async function main() {
  const near = await prisma.ledger.findMany({
    where: {
      cus_id: cusId,
      OR: [
        { debit_amount: { gte: GAP - 1, lte: GAP + 1 } },
        { credit_amount: { gte: GAP - 1, lte: GAP + 1 } },
        { debit_amount: { gte: 354500 - 1, lte: 354500 + 1 } },
        { credit_amount: { gte: 354500 - 1, lte: 354500 + 1 } },
      ],
    },
    select: { l_id: true, bill_no: true, debit_amount: true, credit_amount: true, created_at: true, details: true },
  });
  console.log('Rows with amount ~354499-354500:', near.length);
  for (const r of near) console.log(r);

  const payBank = await prisma.payment.findMany({
    where: { bank_account_id: cusId },
    select: { payment_id: true, payment_type: true, bank_amount: true, total_amount: true, created_at: true, description: true, account_id: true },
    orderBy: { payment_id: 'desc' },
    take: 5,
  });
  console.log('\nLatest 5 payments using UBL as bank account:');
  for (const p of payBank) console.log(`PAY-${p.payment_id}`, p.payment_type, 'bank', p.bank_amount, p.created_at.toISOString().slice(0, 10));

  const missingLedger = [];
  const pays = await prisma.payment.findMany({
    where: { bank_account_id: cusId, bank_amount: { gt: 0 }, status: 'COMPLETED' },
    select: { payment_id: true, payment_type: true, bank_amount: true, created_at: true },
  });
  for (const p of pays) {
    const bill = `PAY-${p.payment_id}`;
    const led = await prisma.ledger.findFirst({ where: { cus_id: cusId, bill_no: bill } });
    if (!led) missingLedger.push(p);
  }
  console.log('\nCompleted bank payments with NO UBL ledger row:', missingLedger.length);
  for (const p of missingLedger.slice(0, 20)) {
    console.log(`  PAY-${p.payment_id} ${p.payment_type} ${p.bank_amount}`);
  }

  const receivePay = await prisma.payment.findMany({
    where: { bank_account_id: cusId, payment_type: 'RECEIVE', bank_amount: { gt: 0 } },
    select: { payment_id: true, bank_amount: true },
  });
  let recvNoLed = 0;
  for (const p of receivePay) {
    const led = await prisma.ledger.findFirst({ where: { cus_id: cusId, bill_no: `PAY-${p.payment_id}` } });
    if (!led) recvNoLed += parseFloat(p.bank_amount);
  }
  console.log('\nRECEIVE bank to UBL missing ledger total:', recvNoLed);

  const payOut = await prisma.payment.findMany({
    where: { bank_account_id: cusId, payment_type: 'PAY', bank_amount: { gt: 0 } },
    select: { payment_id: true, bank_amount: true },
  });
  let payNoLed = 0;
  for (const p of payOut) {
    const led = await prisma.ledger.findFirst({ where: { cus_id: cusId, bill_no: `PAY-${p.payment_id}` } });
    if (!led) payNoLed += parseFloat(p.bank_amount);
  }
  console.log('PAY bank from UBL missing ledger total:', payNoLed);

  console.log('\nIf client balance', CLIENT, 'and system', SYSTEM, 'gap', CLIENT - SYSTEM);
  console.log('Missing RECEIVE ledger would lower system balance by that amount.');
  console.log('Extra CREDIT (duplicate PAY out) would lower system by credit amount.');
}

main().finally(() => prisma.$disconnect());
