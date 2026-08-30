import { NextResponse } from 'next/server';
import prisma from '../../../../lib/prisma';

// Returns all active users for the login page user selector
export async function GET() {
  try {
    const users = await prisma.users.findMany({
      where: { status: 'ACTIVE' },
      select: {
        user_id: true,
        full_name: true,
        role: true,
        fingerprint_enrolled: true,
      },
      orderBy: { full_name: 'asc' },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('user-list error:', error);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
