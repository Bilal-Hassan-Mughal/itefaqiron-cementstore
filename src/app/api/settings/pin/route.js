import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { initBranchScope } from '@/lib/branch-server';


// Set or change PIN for a user
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { userId, pin } = await request.json();

    if (!userId || !pin) {
      return NextResponse.json({ error: 'userId and pin required' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(String(pin))) {
      return NextResponse.json({ error: 'PIN must be exactly 6 digits' }, { status: 400 });
    }

    const hashedPin = await bcrypt.hash(String(pin), 12);

    await prisma.users.update({
      where: { user_id: userId },
      data: { pin_code: hashedPin },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('pin set error:', error);
    return NextResponse.json({ error: 'Failed to set PIN' }, { status: 500 });
  }
}

// Remove PIN for a user
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    await prisma.users.update({
      where: { user_id: userId },
      data: { pin_code: null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('pin delete error:', error);
    return NextResponse.json({ error: 'Failed to remove PIN' }, { status: 500 });
  }
}
