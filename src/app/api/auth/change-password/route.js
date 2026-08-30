import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { centralPrisma } from '@/lib/prisma';
import { parseUserFromRequest } from '@/lib/branch-server';

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request) {
  const actor = parseUserFromRequest(request);
  if (!actor || !actor.user_id) {
    return errorResponse('Authentication required', 401);
  }

  try {
    const body = await request.json();
    const { current_password, new_password } = body;

    if (!current_password?.trim()) {
      return errorResponse('Current password is required');
    }
    if (!new_password?.trim()) {
      return errorResponse('New password is required');
    }
    if (new_password.trim().length < 6) {
      return errorResponse('New password must be at least 6 characters');
    }

    const user = await centralPrisma.users.findUnique({
      where: { user_id: Number(actor.user_id) },
    });

    if (!user) {
      return errorResponse('User account not found', 404);
    }

    let isValid = false;
    try {
      isValid = await bcrypt.compare(current_password.trim(), user.password);
      if (!isValid) {
        isValid = current_password.trim() === user.password;
      }
    } catch {
      isValid = current_password.trim() === user.password;
    }

    if (!isValid) {
      return errorResponse('Current password is incorrect', 400);
    }

    const hashed = await bcrypt.hash(new_password.trim(), 10);
    await centralPrisma.users.update({
      where: { user_id: user.user_id },
      data: { password: hashed },
    });

    return NextResponse.json({
      message: 'Password updated successfully',
    });
  } catch (err) {
    console.error('POST /api/auth/change-password error:', err);
    return errorResponse('Failed to change password', 500);
  }
}
