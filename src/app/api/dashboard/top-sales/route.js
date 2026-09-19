import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';
import { lastNPkDaysInclusive, pkDayRange } from '@/lib/date-helper';

function money(val) {
  const n = parseFloat(val);
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

function qty(val) {
  const n = parseFloat(val);
  return Math.round((Number.isFinite(n) ? n : 0) * 10000) / 10000;
}

function rangeSql(column, fromDate, toDate) {
  const parts = [];
  if (fromDate && /^\d{4}-\d{2}-\d{2}$/.test(fromDate)) {
    parts.push(Prisma.sql`${column} >= ${pkDayRange(fromDate).gte}`);
  }
  if (toDate && /^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    parts.push(Prisma.sql`${column} <= ${pkDayRange(toDate).lte}`);
  }
  if (!parts.length) return Prisma.empty;
  return Prisma.sql`AND ${Prisma.join(parts, ' AND ')}`;
}

const LINE_AMOUNT = Prisma.sql`
  CASE
    WHEN COALESCE(sd.unit_rate, 0) > 0 THEN ROUND(sd.qnty * sd.unit_rate, 2)
    ELSE ROUND(COALESCE(sd.net_total, sd.total_amount, 0), 2)
  END
`;

const RETURN_LINE_AMOUNT = Prisma.sql`
  CASE
    WHEN COALESCE(srd.unit_rate, 0) > 0 THEN ROUND(srd.qnty * srd.unit_rate, 2)
    ELSE ROUND(COALESCE(srd.net_total, srd.total_amount, 0), 2)
  END
`;

const EXTRA_PRODUCT = Prisma.sql`
  AND LOWER(p.pro_title) NOT REGEXP 'labour|labor|deliver|shipping|freight|transport|cargo|fare'
`;

export async function GET(request) {
  const scope = await initBranchScope(request);
  if (scope.error) return scope.error;
  const branchId = scope.branchId;

  try {
    const { searchParams } = new URL(request.url);
    const fallback = lastNPkDaysInclusive(30);
    const fromDate = searchParams.get('fromDate') || fallback.fromDate;
    const toDate = searchParams.get('toDate') || fallback.toDate;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '15', 10) || 15, 1), 30);

    const saleDates = rangeSql(Prisma.sql`s.created_at`, fromDate, toDate);
    const returnDates = rangeSql(Prisma.sql`sr.created_at`, fromDate, toDate);

    const [customerSales, customerReturns, productSales, productReturns] = await Promise.all([
      prisma.$queryRaw`
        SELECT
          s.cus_id AS id,
          c.cus_name AS name,
          COUNT(DISTINCT s.sale_id) AS invoices,
          SUM(${LINE_AMOUNT}) AS amount,
          SUM(sd.qnty) AS qty
        FROM sales s
        INNER JOIN sale_details sd ON sd.sale_id = s.sale_id
        INNER JOIN customers c ON c.cus_id = s.cus_id
        INNER JOIN products p ON p.pro_id = sd.pro_id
        WHERE s.branch_id = ${branchId}
          AND s.bill_type = 'BILL'
          ${saleDates}
          ${EXTRA_PRODUCT}
        GROUP BY s.cus_id, c.cus_name
      `,
      prisma.$queryRaw`
        SELECT
          sr.cus_id AS id,
          SUM(${RETURN_LINE_AMOUNT}) AS amount,
          SUM(srd.qnty) AS qty
        FROM sale_returns sr
        INNER JOIN sale_return_details srd ON srd.return_id = sr.return_id
        INNER JOIN products p ON p.pro_id = srd.pro_id
        WHERE sr.branch_id = ${branchId}
          ${returnDates}
          ${EXTRA_PRODUCT}
        GROUP BY sr.cus_id
      `,
      prisma.$queryRaw`
        SELECT
          sd.pro_id AS id,
          p.pro_title AS name,
          COUNT(DISTINCT s.sale_id) AS invoices,
          SUM(${LINE_AMOUNT}) AS amount,
          SUM(sd.qnty) AS qty
        FROM sale_details sd
        INNER JOIN sales s ON s.sale_id = sd.sale_id
        INNER JOIN products p ON p.pro_id = sd.pro_id
        WHERE s.branch_id = ${branchId}
          AND s.bill_type = 'BILL'
          ${saleDates}
          ${EXTRA_PRODUCT}
        GROUP BY sd.pro_id, p.pro_title
      `,
      prisma.$queryRaw`
        SELECT
          srd.pro_id AS id,
          SUM(${RETURN_LINE_AMOUNT}) AS amount,
          SUM(srd.qnty) AS qty
        FROM sale_return_details srd
        INNER JOIN sale_returns sr ON sr.return_id = srd.return_id
        INNER JOIN products p ON p.pro_id = srd.pro_id
        WHERE sr.branch_id = ${branchId}
          ${returnDates}
          ${EXTRA_PRODUCT}
        GROUP BY srd.pro_id
      `,
    ]);

    const returnByCustomer = new Map(
      customerReturns.map((r) => [Number(r.id), { amount: money(r.amount), qty: qty(r.qty) }])
    );
    const returnByProduct = new Map(
      productReturns.map((r) => [Number(r.id), { amount: money(r.amount), qty: qty(r.qty) }])
    );

    const customers = customerSales
      .map((row) => {
        const ret = returnByCustomer.get(Number(row.id)) || { amount: 0, qty: 0 };
        const amount = money(money(row.amount) - ret.amount);
        return {
          id: Number(row.id),
          name: row.name || `Customer #${row.id}`,
          balance: amount,
          amount,
          qty: qty(qty(row.qty) - ret.qty),
          invoices: Number(row.invoices || 0),
        };
      })
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);

    const products = productSales
      .map((row) => {
        const ret = returnByProduct.get(Number(row.id)) || { amount: 0, qty: 0 };
        const amount = money(money(row.amount) - ret.amount);
        return {
          id: Number(row.id),
          name: row.name || `Product #${row.id}`,
          balance: amount,
          amount,
          qty: qty(qty(row.qty) - ret.qty),
          invoices: Number(row.invoices || 0),
        };
      })
      .filter((row) => row.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      fromDate,
      toDate,
      formula: 'Confirmed bills only · each item qty × its sale rate · minus sale-return qty × rate · labour/delivery lines excluded',
      customers,
      products,
    });
  } catch (error) {
    console.error('Error fetching top sales charts:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
