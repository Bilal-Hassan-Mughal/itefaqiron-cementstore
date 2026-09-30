import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';

/** Lightweight stats for HR hub only — avoids full payroll calculate. */
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId ?? 1;

  try {
    const { searchParams } = new URL(request.url);
    const now = new Date();
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1), 10);
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()), 10);

    const activeRows = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS c, COALESCE(SUM(basic_salary), 0) AS payroll_sum
      FROM employees
      WHERE branch_id = ${branchId} AND status = 'ACTIVE'
    `);
    const activeEmployees = Number(activeRows?.[0]?.c || 0);
    const monthlyPayroll = parseFloat(activeRows?.[0]?.payroll_sum || 0);

    const pendingRows = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*) AS c
      FROM employees e
      WHERE e.branch_id = ${branchId} AND e.status = 'ACTIVE'
        AND NOT EXISTS (
          SELECT 1 FROM payrolls p
          WHERE p.emp_id = e.emp_id AND p.month = ${month} AND p.year = ${year} AND p.status = 'PAID'
        )
    `);
    const pendingClearance = Number(pendingRows?.[0]?.c || 0);

    const advRows = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(SUM(ea.amount), 0) AS total
      FROM employee_advances ea
      INNER JOIN employees e ON e.emp_id = ea.emp_id
      WHERE ea.status = 'PENDING' AND e.branch_id = ${branchId}
    `);
    const advanceBalance = parseFloat(advRows?.[0]?.total || 0);

    return NextResponse.json({
      activeEmployees,
      monthlyPayroll,
      pendingClearance,
      advanceBalance,
      month,
      year,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
