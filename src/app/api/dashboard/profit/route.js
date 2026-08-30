import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';

export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  const branchId = __branchScope.branchId;

  try {
    const rows = await prisma.$queryRaw`
      SELECT
        DATE_FORMAT(s.created_at, '%Y-%m') AS month,
        SUM(sd.net_total)                  AS revenue,
        SUM(p.pro_cost_price * sd.qnty)    AS cost
      FROM sale_details sd
      JOIN sales    s ON sd.sale_id = s.sale_id
      JOIN products p ON sd.pro_id  = p.pro_id
      WHERE s.branch_id = ${branchId}
        AND s.created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
        AND s.bill_type != 'QUOTATION'
      GROUP BY DATE_FORMAT(s.created_at, '%Y-%m')
      ORDER BY month ASC
    `;

    const data = (Array.isArray(rows) ? rows : []).map(r => ({
      month: r.month,
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
