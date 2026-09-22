require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PK_OFFSET = '+05:00';

function n(val) {
  const num = parseFloat(val);
  return Number.isFinite(num) ? num : 0;
}

function fmt(val) {
  return n(val).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function getTodayPk() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}

function pkDayRange(dateStr) {
  return {
    gte: new Date(`${dateStr}T00:00:00.000${PK_OFFSET}`),
    lte: new Date(`${dateStr}T23:59:59.999${PK_OFFSET}`),
  };
}

function isBankAccount(acc) {
  const typeTitle = String(acc.customer_type?.cus_type_title || '').toLowerCase();
  const catTitle = String(acc.customer_category?.cus_cat_title || '').toLowerCase();
  const name = String(acc.cus_name || '').toLowerCase();
  return catTitle.includes('bank') || typeTitle.includes('bank') || name.includes('bank');
}

function isCashAccount(acc) {
  if (isBankAccount(acc)) return false;
  const typeTitle = String(acc.customer_type?.cus_type_title || '').toLowerCase();
  const catTitle = String(acc.customer_category?.cus_cat_title || '').toLowerCase();
  const name = String(acc.cus_name || '').toLowerCase();
  return (
    catTitle.includes('cash account') ||
    catTitle === 'cash' ||
    typeTitle === 'cash' ||
    name.includes('cash')
  ) && catTitle !== 'customer' && catTitle !== 'supplier';
}

function isReportMemo(entry) {
  const det = String(entry.details || '');
  if (!det.includes('no receivable change')) return false;
  const d = n(entry.debit_amount);
  const c = n(entry.credit_amount);
  return d > 0 && c > 0 && Math.abs(d - c) < 0.02;
}

async function main() {
  const today = getTodayPk();
  const range = pkDayRange(today);
  const [y, m, d] = today.split('-').map(Number);
  const businessDate = new Date(Date.UTC(y, m - 1, d));

  const [accounts, ledgerEntries, dayEndRecord, sales, expenses] = await Promise.all([
    prisma.customer.findMany({
      where: { branch_id: 1 },
      include: {
        customer_type: { select: { cus_type_title: true } },
        customer_category: { select: { cus_cat_title: true } },
      },
    }),
    prisma.ledger.findMany({
      where: { branch_id: 1, created_at: range },
      include: {
        customer: {
          include: {
            customer_type: { select: { cus_type_title: true } },
            customer_category: { select: { cus_cat_title: true } },
          },
        },
      },
    }),
    prisma.dayEnd.findFirst({
      where: { branch_id: 1, business_date: businessDate },
    }),
    prisma.sale.findMany({
      where: { branch_id: 1, created_at: range, bill_type: 'BILL' },
      select: { total_amount: true, discount: true, shipping_amount: true, cash_payment: true, bank_payment: true, payment: true, payment_type: true },
    }),
    prisma.expense.findMany({
      where: { branch_id: 1, created_at: range },
      select: { exp_amount: true, cash_amount: true, bank_amount: true, exp_title: true },
    }),
  ]);

  let cashIn = 0;
  let cashOut = 0;
  let bankIn = 0;
  let bankOut = 0;
  let cashBalanceNow = 0;
  let bankBalanceNow = 0;

  const cashAccounts = [];
  const bankAccounts = [];

  for (const acc of accounts) {
    if (isBankAccount(acc)) {
      bankBalanceNow += n(acc.cus_balance);
      bankAccounts.push({ name: acc.cus_name, balance: n(acc.cus_balance) });
    } else if (isCashAccount(acc)) {
      cashBalanceNow += n(acc.cus_balance);
      cashAccounts.push({ name: acc.cus_name, balance: n(acc.cus_balance) });
    }
  }

  for (const entry of ledgerEntries) {
    if (isReportMemo(entry)) continue;
    const debit = n(entry.debit_amount);
    const credit = n(entry.credit_amount);
    if (debit <= 0 && credit <= 0) continue;

    const accLike = entry.customer || {};
    if (isBankAccount(accLike)) {
      bankIn += debit;
      bankOut += credit;
    } else if (isCashAccount(accLike)) {
      cashIn += debit;
      cashOut += credit;
    }
  }

  const prevClosed = await prisma.dayEnd.findFirst({
    where: { branch_id: 1, business_date: { lt: businessDate }, status: 'CLOSED' },
    orderBy: { business_date: 'desc' },
  });

  let openingCash = 0;
  if (dayEndRecord?.opening_cash != null) openingCash = n(dayEndRecord.opening_cash);
  else if (prevClosed?.closing_cash != null) openingCash = n(prevClosed.closing_cash);

  const expectedCashInHand = Math.round((openingCash + cashIn - cashOut) * 100) / 100;
  const netCashToday = cashIn - cashOut;

  let totalSales = 0;
  for (const sale of sales) {
    totalSales += n(sale.total_amount) - n(sale.discount) + n(sale.shipping_amount);
  }

  let totalExpenses = 0;
  for (const exp of expenses) {
    totalExpenses += n(exp.exp_amount);
  }

  console.log(JSON.stringify({
    date: today,
    branch: 'Main branch (branch_id: 1)',
    cashIn,
    cashOut,
    netCashMovementToday: netCashToday,
    openingCash,
    expectedCashInHandToday: expectedCashInHand,
    currentCashAccountBalance: cashBalanceNow,
    bankIn,
    bankOut,
    netBankMovementToday: bankIn - bankOut,
    currentBankAccountBalance: bankBalanceNow,
    totalSalesToday: totalSales,
    totalExpensesToday: totalExpenses,
    cashAccounts,
    bankAccounts,
    dayEndStatus: dayEndRecord?.status || 'OPEN',
  }, null, 2));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
