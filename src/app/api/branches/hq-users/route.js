import { NextResponse } from 'next/server';
import { centralPrisma, parseUserFromRequest } from '@/lib/branch-server';
import { HQ_ROLES, isHqUser } from '@/lib/branch-roles';

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** GET — all branch users for HQ monitoring */
export async function GET(request) {
  const user = parseUserFromRequest(request);
  if (!user || !isHqUser(user)) {
    return errorResponse('Head Office access required', 403);
  }

  try {
    const users = await centralPrisma.users.findMany({
      where: {
        branch_id: { not: null },
        role: { notIn: [...HQ_ROLES] },
      },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        role: true,
        status: true,
        branch_id: true,
        last_logged_in: true,
        created_at: true,
        branch: {
          select: {
            branch_id: true,
            branch_code: true,
            branch_name: true,
            status: true,
          },
        },
      },
      orderBy: [{ branch_id: 'asc' }, { full_name: 'asc' }],
    });

    const byBranch = {};
    for (const u of users) {
      const code = u.branch?.branch_code || '—';
      if (!byBranch[code]) byBranch[code] = [];
      byBranch[code].push(u);
    }

    return NextResponse.json({
      users,
      total: users.length,
      active: users.filter((u) => u.status === 'ACTIVE').length,
      by_branch: byBranch,
    });
  } catch (err) {
    console.error('GET /api/branches/hq-users', err);
    return errorResponse('Failed to load branch users', 500);
  }
}
