import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';


export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const emp_id = searchParams.get('emp_id') ? parseInt(searchParams.get('emp_id')) : null;
    const date = searchParams.get('date');
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')) : null;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')) : null;

    const where = {};
    if (emp_id) where.emp_id = emp_id;

    if (date) {
      const d = new Date(date);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.att_date = { gte: d, lt: next };
    } else if (month && year) {
      where.att_date = {
        gte: new Date(year, month - 1, 1),
        lt: new Date(year, month, 1),
      };
    }

    const attendance = await prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { emp_id: true, emp_name: true, designation: true, department: true } },
      },
      orderBy: [{ att_date: 'asc' }, { emp_id: 'asc' }],
    });
    return NextResponse.json(attendance);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    // Support bulk save: array of records
    if (Array.isArray(body)) {
      const results = await Promise.all(
        body.map(({ emp_id, att_date, in_time, out_time, status, notes }) => {
          const d = new Date(att_date);
          return prisma.attendance.upsert({
            where: { emp_id_att_date: { emp_id: parseInt(emp_id), att_date: d } },
            update: { in_time: in_time || null, out_time: out_time || null, status: status || 'PRESENT', notes: notes || null },
            create: { emp_id: parseInt(emp_id), att_date: d, in_time: in_time || null, out_time: out_time || null, status: status || 'PRESENT', notes: notes || null },
          });
        })
      );
      return NextResponse.json(results);
    }

    const { emp_id, att_date, in_time, out_time, status, notes } = body;
    if (!emp_id || !att_date) return NextResponse.json({ error: 'emp_id and att_date required' }, { status: 400 });
    const d = new Date(att_date);

    const attendance = await prisma.attendance.upsert({
      where: { emp_id_att_date: { emp_id: parseInt(emp_id), att_date: d } },
      update: { in_time: in_time || null, out_time: out_time || null, status: status || 'PRESENT', notes: notes || null },
      create: { emp_id: parseInt(emp_id), att_date: d, in_time: in_time || null, out_time: out_time || null, status: status || 'PRESENT', notes: notes || null },
    });
    return NextResponse.json(attendance);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get('id'));
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await prisma.attendance.delete({ where: { att_id: id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
