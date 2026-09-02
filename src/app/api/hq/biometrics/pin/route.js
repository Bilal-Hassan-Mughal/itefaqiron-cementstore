import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { centralPrisma } from '@/lib/prisma';
import { loadHqUser, requireHqActor } from '@/lib/hq-server';

/** POST — set 6-digit PIN for an HQ account */
export async function POST(request) {
  const scope = requireHqActor(request);
  if (scope.error) return scope.error;

  try {
    const { userId, pin } = await request.json();

    if (!userId || !pin) {
      return NextResponse.json({ error: 'userId and pin required' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(String(pin))) {
      return NextResponse.json({ error: 'PIN must be exactly 6 digits' }, { status: 400 });
    }

    const target = await loadHqUser(Number(userId));
    if (!target) {
      return NextResponse.json({ error: 'HQ account not found' }, { status: 404 });
    }

    const hashedPin = await bcrypt.hash(String(pin), 12);

    await centralPrisma.users.update({
      where: { user_id: target.user_id },
      data: { pin_code: hashedPin },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('POST /api/hq/biometrics/pin', err);
    return NextResponse.json({ error: 'Failed to set PIN' }, { status: 500 });
  }
}

/** DELETE — remove PIN for an HQ account */
export async function DELETE(request) {
  const scope = requireHqActor(request);
  if (scope.error) return scope.error;

  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const target = await loadHqUser(Number(userId));
    if (!target) {
      return NextResponse.json({ error: 'HQ account not found' }, { status: 404 });
    }

    await centralPrisma.users.update({
      where: { user_id: target.user_id },
      data: { pin_code: null },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/hq/biometrics/pin', err);
    return NextResponse.json({ error: 'Failed to remove PIN' }, { status: 500 });
  }
}
