/**
 * Compare Cash Report ledger math vs Day End snapshot / saved closes.
 * Usage: node scripts/compare-day-end-cash-report.js [YYYY-MM-DD]
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PK_OFFSET = '+05:00';

function pkDayRange(dateStr) {
  return {
    gte: new Date(`${dateStr}T00:00:00.000${PK_OFFSET}`),
    lte: new Date(`${dateStr}T23:59:59.999${PK_OFFSET}`),
  };
}

function n(val) {
  const num = parseFloat(val);
  return Number.isFinite(num) ? num : 0;
}

function money(val) {
  return Math.round(n(val) * 100) / 100;
}

function isCashBankMemo(entry) {
  const det = String(entry?.details || '');
  if (!det.includes('no receivable change')) return false;
  const d = n(entry.debit_amount);
  const c = n(entry.credit_amount);
  return d > 0 && c > 0 && Math.abs(d - c) < 0.02;
}

async function getCashCategoryIds() {
  const rows = await prisma.customerCategory.findMany({
    where: { cus_cat_title: { contains: 'cash' } },
    select: { cus_cat_id: true },
  });
  return rows.map((r) => r.cus_cat_id);
}

async function getLedgerOpeningBefore(categoryIds, beforeDate) {
  if (!categoryIds?.length || !beforeDate) return 0;
  const lastPriorEntry = await prisma.ledger.findFirst({
    where: {
      customer: { cus_category: { in: categoryIds } },
      created_at: { lt: beforeDate },
    },
    orderBy: [{ created_at: 'desc' }, { l_id: 'desc' }],
    select: { closing_balance: true },
  });
  return lastPriorEntry ? n(lastPriorEntry.closing_balance) : 0;
}

async function loadCashBankDayTotals(dateStr) {
  const range = pkDayRange(dateStr);
  const cashCategoryIds = await getCashCategoryIds();
  const ledgerEntries = await prisma.ledger.findMany({
    where: {
      created_at: range,
      customer: { cus_category: { in: cashCategoryIds } },
    },
    include: { customer: { select: { cus_category: true } } },
  });
  let ledgerCashIn = 0;
  let ledgerCashOut = 0;
  const cashLedgerEntries = [];
  for (const entry of ledgerEntries) {
    if (isCashBankMemo(entry)) continue;
    const debit = n(entry.debit_amount);
    const credit = n(entry.credit_amount);
    if (debit <= 0 && credit <= 0) continue;
    ledgerCashIn += debit;
    ledgerCashOut += credit;
    cashLedgerEntries.push(entry);
  }
  const openingCash = await getLedgerOpeningBefore(cashCategoryIds, range.gte);
  return {
    openingCash: money(openingCash),
    totalCashInflow: money(ledgerCashIn),
    totalCashOutflow: money(ledgerCashOut),
    expectedCashInHand: money(openingCash + ledgerCashIn - ledgerCashOut),
    cashLedgerEntries,
  };
}

async function getPrevClosedOpening(branchId, dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const biz = new Date(Date.UTC(y, m - 1, d));
  const prevClosed = await prisma.dayEnd.findFirst({
    where: {
      branch_id: branchId,
      business_date: { lt: biz },
      status: 'CLOSED',
    },
    orderBy: { business_date: 'desc' },
  });
  if (!prevClosed) return null;
  if (prevClosed.closing_cash != null) return n(prevClosed.closing_cash);
  if (prevClosed.cash_in_hand != null) return n(prevClosed.cash_in_hand);
  return null;
}

async function main() {
  const argDate = process.argv[2];
  const branchId = 1;

  let dates = [];
  if (argDate) {
    dates = [argDate];
  } else {
    const closes = await prisma.dayEnd.findMany({
      where: { branch_id: branchId, status: 'CLOSED' },
      orderBy: { business_date: 'desc' },
      take: 7,
      select: { business_date: true },
    });
    dates = closes.map((d) => {
      const b = d.business_date;
      return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, '0')}-${String(b.getUTCDate()).padStart(2, '0')}`;
    });
    if (!dates.length) {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
      dates = [today];
    }
  }

  console.log('Branch', branchId, '| dates:', dates.join(', '), '\n');

  for (const dateStr of dates) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const biz = new Date(Date.UTC(y, m - 1, d));
    const dayEnd = await prisma.dayEnd.findFirst({
      where: { branch_id: branchId, business_date: biz },
      include: { day_end_details: true },
    });

    const cashReport = await loadCashBankDayTotals(dateStr);
    const ledgerOpening = cashReport.openingCash;
    const prevClosedOpening = await getPrevClosedOpening(branchId, dateStr);
    const dayEndOpening =
      dayEnd?.status === 'CLOSED' && dayEnd.opening_cash != null
        ? n(dayEnd.opening_cash)
        : prevClosedOpening != null
          ? prevClosedOpening
          : ledgerOpening;

    const expectedFromDEOpening = money(dayEndOpening + cashReport.totalCashInflow - cashReport.totalCashOutflow);

    const detailCashIn = (dayEnd?.day_end_details || []).filter((x) => x.transaction_type === 'CASH_IN');
    const detailCashOut = (dayEnd?.day_end_details || []).filter((x) => x.transaction_type === 'CASH_OUT');
    const ledgerCashLids = new Set(cashReport.cashLedgerEntries.map((e) => e.l_id));
    const detailLids = new Set([
      ...detailCashIn.map((x) => x.transaction_id),
      ...detailCashOut.map((x) => x.transaction_id),
    ]);
    const inDetailsNotInLedger = [...detailLids].filter((id) => !ledgerCashLids.has(id));
    const inLedgerNotInDetails = [...ledgerCashLids].filter((id) => !detailLids.has(id));

    const diff = (a, b) => money(a - b);

    console.log('===', dateStr, dayEnd ? `day_end_id=${dayEnd.day_end_id} ${dayEnd.status}` : 'NO day_ends row', '===');
    console.log('Opening:');
    console.log('  Cash Report (ledger):              ', cashReport.openingCash);
    console.log('  Prev closed physical closing_cash: ', prevClosedOpening != null ? money(prevClosedOpening) : '(none)');
    console.log('  Day End uses (saved or chain):     ', money(dayEndOpening));
    console.log('  Saved opening_cash:                ', dayEnd ? money(dayEnd.opening_cash) : '-');
    console.log('Flows (same logic both sides):       in', cashReport.totalCashInflow, 'out', cashReport.totalCashOutflow);
    console.log('Expected closing:');
    console.log('  Cash Report (ledger opening):      ', cashReport.expectedCashInHand);
    console.log('  If Day End opening chain:          ', expectedFromDEOpening);
    console.log('  Saved cash_in_hand (expected):     ', dayEnd?.cash_in_hand != null ? money(dayEnd.cash_in_hand) : '-');
    console.log('  Physical closing_cash:             ', dayEnd?.closing_cash != null ? money(dayEnd.closing_cash) : '-');
    console.log('Closing History shows closing_cash, NOT ledger closing — compare Cash Report to cash_in_hand / expected.');
    console.log('Detail transaction_id (l_id) vs cash ledger:');
    console.log('  CASH_IN rows:', detailCashIn.length, '| debits in ledger:', cashReport.cashLedgerEntries.filter((e) => n(e.debit_amount) > 0).length);
    console.log('  CASH_OUT rows:', detailCashOut.length, '| credits in ledger:', cashReport.cashLedgerEntries.filter((e) => n(e.credit_amount) > 0).length);
    console.log('  Detail ids not in ledger:', inDetailsNotInLedger.length || 'none');
    console.log('  Ledger l_ids missing from details:', inLedgerNotInDetails.length || 'none');
    const byType = {};
    for (const row of dayEnd?.day_end_details || []) {
      byType[row.transaction_type] = (byType[row.transaction_type] || 0) + 1;
    }
    console.log('  day_end_details by type:', JSON.stringify(byType));
    console.log('');

    if (Math.abs(diff(cashReport.expectedCashInHand, expectedFromDEOpening)) > 0.01) {
      console.log('  >>> Opening chain differs from ledger by', diff(expectedFromDEOpening, cashReport.expectedCashInHand));
    }
    if (dayEnd?.cash_in_hand != null && Math.abs(diff(dayEnd.cash_in_hand, cashReport.expectedCashInHand)) > 0.01) {
      console.log('  >>> Saved cash_in_hand differs from current Cash Report by', diff(dayEnd.cash_in_hand, cashReport.expectedCashInHand));
    }
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
