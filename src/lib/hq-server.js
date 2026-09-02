import { NextResponse } from 'next/server';
import { parseUserFromRequest } from './branch-server';
import { HQ_ROLES, isHqUser } from './branch-roles';
import { centralPrisma } from './prisma';

export function isHqAccount(user) {
  if (!user) return false;
  if (user.branch_id != null && user.branch_id !== '') return false;
  return HQ_ROLES.has(user.role);
}

/** Require an authenticated Head Office session (x-user-json header). */
export function requireHqActor(request) {
  const actor = parseUserFromRequest(request);
  if (!actor) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }
  if (!isHqUser(actor)) {
    return { error: NextResponse.json({ error: 'Head Office access required' }, { status: 403 }) };
  }
  return { actor };
}

export async function loadHqUser(userId) {
  const user = await centralPrisma.users.findUnique({
    where: { user_id: userId },
    select: {
      user_id: true,
      full_name: true,
      email: true,
      role: true,
      status: true,
      branch_id: true,
      pin_code: true,
      fingerprint_enrolled: true,
    },
  });
  if (!user || !isHqAccount(user)) return null;
  return user;
}

export function sanitizeHqBiometricUser(user) {
  if (!user) return user;
  const { pin_code, ...rest } = user;
  return { ...rest, has_pin: Boolean(pin_code) };
}
