import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { isHqUser } from '@/lib/branch-roles';
import { parseUserFromRequest } from '@/lib/branch-server';

const BRANCH_ROLES = new Set([
  'BRANCH_SUPER_ADMIN',
  'ADMIN',
  'MANAGER',
  'ACCOUNTANT',
  'STOCK_MANAGER',
  'SALESMAN',
]);

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function requireHq(request) {
  const user = parseUserFromRequest(request);
  if (!user || !isHqUser(user)) {
    return { error: errorResponse('Head Office access required', 403) };
  }
  return { user };
}

function userSelect() {
  return {
    user_id: true,
    full_name: true,
    email: true,
    role: true,
    status: true,
    branch_id: true,
    is_verified: true,
    last_logged_in: true,
    created_at: true,
  };
}

/** PATCH — update branch user credentials (HQ only) */
export async function PATCH(request, { params }) {
  const auth = requireHq(request);
  if (auth.error) return auth.error;

  const { id, userId: userIdParam } = await params;
  const branchId = parseInt(id, 10);
  const targetUserId = parseInt(userIdParam, 10);
  if (!Number.isFinite(branchId) || !Number.isFinite(targetUserId)) {
    return errorResponse('Invalid id');
  }

  try {
    const existing = await prisma.users.findFirst({
      where: { user_id: targetUserId, branch_id: branchId },
    });
    if (!existing) return errorResponse('User not found in this branch', 404);

    const body = await request.json();
    const data = {};

    if (body.full_name?.trim()) data.full_name = body.full_name.trim();

    if (body.email?.trim()) {
      const normalizedEmail = body.email.trim().toLowerCase();
      if (normalizedEmail !== existing.email) {
        const dup = await prisma.users.findUnique({ where: { email: normalizedEmail } });
        if (dup) return errorResponse('Email already in use', 409);
        data.email = normalizedEmail;
      }
    }

    if (body.password?.trim()) {
      if (body.password.trim().length < 6) {
        return errorResponse('Password must be at least 6 characters');
      }
      data.password = await bcrypt.hash(body.password.trim(), 10);
    }

    if (body.role && BRANCH_ROLES.has(body.role)) data.role = body.role;
    if (body.status === 'ACTIVE' || body.status === 'INACTIVE') data.status = body.status;

    const user = await prisma.users.update({
      where: { user_id: targetUserId },
      data,
      select: userSelect(),
    });

    return NextResponse.json({ user });
  } catch (err) {
    console.error('PATCH /api/branches/[id]/users/[userId]', err);
    return errorResponse('Failed to update user', 500);
  }
}

/** DELETE — remove branch user (HQ only). Pass { force: true } to remove the last user. */
export async function DELETE(request, { params }) {
  const auth = requireHq(request);
  if (auth.error) return auth.error;

  const { id, userId: userIdParam } = await params;
  const branchId = parseInt(id, 10);
  const targetUserId = parseInt(userIdParam, 10);
  if (!Number.isFinite(branchId) || !Number.isFinite(targetUserId)) {
    return errorResponse('Invalid id');
  }

  try {
    let force = false;
    try {
      const body = await request.json();
      force = body?.force === true;
    } catch {
      /* empty body is fine */
    }

    const existing = await prisma.users.findFirst({
      where: { user_id: targetUserId, branch_id: branchId },
    });
    if (!existing) return errorResponse('User not found in this branch', 404);

    const branchUserCount = await prisma.users.count({ where: { branch_id: branchId } });
    if (branchUserCount <= 1 && !force) {
      return errorResponse(
        'This is the last user on the branch. Confirm force delete to remove them (no one will be able to log in until you add a new user).',
        409
      );
    }

    await prisma.users.delete({ where: { user_id: targetUserId } });
    return NextResponse.json({ success: true, was_last_user: branchUserCount <= 1 });
  } catch (err) {
    console.error('DELETE /api/branches/[id]/users/[userId]', err);
    return errorResponse('Failed to delete user', 500);
  }
}
