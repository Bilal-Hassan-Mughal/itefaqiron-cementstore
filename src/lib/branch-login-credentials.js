/** Client-safe helpers for branch login credential display & copy text. */

export const BRANCH_LOGIN_PORTAL = '/login/branch';

import { getRoleDisplayName } from './user-role';

export function formatRoleLabel(role) {
  return getRoleDisplayName(role);
}

/**
 * @param {object} creds
 * @param {string} creds.branchCode
 * @param {string} creds.email
 * @param {string} [creds.password]
 * @param {string} [creds.fullName]
 * @param {string} [creds.role]
 * @param {string} [creds.branchName]
 * @param {string} [creds.portal]
 * @param {string} [origin] — e.g. window.location.origin
 */
export function formatBranchLoginCredentialsText(creds, origin) {
  const portal = creds.portal || BRANCH_LOGIN_PORTAL;
  const loginUrl = origin ? `${origin.replace(/\/$/, '')}${portal}` : portal;
  const lines = [
    'Itefaq POS — Branch Login Credentials',
    '────────────────────────────────────',
    creds.branchName ? `Branch: ${creds.branchName}` : null,
    `Branch Code: ${creds.branchCode || '—'}`,
    `Login URL: ${loginUrl}`,
    creds.fullName ? `Name: ${creds.fullName}` : null,
    creds.role ? `Role: ${formatRoleLabel(creds.role)}` : null,
    `Email: ${creds.email || '—'}`,
    creds.password ? `Password: ${creds.password}` : null,
    '',
    'Steps:',
    '1. Open the login URL above',
    '2. Enter the branch code',
    '3. Sign in with email and password',
  ].filter((line) => line !== null);

  return lines.join('\n');
}

export function buildBranchLoginUrl(origin, portal = BRANCH_LOGIN_PORTAL) {
  if (!origin) return portal;
  return `${origin.replace(/\/$/, '')}${portal}`;
}
