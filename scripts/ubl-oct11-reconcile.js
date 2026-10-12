const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const from = new Date('2026-10-11T00:00:00.000+05:00');
  const to = new Date('2026-10-11T23:59:59.999+05:00');

  const led = await prisma.ledger.findMany({
    where: { cus_id: 1650, created_at: { gte: from, lte: to } },
    select: { l_id: true, bill_no: true, trnx_type: true, debit_amount: true, credit_amount: true, ledger_type: true },
  });
  let ledD = 0;
  let ledC = 0;
  for (const e of led) {
    ledD += parseFloat(e.debit_amount || 0);
    ledC += parseFloat(e.credit_amount || 0);
  }

  const pays = await prisma.payment.findMany({
    where: { bank_account_id: 1650, created_at: { gte: from, lte: to }, status: 'COMPLETED' },
    select: { payment_id: true, payment_type: true, bank_amount: true },
  });
  let payIn = 0;
  let payOut = 0;
  for (const p of pays) {
    const a = parseFloat(p.bank_amount || 0);
    if (p.payment_type === 'RECEIVE') payIn += a;
    else payOut += a;
  }

  console.log('Oct 11 UBL ledger rows:', led.length, 'D', ledD, 'C', ledC);
  console.log('Oct 11 payments bank_account UBL: RECEIVE', payIn, 'PAY out', payOut);

  const salesBank = await prisma.sale.findMany({
    where: { created_at: { gte: from, lte: to }, bank_payment: { gt: 0 } },
    select: { sale_id: true, bank_payment: true, debit_account_id: true, bank_title: true },
    take: 200,
  });
  let saleToUbl = 0;
  let saleBankOther = 0;
  for (const s of salesBank) {
    const amt = parseFloat(s.bank_payment || 0);
    if (Number(s.debit_account_id) === 1650) saleToUbl += amt;
    else saleBankOther += amt;
  }
  console.log('Oct 11 sales with bank_payment>0: count', salesBank.length, 'to UBL debit_account', saleToUbl, 'other bank', saleBankOther);

  const gap = 3903403 - 3548903.58;
  console.log('\nClient vs system gap:', gap);
  console.log('If gap is missing UBL deposits, check bank stmt Oct 11 for ~354,499 not in list above.');
}

main().finally(() => prisma.$disconnect());
