import { NextResponse } from 'next/server';
import { centralPrisma } from '@/lib/branch-server';
import { isHqUser } from '@/lib/branch-roles';
import { parseUserFromRequest } from '@/lib/branch-server';

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** GET — HQ dashboard summary stats */
export async function GET(request) {
  const user = parseUserFromRequest(request);
  if (!user || !isHqUser(user)) {
    return errorResponse('Head Office access required', 403);
  }

  try {
    const branches = await centralPrisma.branch.findMany({
      orderBy: { branch_id: 'asc' },
      include: {
        _count: {
          select: {
            users: true,
            customers: true,
            sales: true,
            products: true,
            stores: true,
          },
        },
      },
    });

    const summary = {
      total_branches: branches.length,
      active_branches: branches.filter((b) => b.status === 'ACTIVE').length,
      suspended_branches: branches.filter((b) => b.status === 'SUSPENDED').length,
      total_customers: branches.reduce((s, b) => s + (b._count?.customers || 0), 0),
      total_sales: branches.reduce((s, b) => s + (b._count?.sales || 0), 0),
      total_products: branches.reduce((s, b) => s + (b._count?.products || 0), 0),
      total_users: branches.reduce((s, b) => s + (b._count?.users || 0), 0),
    };

    return NextResponse.json({ summary, branches });
  } catch (err) {
    console.error('GET /api/branches/stats', err);
    return errorResponse('Failed to load HQ stats', 500);
  }
}
