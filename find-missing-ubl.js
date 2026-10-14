const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findMissingLedgerEntries() {
  const UBL_BANK_ID = 1650;
  console.log(`Investigating missing ledger entries for Ubl bank (ID: ${UBL_BANK_ID})...`);

  // 1. Get all existing ledger entries for UBL to know what's already there
  const existingLedger = await prisma.ledger.findMany({
    where: { cus_id: UBL_BANK_ID },
    select: { bill_no: true, l_id: true, details: true }
  });

  const ledgerBillNos = new Set(existingLedger.map(l => l.bill_no));
  const ledgerDetails = existingLedger.map(l => l.details).join(' ');

  const missing = [];

  // 2. Check Payments table
  console.log('Checking Payments table...');
  const payments = await prisma.payment.findMany({
    where: {
      OR: [
        { bank_account_id: UBL_BANK_ID },
        { account_id: UBL_BANK_ID }
      ]
    }
  });

  for (const p of payments) {
    const payRef = `PAY-${p.payment_id}`;
    if (!ledgerBillNos.has(payRef)) {
      missing.push({ type: 'Payment', id: p.payment_id, date: p.payment_date, amount: p.total_amount, info: `Reference: ${payRef}` });
    }
  }

  // 3. Check Sales table
  console.log('Checking Sales table...');
  // Note: In Sales, bank_payment > 0 usually goes to a bank account. 
  // We need to see if Ubl bank was the intended bank.
  // The sample ledger showed bill_no as the sale_id (e.g., "6783").
  const sales = await prisma.sale.findMany({
    where: { bank_payment: { gt: 0 } }
  });

  for (const s of sales) {
    const saleIdStr = String(s.sale_id);
    const saleBillNoStr = s.bill_number ? String(s.bill_number) : null;
    
    // Check if either sale_id or bill_number is in ledger bill_no
    if (!ledgerBillNos.has(saleIdStr) && (!saleBillNoStr || !ledgerBillNos.has(saleBillNoStr))) {
      // It's possible it's missing, but we only care if it was supposed to go to UBL.
      // If the detail mentions UBL, it's definitely missing for UBL.
      if (s.bank_title && s.bank_title.toLowerCase().includes('ubl')) {
        missing.push({ type: 'Sale', id: s.sale_id, date: s.created_at, amount: s.bank_payment, info: `Sale ID: ${s.sale_id}, Bank: ${s.bank_title}` });
      }
    }
  }

  // 4. Check Expenses table
  console.log('Checking Expenses table...');
  const expenses = await prisma.expense.findMany({
    where: { bank_account_id: UBL_BANK_ID }
  });

  for (const e of expenses) {
    const expRef = `EXP-${e.exp_id}`;
    if (!ledgerBillNos.has(expRef) && !ledgerBillNos.has(String(e.exp_id))) {
      missing.push({ type: 'Expense', id: e.exp_id, date: e.created_at, amount: e.exp_amount, info: `Expense ID: ${e.exp_id}` });
    }
  }

  // 5. Check JournalDetails table
  console.log('Checking JournalDetails table...');
  const journalDetails = await prisma.journalDetail.findMany({
    where: { account_id: UBL_BANK_ID },
    include: { journal: true }
  });

  for (const jd of journalDetails) {
    const jRef = `JRN-${jd.journal_id}`;
    if (!ledgerBillNos.has(jRef)) {
      missing.push({ type: 'Journal', id: jd.journal_id, date: jd.journal.journal_date, amount: jd.debit_amount || jd.credit_amount, info: `Journal ID: ${jd.journal_id}` });
    }
  }

  console.log('\n--- MISSING ENTRIES REPORT ---');
  if (missing.length === 0) {
    console.log('No missing ledger entries found for Ubl bank.');
  } else {
    console.log(`Found ${missing.length} potentially missing entries.`);
    console.table(missing);
  }

  await prisma.$disconnect();
}

findMissingLedgerEntries().catch((e) => {
  console.error(e);
  process.exit(1);
});
