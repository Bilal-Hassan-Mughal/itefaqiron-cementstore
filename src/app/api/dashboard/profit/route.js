import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma, sqlTableName, sqlBranchWhere } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';

export const dynamic = 'force-dynamic';

function tableIdent(base) {
  const name = String(sqlTableName(base) || base).replace(/[^a-zA-Z0-9_]/g, '');
  return Prisma.raw(`\`${name}\``);
}

export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  const branchId = __branchScope.branchId;

  const sales = tableIdent('sales');
  const saleDetails = tableIdent('sale_details');
  const saleReturns = tableIdent('sale_returns');
  const saleReturnDetails = tableIdent('sale_return_details');
  const products = tableIdent('products');

  const salesBranchS = Prisma.raw(sqlBranchWhere(branchId, 's'));
  const returnsBranch = Prisma.raw(sqlBranchWhere(branchId, 'sr'));

  try {
    const rows = await prisma.$queryRaw`
      SELECT
        period,
        SUM(revenue) AS revenue,
        SUM(cost) AS cost
      FROM (
        SELECT
          DATE_FORMAT(s.created_at + INTERVAL 5 HOUR, '%Y-%m') AS period,
          s.sale_id,
          MAX(CAST(s.total_amount - s.shipping_amount - s.labour_charges AS DECIMAL(18,2))) AS revenue,
          SUM(CAST(COALESCE(NULLIF(p.pro_cost_price, 0), NULLIF(p.pro_crate, 0), NULLIF(p.pro_baser_price, 0), 0) * sd.qnty AS DECIMAL(18,2))) AS cost
        FROM ${sales} s
        JOIN ${saleDetails} sd ON s.sale_id = sd.sale_id
        JOIN ${products} p ON sd.pro_id = p.pro_id
        WHERE ${salesBranchS}
          AND s.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
          AND s.bill_type = 'BILL'
        GROUP BY s.sale_id, period

        UNION ALL

        SELECT
          DATE_FORMAT(sr.created_at + INTERVAL 5 HOUR, '%Y-%m') AS period,
          sr.return_id,
          -MAX(CAST(sr.total_amount - sr.discount - sr.labour_charges - sr.shipping_amount AS DECIMAL(18,2))) AS revenue,
          -SUM(CAST(COALESCE(NULLIF(p.pro_cost_price, 0), NULLIF(p.pro_crate, 0), NULLIF(p.pro_baser_price, 0), 0) * srd.qnty AS DECIMAL(18,2))) AS cost
        FROM ${saleReturns} sr
        JOIN ${saleReturnDetails} srd ON sr.return_id = srd.return_id
        JOIN ${products} p ON srd.pro_id = p.pro_id
        WHERE ${returnsBranch}
          AND sr.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        GROUP BY sr.return_id, period
      ) combined
      GROUP BY period
      ORDER BY period ASC
    `;

    const data = (Array.isArray(rows) ? rows : []).map(r => ({
      month: r.period,
      revenue: parseFloat(r.revenue || 0),
      cost:    parseFloat(r.cost    || 0),
      profit:  parseFloat(r.revenue || 0) - parseFloat(r.cost || 0)
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('❌ Profit chart error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
