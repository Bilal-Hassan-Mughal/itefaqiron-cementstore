/**
 * Role permission templates from User Management (Role Access Map).
 * Stored in localStorage until persisted on each user via API sync.
 */

import { getAllPageIds, normalizeAllowedModules } from './page-modules';

const FULL_ACCESS_ROLE_KEYS = new Set(['BRANCH_SUPER_ADMIN', 'SUPER_ADMIN', 'HQ_SUPER_ADMIN']);

export const ROLE_PERMISSIONS_STORAGE_KEY = 'pos_custom_role_permissions';

export function loadCustomRolePermissions() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ROLE_PERMISSIONS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const normalized = {};
    Object.keys(parsed).forEach((key) => {
      normalized[key] = normalizeAllowedModules(parsed[key]);
    });
    return normalized;
  } catch {
    return null;
  }
}

export function saveCustomRolePermissions(map) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ROLE_PERMISSIONS_STORAGE_KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent('role-permissions-updated'));
}

/** Factory defaults before any User Management customization. */
export function getFactoryRoleModules(roleKey, systemRoles = []) {
  if (FULL_ACCESS_ROLE_KEYS.has(roleKey)) {
    return getAllPageIds();
  }
  const role = systemRoles.find((r) => r.key === roleKey);
  const coarse = role?.defaultModules?.length ? [...role.defaultModules] : ['dashboard', 'sales'];
  if (coarse.includes('__full_access__')) {
    return getAllPageIds();
  }
  return normalizeAllowedModules(coarse);
}

/** Role template: custom map → factory default. */
export function getRoleTemplateModules(roleKey, systemRoles = []) {
  const custom = loadCustomRolePermissions();
  if (custom?.[roleKey]?.length) {
    return custom[roleKey];
  }
  return getFactoryRoleModules(roleKey, systemRoles);
}

export function notifyUserPermissionsUpdated(user) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('user-permissions-updated', { detail: user }));
}
