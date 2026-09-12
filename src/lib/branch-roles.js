/** Roles branch managers can assign to staff (not HQ, not another super admin). */
export const BRANCH_ASSIGNABLE_ROLES = ['ADMIN', 'SALESMAN', 'MANAGER', 'ACCOUNTANT', 'STOCK_MANAGER'];

/** HQ roles — no branch_id on user; can access all branches. */
export const HQ_ROLES = new Set(['SUPER_ADMIN', 'HQ_SUPER_ADMIN']);

import { resolveStaffRole } from './user-role';

/** Full branch access roles (coarse DB enum — prefer resolveStaffRole for checks). */
export const BRANCH_ADMIN_ROLES = new Set(['BRANCH_SUPER_ADMIN', 'ADMIN', 'SUPER_ADMIN']);

export function isHqUser(user) {
  if (!user) return false;
  if (user.branch_id != null && user.branch_id !== '') return false;
  return HQ_ROLES.has(user.role);
}

export function canManageBranches(user) {
  return isHqUser(user);
}

export function canAccessBranch(user, branchId) {
  if (!user || !branchId) return false;
  if (isHqUser(user)) return true;
  return Number(user.branch_id) === Number(branchId);
}

/** Resolved role key for display and client-side access (not raw DB enum). */
export function getEffectiveStaffRole(user) {
  return resolveStaffRole(user);
}
