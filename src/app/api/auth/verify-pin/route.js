import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';


// Lightweight PIN check used for in-app action confirmation (not a login)
export async function POST(request) {
  try {
    const { userId, pin } = await request.json();

    if (!userId || !pin) {
      return NextResponse.json({ valid: false, error: 'userId and pin required' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(String(pin))) {
      return NextResponse.json({ valid: false, error: 'PIN must be 6 digits' }, { status: 400 });
    }

    const user = await prisma.users.findUnique({
      where: { user_id: userId },
      select: { pin_code: true, status: true },
    });

    if (!user || user.status !== 'ACTIVE') {
      return NextResponse.json({ valid: false, error: 'User not found or inactive' }, { status: 404 });
    }

    if (!user.pin_code) {
      return NextResponse.json({ valid: false, error: 'No PIN set. Ask admin to set a PIN in Biometric Settings.' });
    }

    const valid = await bcrypt.compare(String(pin), user.pin_code);
    return NextResponse.json({ valid });
  } catch (error) {
    console.error('verify-pin error:', error);
    return NextResponse.json({ valid: false, error: 'Verification failed' }, { status: 500 });
  }
}
