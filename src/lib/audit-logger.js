import { prisma } from './prisma';

/**
 * Standard module names for consistent activity categorization.
 */
export const AUDIT_MODULES = {
  AUTH: 'Authentication',
  SALES: 'Sales & POS',
  PURCHASES: 'Purchases',
  CUSTOMERS: 'Accounts & Customers',
  SUPPLIERS: 'Suppliers',
  PRODUCTS: 'Inventory & Products',
  EXPENSES: 'Expenses',
  DAY_END: 'Day End Closing',
  PAYMENTS: 'Payments',
  JOURNAL: 'Journal Entries',
  USERS: 'User Management',
  SYSTEM: 'System Settings',
  REPORTS: 'Reports & Analytics',
};

/**
 * Standard actions for consistent filtering.
 */
export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  LOGIN_FAILED: 'LOGIN_FAILED',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  VIEW: 'VIEW',
  EXPORT: 'EXPORT',
  STATUS_CHANGE: 'STATUS_CHANGE',
  DAY_END_CLOSE: 'DAY_END_CLOSE',
  ADJUSTMENT: 'ADJUSTMENT',
  RETURN: 'RETURN',
};

/**
 * Extract client IP from Next.js request headers.
 */
export function getClientIp(request) {
  if (!request) return null;
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return null;
}

/**
 * Extract User-Agent header from request.
 */
export function getClientUserAgent(request) {
  if (!request) return null;
  const ua = request.headers.get('user-agent');
  return ua ? ua.slice(0, 255) : null;
}

/**
 * Log user activity into activity_logs table.
 * Designed to be non-blocking and safe so failures in logging never break business operations.
 *
 * @param {Object} options
 * @param {Object} [options.request] - Next.js Request object (optional, extracts IP, user, UA)
 * @param {number} [options.branchId] - Branch ID (defaults from user/context)
 * @param {number} [options.userId] - User ID
 * @param {string} [options.userName] - Full Name
 * @param {string} [options.role] - User role
 * @param {string} options.action - Action type (CREATE, UPDATE, DELETE, etc.)
 * @param {string} options.module - Module name (Sales, Customer, etc.)
 * @param {string|number} [options.entityId] - ID of affected record (Sale #123)
 * @param {string} options.description - Human-readable summary of activity
 * @param {Object} [options.details] - Structured metadata / old vs new diff
 */
export async function logActivity({
  request = null,
  branchId = null,
  userId = null,
  userName = null,
  role = null,
  action,
  module,
  entityId = null,
  description,
  details = null,
}) {
  try {
    let resolvedUserId = userId;
    let resolvedUserName = userName;
    let resolvedRole = role;
    let resolvedBranchId = branchId;

    let ipAddress = null;
    let userAgent = null;

    if (request) {
      ipAddress = getClientIp(request);
      userAgent = getClientUserAgent(request);

      const rawUser = request.headers.get('x-user-json');
      if (rawUser && (!resolvedUserId || !resolvedUserName)) {
        try {
          const parsed = JSON.parse(rawUser);
          if (parsed) {
            resolvedUserId = resolvedUserId || parsed.user_id || parsed.id;
            resolvedUserName = resolvedUserName || parsed.full_name || parsed.name || parsed.email;
            resolvedRole = resolvedRole || parsed.role;
            resolvedBranchId = resolvedBranchId || parsed.branch_id;
          }
        } catch {
          // Ignore JSON parse errors
        }
      }

      const branchHeader = request.headers.get('x-branch-id');
      if (!resolvedBranchId && branchHeader) {
        const parsedB = parseInt(branchHeader, 10);
        if (Number.isFinite(parsedB) && parsedB > 0) {
          resolvedBranchId = parsedB;
        }
      }
    }

    if (resolvedBranchId != null) {
      resolvedBranchId = parseInt(resolvedBranchId, 10) || null;
    }
    if (resolvedUserId != null) {
      resolvedUserId = parseInt(resolvedUserId, 10) || null;
    }

    const payload = {
      branch_id: resolvedBranchId,
      user_id: resolvedUserId,
      user_name: resolvedUserName ? String(resolvedUserName).slice(0, 128) : null,
      role: resolvedRole ? String(resolvedRole).slice(0, 50) : null,
      action: String(action || 'ACTION').slice(0, 50),
      module: String(module || 'General').slice(0, 100),
      entity_id: entityId != null ? String(entityId).slice(0, 100) : null,
      description: description || null,
      details: details ? (typeof details === 'object' ? details : { raw: details }) : null,
      ip_address: ipAddress ? String(ipAddress).slice(0, 64) : null,
      user_agent: userAgent ? String(userAgent).slice(0, 255) : null,
    };

    // Use Prisma or direct raw query if Prisma model is still compiling
    if (prisma?.activityLog?.create) {
      await prisma.activityLog.create({ data: payload });
    } else {
      const detailsJson = payload.details ? JSON.stringify(payload.details) : null;
      await prisma.$executeRaw`
        INSERT INTO activity_logs (
          branch_id, user_id, user_name, role, action, module, entity_id, description, details, ip_address, user_agent, created_at
        ) VALUES (
          ${payload.branch_id}, ${payload.user_id}, ${payload.user_name}, ${payload.role}, ${payload.action},
          ${payload.module}, ${payload.entity_id}, ${payload.description}, ${detailsJson},
          ${payload.ip_address}, ${payload.user_agent}, NOW()
        )
      `;
    }
  } catch (err) {
    // Non-blocking catch: Never fail the main business transaction because logging failed
    console.error('⚠️ [AuditLogger] Failed to record log:', err.message);
  }
}
