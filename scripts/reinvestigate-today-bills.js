const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function reinvestigateTodayBills() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  DEEP RE-INVESTIGATION: EVERY BILL & TRANSACTION TODAY (SEPT 23)');
  console.log('══════════════════════════════════════════════════════════════════');

  // Today in PKT (UTC+5): 2026-09-22 19:00:00 UTC to 2026-09-23 18:59:59 UTC
  const todayStart = new Date('2026-09-22T19:00:00.000Z');
  const todayEnd = new Date('2026-09-23T18:59:59.999Z');

  // 1. Fetch ALL Sales created today
  const salesToday = await prisma.sale.findMany({
    where: { created_at: { gte: todayStart, lte: todayEnd } },
    include: {
      customer: { select: { cus_id: true, cus_name: true } },
      split_payments: true
    },
    orderBy: { sale_id: 'asc' }
  });

  console.log(`\n📋 TOTAL SALES CREATED TODAY: ${salesToday.length}\n`);

  let totalSalesAmount = 0;
  let totalCashFromSales = 0;
  let totalBankFromSales = 0;
  let missingLedgerCount = 0;

  console.log('sale_id | bill_no | time     | customer                       | total_amt  | cash_paid  | bank_paid  | customer_ledger | cash_ledger | status');
  console.log('---------------------------------------------------------------------------------------------------------------------------------------------');

  for (const s of salesToday) {
    const time = s.created_at.toISOString().slice(11, 19);
    const bill = (s.bill_number ? String(s.bill_number) : String(s.sale_id)).padEnd(7);
    const custName = (s.customer?.cus_name || 'Unknown').slice(0, 30).padEnd(30);
    const tot = Number(s.total_amount);
    const cash = Number(s.cash_payment || 0);
    const bank = Number(s.bank_payment || 0);

    totalSalesAmount += tot;
    totalCashFromSales += cash;
    totalBankFromSales += bank;

    // Check customer ledger entries for this sale
    const custLedgers = await prisma.ledger.findMany({
      where: {
        bill_no: String(s.sale_id),
        cus_id: s.cus_id
      }
    });

    // Check cash account ledger entries for this sale
    const cashLedgers = await prisma.ledger.findMany({
      where: {
        bill_no: String(s.sale_id),
        cus_id: 2551
      }
    });

    // Check bank account ledger entries if bank > 0
    let bankLedgerOk = true;
    if (bank > 0) {
      const bankLedgers = await prisma.ledger.findMany({
        where: {
          bill_no: String(s.sale_id),
          trnx_type: 'DEBIT',
          cus_id: { notIn: [s.cus_id, 2551] }
        }
      });
      bankLedgerOk = bankLedgers.length > 0;
    }

    const custOk = custLedgers.length > 0 ? 'YES' : 'NO';
    let cashOk = 'N/A';
    if (cash > 0) {
      cashOk = cashLedgers.length > 0 ? (cashLedgers[0].debit_amount === cash ? 'YES' : 'DIFF') : 'MISSING';
    }

    let status = '✅ OK';
    if (custOk === 'NO' || cashOk === 'MISSING' || cashOk === 'DIFF' || !bankLedgerOk) {
      status = '❌ ISSUE';
      missingLedgerCount++;
    }

    console.log(`${String(s.sale_id).padEnd(7)} | ${bill} | ${time} | ${custName} | ${tot.toFixed(2).padStart(10)} | ${cash.toFixed(2).padStart(10)} | ${bank.toFixed(2).padStart(10)} | ${custOk.padEnd(15)} | ${cashOk.padEnd(11)} | ${status}`);
  }

  console.log('\n─────────────────────────────────────────────────────────────────────────────');
  console.log(`Sales Summary:`);
  console.log(`  • Total Sales Amount: PKR ${totalSalesAmount.toFixed(2)}`);
  console.log(`  • Total Cash Paid:    PKR ${totalCashFromSales.toFixed(2)}`);
  console.log(`  • Total Bank Paid:    PKR ${totalBankFromSales.toFixed(2)}`);
  console.log(`  • Sales with Issues:  ${missingLedgerCount} / ${salesToday.length}`);

  // 2. Fetch ALL Payment Vouchers created today
  const paymentsToday = await prisma.payment.findMany({
    where: { created_at: { gte: todayStart, lte: todayEnd } },
    include: {
      account: { select: { cus_name: true } }
    },
    orderBy: { payment_id: 'asc' }
  });

  console.log(`\n📋 TOTAL PAYMENT VOUCHERS CREATED TODAY: ${paymentsToday.length}\n`);
  let missingPaymentLedgers = 0;

  console.log('pay_id   | type    | time     | account                        | amount     | cash_amt   | bank_amt   | customer_ledger | cash_ledger | status');
  console.log('---------------------------------------------------------------------------------------------------------------------------------------------');

  for (const p of paymentsToday) {
    const time = p.created_at.toISOString().slice(11, 19);
    const acc = (p.account?.cus_name || 'Unknown').slice(0, 30).padEnd(30);
    const tot = Number(p.total_amount);
    const cash = Number(p.cash_amount || 0);
    const bank = Number(p.bank_amount || 0);

    // Check customer ledger
    const custLedgers = await prisma.ledger.findMany({
      where: {
        bill_no: `PAY-${p.payment_id}`,
        cus_id: p.account_id
      }
    });

    // Check cash ledger
    const cashLedgers = await prisma.ledger.findMany({
      where: {
        bill_no: `PAY-${p.payment_id}`,
        cus_id: 2551
      }
    });

    const custOk = custLedgers.length > 0 ? 'YES' : 'NO';
    let cashOk = 'N/A';
    if (cash > 0) {
      cashOk = cashLedgers.length > 0 ? 'YES' : 'MISSING';
    }

    let status = '✅ OK';
    if (custOk === 'NO' || cashOk === 'MISSING') {
      status = '❌ ISSUE';
      missingPaymentLedgers++;
    }

    console.log(`PAY-${String(p.payment_id).padEnd(4)} | ${p.payment_type.padEnd(7)} | ${time} | ${acc} | ${tot.toFixed(2).padStart(10)} | ${cash.toFixed(2).padStart(10)} | ${bank.toFixed(2).padStart(10)} | ${custOk.padEnd(15)} | ${cashOk.padEnd(11)} | ${status}`);
  }

  // 3. Fetch ALL Expenses created today
  const expensesToday = await prisma.expense.findMany({
    where: { created_at: { gte: todayStart, lte: todayEnd } },
    include: { expense_title: true },
    orderBy: { exp_id: 'asc' }
  });

  console.log(`\n📋 TOTAL EXPENSES CREATED TODAY: ${expensesToday.length}\n`);
  for (const exp of expensesToday) {
    const time = exp.created_at.toISOString().slice(11, 19);
    const cash = Number(exp.cash_amount || 0);
    const cashLedgers = await prisma.ledger.findMany({
      where: {
        bill_no: `EXP-${exp.exp_id}`,
        cus_id: 2551
      }
    });
    console.log(`EXP-${exp.exp_id} | ${time} | ${exp.exp_title.padEnd(25)} | Amount: ${Number(exp.exp_amount).toFixed(2)} | CashAmt: ${cash.toFixed(2)} | Cash Ledger: ${cashLedgers.length > 0 ? 'YES' : 'MISSING'}`);
  }

  // 4. Fetch ALL Sale Returns created today
  const returnsToday = await prisma.saleReturn.findMany({
    where: { created_at: { gte: todayStart, lte: todayEnd } },
    include: { customer: { select: { cus_name: true } } },
    orderBy: { return_id: 'asc' }
  });

  console.log(`\n📋 TOTAL SALE RETURNS TODAY: ${returnsToday.length}\n`);
  for (const r of returnsToday) {
    const time = r.created_at.toISOString().slice(11, 19);
    const refund = Number(r.payment || 0);
    const payType = r.payment_type;
    console.log(`Return #${r.return_id} | ${time} | ${(r.customer?.cus_name || '').padEnd(30)} | Net Total: ${Number(r.total_amount).toFixed(2)} | Refund: ${refund.toFixed(2)} (${payType})`);
  }

  await prisma.$disconnect();
}

reinvestigateTodayBills().catch(console.error);
