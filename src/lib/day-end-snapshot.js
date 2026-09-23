import { getPkDateString, pkBusinessDate, pkDayRange, shiftPkDate } from '@/lib/date-helper';
import {
  getCashCategoryIds,
  getBankCategoryIds,
  getLedgerOpeningBefore,
  sumCashBankLedgerFlow,
} from '@/lib/cash-bank-report-helper';

function n(val) {
  const num = parseFloat(val);
  return Number.isFinite(num) ? num : 0;
}

function money(val) {
  return Math.round(n(val) * 100) / 100;
}

export function mapTrnxToPaymentType(transactionType) {
  const mapping = {
    CASH: 'CASH',
    CHEQUE: 'CHEQUE',
    BANK_TRANSFER: 'BANK_TRANSFER',
    BANK_PAYMENT: 'BANK_TRANSFER',
    CASH_PAYMENT: 'CASH',
    PURCHASE: 'CASH',
    SALE: 'CASH',
    SALE_RETURN: 'CASH',
    PURCHASE_RETURN: 'CASH',
  };
  return mapping[transactionType] || 'CASH';
}

export function saleNetTotal(sale) {
  return n(sale.total_amount);
}

export function splitPaidAmounts(doc, netTotal) {
  const cash = n(doc.cash_payment ?? doc.cash_return ?? doc.cash_amount);
  const bank = n(doc.bank_payment ?? doc.bank_return ?? doc.bank_amount);
  if (cash > 0 || bank > 0) {
    const paid = cash + bank;
    return { cash, bank, credit: Math.max(0, n(netTotal) - paid) };
  }
  const pVal = n(doc.payment);
  const pType = String(doc.payment_type || '').toUpperCase();
  if (pVal > 0) {
    if (pType === 'BANK_TRANSFER' || pType === 'CHEQUE' || pType === 'BANK' || pType === 'BANK_PAYMENT') {
      return { cash: 0, bank: pVal, credit: Math.max(0, n(netTotal) - pVal) };
    }
    if (pType === 'CASH' || pType === 'CASH_PAYMENT' || !pType) {
      return { cash: pVal, bank: 0, credit: Math.max(0, n(netTotal) - pVal) };
    }
  }
  return { cash: 0, bank: 0, credit: n(netTotal) };
}

function classifyCashBankAccount(acc) {
  const typeTitle = String(acc.customer_type?.cus_type_title || '').toLowerCase();
  const catTitle = String(acc.customer_category?.cus_cat_title || '').toLowerCase();
  const name = String(acc.cus_name || '').toLowerCase();
  const bal = n(acc.cus_balance);
  const isBank = catTitle.includes('bank') || typeTitle.includes('bank') || name.includes('bank');
  const isCash = !isBank &&
    (catTitle.includes('cash account') || catTitle === 'cash' || typeTitle === 'cash' || name.includes('cash')) &&
    catTitle !== 'customer' && catTitle !== 'supplier';
  return { isBank, isCash, bal };
}

function isStandaloneLedger(entry, cashBankCusIds) {
  const trnxType = String(entry.trnx_type || '').toUpperCase();
  const details = String(entry.details || '').toLowerCase();
  const billNo = String(entry.bill_no || '');
  if (['SALE', 'PURCHASE', 'SALE_RETURN', 'PURCHASE_RETURN'].includes(trnxType)) return false;
  if (billNo.startsWith('SALE-') || billNo.startsWith('PUR-') || billNo.startsWith('EXP-') || billNo.startsWith('SR-') || billNo.startsWith('PR-')) return false;
  if (details.includes('no receivable change') || details.includes('expense:') || details.includes('stock adjustment')) return false;
  if (cashBankCusIds.has(entry.cus_id)) return false;
  const d = n(entry.debit_amount);
  const c = n(entry.credit_amount);
  if (d > 0 && c > 0 && Math.abs(d - c) < 0.01) return false;
  return n(d) > 0 || n(c) > 0;
}

function isReportMemo(entry) {
  const det = String(entry.details || '');
  if (!det.includes('no receivable change')) return false;
  const d = n(entry.debit_amount);
  const c = n(entry.credit_amount);
  return d > 0 && c > 0 && Math.abs(d - c) < 0.02;
}

function ledgerCategoryTitle(entry) {
  return String(entry.customer?.customer_category?.cus_cat_title || '').toLowerCase();
}

function isBankLedgerAccount(entry) {
  return ledgerCategoryTitle(entry).includes('bank');
}

function isCashLedgerAccount(entry) {
  const cat = ledgerCategoryTitle(entry);
  return cat.includes('cash') && !cat.includes('bank');
}

function classifyLedgerEntry(entry) {
  const trnxType = String(entry.trnx_type || '').toUpperCase();
  const details = String(entry.details || '').toLowerCase();
  const d = n(entry.debit_amount);
  const c = n(entry.credit_amount);
  const isBank = trnxType === 'BANK_TRANSFER' || trnxType === 'CHEQUE' ||
    String(entry.customer?.customer_type?.cus_type_title || '').toLowerCase().includes('bank') ||
    String(entry.customer?.customer_category?.cus_cat_title || '').toLowerCase().includes('bank') ||
    n(entry.bank_payment) > 0 ||
    details.includes('bank');
  const entryAmt = d > 0 ? d : c;
  const ledgerType = String(entry.ledger_type || '').toLowerCase();
  const isReceipt = c > 0 || ledgerType === 'receiving' || ledgerType === 'receipt' || details.includes('received') || details.includes('receipt');
  const isPayment = !isReceipt && (d > 0 || ledgerType === 'payment' || ledgerType === 'pay' || details.includes('paid'));
  return { isBank, entryAmt, isReceipt, isPayment, debit: d, credit: c };
}

export async function loadDayEndSnapshot(prisma, { dateStr, openingCashOverride, dayEndRecord, branchId }) {
  const range = pkDayRange(dateStr);
  const customerInclude = {
    customer_type: { select: { cus_type_title: true } },
    customer_category: { select: { cus_cat_title: true } },
  };

  const [
    cashAndBankAccounts,
    sales,
    purchases,
    expenses,
    ledgerEntries,
    saleReturns,
    purchaseReturns,
    saleDetails,
    openOrdersCount,
    holdBillsCount,
    draftJournalsCount,
    products,
    cashCategoryIds,
    bankCategoryIds,
  ] = await Promise.all([
    prisma.customer.findMany({
      where: {
        OR: [
          { customer_type: { cus_type_title: { contains: 'cash' } } },
          { customer_type: { cus_type_title: { contains: 'bank' } } },
          { customer_category: { cus_cat_title: { contains: 'cash' } } },
          { customer_category: { cus_cat_title: { contains: 'bank' } } },
        ],
      },
      include: customerInclude,
    }),
    prisma.sale.findMany({
      where: { created_at: range, bill_type: 'BILL' },
      include: { customer: { select: { cus_name: true } } },
      orderBy: { created_at: 'desc' },
    }),
    prisma.purchase.findMany({
      where: { created_at: range },
      include: { customer: { select: { cus_name: true } } },
      orderBy: { created_at: 'desc' },
    }),
    prisma.expense.findMany({
      where: { created_at: range },
      include: { expense_title: true },
      orderBy: { created_at: 'desc' },
    }),
    prisma.ledger.findMany({
      where: { created_at: range },
      include: {
        customer: {
          select: { cus_id: true, cus_name: true, cus_category: true, ...customerInclude },
        },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.saleReturn.findMany({
      where: { created_at: range },
      include: {
        customer: { select: { cus_name: true } },
        return_details: {
          include: {
            product: { select: { pro_title: true, pro_cost_price: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.purchaseReturn.findMany({
      where: { created_at: range },
      orderBy: { created_at: 'desc' },
    }),
    prisma.saleDetail.findMany({
      where: { created_at: range, sale: { bill_type: 'BILL' } },
      include: { product: { select: { pro_title: true, pro_cost_price: true } } },
    }),
    prisma.sale.count({ where: { created_at: range, bill_type: 'ORDER' } }),
    prisma.holdBill.count({ where: { created_at: range, status: 'DRAFT' } }),
    prisma.journal.count({ where: { journal_date: new Date(`${dateStr}T00:00:00.000Z`), status: 'DRAFT' } }),
    prisma.product.findMany({ select: { pro_stock_qnty: true, pro_cost_price: true } }),
    getCashCategoryIds(prisma),
    getBankCategoryIds(prisma),
  ]);

  const cashAccounts = [];
  const bankAccounts = [];
  const cashBankCusIds = new Set();
  let totalCashAccountsBalance = 0;
  let totalBankAccountsBalance = 0;

  cashAndBankAccounts.forEach((acc) => {
    cashBankCusIds.add(acc.cus_id);
    const { isBank, isCash, bal } = classifyCashBankAccount(acc);
    if (isBank) {
      totalBankAccountsBalance += bal;
      bankAccounts.push({ cus_id: acc.cus_id, cus_name: acc.cus_name, balance: bal });
    } else if (isCash) {
      totalCashAccountsBalance += bal;
      cashAccounts.push({ cus_id: acc.cus_id, cus_name: acc.cus_name, balance: bal });
    }
  });

  let totalSales = 0;
  let cashSales = 0;
  let bankSales = 0;
  let creditSales = 0;
  sales.forEach((sale) => {
    const netTotal = saleNetTotal(sale);
    totalSales += netTotal;
    const split = splitPaidAmounts(sale, netTotal);
    cashSales += split.cash;
    bankSales += split.bank;
    creditSales += split.credit;
  });

  let totalPurchases = 0;
  let cashPurchases = 0;
  let bankPurchases = 0;
  let creditPurchases = 0;
  purchases.forEach((pur) => {
    const netTotal = n(pur.net_total || pur.total_amount);
    totalPurchases += netTotal;
    const split = splitPaidAmounts(pur, netTotal);
    cashPurchases += split.cash;
    bankPurchases += split.bank;
    creditPurchases += split.credit;
  });

  let totalExpenses = 0;
  let cashExpenses = 0;
  let bankExpenses = 0;
  expenses.forEach((exp) => {
    const amt = n(exp.exp_amount);
    totalExpenses += amt;
    const cashAmt = n(exp.cash_amount);
    const bankAmt = n(exp.bank_amount);
    if (cashAmt > 0 || bankAmt > 0) {
      cashExpenses += cashAmt;
      bankExpenses += bankAmt;
    } else if (exp.is_paid !== false) {
      cashExpenses += amt;
    }
  });

  let totalSaleReturns = 0;
  let cashSaleReturns = 0;
  let bankSaleReturns = 0;
  saleReturns.forEach((ret) => {
    const netTotal = n(ret.total_amount) - n(ret.discount) - n(ret.shipping_amount) - n(ret.labour_charges);
    totalSaleReturns += netTotal;
    const split = splitPaidAmounts(ret, n(ret.payment) || netTotal);
    cashSaleReturns += split.cash;
    bankSaleReturns += split.bank;
  });

  let totalPurchaseReturns = 0;
  purchaseReturns.forEach((ret) => {
    totalPurchaseReturns += n(ret.total_return_amount);
  });
  const cashPurchaseReturns = totalPurchaseReturns;

  let totalReceipts = 0;
  let cashReceipts = 0;
  let bankReceipts = 0;
  let totalPayments = 0;
  let cashPayments = 0;
  let bankPayments = 0;
  const standaloneLedgers = [];

  ledgerEntries.forEach((entry) => {
    if (!isStandaloneLedger(entry, cashBankCusIds)) return;
    const classified = classifyLedgerEntry(entry);
    if (classified.entryAmt <= 0) return;
    standaloneLedgers.push(entry);
    if (classified.isReceipt) {
      totalReceipts += classified.entryAmt;
      if (classified.isBank) bankReceipts += classified.entryAmt;
      else cashReceipts += classified.entryAmt;
    } else if (classified.isPayment) {
      totalPayments += classified.entryAmt;
      if (classified.isBank) bankPayments += classified.entryAmt;
      else cashPayments += classified.entryAmt;
    }
  });

  const {
    ledgerCashIn,
    ledgerCashOut,
    ledgerBankIn,
    ledgerBankOut,
    cashLedgerEntries,
    bankLedgerEntries,
  } = sumCashBankLedgerFlow(ledgerEntries, cashCategoryIds, bankCategoryIds);

  const totalCashInflow = ledgerCashIn;
  const totalCashOutflow = ledgerCashOut;
  const totalBankInflow = ledgerBankIn;
  const totalBankOutflow = ledgerBankOut;
  const netBankFlow = totalBankInflow - totalBankOutflow;
  totalReceipts = totalCashInflow + totalBankInflow;
  totalPayments = totalCashOutflow + totalBankOutflow;
  cashReceipts = totalCashInflow;
  cashPayments = totalCashOutflow;
  bankReceipts = totalBankInflow;
  bankPayments = totalBankOutflow;

  const effectiveBranchId = branchId !== undefined ? branchId : dayEndRecord?.branch_id;
  const prevClosedWhere = {
    business_date: { lt: pkBusinessDate(dateStr) },
    status: 'CLOSED',
  };
  if (effectiveBranchId !== undefined && effectiveBranchId !== null) {
    prevClosedWhere.branch_id = effectiveBranchId;
  }
  const prevClosed = await prisma.dayEnd.findFirst({
    where: prevClosedWhere,
    orderBy: { business_date: 'desc' },
  });
  const prevClosedDate = prevClosed?.business_date ? getPkDateString(prevClosed.business_date) : null;
  const prevClosedClosingCash = prevClosed
    ? (prevClosed.closing_cash != null
        ? n(prevClosed.closing_cash)
        : (prevClosed.cash_in_hand != null ? n(prevClosed.cash_in_hand) : null))
    : null;

  const [ledgerOpeningCash, ledgerOpeningBank] = await Promise.all([
    getLedgerOpeningBefore(prisma, cashCategoryIds, range.gte),
    getLedgerOpeningBefore(prisma, bankCategoryIds, range.gte),
  ]);

  let openingCash;
  let openingCashSource = 'LEDGER';
  if (dayEndRecord?.status === 'CLOSED' && dayEndRecord?.opening_cash != null) {
    openingCash = n(dayEndRecord.opening_cash);
    openingCashSource = 'FROZEN';
  } else if (openingCashOverride !== undefined && openingCashOverride !== null && openingCashOverride !== '') {
    openingCash = n(openingCashOverride);
    openingCashSource = 'ENTERED';
  } else if (prevClosed && prevClosedClosingCash !== null) {
    openingCash = prevClosedClosingCash;
    openingCashSource = 'PREV_CLOSED';
  } else {
    openingCash = ledgerOpeningCash;
    openingCashSource = 'LEDGER';
  }

  const expectedCashInHand = money(openingCash + totalCashInflow - totalCashOutflow);
  const actualClosingCash = dayEndRecord?.closing_cash != null ? money(dayEndRecord.closing_cash) : null;
  const variance = actualClosingCash != null ? money(actualClosingCash - expectedCashInHand) : 0;

  const openingBank = ledgerOpeningBank;
  const expectedClosingBank = money(openingBank + netBankFlow);
  const savedClosingBank = dayEndRecord?.bank_balance != null ? n(dayEndRecord.bank_balance) : null;

  let totalSalesCOGS = 0;
  const itemMap = {};
  saleDetails.forEach((sd) => {
    const title = sd.product?.pro_title || `Product #${sd.pro_id}`;
    const amt = n(sd.net_total || sd.total_amount);
    const qty = n(sd.qnty);
    const cost = n(sd.product?.pro_cost_price);
    totalSalesCOGS += qty * cost;
    if (!itemMap[title]) itemMap[title] = { name: title, amount: 0, qty: 0 };
    itemMap[title].amount += amt;
    itemMap[title].qty += qty;
  });
  const topSellingItems = Object.values(itemMap).sort((a, b) => b.amount - a.amount).slice(0, 5);

  let returnCOGS = 0;
  saleReturns.forEach((ret) => {
    (ret.return_details || []).forEach((rd) => {
      const qty = n(rd.qnty);
      const cost = n(rd.product?.pro_cost_price);
      returnCOGS += qty * cost;
    });
  });

  const totalCOGS = totalSalesCOGS;
  const netSales = totalSales - totalSaleReturns;
  const netCOGS = totalSalesCOGS - returnCOGS;
  const grossProfit = netSales - netCOGS;
  const netProfit = grossProfit - totalExpenses;
  const profitMargin = netSales > 0 ? parseFloat(((netProfit / netSales) * 100).toFixed(2)) : 0;

  const currentStockValue = products.reduce(
    (sum, p) => sum + n(p.pro_stock_qnty) * n(p.pro_cost_price),
    0
  );

  const isClosed = dayEndRecord?.status === 'CLOSED';
  const cashCounted = actualClosingCash != null;
  const checklistStatus = [
    { id: 1, title: `Sales invoices posted (${sales.length})`, status: 'Completed' },
    { id: 2, title: `Sale returns posted (${saleReturns.length})`, status: 'Completed' },
    { id: 3, title: `Purchase bills posted (${purchases.length})`, status: 'Completed' },
    { id: 4, title: `Purchase returns posted (${purchaseReturns.length})`, status: 'Completed' },
    { id: 5, title: `Cash/bank in posted (${cashLedgerEntries.filter((e) => n(e.debit_amount) > 0).length + bankLedgerEntries.filter((e) => n(e.debit_amount) > 0).length})`, status: 'Completed' },
    { id: 6, title: `Cash/bank out posted (${cashLedgerEntries.filter((e) => n(e.credit_amount) > 0).length + bankLedgerEntries.filter((e) => n(e.credit_amount) > 0).length})`, status: 'Completed' },
    { id: 7, title: 'Physical cash count entered', status: cashCounted ? 'Completed' : 'Pending' },
    { id: 8, title: 'Bank closing balance recorded', status: isClosed || savedClosingBank != null ? 'Completed' : 'Pending' },
    { id: 9, title: openOrdersCount > 0 ? `Open orders still pending (${openOrdersCount})` : 'No open orders pending', status: openOrdersCount > 0 ? 'Pending' : 'Completed' },
    { id: 10, title: holdBillsCount > 0 ? `Hold bills still pending (${holdBillsCount})` : 'No hold bills pending', status: holdBillsCount > 0 ? 'Pending' : 'Completed' },
    { id: 11, title: draftJournalsCount > 0 ? `Draft journals still pending (${draftJournalsCount})` : 'No draft journals pending', status: draftJournalsCount > 0 ? 'Pending' : 'Completed' },
    { id: 12, title: 'Previous business day is closed (or had no bills)', status: isClosed ? 'Completed' : 'Pending' },
  ];

  const trendStart = pkDayRange(shiftPkDate(dateStr, -6))?.gte;
  const [trendSales, trendPurchases] = await Promise.all([
    prisma.sale.findMany({
      where: { created_at: { gte: trendStart, lte: range.lte }, bill_type: 'BILL' },
      select: { created_at: true, total_amount: true, discount: true, shipping_amount: true },
    }),
    prisma.purchase.findMany({
      where: { created_at: { gte: trendStart, lte: range.lte } },
      select: { created_at: true, net_total: true, total_amount: true },
    }),
  ]);

  const trend = [];
  for (let i = 6; i >= 0; i -= 1) {
    const dStr = shiftPkDate(dateStr, -i);
    const dayRange = pkDayRange(dStr);
    const [y, m, d] = dStr.split('-').map(Number);
    const label = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      timeZone: 'UTC',
    });
    const daySales = trendSales
      .filter((s) => s.created_at >= dayRange.gte && s.created_at <= dayRange.lte)
      .reduce((sum, s) => sum + saleNetTotal(s), 0);
    const dayPurchases = trendPurchases
      .filter((p) => p.created_at >= dayRange.gte && p.created_at <= dayRange.lte)
      .reduce((sum, p) => sum + n(p.net_total || p.total_amount), 0);
    trend.push({ date: dStr, label, sales: daySales, purchases: dayPurchases });
  }

  const openingCashLocked = openingCashSource === 'FROZEN';

  const summary = {
    openingCash: money(openingCash),
    ledgerOpeningCash: money(ledgerOpeningCash),
    openingCashLocked,
    openingCashSource,
    openingCashFromDate: openingCashSource === 'LEDGER' ? dateStr : prevClosedDate,
    totalSales: money(totalSales),
    cashSales: money(cashSales),
    bankSales: money(bankSales),
    creditSales: money(creditSales),
    totalPurchases: money(totalPurchases),
    cashPurchases: money(cashPurchases),
    bankPurchases: money(bankPurchases),
    creditPurchases: money(creditPurchases),
    totalExpenses: money(totalExpenses),
    cashExpenses: money(cashExpenses),
    bankExpenses: money(bankExpenses),
    totalSaleReturns: money(totalSaleReturns),
    cashSaleReturns: money(cashSaleReturns),
    bankSaleReturns: money(bankSaleReturns),
    totalPurchaseReturns: money(totalPurchaseReturns),
    cashPurchaseReturns: money(cashPurchaseReturns),
    totalReceipts: money(totalReceipts),
    cashReceipts: money(cashReceipts),
    bankReceipts: money(bankReceipts),
    totalPayments: money(totalPayments),
    cashPayments: money(cashPayments),
    bankPayments: money(bankPayments),
    totalCashInflow: money(totalCashInflow),
    totalCashOutflow: money(totalCashOutflow),
    expectedCashInHand,
    actualClosingCash,
    variance,
    totalBankInflow: money(totalBankInflow),
    totalBankOutflow: money(totalBankOutflow),
    netBankFlow: money(netBankFlow),
    openingBank: money(openingBank),
    ledgerOpeningBank: money(ledgerOpeningBank),
    openingBankSource: 'LEDGER',
    expectedClosingBank,
    savedClosingBank: savedClosingBank != null ? money(savedClosingBank) : null,
    totalCashAccountsBalance: money(totalCashAccountsBalance),
    totalBankAccountsBalance: money(totalBankAccountsBalance),
    totalCOGS: money(totalSalesCOGS),
    returnCOGS: money(returnCOGS),
    netCOGS: money(netCOGS),
    grossProfit: money(grossProfit),
    netProfit: money(netProfit),
    profitMargin,
    closingBalance: expectedCashInHand,
    closingCashBalance: expectedCashInHand,
    closingCombinedBalance: money(expectedCashInHand + (savedClosingBank ?? expectedClosingBank)),
    cashMovementSource: 'LEDGER_CASH_BANK',
    invoicesCount: sales.length,
    receiptsCount: cashLedgerEntries.filter((e) => n(e.debit_amount) > 0).length
      + bankLedgerEntries.filter((e) => n(e.debit_amount) > 0).length,
    billsCount: purchases.length,
    paymentsCount: cashLedgerEntries.filter((e) => n(e.credit_amount) > 0).length
      + bankLedgerEntries.filter((e) => n(e.credit_amount) > 0).length,
    returnsCount: saleReturns.length,
    openOrdersCount,
    holdBillsCount,
    draftJournalsCount,
  };

  return {
    cashBankCusIds,
    cashAccounts,
    bankAccounts,
    sales,
    purchases,
    expenses,
    ledgerEntries,
    standaloneLedgers,
    cashLedgerEntries,
    bankLedgerEntries,
    saleReturns,
    purchaseReturns,
    summary,
    topSellingItems,
    last7DaysTrend: trend,
    stockSummary: {
      openingStockValue: currentStockValue - totalPurchases + totalPurchaseReturns + netCOGS,
      inwardValue: totalPurchases - totalPurchaseReturns,
      outwardValue: netCOGS,
      closingStockValue: currentStockValue,
      method: 'Current quantity × current product cost',
    },
    checklistStatus,
    todayPk: getPkDateString(),
  };
}

export function buildDayEndDetails(dayEndId, snapshot) {
  const details = [];
  snapshot.sales.forEach((s) => {
    details.push({
      day_end_id: dayEndId,
      transaction_type: 'SALE',
      transaction_id: s.sale_id,
      amount: saleNetTotal(s),
      payment_type: s.payment_type || 'CASH',
      description: `Sale Invoice #${s.bill_number || s.sale_id}`,
    });
  });
  snapshot.purchases.forEach((p) => {
    details.push({
      day_end_id: dayEndId,
      transaction_type: 'PURCHASE',
      transaction_id: p.pur_id,
      amount: n(p.net_total || p.total_amount),
      payment_type: p.payment_type || 'CASH',
      description: `Purchase Bill #${p.invoice_number || p.pur_id}`,
    });
  });
  snapshot.expenses.forEach((e) => {
    details.push({
      day_end_id: dayEndId,
      transaction_type: 'EXPENSE',
      transaction_id: e.exp_id,
      amount: n(e.exp_amount),
      payment_type: n(e.bank_amount) > 0 && n(e.cash_amount) <= 0 ? 'BANK_TRANSFER' : 'CASH',
      description: e.exp_title || 'Expense',
    });
  });
  snapshot.saleReturns.forEach((r) => {
    details.push({
      day_end_id: dayEndId,
      transaction_type: 'SALE_RETURN',
      transaction_id: r.return_id,
      amount: n(r.total_amount) - n(r.discount),
      payment_type: r.payment_type || 'CASH',
      description: `Sale Return #${r.return_id}`,
    });
  });
  snapshot.purchaseReturns.forEach((r) => {
    details.push({
      day_end_id: dayEndId,
      transaction_type: 'PURCHASE_RETURN',
      transaction_id: r.id || r.return_id,
      amount: n(r.total_return_amount),
      payment_type: 'CASH',
      description: `Purchase Return #${r.id || r.return_id}`,
    });
  });
  (snapshot.cashLedgerEntries || []).forEach((l) => {
    const debit = n(l.debit_amount);
    const credit = n(l.credit_amount);
    if (debit > 0) {
      details.push({
        day_end_id: dayEndId,
        transaction_type: 'CASH_IN',
        transaction_id: l.l_id,
        amount: debit,
        payment_type: 'CASH',
        description: l.details || `Cash in — ${l.customer?.cus_name || 'Cash'}`,
      });
    }
    if (credit > 0) {
      details.push({
        day_end_id: dayEndId,
        transaction_type: 'CASH_OUT',
        transaction_id: l.l_id,
        amount: credit,
        payment_type: 'CASH',
        description: l.details || `Cash out — ${l.customer?.cus_name || 'Cash'}`,
      });
    }
  });
  (snapshot.bankLedgerEntries || []).forEach((l) => {
    const debit = n(l.debit_amount);
    const credit = n(l.credit_amount);
    if (debit > 0) {
      details.push({
        day_end_id: dayEndId,
        transaction_type: 'BANK_IN',
        transaction_id: l.l_id,
        amount: debit,
        payment_type: 'BANK_TRANSFER',
        description: l.details || `Bank in — ${l.customer?.cus_name || 'Bank'}`,
      });
    }
    if (credit > 0) {
      details.push({
        day_end_id: dayEndId,
        transaction_type: 'BANK_OUT',
        transaction_id: l.l_id,
        amount: credit,
        payment_type: 'BANK_TRANSFER',
        description: l.details || `Bank out — ${l.customer?.cus_name || 'Bank'}`,
      });
    }
  });
  return details;
}
