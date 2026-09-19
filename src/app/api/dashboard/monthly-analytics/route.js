import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';
import { eachPkDate, eachPkWeekInRange, lastNPkDaysInclusive, pkDayRange } from '@/lib/date-helper';

function n(val) {
  const num = parseFloat(val);
  return Number.isFinite(num) ? num : 0;
}

export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  const branchId = __branchScope.branchId;

  try {
    const { searchParams } = new URL(request.url);
    const fallback = lastNPkDaysInclusive(30);
    const fromDate = searchParams.get('fromDate') || fallback.fromDate;
    const toDate = searchParams.get('toDate') || fallback.toDate;
    const fromRange = pkDayRange(fromDate);
    const toRange = pkDayRange(toDate);
    const startDate = fromRange?.gte;
    const endDate = toRange?.lte;
    const dayCount = eachPkDate(fromDate, toDate).length;
    const useWeekly = dayCount > 0 && dayCount <= 90;
    const periodExpr = useWeekly
      ? "DATE_FORMAT(created_at + INTERVAL 5 HOUR, '%Y-%m-%d')"
      : "DATE_FORMAT(created_at + INTERVAL 5 HOUR, '%Y-%m')";
    const salePeriodExpr = useWeekly
      ? "DATE_FORMAT(s.created_at + INTERVAL 5 HOUR, '%Y-%m-%d')"
      : "DATE_FORMAT(s.created_at + INTERVAL 5 HOUR, '%Y-%m')";

    const startSql = startDate.toISOString().slice(0, 19).replace('T', ' ');
    const endSql = endDate.toISOString().slice(0, 19).replace('T', ' ');

    const ledgerWhere = `WHERE branch_id = ${branchId} AND created_at >= '${startSql}' AND created_at <= '${endSql}'`;
    const salesWhere = `WHERE branch_id = ${branchId} AND bill_type != 'QUOTATION' AND created_at >= '${startSql}' AND created_at <= '${endSql}'`;
    const profitWhere = `WHERE s.branch_id = ${branchId} AND s.bill_type != 'QUOTATION' AND s.created_at >= '${startSql}' AND s.created_at <= '${endSql}'`;
    const expenseWhere = `WHERE branch_id = ${branchId} AND created_at >= '${startSql}' AND created_at <= '${endSql}'`;

    const [ledgerRows, salesRows, profitRows, expenseRows] = await Promise.all([
      prisma.$queryRawUnsafe(`
        SELECT
          ${periodExpr} AS period,
          SUM(credit_amount) AS credit_total,
          SUM(debit_amount) AS debit_total
        FROM ledger
        ${ledgerWhere}
        GROUP BY period
        ORDER BY period ASC
      `),
      prisma.$queryRawUnsafe(`
        SELECT
          ${periodExpr} AS period,
          SUM(total_amount) AS total_sales,
          COUNT(sale_id) AS total_orders
        FROM sales
        ${salesWhere}
        GROUP BY period
        ORDER BY period ASC
      `),
      prisma.$queryRawUnsafe(`
        SELECT
          ${salePeriodExpr} AS period,
          SUM(sd.net_total) AS revenue,
          SUM(p.pro_cost_price * sd.qnty) AS cost
        FROM sale_details sd
        JOIN sales s ON sd.sale_id = s.sale_id
        JOIN products p ON sd.pro_id = p.pro_id
        ${profitWhere}
        GROUP BY period
        ORDER BY period ASC
      `),
      prisma.$queryRawUnsafe(`
        SELECT
          ${periodExpr} AS period,
          SUM(exp_amount) AS total_expense
        FROM expenses
        ${expenseWhere}
        GROUP BY period
        ORDER BY period ASC
      `),
    ]);

    const ledgerMap = new Map(ledgerRows.map((r) => [r.period, r]));
    const salesMap = new Map(salesRows.map((r) => [r.period, r]));
    const profitMap = new Map(profitRows.map((r) => [r.period, r]));
    const expenseMap = new Map(expenseRows.map((r) => [r.period, r]));

    const buckets = useWeekly
      ? eachPkWeekInRange(fromDate, toDate).map((week) => ({
        period: week.key,
        label: week.label,
        days: eachPkDate(week.from, week.to),
      }))
      : Array.from(new Set([
        ...ledgerRows.map((r) => r.period),
        ...salesRows.map((r) => r.period),
        ...profitRows.map((r) => r.period),
        ...expenseRows.map((r) => r.period),
      ])).sort().map((period) => ({ period, label: period, days: [period] }));

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
        orders += Number(s.total_orders || 0);
        revenue += n(p.revenue);
        cost += n(p.cost);
        expense += n(e.total_expense);
      });

      monthlyCredit.push({ period: bucket.period, label: bucket.label, amount: credit });
      monthlyDebit.push({ period: bucket.period, label: bucket.label, amount: debit });
      monthlySales.push({ period: bucket.period, label: bucket.label, amount: salesVal, count: orders });
      monthlyProfit.push({ period: bucket.period, label: bucket.label, revenue, cost, expense, profit: revenue - cost - expense });
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
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
