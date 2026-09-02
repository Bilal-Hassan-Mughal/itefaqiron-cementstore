import { NextResponse } from 'next/server';
import { centralPrisma } from '@/lib/prisma';
import { HQ_ROLES, isHqUser } from '@/lib/branch-roles';

/** Active users for login selectors (optional login_mode=hq|branch filter). */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const loginMode = searchParams.get('login_mode');

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
      select: {
        user_id: true,
        full_name: true,
        email: true,
        role: true,
        fingerprint_enrolled: true,
        pin_code: true,
      },
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
