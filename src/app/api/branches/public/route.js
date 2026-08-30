import { NextResponse } from 'next/server';
import { centralPrisma } from '@/lib/prisma';

/** GET — active branches for branch login dropdown (no auth) */
export async function GET() {
  try {
    const branches = await centralPrisma.branch.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ branch_name: 'asc' }, { branch_code: 'asc' }],
      select: {
        branch_id: true,
        branch_code: true,
        branch_name: true,
      },
    });

    return NextResponse.json({ branches });
  } catch (err) {
    console.error('GET /api/branches/public', err);
    return NextResponse.json({ error: 'Failed to load branches' }, { status: 500 });
  }
}
