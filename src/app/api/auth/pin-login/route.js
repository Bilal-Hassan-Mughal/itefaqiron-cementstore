import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { isHqUser } from '@/lib/branch-roles';
import { normalizeUserForClient, resolveStaffRole, toDbRole } from '@/lib/user-role';

export async function POST(request) {
  try {
    const { userId, pin, login_mode: loginMode, branch_code: branchCode } = await request.json();

    if (!userId || !pin) {
      return NextResponse.json({ error: 'userId and pin required' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(String(pin))) {
      return NextResponse.json({ error: 'PIN must be exactly 6 digits' }, { status: 400 });
    }

    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        role: true,
        status: true,
        branch_id: true,
        fingerprint_enrolled: true,
        allowed_modules: true,
        is_verified: true,
        pin_code: true,
        branch: {
          select: {
            branch_id: true,
            branch_code: true,
            branch_name: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Account is inactive' }, { status: 401 });
    }

    const userIsHq = isHqUser(user);

    if (loginMode === 'hq' && !userIsHq) {
      return NextResponse.json({ error: 'This account is for branch login. Please use Branch Login.' }, { status: 403 });
    }

    if (loginMode === 'branch') {
      if (userIsHq) {
        return NextResponse.json({ error: 'Head Office accounts must use HQ Login.' }, { status: 403 });
      }
      if (!user.branch_id) {
        return NextResponse.json({ error: 'This account is not assigned to a branch.' }, { status: 403 });
      }
      if (user.branch?.status === 'SUSPENDED') {
        return NextResponse.json({ error: 'This branch is suspended. Contact Head Office.' }, { status: 403 });
      }
      const code = (branchCode || '').trim().toUpperCase();
      if (code && user.branch?.branch_code?.toUpperCase() !== code) {
        return NextResponse.json({ error: 'Branch code does not match this account.' }, { status: 403 });
      }
    }

    if (!user.pin_code) {
      return NextResponse.json({ error: 'PIN not set for this user. Set a PIN in Settings first.' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(String(pin), user.pin_code);
    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect PIN. Please try again.' }, { status: 401 });
    }

    const resolvedRole = resolveStaffRole(user);
    const roleNeedsSync =
      user.role === 'ADMIN' &&
      resolvedRole !== 'ADMIN' &&
      ['MANAGER', 'ACCOUNTANT', 'STOCK_MANAGER', 'SALESMAN'].includes(resolvedRole);

    const pinUpdate = { last_logged_in: new Date() };
    if (roleNeedsSync) pinUpdate.role = toDbRole(resolvedRole);

    try {
      await prisma.users.update({
        where: { user_id: userId },
        data: pinUpdate,
      });
    } catch (syncErr) {
      console.warn('PIN login role sync skipped (run DB migration for new roles):', syncErr?.message);
      await prisma.users.update({
        where: { user_id: userId },
        data: { last_logged_in: new Date() },
      });
    }

    const { pin_code, ...safeUser } = user;
    const clientUser = normalizeUserForClient(
      roleNeedsSync ? { ...safeUser, role: resolvedRole } : safeUser
    );
    return NextResponse.json({
      user: clientUser,
      is_hq: userIsHq,
      login_mode: loginMode || null,
    });
  } catch (error) {
    console.error('pin-login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
