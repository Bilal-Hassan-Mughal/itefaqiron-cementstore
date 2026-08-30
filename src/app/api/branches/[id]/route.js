import { NextResponse } from 'next/server';
import { centralPrisma, invalidateBranchMetaCache, parseUserFromRequest } from '@/lib/branch-server';
import { isHqUser } from '@/lib/branch-roles';
import { provisionBranchStorage } from '@/lib/db/provision-branch';
import { deprovisionBranchStorage } from '@/lib/db/deprovision-branch';

function branchHasBusinessData(counts) {
  return (
    counts.sales > 0
    || counts.customers > 0
    || counts.products > 0
    || counts.purchases > 0
    || counts.expenses > 0
    || counts.ledger > 0
    || counts.hold_bills > 0
    || counts.day_ends > 0
    || counts.stores > 0
  );
}

function dataStorageLabel(branch) {
  const mode = branch.isolation_mode || 'SHARED';
  if (mode === 'DEDICATED') return `Dedicated database: ${branch.db_name || '—'}`;
  if (mode === 'PREFIXED') {
    const prefix = branch.table_prefix || branch.branch_code?.toLowerCase();
    return `Prefixed tables: ${prefix}_* (${branch.tables_provisioned ? 'provisioned' : 'not provisioned'})`;
  }
  return 'Shared tables (filtered by branch_id)';
}

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const COUNT_SELECT = {
  users: true,
  customers: true,
  sales: true,
  products: true,
  stores: true,
  purchases: true,
  expenses: true,
  ledger: true,
  hold_bills: true,
  day_ends: true,
};

const USER_SELECT = {
  user_id: true,
  full_name: true,
  email: true,
  role: true,
  status: true,
  last_logged_in: true,
  created_at: true,
};

/** PATCH — update branch (HQ only) */
export async function PATCH(request, { params }) {
  const user = parseUserFromRequest(request);
  if (!user || !isHqUser(user)) {
    return errorResponse('Head Office access required', 403);
  }

  const { id } = await params;
  const branchId = parseInt(id, 10);
  if (!Number.isFinite(branchId)) return errorResponse('Invalid branch id');

  try {
    const body = await request.json();
    const data = {};

    if (body.branch_code?.trim()) {
      const code = body.branch_code.trim().toUpperCase();
      if (!/^[A-Z0-9_-]{2,12}$/.test(code)) {
        return errorResponse('Branch code must be 2–12 letters/numbers (e.g. MAIN, LHR)');
      }
      const dup = await centralPrisma.branch.findFirst({
        where: { branch_code: code, branch_id: { not: branchId } },
      });
      if (dup) return errorResponse('Branch code already in use', 409);
      data.branch_code = code;
    }

    if (body.branch_name?.trim()) data.branch_name = body.branch_name.trim();
    if (body.address !== undefined) data.address = body.address?.trim() || null;
    if (body.phone !== undefined) data.phone = body.phone?.trim() || null;
    if (body.status === 'ACTIVE' || body.status === 'SUSPENDED') data.status = body.status;

    if (body.action === 'reprovision') {
      const existing = await centralPrisma.branch.findUnique({ where: { branch_id: branchId } });
      if (!existing) return errorResponse('Branch not found', 404);
      const provision = await provisionBranchStorage(existing.branch_code, process.env.DATABASE_URL);
      const updated = await centralPrisma.branch.update({
        where: { branch_id: branchId },
        data: {
          table_prefix: provision.table_prefix,
          isolation_mode: provision.isolation_mode,
          tables_provisioned: provision.tables_provisioned,
          provision_status: provision.provision_status,
          provision_message: provision.provision_message,
          db_host: provision.db_host,
          db_port: provision.db_port,
          db_name: provision.db_name,
          db_user: provision.db_user,
          db_password: provision.db_password,
        },
      });
      invalidateBranchMetaCache(branchId);
      return NextResponse.json({ branch: updated, provision });
    }

    if (Object.keys(data).length === 0) {
      return errorResponse('No valid fields to update');
    }

    const branch = await centralPrisma.branch.update({
      where: { branch_id: branchId },
      data,
      include: { _count: { select: COUNT_SELECT } },
    });

    invalidateBranchMetaCache(branchId);

    return NextResponse.json({ branch });
  } catch (err) {
    if (err.code === 'P2025') return errorResponse('Branch not found', 404);
    console.error('PATCH /api/branches/[id]', err);
    return errorResponse('Failed to update branch', 500);
  }
}

/** GET — full branch detail (HQ only) */
export async function GET(request, { params }) {
  const user = parseUserFromRequest(request);
  if (!user || !isHqUser(user)) {
    return errorResponse('Head Office access required', 403);
  }

  const { id } = await params;
  const branchId = parseInt(id, 10);
  if (!Number.isFinite(branchId)) return errorResponse('Invalid branch id');

  try {
    const branch = await centralPrisma.branch.findUnique({
      where: { branch_id: branchId },
      include: {
        _count: { select: COUNT_SELECT },
        users: {
          select: USER_SELECT,
          orderBy: [{ role: 'asc' }, { full_name: 'asc' }],
        },
      },
    });
    if (!branch) return errorResponse('Branch not found', 404);

    const hasBusinessData = branchHasBusinessData(branch._count);
    const isDefaultMain = branch.branch_code === 'MAIN';

    return NextResponse.json({
      branch,
      can_delete: !isDefaultMain,
      delete_block_reason: isDefaultMain
        ? 'The default MAIN branch cannot be deleted.'
        : null,
      has_business_data: hasBusinessData,
      data_storage: dataStorageLabel(branch),
    });
  } catch (err) {
    console.error('GET /api/branches/[id]', err);
    return errorResponse('Failed to load branch', 500);
  }
}

/** DELETE — remove branch (HQ only). Options: drop_data=true drops tables/DB rows; false keeps data. */
export async function DELETE(request, { params }) {
  const user = parseUserFromRequest(request);
  if (!user || !isHqUser(user)) {
    return errorResponse('Head Office access required', 403);
  }

  const { id } = await params;
  const branchId = parseInt(id, 10);
  if (!Number.isFinite(branchId)) return errorResponse('Invalid branch id');

  try {
    const body = await request.json().catch(() => ({}));
    const confirmCode = body.confirm_code?.trim().toUpperCase();
    const dropData = body.drop_data === true;

    const branch = await centralPrisma.branch.findUnique({
      where: { branch_id: branchId },
      include: { _count: { select: COUNT_SELECT } },
    });
    if (!branch) return errorResponse('Branch not found', 404);

    if (branch.branch_code === 'MAIN') {
      return errorResponse('The default MAIN branch cannot be deleted', 409);
    }

    if (!confirmCode || confirmCode !== branch.branch_code) {
      return errorResponse(`Type branch code "${branch.branch_code}" to confirm deletion`, 400);
    }

    let deprovisionResult = null;
    if (dropData) {
      deprovisionResult = await deprovisionBranchStorage(branch, process.env.DATABASE_URL);
    }

    await centralPrisma.$transaction([
      centralPrisma.users.deleteMany({ where: { branch_id: branchId } }),
      centralPrisma.branch.delete({ where: { branch_id: branchId } }),
    ]);

    invalidateBranchMetaCache(branchId);

    return NextResponse.json({
      success: true,
      deleted_branch_code: branch.branch_code,
      drop_data: dropData,
      data_action: dropData ? 'dropped' : 'kept',
      deprovision: deprovisionResult,
    });
  } catch (err) {
    console.error('DELETE /api/branches/[id]', err);
    return errorResponse(err.message || 'Failed to delete branch', 500);
  }
}
