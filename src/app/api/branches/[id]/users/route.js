import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { isHqUser } from '@/lib/branch-roles';
import { parseUserFromRequest } from '@/lib/branch-server';

const BRANCH_ROLES = new Set(['BRANCH_SUPER_ADMIN', 'ADMIN', 'SALESMAN']);

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

async function parseBranchId(params) {
  const { id } = await params;
  const branchId = parseInt(id, 10);
  if (!Number.isFinite(branchId)) return null;
  return branchId;
}

function userSelect() {
  return {
    user_id: true,
    full_name: true,
    email: true,
    role: true,
    status: true,
    branch_id: true,
    is_verified: true,
    last_logged_in: true,
    created_at: true,
  };
}

/** GET — branch users (HQ only) */
export async function GET(request, { params }) {
  const auth = requireHq(request);
  if (auth.error) return auth.error;

  const branchId = await parseBranchId(params);
  if (!branchId) return errorResponse('Invalid branch id');

  try {
    const branch = await prisma.branch.findUnique({ where: { branch_id: branchId } });
    if (!branch) return errorResponse('Branch not found', 404);

    const users = await prisma.users.findMany({
      where: { branch_id: branchId },
      select: userSelect(),
      orderBy: [{ role: 'asc' }, { full_name: 'asc' }],
    });

    return NextResponse.json({ users, branch_code: branch.branch_code });
  } catch (err) {
    console.error('GET /api/branches/[id]/users', err);
    return errorResponse('Failed to load branch users', 500);
  }
}

/** POST — add branch user (HQ only) */
export async function POST(request, { params }) {
  const auth = requireHq(request);
  if (auth.error) return auth.error;

  const branchId = await parseBranchId(params);
  if (!branchId) return errorResponse('Invalid branch id');

  try {
    const branch = await prisma.branch.findUnique({ where: { branch_id: branchId } });
    if (!branch) return errorResponse('Branch not found', 404);

    const body = await request.json();
    const { full_name, email, password, role, status } = body;

    if (!full_name?.trim()) return errorResponse('Full name is required');
    if (!email?.trim()) return errorResponse('Email is required');
    if (!password?.trim()) return errorResponse('Password is required');
    if (password.trim().length < 6) return errorResponse('Password must be at least 6 characters');

    const dbRole = BRANCH_ROLES.has(role) ? role : 'SALESMAN';
    const normalizedEmail = email.trim().toLowerCase();

    const dup = await prisma.users.findUnique({ where: { email: normalizedEmail } });
    if (dup) return errorResponse('Email already in use', 409);

    const hashed = await bcrypt.hash(password.trim(), 10);
    const user = await prisma.users.create({
      data: {
        full_name: full_name.trim(),
        email: normalizedEmail,
        password: hashed,
        role: dbRole,
        branch_id: branchId,
        is_verified: true,
        status: status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
      },
      select: userSelect(),
    });

    return NextResponse.json(
      {
        user,
        login_hint: {
          portal: '/login/branch',
          branch_code: branch.branch_code,
          email: user.email,
          role: user.role,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('POST /api/branches/[id]/users', err);
    return errorResponse('Failed to create branch user', 500);
  }
}
