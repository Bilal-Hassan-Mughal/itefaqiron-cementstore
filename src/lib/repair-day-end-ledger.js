import { buildDayEndDetails, loadDayEndSnapshot } from '@/lib/day-end-snapshot';

function businessDateToStr(businessDate) {
  const b = businessDate instanceof Date ? businessDate : new Date(businessDate);
  return `${b.getUTCFullYear()}-${String(b.getUTCMonth() + 1).padStart(2, '0')}-${String(b.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Re-align day_ends + day_end_details with Cash Report ledger math.
 * CLOSED rows: closing_cash = expected ledger cash (variance 0).
 */
export async function repairDayEndRecords(prisma, { branchId = 1, dryRun = false } = {}) {
  const rows = await prisma.dayEnd.findMany({
    where: { branch_id: branchId },
    orderBy: { business_date: 'asc' },
  });

  const results = [];

  for (const row of rows) {
    const dateStr = businessDateToStr(row.business_date);
    const snapshot = await loadDayEndSnapshot(prisma, {
      dateStr,
      dayEndRecord: row,
      branchId,
    });
    const { summary } = snapshot;
    const isClosed = row.status === 'CLOSED';
    const closingCash = isClosed ? summary.expectedCashInHand : null;

    const data = {
      opening_cash: summary.openingCash,
      cash_in_hand: summary.expectedCashInHand,
      closing_cash: closingCash,
      bank_balance: isClosed ? summary.expectedClosingBank : row.bank_balance,
      total_sales: summary.totalSales,
      total_purchases: summary.totalPurchases,
      total_expenses: summary.totalExpenses,
      total_receipts: summary.totalReceipts,
      total_payments: summary.totalPayments,
    };

    results.push({
      day_end_id: row.day_end_id,
      business_date: dateStr,
      status: row.status,
      before: {
        opening_cash: Number(row.opening_cash),
        cash_in_hand: row.cash_in_hand != null ? Number(row.cash_in_hand) : null,
        closing_cash: row.closing_cash != null ? Number(row.closing_cash) : null,
      },
      after: {
        opening_cash: Number(data.opening_cash),
        cash_in_hand: Number(data.cash_in_hand),
        closing_cash: data.closing_cash != null ? Number(data.closing_cash) : null,
      },
    });

    if (dryRun) continue;

    await prisma.$transaction(async (tx) => {
      const updated = await tx.dayEnd.update({
        where: { day_end_id: row.day_end_id },
        data,
      });
      await tx.dayEndDetail.deleteMany({ where: { day_end_id: row.day_end_id } });
      const details = buildDayEndDetails(updated.day_end_id, snapshot);
      if (details.length > 0) {
        await tx.dayEndDetail.createMany({ data: details });
      }
    });
  }

  return { branchId, count: rows.length, dryRun, results };
}
