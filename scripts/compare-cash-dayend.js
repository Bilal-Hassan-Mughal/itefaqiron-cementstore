require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const PK = '+05:00';

function todayPk() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
}

async function cashReportTotals(dateStr) {
  const cashCategories = await prisma.customerCategory.findMany({
    where: { cus_cat_title: { contains: 'cash' } },
  });
  const cashCategoryIds = cashCategories.map((c) => c.cus_cat_id);
  const range = {
    gte: new Date(`${dateStr}T00:00:00.000${PK}`),
    lte: new Date(`${dateStr}T23:59:59.999${PK}`),
  };

  const ledgerEntries = await prisma.ledger.findMany({
    where: { customer: { cus_category: { in: cashCategoryIds } }, created_at: range },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
  });

  const lastPrior = await prisma.ledger.findFirst({
    where: { customer: { cus_category: { in: cashCategoryIds } }, created_at: { lt: range.gte } },
    orderBy: [{ created_at: 'desc' }, { l_id: 'desc' }],
  });

  let opening = lastPrior ? parseFloat(lastPrior.closing_balance || 0) : 0;
  let running = opening;
  let cashIn = 0;
  let cashOut = 0;

  for (const e of ledgerEntries) {
    const det = e.details || '';
    if (det.includes('no receivable change')) {
      const d = parseFloat(e.debit_amount || 0);
      const c = parseFloat(e.credit_amount || 0);
      if (d > 0 && c > 0 && Math.abs(d - c) < 0.02) continue;
    }
    const debit = parseFloat(e.debit_amount || 0);
    const credit = parseFloat(e.credit_amount || 0);
    cashIn += debit;
    cashOut += credit;
    running = running + debit - credit;
  }

  return { opening, cashIn, cashOut, closing: running };
}

async function main() {
  const dateStr = todayPk();
  const { loadCashBankDayTotals } = await import('../src/lib/cash-bank-report-helper.js');
  const dayEnd = await loadCashBankDayTotals(prisma, dateStr);
  const report = await cashReportTotals(dateStr);

  console.log(JSON.stringify({ dateStr, cashReport: report, dayEndCash: {
    opening: dayEnd.openingCash,
    cashIn: dayEnd.totalCashInflow,
    cashOut: dayEnd.totalCashOutflow,
    closing: dayEnd.expectedCashInHand,
  }, match: {
    opening: Math.abs(report.opening - dayEnd.openingCash) < 0.02,
    cashIn: Math.abs(report.cashIn - dayEnd.totalCashInflow) < 0.02,
    cashOut: Math.abs(report.cashOut - dayEnd.totalCashOutflow) < 0.02,
    closing: Math.abs(report.closing - dayEnd.expectedCashInHand) < 0.02,
  }}, null, 2));
}

main().finally(() => prisma.$disconnect());
