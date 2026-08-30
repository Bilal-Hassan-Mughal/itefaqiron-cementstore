import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';


export async function GET() {
  try {
    let settings = await prisma.hrSettings.findFirst();
    if (!settings) {
      settings = await prisma.hrSettings.create({
        data: { allowed_leaves_per_month: 2, allowed_leaves_per_year: 24 },
      });
    }
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { allowed_leaves_per_month, allowed_leaves_per_year } = await request.json();
    let settings = await prisma.hrSettings.findFirst();
    if (!settings) {
      settings = await prisma.hrSettings.create({
        data: {
          allowed_leaves_per_month: parseInt(allowed_leaves_per_month) ?? 2,
          allowed_leaves_per_year: parseInt(allowed_leaves_per_year) ?? 24,
        },
      });
    } else {
      settings = await prisma.hrSettings.update({
        where: { id: settings.id },
        data: {
          allowed_leaves_per_month: parseInt(allowed_leaves_per_month) ?? settings.allowed_leaves_per_month,
          allowed_leaves_per_year: parseInt(allowed_leaves_per_year) ?? settings.allowed_leaves_per_year,
        },
      });
    }
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
