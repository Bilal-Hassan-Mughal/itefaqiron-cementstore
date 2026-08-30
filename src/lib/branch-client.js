'use client';

import { isHqUser } from './branch-roles';

const ACTIVE_BRANCH_KEY = 'active_branch_id';
const ACTIVE_BRANCH_NAME_KEY = 'active_branch_name';
const ACTIVE_BRANCH_CODE_KEY = 'active_branch_code';
const HQ_POS_MODE_KEY = 'hq_pos_mode';

export function isHqPosMode() {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(HQ_POS_MODE_KEY) === '1';
}

export function setHqPosMode(enabled) {
  if (typeof window === 'undefined') return;
  if (enabled) localStorage.setItem(HQ_POS_MODE_KEY, '1');
  else localStorage.removeItem(HQ_POS_MODE_KEY);
}

/** HQ explicitly opened a branch POS session */
export function enterBranchAsHq(branch) {
  setActiveBranch(branch);
  setHqPosMode(true);
}

/** Return HQ to dashboard-only mode (no POS) */
export function exitHqPosMode() {
  clearActiveBranch();
  setHqPosMode(false);
}

export function getActiveBranchId() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(ACTIVE_BRANCH_KEY);
  if (!raw) return null;
  const id = parseInt(raw, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export function getActiveBranchMeta() {
  if (typeof window === 'undefined') return { id: null, name: '', code: '' };
  return {
    id: getActiveBranchId(),
    name: localStorage.getItem(ACTIVE_BRANCH_NAME_KEY) || '',
    code: localStorage.getItem(ACTIVE_BRANCH_CODE_KEY) || '',
  };
}

export function setActiveBranch(branch) {
  if (typeof window === 'undefined' || !branch?.branch_id) return;
  localStorage.setItem(ACTIVE_BRANCH_KEY, String(branch.branch_id));
  localStorage.setItem(ACTIVE_BRANCH_NAME_KEY, branch.branch_name || '');
  localStorage.setItem(ACTIVE_BRANCH_CODE_KEY, branch.branch_code || '');
  window.dispatchEvent(new CustomEvent('branch-changed', { detail: branch }));
}

export function clearActiveBranch() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(ACTIVE_BRANCH_KEY);
  localStorage.removeItem(ACTIVE_BRANCH_NAME_KEY);
  localStorage.removeItem(ACTIVE_BRANCH_CODE_KEY);
  window.dispatchEvent(new CustomEvent('branch-changed', { detail: null }));
}

/** Resolve branch for API calls. Branch users: fixed. HQ in POS mode: selected branch. HQ on dashboard: none (uses default 1 only if in POS). */
export function resolveClientBranchId(user) {
  if (!user) return 1;
  if (isHqUser(user)) {
    if (!isHqPosMode()) return null;
    return getActiveBranchId() || 1;
  }
  return user.branch_id ? Number(user.branch_id) : 1;
}

export function getBranchHeaders(user) {
  const branchId = resolveClientBranchId(user);
  if (!branchId) return {};
  return { 'x-branch-id': String(branchId) };
}

/** Patched fetch that sends x-branch-id for dashboard API calls. */
export function branchFetch(user, input, init = {}) {
  const headers = new Headers(init.headers || {});
  const branchHeaders = getBranchHeaders(user);
  Object.entries(branchHeaders).forEach(([k, v]) => headers.set(k, v));
  if (user && !headers.has('x-user-json')) {
    headers.set('x-user-json', JSON.stringify(user));
  }
  return fetch(input, { ...init, headers });
}
