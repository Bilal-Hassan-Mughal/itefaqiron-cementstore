import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';

export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    let settings = await prisma.hrSettings.findFirst({ where: { branch_id: branchId } });
    if (!settings) {
      settings = await prisma.hrSettings.create({
        data: {
          branch_id: branchId,
          allowed_leaves_per_month: 2,
          allowed_leaves_per_year: 24,
        },
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
  const branchId = __branchScope.branchId;

  try {
    const { allowed_leaves_per_month, allowed_leaves_per_year } = await request.json();
    let settings = await prisma.hrSettings.findFirst({ where: { branch_id: branchId } });
    if (!settings) {
      settings = await prisma.hrSettings.create({
        data: {
          branch_id: branchId,
          allowed_leaves_per_month: parseInt(allowed_leaves_per_month, 10) ?? 2,
          allowed_leaves_per_year: parseInt(allowed_leaves_per_year, 10) ?? 24,
        },
      });
    } else {
      settings = await prisma.hrSettings.update({
        where: { id: settings.id },
        data: {
          allowed_leaves_per_month: parseInt(allowed_leaves_per_month, 10) ?? settings.allowed_leaves_per_month,
          allowed_leaves_per_year: parseInt(allowed_leaves_per_year, 10) ?? settings.allowed_leaves_per_year,
        },
      });
    }
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
