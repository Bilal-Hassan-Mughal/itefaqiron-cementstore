import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';


export async function POST(request) {
  try {
    const { userId, pin } = await request.json();

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
        fingerprint_enrolled: true,
        allowed_modules: true,
        pin_code: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'Account is inactive' }, { status: 401 });
    }

    if (!user.pin_code) {
      return NextResponse.json({ error: 'PIN not set for this user. Ask admin to set a PIN in Settings.' }, { status: 401 });
    }

    const isValid = await bcrypt.compare(String(pin), user.pin_code);
    if (!isValid) {
      return NextResponse.json({ error: 'Incorrect PIN. Please try again.' }, { status: 401 });
    }

    await prisma.users.update({
      where: { user_id: userId },
      data: { last_logged_in: new Date() },
    });

    const { pin_code, ...safeUser } = user;
    return NextResponse.json({ user: safeUser });
  } catch (error) {
    console.error('pin-login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
