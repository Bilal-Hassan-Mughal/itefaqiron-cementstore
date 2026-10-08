import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma, sqlTableName, sqlBranchWhere } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';
import {
  eachPkDate,
  eachPkMonthInRange,
  eachPkWeekInRange,
  lastNPkDaysInclusive,
  pkDayRange,
  pkMonthLastDate,
} from '@/lib/date-helper';

export const dynamic = 'force-dynamic';

function tableIdent(base) {
  const name = String(sqlTableName(base) || base).replace(/[^a-zA-Z0-9_]/g, '');
  return Prisma.raw(`\`${name}\``);
}

function n(val) {
  if (val == null) return 0;
  if (typeof val === 'bigint') return Number(val);
  const num = parseFloat(String(val));
  return Number.isFinite(num) ? num : 0;
}

function isPkDate(dateStr) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ''));
}

function resolveDateRange(fromDate, toDate) {
  const fromRange = pkDayRange(fromDate);
  const toRange = pkDayRange(toDate);
  if (!fromRange?.gte || !toRange?.lte) return null;
  if (Number.isNaN(fromRange.gte.getTime()) || Number.isNaN(toRange.lte.getTime())) return null;
  if (fromDate > toDate) return null;
  return { startDate: fromRange.gte, endDate: toRange.lte };
}

function isCashOrBankCategoryTitle(title) {
  const t = String(title || '').toLowerCase();
  return t.includes('cash') || t.includes('bank');
}

/** Month-end outstanding from ledger closing balances (same sign as cus_balance report). */
async function computeMonthEndOutstanding(branchId, asOfDateStr, tables) {
  const asOfRange = pkDayRange(asOfDateStr);
  if (!asOfRange?.lte) return { receivable: 0, payable: 0 };

  const { ledger, customers } = tables;
  const ledgerBranch = Prisma.raw(sqlBranchWhere(branchId));
  const customerBranch = Prisma.raw(sqlBranchWhere(branchId, 'c'));

  const rows = await prisma.$queryRaw`
    SELECT l.closing_balance, c.cus_category
    FROM ${ledger} l
    INNER JOIN (
      SELECT cus_id, MAX(l_id) AS max_l_id
      FROM ${ledger}
      WHERE ${ledgerBranch}
        AND created_at <= ${asOfRange.lte}
      GROUP BY cus_id
    ) latest ON l.l_id = latest.max_l_id
    INNER JOIN ${customers} c ON c.cus_id = l.cus_id
    WHERE ${customerBranch}
  `;

  let receivable = 0;
  let payable = 0;
  for (const row of rows) {
    if (tables.cashBankCategoryIds.has(Number(row.cus_category))) continue;
    const bal = n(row.closing_balance);
    if (bal > 0) receivable += bal;
    else if (bal < 0) payable += Math.abs(bal);
  }

  return {
    receivable: Number(receivable.toFixed(2)),
    payable: Number(payable.toFixed(2)),
  };
}

export async function GET(request) {
  try {
    const __branchScope = await initBranchScope(request);
    if (__branchScope.error) return __branchScope.error;

    const branchId = __branchScope.branchId;
    const { searchParams } = new URL(request.url);
    const fallback = lastNPkDaysInclusive(30);
    const fromDate = searchParams.get('fromDate') || fallback.fromDate;
    const toDate = searchParams.get('toDate') || fallback.toDate;

    if (!isPkDate(fromDate) || !isPkDate(toDate)) {
      return NextResponse.json(
        { success: false, error: 'Invalid date format (use YYYY-MM-DD)' },
        { status: 400 }
      );
    }

    const dateRange = resolveDateRange(fromDate, toDate);
    if (!dateRange) {
      return NextResponse.json({ success: false, error: 'Invalid date range' }, { status: 400 });
    }

    const { startDate, endDate } = dateRange;
    const dayCount = eachPkDate(fromDate, toDate).length;
    const chartGrainParam = searchParams.get('chartGrain');
    const ledgerGrainParam = searchParams.get('ledgerGrain');
    const ledgerSeries = searchParams.get('ledgerSeries');
    const useOutstandingLedger = ledgerSeries === 'outstanding';
    const chartGrainAuto = dayCount > 0 && dayCount <= 90;
    const useWeeklyCharts =
      chartGrainParam === 'month' ? false : chartGrainParam === 'week' ? true : chartGrainAuto;
    const useWeeklyLedger =
      ledgerGrainParam === 'month'
        ? false
        : ledgerGrainParam === 'week'
          ? true
          : chartGrainAuto;

    const chartPeriodExpr = useWeeklyCharts
      ? Prisma.raw("DATE_FORMAT(created_at + INTERVAL 5 HOUR, '%Y-%m-%d')")
      : Prisma.raw("DATE_FORMAT(created_at + INTERVAL 5 HOUR, '%Y-%m')");
    const salePeriodExpr = useWeeklyCharts
      ? Prisma.raw("DATE_FORMAT(s.created_at + INTERVAL 5 HOUR, '%Y-%m-%d')")
      : Prisma.raw("DATE_FORMAT(s.created_at + INTERVAL 5 HOUR, '%Y-%m')");
    const ledgerPeriodExpr = useWeeklyLedger
      ? Prisma.raw("DATE_FORMAT(created_at + INTERVAL 5 HOUR, '%Y-%m-%d')")
      : Prisma.raw("DATE_FORMAT(created_at + INTERVAL 5 HOUR, '%Y-%m')");

    const ledger = tableIdent('ledger');
    const customers = tableIdent('customers');
    const sales = tableIdent('sales');
    const saleDetails = tableIdent('sale_details');
    const products = tableIdent('products');
    const expenses = tableIdent('expenses');

    const ledgerBranch = Prisma.raw(sqlBranchWhere(branchId));
    const salesBranch = Prisma.raw(sqlBranchWhere(branchId));
    const salesBranchS = Prisma.raw(sqlBranchWhere(branchId, 's'));

    const allCategories = await prisma.customerCategory.findMany({
      select: { cus_cat_id: true, cus_cat_title: true },
    });
    const cashBankCategoryIds = new Set(
      allCategories
        .filter((c) => isCashOrBankCategoryTitle(c.cus_cat_title))
        .map((c) => c.cus_cat_id)
    );
    const outstandingTables = { ledger, customers, cashBankCategoryIds };

    const ledgerFlowQuery = useOutstandingLedger
      ? Promise.resolve([])
      : prisma.$queryRaw`
        SELECT
          ${ledgerPeriodExpr} AS period,
          SUM(credit_amount) AS credit_total,
          SUM(debit_amount) AS debit_total
        FROM ${ledger}
        WHERE ${ledgerBranch}
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
        GROUP BY period
        ORDER BY period ASC
      `;

    const [ledgerRows, salesRows, profitRows, expenseRows] = await Promise.all([
      ledgerFlowQuery,
      prisma.$queryRaw`
        SELECT
          ${chartPeriodExpr} AS period,
          SUM(total_amount) AS total_sales,
          COUNT(sale_id) AS total_orders
        FROM ${sales}
        WHERE ${salesBranch}
          AND bill_type != 'QUOTATION'
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
        GROUP BY period
        ORDER BY period ASC
      `,
      prisma.$queryRaw`
        SELECT
          ${salePeriodExpr} AS period,
          SUM(sd.net_total) AS revenue,
          SUM(p.pro_cost_price * sd.qnty) AS cost
        FROM ${saleDetails} sd
        JOIN ${sales} s ON sd.sale_id = s.sale_id
        JOIN ${products} p ON sd.pro_id = p.pro_id
        WHERE ${salesBranchS}
          AND s.bill_type != 'QUOTATION'
          AND s.created_at >= ${startDate}
          AND s.created_at <= ${endDate}
        GROUP BY period
        ORDER BY period ASC
      `,
      prisma.$queryRaw`
        SELECT
          ${chartPeriodExpr} AS period,
          SUM(exp_amount) AS total_expense
        FROM ${expenses}
        WHERE ${ledgerBranch}
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
        GROUP BY period
        ORDER BY period ASC
      `,
    ]);

    const periodKey = (p) => (p == null ? '' : String(p));

    const ledgerMap = new Map(ledgerRows.map((r) => [periodKey(r.period), r]));
    const salesMap = new Map(salesRows.map((r) => [periodKey(r.period), r]));
    const profitMap = new Map(profitRows.map((r) => [periodKey(r.period), r]));
    const expenseMap = new Map(expenseRows.map((r) => [periodKey(r.period), r]));

    const buildWeekBuckets = () =>
      eachPkWeekInRange(fromDate, toDate).map((week) => ({
        period: week.key,
        label: week.label,
        days: eachPkDate(week.from, week.to),
      }));

    const buildMonthBucketsFromPeriods = (periodKeys) =>
      Array.from(new Set(periodKeys)).filter(Boolean).sort().map((period) => ({
        period,
        label: period,
        days: [period],
      }));

    const ledgerBuckets = useWeeklyLedger
      ? buildWeekBuckets()
      : eachPkMonthInRange(fromDate, toDate).map((month) => ({
        period: month.key,
        label: month.label,
        days: [month.key],
      }));

    const chartBuckets = useWeeklyCharts
      ? buildWeekBuckets()
      : buildMonthBucketsFromPeriods([
        ...salesRows.map((r) => periodKey(r.period)),
        ...profitRows.map((r) => periodKey(r.period)),
        ...expenseRows.map((r) => periodKey(r.period)),
      ]);

    const monthlyCredit = [];
    const monthlyDebit = [];

    if (useOutstandingLedger) {
      const monthBuckets = eachPkMonthInRange(fromDate, toDate);
      for (const month of monthBuckets) {
        const asOf = pkMonthLastDate(month.key, toDate);
        const { receivable, payable } = await computeMonthEndOutstanding(
          branchId,
          asOf,
          outstandingTables
        );
        const point = {
          period: month.key,
          label: month.label,
          asOfDate: asOf,
        };
        monthlyCredit.push({
          ...point,
          amount: receivable,
          toReceive: receivable,
          metric: 'closing_balance',
        });
        monthlyDebit.push({
          ...point,
          amount: payable,
          toPay: payable,
          metric: 'closing_balance',
        });
      }
    } else {
      ledgerBuckets.forEach((bucket) => {
        let credit = 0;
        let debit = 0;
        bucket.days.forEach((day) => {
          const l = ledgerMap.get(day) || {};
          credit += n(l.credit_total);
          debit += n(l.debit_total);
        });
        monthlyCredit.push({ period: bucket.period, label: bucket.label, amount: credit });
        monthlyDebit.push({ period: bucket.period, label: bucket.label, amount: debit });
      });
    }

    const monthlySales = [];
    const monthlyProfit = [];

    chartBuckets.forEach((bucket) => {
      let salesVal = 0;
      let orders = 0;
      let revenue = 0;
      let cost = 0;
      let expense = 0;
      bucket.days.forEach((day) => {
        const s = salesMap.get(day) || {};
        const p = profitMap.get(day) || {};
        const e = expenseMap.get(day) || {};
        salesVal += n(s.total_sales);
        orders += n(s.total_orders);
        revenue += n(p.revenue);
        cost += n(p.cost);
        expense += n(e.total_expense);
      });
      monthlySales.push({ period: bucket.period, label: bucket.label, amount: salesVal, count: orders });
      monthlyProfit.push({
        period: bucket.period,
        label: bucket.label,
        revenue,
        cost,
        expense,
        profit: revenue - cost - expense,
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        grain: useWeeklyCharts ? 'week' : 'month',
        ledgerGrain: useOutstandingLedger ? 'month' : useWeeklyLedger ? 'week' : 'month',
        ledgerSeries: useOutstandingLedger ? 'outstanding' : 'flow',
        fromDate,
        toDate,
        periods: chartBuckets.map((b) => b.period),
        ledgerPeriods: ledgerBuckets.map((b) => b.period),
        monthlyCredit,
        monthlyDebit,
        monthEndToReceive: monthlyCredit,
        monthEndToPay: monthlyDebit,
        monthlySales,
        monthlyProfit,
      },
    });
  } catch (error) {
    console.error('Error fetching monthly analytics:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch monthly analytics' },
      { status: 500 }
    );
  }
}
