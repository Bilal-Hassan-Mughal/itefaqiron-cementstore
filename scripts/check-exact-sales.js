const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkExactSalesMatch() {
  const cashCusId = 2551;
  const allSales = await prisma.sale.findMany({
    select: {
      sale_id: true,
      bill_number: true,
      bill_type: true,
      total_amount: true,
      payment: true,
      cash_payment: true,
      bank_payment: true,
      payment_type: true,
      created_at: true,
      cus_id: true,
      customer: { select: { cus_name: true } }
    },
    orderBy: { sale_id: 'desc' }
  });

  const cashLedgers = await prisma.ledger.findMany({
    where: { cus_id: cashCusId },
    select: { l_id: true, bill_no: true, debit_amount: true, credit_amount: true, created_at: true, details: true }
  });

  const ledgerByBillNo = new Map();
  for (const l of cashLedgers) {
    const b = String(l.bill_no || '').trim();
    if (!ledgerByBillNo.has(b)) ledgerByBillNo.set(b, []);
    ledgerByBillNo.get(b).push(l);
  }

  const missingCashSales = [];
  const mismatchedCashSales = [];

  for (const s of allSales) {
    const payVal = Number(s.payment || 0);
    let effCash = Number(s.cash_payment || 0);
    const effBank = Number(s.bank_payment || 0);
    const payType = String(s.payment_type || '').toUpperCase();

    if (payVal > 0 && effCash === 0 && effBank === 0) {
      if (payType !== 'BANK_TRANSFER' && payType !== 'CHEQUE') {
        effCash = payVal;
      }
    }

    if (effCash <= 0) continue;

    const matches = ledgerByBillNo.get(String(s.sale_id)) || [];
    if (matches.length === 0) {
      missingCashSales.push({
        sale_id: s.sale_id,
        bill_number: s.bill_number,
        bill_type: s.bill_type,
        created_at: s.created_at.toISOString(),
        customer: s.customer?.cus_name,
        effCash,
        total_amount: Number(s.total_amount)
      });
    } else {
      const totalDebit = matches.reduce((sum, m) => sum + Number(m.debit_amount || 0), 0);
      if (Math.abs(totalDebit - effCash) > 0.01) {
        mismatchedCashSales.push({
          sale_id: s.sale_id,
          bill_number: s.bill_number,
          created_at: s.created_at.toISOString(),
          customer: s.customer?.cus_name,
          sale_cash: effCash,
          ledger_debit: totalDebit,
          diff: effCash - totalDebit
        });
      }
    }
  }

  console.log(`=== SALES AUDIT ===`);
  console.log(`Sales checked: ${allSales.length}`);
  console.log(`Sales with Cash but NO ledger entry for Cash Account: ${missingCashSales.length}`);
  if (missingCashSales.length > 0) {
    console.log(JSON.stringify(missingCashSales, null, 2));
  }
  console.log(`\nSales with Cash MISMATCH in ledger: ${mismatchedCashSales.length}`);
  if (mismatchedCashSales.length > 0) {
    console.log(JSON.stringify(mismatchedCashSales, null, 2));
  }

  await prisma.$disconnect();
}

checkExactSalesMatch().catch(console.error);
