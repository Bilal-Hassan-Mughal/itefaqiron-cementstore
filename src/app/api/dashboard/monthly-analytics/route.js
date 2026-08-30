import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';

export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  const branchId = __branchScope.branchId;

  try {
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');

    let startDate = fromDate ? new Date(`${fromDate}T00:00:00.000Z`) : null;
    let endDate = toDate ? new Date(`${toDate}T23:59:59.999Z`) : null;

    let ledgerWhere = [`branch_id = ${branchId}`];
    let salesWhere = [`branch_id = ${branchId}`, "bill_type != 'QUOTATION'"];
    let profitWhere = [`s.branch_id = ${branchId}`, "s.bill_type != 'QUOTATION'"];
    let expenseWhere = [`branch_id = ${branchId}`];

    if (startDate) {
      const sStr = startDate.toISOString().slice(0, 19).replace('T', ' ');
      ledgerWhere.push(`created_at >= '${sStr}'`);
      salesWhere.push(`created_at >= '${sStr}'`);
      profitWhere.push(`s.created_at >= '${sStr}'`);
      expenseWhere.push(`created_at >= '${sStr}'`);
    }

    if (endDate) {
      const eStr = endDate.toISOString().slice(0, 19).replace('T', ' ');
      ledgerWhere.push(`created_at <= '${eStr}'`);
      salesWhere.push(`created_at <= '${eStr}'`);
      profitWhere.push(`s.created_at <= '${eStr}'`);
      expenseWhere.push(`created_at <= '${eStr}'`);
    }

    if (!startDate && !endDate) {
      // Default to last 12 months if no date filter specified
      const defaultStart = new Date();
      defaultStart.setMonth(defaultStart.getMonth() - 11);
      defaultStart.setDate(1);
      const dsStr = defaultStart.toISOString().slice(0, 19).replace('T', ' ');
      ledgerWhere.push(`created_at >= '${dsStr}'`);
      salesWhere.push(`created_at >= '${dsStr}'`);
      profitWhere.push(`s.created_at >= '${dsStr}'`);
      expenseWhere.push(`created_at >= '${dsStr}'`);
    }

    const whereClauseLedger = ledgerWhere.length > 0 ? `WHERE ${ledgerWhere.join(' AND ')}` : '';
    const whereClauseSales = `WHERE ${salesWhere.join(' AND ')}`;
    const whereClauseProfit = `WHERE ${profitWhere.join(' AND ')}`;
    const whereClauseExpense = expenseWhere.length > 0 ? `WHERE ${expenseWhere.join(' AND ')}` : '';

    // 1. Monthly Credit & Debit from Ledger
    const ledgerRows = await prisma.$queryRawUnsafe(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') AS period,
        SUM(credit_amount) AS credit_total,
        SUM(debit_amount) AS debit_total
      FROM ledger
      ${whereClauseLedger}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY period ASC
    `);

    // 2. Monthly Sales
    const salesRows = await prisma.$queryRawUnsafe(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') AS period,
        SUM(total_amount) AS total_sales,
        COUNT(sale_id) AS total_orders
      FROM sales
      ${whereClauseSales}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY period ASC
    `);

    // 3. Monthly Profit (Sales Revenue - Product Cost)
    const profitRows = await prisma.$queryRawUnsafe(`
      SELECT
        DATE_FORMAT(s.created_at, '%Y-%m') AS period,
        SUM(sd.net_total) AS revenue,
        SUM(p.pro_cost_price * sd.qnty) AS cost
      FROM sale_details sd
      JOIN sales s ON sd.sale_id = s.sale_id
      JOIN products p ON sd.pro_id = p.pro_id
      ${whereClauseProfit}
      GROUP BY DATE_FORMAT(s.created_at, '%Y-%m')
      ORDER BY period ASC
    `);

    // 4. Monthly Expenses
    const expenseRows = await prisma.$queryRawUnsafe(`
      SELECT
        DATE_FORMAT(created_at, '%Y-%m') AS period,
        SUM(exp_amount) AS total_expense
      FROM expenses
      ${whereClauseExpense}
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY period ASC
    `);

    const periodsSet = new Set([
      ...ledgerRows.map(r => r.period),
      ...salesRows.map(r => r.period),
      ...profitRows.map(r => r.period),
      ...expenseRows.map(r => r.period)
    ]);

    const sortedPeriods = Array.from(periodsSet).sort();

    const ledgerMap = new Map(ledgerRows.map(r => [r.period, r]));
    const salesMap = new Map(salesRows.map(r => [r.period, r]));
    const profitMap = new Map(profitRows.map(r => [r.period, r]));
    const expenseMap = new Map(expenseRows.map(r => [r.period, r]));

    const monthlyCredit = [];
    const monthlyDebit = [];
    const monthlySales = [];
    const monthlyProfit = [];

    sortedPeriods.forEach(period => {
      const l = ledgerMap.get(period) || {};
      const s = salesMap.get(period) || {};
      const p = profitMap.get(period) || {};
      const e = expenseMap.get(period) || {};

      const credit = parseFloat(l.credit_total || 0);
      const debit = parseFloat(l.debit_total || 0);
      const salesVal = parseFloat(s.total_sales || 0);
      const revenue = parseFloat(p.revenue || 0);
      const cost = parseFloat(p.cost || 0);
      const expense = parseFloat(e.total_expense || 0);
      const profitVal = revenue - cost - expense;

      monthlyCredit.push({ period, amount: credit });
      monthlyDebit.push({ period, amount: debit });
      monthlySales.push({ period, amount: salesVal, count: Number(s.total_orders || 0) });
      monthlyProfit.push({ period, revenue, cost, expense, profit: profitVal });
    });

    return NextResponse.json({
      success: true,
      data: {
        periods: sortedPeriods,
        monthlyCredit,
        monthlyDebit,
        monthlySales,
        monthlyProfit
      }
    });

  } catch (error) {
    console.error('Error fetching monthly analytics:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
