import { NextResponse } from 'next/server';
import { canAccessBranch, isHqUser } from './branch-roles';
import { branchContext } from './branch-context';
import { centralPrisma, getDedicatedBranchClient } from './prisma';

const DEFAULT_BRANCH_ID = 1;

const branchMetaCache = new Map();

export function parseUserFromRequest(request) {
  const raw = request.headers.get('x-user-json');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function resolveBranchId(request, fallback = DEFAULT_BRANCH_ID) {
  const user = parseUserFromRequest(request);
  const header = request.headers.get('x-branch-id');
  if (header) {
    const id = parseInt(header, 10);
    if (Number.isFinite(id) && id > 0) return id;
  }
  if (user?.branch_id != null && user.branch_id !== '') {
    return Number(user.branch_id);
  }
  return fallback;
}

export function branchWhere(branchId) {
  if (!branchId) return {};
  return { branch_id: branchId };
}

export function mergeBranchWhere(branchId, where = {}) {
  return { ...where, ...branchWhere(branchId) };
}

export function withBranchData(branchId, data) {
  return { ...data, branch_id: branchId };
}

export function assertBranchAccess(user, branchId) {
  if (!canAccessBranch(user, branchId)) {
    const err = new Error('Access denied for this branch');
    err.status = 403;
    throw err;
  }
}

export function requireBranchScope(request) {
  const user = parseUserFromRequest(request);
  const header = request.headers.get('x-branch-id');

  let branchId = null;
  if (header) {
    branchId = parseInt(header, 10);
  } else if (user?.branch_id != null && user.branch_id !== '') {
    branchId = Number(user.branch_id);
  } else if (user && isHqUser(user)) {
    return {
      error: NextResponse.json(
        { error: 'Branch context required. Open a branch from Head Office first.' },
        { status: 400 }
      ),
    };
  } else {
    branchId = DEFAULT_BRANCH_ID;
  }

  if (!Number.isFinite(branchId) || branchId <= 0) {
    return { error: NextResponse.json({ error: 'Invalid branch context' }, { status: 400 }) };
  }

  if (user && !canAccessBranch(user, branchId)) {
    return { error: NextResponse.json({ error: 'Access denied for this branch' }, { status: 403 }) };
  }

  return { branchId, user };
}

async function loadBranchMeta(branchId) {
  if (branchMetaCache.has(branchId)) return branchMetaCache.get(branchId);

  const branch = await centralPrisma.branch.findUnique({
    where: { branch_id: branchId },
    select: {
      branch_id: true,
      branch_code: true,
      table_prefix: true,
      isolation_mode: true,
      tables_provisioned: true,
      db_host: true,
      db_port: true,
      db_name: true,
      db_user: true,
      db_password: true,
    },
  });

  if (!branch) return null;

  const meta = {
    branchId,
    tablePrefix: branch.table_prefix,
    isolationMode: branch.isolation_mode || 'SHARED',
    branchPrisma: getDedicatedBranchClient(branch),
  };

  branchMetaCache.set(branchId, meta);
  return meta;
}

/** Clear cache after branch update (call from branch PATCH/POST). */
export function invalidateBranchMetaCache(branchId) {
  if (branchId) branchMetaCache.delete(branchId);
  else branchMetaCache.clear();
}

/**
 * Async — loads branch isolation (dedicated DB / prefixed tables) into request context.
 */
export async function initBranchScope(request) {
  const scope = requireBranchScope(request);
  if (scope.error) return scope;

  const meta = await loadBranchMeta(scope.branchId);
  if (!meta) {
    return { error: NextResponse.json({ error: 'Branch not found' }, { status: 404 }) };
  }

  branchContext.enterWith({
    branchId: scope.branchId,
    tablePrefix: meta.tablePrefix,
    isolationMode: meta.isolationMode,
    branchPrisma: meta.branchPrisma,
  });

  return { ...scope, ...meta };
}

export function requireBranchContext(request, user = null) {
  const branchId = resolveBranchId(request);
  if (user && !isHqUser(user) && Number(user.branch_id) !== branchId) {
    const err = new Error('Branch mismatch');
    err.status = 403;
    throw err;
  }
  return branchId;
}

export { DEFAULT_BRANCH_ID, isHqUser, centralPrisma };
