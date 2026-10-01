import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';
import { attendanceDayBounds } from '@/lib/hr-payroll';
import { buildAttendanceSheetPayload } from './sheet-helpers';
import { batchSaveAttendanceSheet } from './save-helpers';

async function findAttendanceOnDay(db, empId, att_date) {
  const bounds = attendanceDayBounds(att_date);
  if (!bounds) return null;
  return db.attendance.findFirst({
    where: {
      emp_id: empId,
      att_date: { gte: bounds.start, lt: bounds.end },
    },
  });
}

async function saveAttendanceRecord(db, empId, { att_date, in_time, out_time, status, notes, clear }) {
  const bounds = attendanceDayBounds(att_date);
  if (!bounds) throw new Error(`Invalid att_date: ${att_date}`);

  const existing = await findAttendanceOnDay(db, empId, att_date);

  if (clear) {
    if (existing) {
      await db.attendance.delete({ where: { att_id: existing.att_id } });
      return { emp_id: empId, att_date, cleared: true };
    }
    return { emp_id: empId, att_date, cleared: false };
  }

  const data = {
    in_time: in_time || null,
    out_time: out_time || null,
    status: status || 'PRESENT',
    notes: notes || null,
    att_date: bounds.storageDate,
  };

  if (existing) {
    return db.attendance.update({
      where: { att_id: existing.att_id },
      data,
    });
  }

  return db.attendance.create({
    data: { emp_id: empId, ...data },
  });
}

async function getBranchEmployeeIds(branchId) {
  const employees = await prisma.employee.findMany({
    where: { branch_id: branchId },
    select: { emp_id: true },
  });
  return employees.map((e) => e.emp_id);
}

export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    const { searchParams } = new URL(request.url);
    const emp_id = searchParams.get('emp_id') ? parseInt(searchParams.get('emp_id'), 10) : null;
    const date = searchParams.get('date');
    const month = searchParams.get('month') ? parseInt(searchParams.get('month'), 10) : null;
    const year = searchParams.get('year') ? parseInt(searchParams.get('year'), 10) : null;
    const sheet = searchParams.get('sheet') === 'true';

    if (sheet && month && year) {
      const limit = searchParams.get('limit');
      const offset = searchParams.get('offset');
      const payload = await buildAttendanceSheetPayload(prisma, branchId, month, year, {
        limit: limit ? parseInt(limit, 10) : undefined,
        offset: offset ? parseInt(offset, 10) : undefined,
      });
      return NextResponse.json(payload);
    }

    const branchEmpIds = await getBranchEmployeeIds(branchId);
    if (branchEmpIds.length === 0) {
      return NextResponse.json([]);
    }

    const where = { emp_id: { in: branchEmpIds } };
    if (emp_id) {
      if (!branchEmpIds.includes(emp_id)) {
        return NextResponse.json({ error: 'Employee not found in branch' }, { status: 404 });
      }
      where.emp_id = emp_id;
    }

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
        employee: {
          select: {
            emp_id: true,
            emp_name: true,
            designation: true,
            department: true,
            join_date: true,
            basic_salary: true,
            status: true,
            branch_id: true,
          },
        },
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
  const branchId = __branchScope.branchId;

  try {
    const body = await request.json();
    const branchEmpIds = await getBranchEmployeeIds(branchId);

    const validateEmp = (id) => {
      const empId = parseInt(id, 10);
      if (!branchEmpIds.includes(empId)) {
        throw new Error(`Employee ${empId} is not in this branch`);
      }
      return empId;
    };

    if (Array.isArray(body)) {
      const result = await prisma.$transaction(
        (tx) => batchSaveAttendanceSheet(tx, branchId, body),
        { timeout: 120000, maxWait: 10000 },
      );
      return NextResponse.json({ ok: true, ...result });
    }

    const { emp_id, att_date, in_time, out_time, status, notes } = body;
    if (!emp_id || !att_date) {
      return NextResponse.json({ error: 'emp_id and att_date required' }, { status: 400 });
    }

    const empId = validateEmp(emp_id);
    const attendance = await saveAttendanceRecord(prisma, empId, {
      att_date, in_time, out_time, status, notes,
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
    const id = parseInt(searchParams.get('id'), 10);
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    await prisma.attendance.delete({ where: { att_id: id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
