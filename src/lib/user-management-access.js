import { isHqUser, HQ_ROLES, canManageUsers, BRANCH_ASSIGNABLE_ROLES } from './branch-roles';
import { parseUserFromRequest } from './branch-server';
import { centralPrisma } from './prisma';
import { NextResponse } from 'next/server';

export { BRANCH_ASSIGNABLE_ROLES };

/** Map UI role keys to Prisma UserRole enum */
export function toDbRole(role) {
  const map = {
    HQ_SUPER_ADMIN: 'HQ_SUPER_ADMIN',
    SUPER_ADMIN: 'SUPER_ADMIN',
    BRANCH_SUPER_ADMIN: 'BRANCH_SUPER_ADMIN',
    ADMIN: 'ADMIN',
    SALESMAN: 'SALESMAN',
    MANAGER: 'ADMIN',
    ACCOUNTANT: 'ADMIN',
    STOCK_MANAGER: 'ADMIN',
  };
  return map[role] || 'SALESMAN';
}

export function resolveUserManagementScope(request) {
  const actor = parseUserFromRequest(request);
  if (!actor) {
    return { error: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  }

  if (!canManageUsers(actor)) {
    return { error: NextResponse.json({ error: 'You do not have permission to manage users' }, { status: 403 }) };
  }

  const { searchParams } = new URL(request.url);
  const queryBranchId = searchParams.get('branch_id')
    ? parseInt(searchParams.get('branch_id'), 10)
    : null;

  const headerBranch = request.headers.get('x-branch-id');
  const headerBranchId = headerBranch ? parseInt(headerBranch, 10) : null;

  let branchId = null;

  if (isHqUser(actor)) {
    branchId = queryBranchId || headerBranchId || null;
  } else {
    branchId = Number(actor.branch_id);
    if (!Number.isFinite(branchId) || branchId <= 0) {
      return { error: NextResponse.json({ error: 'Your account is not assigned to a branch' }, { status: 403 }) };
    }
  }

  return { actor, branchId, isHq: isHqUser(actor) };
}

export function userListWhere(scope) {
  const where = {
    role: { notIn: [...HQ_ROLES] },
  };

  if (scope.branchId) {
    where.branch_id = scope.branchId;
  } else if (scope.isHq) {
    where.branch_id = { not: null };
  }

  return where;
}

export function assertCanModifyUser(scope, targetUser) {
  if (!targetUser) return 'User not found';

  if (HQ_ROLES.has(targetUser.role)) {
    return 'HQ accounts are managed from Head Office only';
  }

  if (!scope.isHq) {
    if (Number(targetUser.branch_id) !== Number(scope.branchId)) {
      return 'You can only manage users in your branch';
    }
    if (targetUser.role === 'BRANCH_SUPER_ADMIN' && scope.actor.role !== 'BRANCH_SUPER_ADMIN') {
      return 'Only Branch Super Admin can edit this account';
    }
    if (targetUser.user_id === scope.actor.user_id && scope.actor.role !== 'BRANCH_SUPER_ADMIN') {
      return 'You cannot delete your own account';
    }
  }

  return null;
}

export function assertRoleAssignable(scope, role) {
  const dbRole = toDbRole(role);

  if (HQ_ROLES.has(dbRole) || dbRole === 'BRANCH_SUPER_ADMIN') {
    if (!scope.isHq) {
      return 'Branch managers cannot create HQ or Super Admin accounts';
    }
  }

  if (!scope.isHq) {
    if (!BRANCH_ASSIGNABLE_ROLES.includes(role)) {
      return `Role must be one of: ${BRANCH_ASSIGNABLE_ROLES.join(', ')}`;
    }
  }

  return null;
}

export async function loadBranchMeta(branchId) {
  if (!branchId) return null;
  return centralPrisma.branch.findUnique({
    where: { branch_id: branchId },
    select: { branch_id: true, branch_code: true, branch_name: true, status: true },
  });
}
