import { NextResponse } from 'next/server';
import { centralPrisma } from '@/lib/prisma';
import { HQ_ROLES } from '@/lib/branch-roles';
import { requireHqActor, sanitizeHqBiometricUser } from '@/lib/hq-server';

/** GET — list HQ accounts with biometric security status */
export async function GET(request) {
  const scope = requireHqActor(request);
  if (scope.error) return scope.error;

  try {
    const users = await centralPrisma.users.findMany({
      where: {
        branch_id: null,
        role: { in: [...HQ_ROLES] },
      },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        role: true,
        status: true,
        pin_code: true,
        fingerprint_enrolled: true,
        last_logged_in: true,
      },
      orderBy: [{ role: 'asc' }, { full_name: 'asc' }],
    });

    return NextResponse.json({
      users: users.map(sanitizeHqBiometricUser),
    });
  } catch (err) {
    console.error('GET /api/hq/biometrics', err);
    return NextResponse.json({ error: 'Failed to load HQ accounts' }, { status: 500 });
  }
}
