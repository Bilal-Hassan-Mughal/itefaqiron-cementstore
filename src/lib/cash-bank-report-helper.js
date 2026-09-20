import { pkDayRange } from './date-helper.js';

function n(val) {
  const num = parseFloat(val);
  return Number.isFinite(num) ? num : 0;
}

export function money(val) {
  return Math.round(n(val) * 100) / 100;
}

/** Same memo filter as Cash Report / Bank Report */
export function isCashBankMemo(entry) {
  const det = String(entry?.details || '');
  if (!det.includes('no receivable change')) return false;
  const d = n(entry.debit_amount);
  const c = n(entry.credit_amount);
  return d > 0 && c > 0 && Math.abs(d - c) < 0.02;
}

export async function getCashCategoryIds(prisma) {
  const rows = await prisma.customerCategory.findMany({
    where: { cus_cat_title: { contains: 'cash' } },
    select: { cus_cat_id: true },
  });
  return rows.map((r) => r.cus_cat_id);
}

export async function getBankCategoryIds(prisma) {
  const rows = await prisma.customerCategory.findMany({
    where: { cus_cat_title: { contains: 'bank' } },
    select: { cus_cat_id: true },
  });
  return rows.map((r) => r.cus_cat_id);
}

/**
 * Opening balance at start of a Pakistan calendar day — matches Cash/Bank Report.
 */
export async function getLedgerOpeningBefore(prisma, categoryIds, beforeDate) {
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

/**
 * Sum cash/bank in & out for ledger rows on the given accounts (excludes memos).
 */
export function sumCashBankLedgerFlow(ledgerEntries, cashCategoryIds, bankCategoryIds) {
  const cashSet = new Set(cashCategoryIds || []);
  const bankSet = new Set(bankCategoryIds || []);

  let ledgerCashIn = 0;
  let ledgerCashOut = 0;
  let ledgerBankIn = 0;
  let ledgerBankOut = 0;
  const cashLedgerEntries = [];
  const bankLedgerEntries = [];

  for (const entry of ledgerEntries || []) {
    if (isCashBankMemo(entry)) continue;

    const catId = entry.customer?.cus_category;
    const debit = n(entry.debit_amount);
    const credit = n(entry.credit_amount);
    if (debit <= 0 && credit <= 0) continue;

    if (cashSet.has(catId)) {
      ledgerCashIn += debit;
      ledgerCashOut += credit;
      cashLedgerEntries.push(entry);
    } else if (bankSet.has(catId)) {
      ledgerBankIn += debit;
      ledgerBankOut += credit;
      bankLedgerEntries.push(entry);
    }
  }

  return {
    ledgerCashIn,
    ledgerCashOut,
    ledgerBankIn,
    ledgerBankOut,
    cashLedgerEntries,
    bankLedgerEntries,
  };
}

/**
 * Cash/bank opening + in/out + expected closing for one day (Cash Report logic).
 */
export async function loadCashBankDayTotals(prisma, dateStr) {
  const range = pkDayRange(dateStr);
  const [cashCategoryIds, bankCategoryIds] = await Promise.all([
    getCashCategoryIds(prisma),
    getBankCategoryIds(prisma),
  ]);

  const ledgerEntries = await prisma.ledger.findMany({
    where: { created_at: range },
    include: {
      customer: {
        select: {
          cus_id: true,
          cus_name: true,
          cus_category: true,
          customer_category: { select: { cus_cat_title: true } },
          customer_type: { select: { cus_type_title: true } },
        },
      },
    },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
  });

  ledgerEntries.sort((a, b) => {
    const timeDiff = a.created_at.getTime() - b.created_at.getTime();
    if (timeDiff !== 0) return timeDiff;
    const billA = parseInt(String(a.bill_no || '').replace(/\D/g, ''), 10) || 0;
    const billB = parseInt(String(b.bill_no || '').replace(/\D/g, ''), 10) || 0;
    if (billA !== billB) return billA - billB;
    return a.l_id - b.l_id;
  });

  const [openingCash, openingBank] = await Promise.all([
    getLedgerOpeningBefore(prisma, cashCategoryIds, range.gte),
    getLedgerOpeningBefore(prisma, bankCategoryIds, range.gte),
  ]);

  const flow = sumCashBankLedgerFlow(ledgerEntries, cashCategoryIds, bankCategoryIds);

  const expectedCashInHand = money(openingCash + flow.ledgerCashIn - flow.ledgerCashOut);
  const expectedClosingBank = money(openingBank + flow.ledgerBankIn - flow.ledgerBankOut);

  return {
    cashCategoryIds,
    bankCategoryIds,
    openingCash: money(openingCash),
    openingBank: money(openingBank),
    totalCashInflow: money(flow.ledgerCashIn),
    totalCashOutflow: money(flow.ledgerCashOut),
    totalBankInflow: money(flow.ledgerBankIn),
    totalBankOutflow: money(flow.ledgerBankOut),
    expectedCashInHand,
    expectedClosingBank,
    netBankFlow: money(flow.ledgerBankIn - flow.ledgerBankOut),
    cashLedgerEntries: flow.cashLedgerEntries,
    bankLedgerEntries: flow.bankLedgerEntries,
  };
}
