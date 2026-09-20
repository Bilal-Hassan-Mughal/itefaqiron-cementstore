import { NextResponse } from 'next/server';
import { centralPrisma } from '@/lib/prisma';
import { HQ_ROLES, isHqUser } from '@/lib/branch-roles';

/** Active users for login selectors (optional login_mode=hq|branch filter, or user_id for one user). */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const loginMode = searchParams.get('login_mode');
    const userIdParam = searchParams.get('user_id');

    const select = {
      user_id: true,
      full_name: true,
      email: true,
      role: true,
      fingerprint_enrolled: true,
      pin_code: true,
    };

    if (userIdParam) {
      const userId = parseInt(userIdParam, 10);
      if (!Number.isFinite(userId) || userId <= 0) {
        return NextResponse.json({ error: 'Invalid user_id' }, { status: 400 });
      }

      const user = await centralPrisma.users.findFirst({
        where: { user_id: userId, status: 'ACTIVE' },
        select,
      });

      return NextResponse.json({
        users: user
          ? [{
              user_id: user.user_id,
              full_name: user.full_name,
              email: user.email,
              role: user.role,
              fingerprint_enrolled: user.fingerprint_enrolled,
              has_pin: Boolean(user.pin_code),
            }]
          : [],
      });
    }

    const where = { status: 'ACTIVE' };

    if (loginMode === 'hq') {
      where.branch_id = null;
      where.role = { in: [...HQ_ROLES] };
    } else if (loginMode === 'branch') {
      where.branch_id = { not: null };
      where.role = { notIn: [...HQ_ROLES] };
    }

    const users = await centralPrisma.users.findMany({
      where,
      select,
      orderBy: { full_name: 'asc' },
    });

    return NextResponse.json({
      users: users.map(({ pin_code, ...u }) => ({
        ...u,
        has_pin: Boolean(pin_code),
      })),
    });
  } catch (error) {
    console.error('user-list error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
