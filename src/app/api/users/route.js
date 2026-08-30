import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { centralPrisma } from '@/lib/prisma';
import {
  resolveUserManagementScope,
  userListWhere,
  assertCanModifyUser,
  assertRoleAssignable,
  toDbRole,
  loadBranchMeta,
} from '@/lib/user-management-access';

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const userInclude = {
  branch: {
    select: { branch_id: true, branch_code: true, branch_name: true, status: true },
  },
  _count: {
    select: { products: true, sales: true, purchases: true, expenses: true },
  },
};

function sanitizeUser(user) {
  if (!user) return user;
  const { password, ...rest } = user;
  return rest;
}

/** GET — branch-scoped user list */
export async function GET(request) {
  const scope = resolveUserManagementScope(request);
  if (scope.error) return scope.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ? parseInt(searchParams.get('id'), 10) : null;

  try {
    if (id) {
      const user = await centralPrisma.users.findUnique({
        where: { user_id: id },
        include: userInclude,
      });
      if (!user) return errorResponse('User not found', 404);
      const block = assertCanModifyUser(scope, user);
      if (block) return errorResponse(block, 403);
      return NextResponse.json(sanitizeUser(user));
    }

    const users = await centralPrisma.users.findMany({
      where: userListWhere(scope),
      include: userInclude,
      orderBy: [{ role: 'asc' }, { full_name: 'asc' }],
    });

    const branch = scope.branchId ? await loadBranchMeta(scope.branchId) : null;

    return NextResponse.json({
      users: users.map(sanitizeUser),
      branch,
      scope: {
        branch_id: scope.branchId,
        is_hq: scope.isHq,
      },
    });
  } catch (err) {
    console.error('GET /api/users', err);
    return errorResponse('Failed to fetch users', 500);
  }
}

/** POST — create staff for current branch */
export async function POST(request) {
  const scope = resolveUserManagementScope(request);
  if (scope.error) return scope.error;

  if (!scope.branchId) {
    return errorResponse('Open a branch or select a branch to create users', 400);
  }

  try {
    const body = await request.json();
    const { full_name, email, password, role, status, is_verified, allowed_modules } = body;

    if (!full_name?.trim()) return errorResponse('Full name is required');
    if (!email?.trim()) return errorResponse('Email is required');
    if (!password?.trim()) return errorResponse('Password is required');
    if (password.trim().length < 6) return errorResponse('Password must be at least 6 characters');

    const roleKey = role || 'SALESMAN';
    const roleErr = assertRoleAssignable(scope, roleKey);
    if (roleErr) return errorResponse(roleErr);

    const emailNorm = email.trim().toLowerCase();
    const dup = await centralPrisma.users.findUnique({ where: { email: emailNorm } });
    if (dup) return errorResponse('Email already in use', 409);

    const branch = await loadBranchMeta(scope.branchId);
    if (!branch || branch.status !== 'ACTIVE') {
      return errorResponse('Branch is not active', 403);
    }

    const hashed = await bcrypt.hash(password.trim(), 10);

    const newUser = await centralPrisma.users.create({
      data: {
        full_name: full_name.trim(),
        email: emailNorm,
        password: hashed,
        role: toDbRole(roleKey),
        branch_id: scope.branchId,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        is_verified: is_verified ?? true,
        allowed_modules: allowed_modules
          ? (typeof allowed_modules === 'string' ? allowed_modules : JSON.stringify(allowed_modules))
          : null,
      },
      include: userInclude,
    });

    return NextResponse.json(
      {
        ...sanitizeUser(newUser),
        login_hint: {
          portal: '/login/branch',
          branch_code: branch.branch_code,
          email: emailNorm,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/users', err);
    return errorResponse('Failed to create user', 500);
  }
}

/** PUT — update branch user */
export async function PUT(request) {
  const scope = resolveUserManagementScope(request);
  if (scope.error) return scope.error;

  try {
    const body = await request.json();
    const { id, full_name, email, password, role, status, is_verified, allowed_modules } = body;

    if (!id) return errorResponse('User ID is required');

    const existing = await centralPrisma.users.findUnique({
      where: { user_id: id },
      include: userInclude,
    });
    if (!existing) return errorResponse('User not found', 404);

    const block = assertCanModifyUser(scope, existing);
    if (block) return errorResponse(block, 403);

    if (!full_name?.trim()) return errorResponse('Full name is required');
    if (!email?.trim()) return errorResponse('Email is required');

    const roleKey = role || existing.role;
    const roleErr = assertRoleAssignable(scope, roleKey);
    if (roleErr && roleKey !== existing.role) return errorResponse(roleErr);

    const emailNorm = email.trim().toLowerCase();
    const emailTaken = await centralPrisma.users.findFirst({
      where: { email: emailNorm, NOT: { user_id: id } },
    });
    if (emailTaken) return errorResponse('Email already in use', 409);

    const updateData = {
      full_name: full_name.trim(),
      email: emailNorm,
      role: toDbRole(roleKey),
      status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      is_verified: is_verified ?? existing.is_verified,
      allowed_modules: allowed_modules
        ? (typeof allowed_modules === 'string' ? allowed_modules : JSON.stringify(allowed_modules))
        : existing.allowed_modules,
    };

    if (password?.trim()) {
      if (password.trim().length < 6) return errorResponse('Password must be at least 6 characters');
      updateData.password = await bcrypt.hash(password.trim(), 10);
    }

    if (!scope.isHq && existing.branch_id) {
      updateData.branch_id = existing.branch_id;
    }

    const updated = await centralPrisma.users.update({
      where: { user_id: id },
      data: updateData,
      include: userInclude,
    });

    return NextResponse.json(sanitizeUser(updated));
  } catch (err) {
    console.error('PUT /api/users', err);
    return errorResponse('Failed to update user', 500);
  }
}

/** DELETE — remove branch user */
export async function DELETE(request) {
  const scope = resolveUserManagementScope(request);
  if (scope.error) return scope.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ? parseInt(searchParams.get('id'), 10) : null;
  if (!id) return errorResponse('User ID is required');

  try {
    const existing = await centralPrisma.users.findUnique({
      where: { user_id: id },
      include: { _count: { select: { products: true, sales: true, purchases: true, expenses: true } } },
    });
    if (!existing) return errorResponse('User not found', 404);

    const block = assertCanModifyUser(scope, existing);
    if (block) return errorResponse(block, 403);

    if (existing.role === 'BRANCH_SUPER_ADMIN') {
      const count = await centralPrisma.users.count({
        where: { branch_id: existing.branch_id, role: 'BRANCH_SUPER_ADMIN' },
      });
      if (count <= 1) {
        return errorResponse('Cannot delete the last Branch Super Admin — create another admin first', 409);
      }
    }

    const totalRelated =
      (existing._count?.products || 0)
      + (existing._count?.sales || 0)
      + (existing._count?.purchases || 0)
      + (existing._count?.expenses || 0);

    if (totalRelated > 0) {
      return errorResponse(
        'User has transaction history. Set status to Inactive instead of deleting.',
        409
      );
    }

    await centralPrisma.users.delete({ where: { user_id: id } });
    return NextResponse.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('DELETE /api/users', err);
    return errorResponse('Failed to delete user', 500);
  }
}
