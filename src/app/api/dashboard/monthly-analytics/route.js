import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma, sqlTableName, sqlBranchWhere } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';
import { eachPkDate, eachPkWeekInRange, lastNPkDaysInclusive, pkDayRange } from '@/lib/date-helper';

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
    const useWeekly = dayCount > 0 && dayCount <= 90;

    const periodExpr = useWeekly
      ? Prisma.raw("DATE_FORMAT(created_at + INTERVAL 5 HOUR, '%Y-%m-%d')")
      : Prisma.raw("DATE_FORMAT(created_at + INTERVAL 5 HOUR, '%Y-%m')");
    const salePeriodExpr = useWeekly
      ? Prisma.raw("DATE_FORMAT(s.created_at + INTERVAL 5 HOUR, '%Y-%m-%d')")
      : Prisma.raw("DATE_FORMAT(s.created_at + INTERVAL 5 HOUR, '%Y-%m')");

    const ledger = tableIdent('ledger');
    const sales = tableIdent('sales');
    const saleDetails = tableIdent('sale_details');
    const products = tableIdent('products');
    const expenses = tableIdent('expenses');

    const ledgerBranch = Prisma.raw(sqlBranchWhere(branchId));
    const salesBranch = Prisma.raw(sqlBranchWhere(branchId));
    const salesBranchS = Prisma.raw(sqlBranchWhere(branchId, 's'));

    const [ledgerRows, salesRows, profitRows, expenseRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          ${periodExpr} AS period,
          SUM(credit_amount) AS credit_total,
          SUM(debit_amount) AS debit_total
        FROM ${ledger}
        WHERE ${ledgerBranch}
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
        GROUP BY period
        ORDER BY period ASC
      `,
      prisma.$queryRaw`
        SELECT
          ${periodExpr} AS period,
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
          ${periodExpr} AS period,
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

    const buckets = useWeekly
      ? eachPkWeekInRange(fromDate, toDate).map((week) => ({
        period: week.key,
        label: week.label,
        days: eachPkDate(week.from, week.to),
      }))
      : Array.from(new Set([
        ...ledgerRows.map((r) => periodKey(r.period)),
        ...salesRows.map((r) => periodKey(r.period)),
        ...profitRows.map((r) => periodKey(r.period)),
        ...expenseRows.map((r) => periodKey(r.period)),
      ])).filter(Boolean).sort().map((period) => ({ period, label: period, days: [period] }));

    const monthlyCredit = [];
    const monthlyDebit = [];
    const monthlySales = [];
    const monthlyProfit = [];

    buckets.forEach((bucket) => {
      let credit = 0;
      let debit = 0;
      let salesVal = 0;
      let orders = 0;
      let revenue = 0;
      let cost = 0;
      let expense = 0;
      bucket.days.forEach((day) => {
        const l = ledgerMap.get(day) || {};
        const s = salesMap.get(day) || {};
        const p = profitMap.get(day) || {};
        const e = expenseMap.get(day) || {};
        credit += n(l.credit_total);
        debit += n(l.debit_total);
        salesVal += n(s.total_sales);
        orders += n(s.total_orders);
        revenue += n(p.revenue);
        cost += n(p.cost);
        expense += n(e.total_expense);
      });

      monthlyCredit.push({ period: bucket.period, label: bucket.label, amount: credit });
      monthlyDebit.push({ period: bucket.period, label: bucket.label, amount: debit });
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
        grain: useWeekly ? 'week' : 'month',
        fromDate,
        toDate,
        periods: buckets.map((b) => b.period),
        monthlyCredit,
        monthlyDebit,
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
