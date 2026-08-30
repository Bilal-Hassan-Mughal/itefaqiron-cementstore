import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { isHqUser } from '@/lib/branch-roles';
import { centralPrisma, invalidateBranchMetaCache, parseUserFromRequest } from '@/lib/branch-server';
import { provisionBranchStorage } from '@/lib/db/provision-branch';

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function requireHq(request) {
  const user = parseUserFromRequest(request);
  if (!user || !isHqUser(user)) {
    return { error: errorResponse('Head Office access required', 403) };
  }
  return { user };
}

/** GET — list all branches (HQ only) */
export async function GET(request) {
  const auth = requireHq(request);
  if (auth.error) return auth.error;

  try {
    const branches = await centralPrisma.branch.findMany({
      orderBy: { branch_id: 'asc' },
      select: {
        branch_id: true,
        branch_code: true,
        branch_name: true,
        address: true,
        phone: true,
        status: true,
        table_prefix: true,
        isolation_mode: true,
        tables_provisioned: true,
        provision_status: true,
        provision_message: true,
        db_name: true,
        created_at: true,
        updated_at: true,
        _count: { select: { users: true } },
      },
    });
    return NextResponse.json({ branches });
  } catch (err) {
    console.error('GET /api/branches', err);
    return errorResponse('Failed to load branches', 500);
  }
}

/** POST — create branch + dedicated tables + branch admin */
export async function POST(request) {
  const auth = requireHq(request);
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const {
      branch_code,
      branch_name,
      address,
      phone,
      admin_email,
      admin_password,
      admin_full_name,
    } = body;

    if (!branch_code?.trim()) return errorResponse('Branch code is required');
    if (!branch_name?.trim()) return errorResponse('Branch name is required');
    if (!admin_email?.trim()) return errorResponse('Branch admin email is required');
    if (!admin_password?.trim()) return errorResponse('Branch admin password is required');
    if (admin_password.trim().length < 6) {
      return errorResponse('Branch admin password must be at least 6 characters');
    }

    const code = branch_code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{2,12}$/.test(code)) {
      return errorResponse('Branch code must be 2–12 letters/numbers (e.g. LHR, GRT01)');
    }

    const existing = await centralPrisma.branch.findUnique({ where: { branch_code: code } });
    if (existing) return errorResponse('Branch code already exists', 409);

    const email = admin_email.trim().toLowerCase();
    const dup = await centralPrisma.users.findUnique({ where: { email } });
    if (dup) return errorResponse('Admin email already in use — choose another email', 409);

    const tablePrefix = code.toLowerCase().replace(/[^a-z0-9_]/g, '');

    let provision = {
      isolation_mode: 'SHARED',
      tables_provisioned: false,
      provision_status: 'PENDING',
      provision_message: 'Not provisioned',
    };

    try {
      provision = await provisionBranchStorage(code, process.env.DATABASE_URL);
    } catch (provErr) {
      console.error('Branch table provision failed:', provErr);
      provision = {
        isolation_mode: 'PREFIXED',
        table_prefix: tablePrefix,
        tables_provisioned: false,
        provision_status: 'FAILED',
        provision_message: provErr.message || 'Failed to create dedicated tables',
      };
    }

    const hashed = await bcrypt.hash(admin_password.trim(), 10);

    const branch = await centralPrisma.branch.create({
      data: {
        branch_code: code,
        branch_name: branch_name.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        status: 'ACTIVE',
        table_prefix: provision.table_prefix || tablePrefix,
        isolation_mode: provision.isolation_mode || 'PREFIXED',
        tables_provisioned: provision.tables_provisioned ?? false,
        provision_status: provision.provision_status || 'PENDING',
        provision_message: provision.provision_message || null,
        db_host: provision.db_host || null,
        db_port: provision.db_port || 3306,
        db_name: provision.db_name || null,
        db_user: provision.db_user || null,
        db_password: provision.db_password || null,
      },
    });

    const adminUser = await centralPrisma.users.create({
      data: {
        email,
        password: hashed,
        full_name: admin_full_name?.trim() || `${branch_name.trim()} Admin`,
        role: 'BRANCH_SUPER_ADMIN',
        branch_id: branch.branch_id,
        is_verified: true,
        status: 'ACTIVE',
      },
      select: {
        user_id: true,
        email: true,
        full_name: true,
        role: true,
        branch_id: true,
      },
    });

    invalidateBranchMetaCache(branch.branch_id);

    return NextResponse.json(
      {
        branch,
        adminUser,
        login_hint: {
          portal: '/login/branch',
          branch_code: branch.branch_code,
          email: adminUser.email,
          role: adminUser.role,
        },
        provision: {
          isolation_mode: branch.isolation_mode,
          tables_provisioned: branch.tables_provisioned,
          provision_status: branch.provision_status,
          message: branch.provision_message,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/branches', err);
    return errorResponse(err.message || 'Failed to create branch', 500);
  }
}
