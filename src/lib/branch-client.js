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

/** Drop secrets/blobs that must never live in localStorage or request headers. */
export function stripSensitiveUserFields(user) {
  if (!user || typeof user !== 'object') return user;
  const {
    fingerprint_template,
    password,
    pin_code,
    ...safe
  } = user;
  return safe;
}

export function persistSessionUser(user) {
  if (typeof window === 'undefined' || !user) return null;
  const safe = stripSensitiveUserFields(user);
  try {
    localStorage.setItem('user', JSON.stringify(safe));
  } catch {
    /* ignore quota / private-mode write failures */
  }
  return safe;
}

/** Small session payload for x-user-json — never send templates/passwords. */
export function sanitizeUserForRequest(user) {
  if (!user || typeof user !== 'object') return null;
  const safe = stripSensitiveUserFields(user);
  const branch = safe.branch && typeof safe.branch === 'object'
    ? {
        branch_id: safe.branch.branch_id ?? null,
        branch_code: safe.branch.branch_code ?? '',
        branch_name: safe.branch.branch_name ?? '',
      }
    : undefined;
  return {
    user_id: safe.user_id,
    role: safe.role,
    email: safe.email,
    full_name: safe.full_name,
    branch_id: safe.branch_id ?? null,
    status: safe.status,
    allowed_modules: safe.allowed_modules ?? null,
    fingerprint_enrolled: safe.fingerprint_enrolled === true,
    ...(branch ? { branch } : {}),
  };
}

/** Patched fetch that sends x-branch-id for dashboard API calls. */
export function branchFetch(user, input, init = {}) {
  const headers = new Headers(init.headers || {});
  const branchHeaders = getBranchHeaders(user);
  Object.entries(branchHeaders).forEach(([k, v]) => headers.set(k, v));
  const safeUser = sanitizeUserForRequest(user);
  if (safeUser && !headers.has('x-user-json')) {
    headers.set('x-user-json', JSON.stringify(safeUser));
  }
  return fetch(input, { ...init, headers });
}
