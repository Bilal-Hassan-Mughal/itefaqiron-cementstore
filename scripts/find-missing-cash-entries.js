const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findMissingCashEntries() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  DEEP RECONCILIATION: FIND MISSING CASH LEDGER ENTRIES');
  console.log('═══════════════════════════════════════════════════════════');

  const cashCust = await prisma.customer.findFirst({ where: { cus_name: 'Cash Account' } });
  const cashCusId = cashCust.cus_id;
  console.log(`Cash Account: cus_id = ${cashCusId}, current balance = ${cashCust.cus_balance}`);

  // Fetch all Cash Account ledger entries into a map / set
  const allCashLedger = await prisma.ledger.findMany({
    where: { cus_id: cashCusId }
  });
  console.log(`Total Cash Account ledger entries: ${allCashLedger.length}`);

  // Map by bill_no
  const ledgerByBillNo = new Map();
  for (const l of allCashLedger) {
    const b = String(l.bill_no || '').trim();
    if (!ledgerByBillNo.has(b)) ledgerByBillNo.set(b, []);
    ledgerByBillNo.get(b).push(l);
  }

  // ─────────────────────────────────────────────────────────────
  // 1. AUDIT SALES (Cash In / Debits)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- 1. AUDITING SALES ---');
  const allSales = await prisma.sale.findMany({
    select: {
      sale_id: true,
      bill_number: true,
      bill_type: true,
      total_amount: true,
      payment: true,
      cash_payment: true,
      bank_payment: true,
      advance_payment: true,
      payment_type: true,
      created_at: true,
      cus_id: true,
      customer: { select: { cus_name: true } }
    },
    orderBy: { sale_id: 'desc' }
  });

  console.log(`Total sales in database: ${allSales.length}`);

  const missingSales = [];
  const mismatchedSales = [];
  let totalMissingCashFromSales = 0;

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

    if (effCash <= 0) continue; // No cash on this sale

    // Check if there is a ledger entry in Cash Account
    // Try by sale_id, bill_number, or reference
    const matchesById = ledgerByBillNo.get(String(s.sale_id)) || [];
    const matchesByBillNum = s.bill_number ? (ledgerByBillNo.get(String(s.bill_number)) || []) : [];
    const allMatches = [...new Set([...matchesById, ...matchesByBillNum])];

    if (allMatches.length === 0) {
      missingSales.push({
        sale_id: s.sale_id,
        bill_number: s.bill_number,
        bill_type: s.bill_type,
        created_at: s.created_at.toISOString(),
        customer: s.customer?.cus_name,
        effCash,
        total_amount: Number(s.total_amount)
      });
      totalMissingCashFromSales += effCash;
    } else {
      // Check if amount matches
      const totalDebitInLedger = allMatches.reduce((sum, m) => sum + Number(m.debit_amount || 0), 0);
      if (Math.abs(totalDebitInLedger - effCash) > 0.01) {
        mismatchedSales.push({
          sale_id: s.sale_id,
          bill_number: s.bill_number,
          created_at: s.created_at.toISOString(),
          customer: s.customer?.cus_name,
          sale_cash: effCash,
          ledger_debit: totalDebitInLedger,
          diff: effCash - totalDebitInLedger
        });
      }
    }
  }

  console.log(`Sales with Cash Payment but ZERO Cash Ledger entries: ${missingSales.length}`);
  console.log(`Total unrecorded Cash from missing sales: PKR ${totalMissingCashFromSales.toFixed(2)}`);
  if (missingSales.length > 0) {
    console.log('Sample missing sales (last 10):');
    console.log(JSON.stringify(missingSales.slice(0, 10), null, 2));
  }

  console.log(`\nSales with Cash amount MISMATCH between sale and ledger: ${mismatchedSales.length}`);
  if (mismatchedSales.length > 0) {
    console.log('Sample mismatched sales (last 10):');
    console.log(JSON.stringify(mismatchedSales.slice(0, 10), null, 2));
  }

  // ─────────────────────────────────────────────────────────────
  // 2. AUDIT PURCHASES (Cash Out / Credits)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- 2. AUDITING PURCHASES ---');
  const allPurchases = await prisma.purchase.findMany({
    select: {
      pur_id: true,
      invoice_number: true,
      total_amount: true,
      payment: true,
      cash_payment: true,
      bank_payment: true,
      payment_type: true,
      created_at: true,
      customer: { select: { cus_name: true } }
    },
    orderBy: { pur_id: 'desc' }
  });

  const missingPurchases = [];
  let totalMissingCashFromPurchases = 0;

  for (const p of allPurchases) {
    const payVal = Number(p.payment || 0);
    let effCash = Number(p.cash_payment || 0);
    const effBank = Number(p.bank_payment || 0);
    const payType = String(p.payment_type || '').toUpperCase();

    if (payVal > 0 && effCash === 0 && effBank === 0) {
      if (payType !== 'BANK_TRANSFER' && payType !== 'CHEQUE') {
        effCash = payVal;
      }
    }

    if (effCash <= 0) continue;

    const matchesById = ledgerByBillNo.get(String(p.pur_id)) || [];
    const matchesByInv = p.invoice_number ? (ledgerByBillNo.get(String(p.invoice_number)) || []) : [];
    const allMatches = [...new Set([...matchesById, ...matchesByInv])];

    if (allMatches.length === 0) {
      missingPurchases.push({
        pur_id: p.pur_id,
        invoice_number: p.invoice_number,
        created_at: p.created_at.toISOString(),
        supplier: p.customer?.cus_name,
        effCash,
        total_amount: Number(p.total_amount)
      });
      totalMissingCashFromPurchases += effCash;
    }
  }

  console.log(`Purchases with Cash Payment but ZERO Cash Ledger entries: ${missingPurchases.length}`);
  console.log(`Total unrecorded Cash Out from missing purchases: PKR ${totalMissingCashFromPurchases.toFixed(2)}`);
  if (missingPurchases.length > 0) {
    console.log(JSON.stringify(missingPurchases, null, 2));
  }

  // ─────────────────────────────────────────────────────────────
  // 3. AUDIT EXPENSES (Cash Out / Credits)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- 3. AUDITING EXPENSES ---');
  const allExpenses = await prisma.expense.findMany({
    select: {
      exp_id: true,
      exp_title: true,
      exp_amount: true,
      is_paid: true,
      paid_from_account_id: true,
      cash_amount: true,
      bank_amount: true,
      created_at: true
    },
    orderBy: { exp_id: 'desc' }
  });

  const missingExpenses = [];
  let totalMissingExpenses = 0;

  for (const exp of allExpenses) {
    const cashAmt = Number(exp.cash_amount || 0);
    const isCashPaid = exp.is_paid && (cashAmt > 0 || exp.paid_from_account_id === cashCusId);
    const effAmt = cashAmt > 0 ? cashAmt : (exp.paid_from_account_id === cashCusId ? Number(exp.exp_amount) : 0);

    if (effAmt <= 0) continue;

    const matches = ledgerByBillNo.get(`EXP-${exp.exp_id}`) || ledgerByBillNo.get(String(exp.exp_id)) || [];
    if (matches.length === 0) {
      missingExpenses.push({
        exp_id: exp.exp_id,
        title: exp.exp_title,
        amount: effAmt,
        created_at: exp.created_at.toISOString()
      });
      totalMissingExpenses += effAmt;
    }
  }

  console.log(`Paid Expenses with Cash but ZERO Cash Ledger entries: ${missingExpenses.length}`);
  console.log(`Total unrecorded Cash Out from missing expenses: PKR ${totalMissingExpenses.toFixed(2)}`);
  if (missingExpenses.length > 0) {
    console.log(JSON.stringify(missingExpenses, null, 2));
  }

  // ─────────────────────────────────────────────────────────────
  // 4. AUDIT PAYMENTS TABLE (Receipts / Vouchers)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- 4. AUDITING PAYMENTS TABLE ---');
  const allPayments = await prisma.payment.findMany({
    select: {
      payment_id: true,
      payment_date: true,
      payment_type: true,
      total_amount: true,
      net_amount: true,
      cash_account_id: true,
      cash_amount: true,
      description: true,
      account: { select: { cus_name: true } }
    },
    orderBy: { payment_id: 'desc' }
  });

  const missingPayments = [];
  let totalMissingPayments = 0;

  for (const p of allPayments) {
    const cashAmt = Number(p.cash_amount || 0);
    if (cashAmt <= 0 && p.cash_account_id !== cashCusId) continue;
    const effAmt = cashAmt > 0 ? cashAmt : Number(p.net_amount || p.total_amount);

    const matches = ledgerByBillNo.get(`PAY-${p.payment_id}`) || ledgerByBillNo.get(String(p.payment_id)) || [];
    if (matches.length === 0) {
      missingPayments.push({
        payment_id: p.payment_id,
        type: p.payment_type,
        account: p.account?.cus_name,
        amount: effAmt,
        date: p.payment_date.toISOString(),
        desc: p.description
      });
      totalMissingPayments += effAmt;
    }
  }

  console.log(`Payments table vouchers with Cash but ZERO Cash Ledger entries: ${missingPayments.length}`);
  console.log(`Total unrecorded amount from missing payments: PKR ${totalMissingPayments.toFixed(2)}`);
  if (missingPayments.length > 0) {
    console.log(JSON.stringify(missingPayments.slice(0, 10), null, 2));
  }

  // ─────────────────────────────────────────────────────────────
  // 5. AUDIT RECENT ACTIVITY (Today & Yesterday)
  // ─────────────────────────────────────────────────────────────
  console.log('\n--- 5. CHECKING RECENT SALES FROM SEPT 22 & 23 ---');
  const recentSales = allSales.filter(s => new Date(s.created_at) >= new Date('2026-09-22T00:00:00.000Z'));
  console.log(`Recent sales count (Sept 22 - 23): ${recentSales.length}`);
  const recentMissing = missingSales.filter(s => new Date(s.created_at) >= new Date('2026-09-22T00:00:00.000Z'));
  console.log(`Recent missing sales: ${recentMissing.length}`);
  if (recentMissing.length > 0) {
    console.log('Recent missing sales details:');
    console.log(JSON.stringify(recentMissing, null, 2));
  }

  await prisma.$disconnect();
}

findMissingCashEntries().catch(console.error);
