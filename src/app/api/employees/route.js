import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';


export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;
    const status = searchParams.get('status');

    if (id) {
      const employee = await prisma.employee.findUnique({
        where: { emp_id: id },
        include: {
          attendance: { orderBy: { att_date: 'desc' }, take: 30 },
          payrolls: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
        },
      });
      if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json(employee);
    }

    const employees = await prisma.employee.findMany({
      where: status ? { status } : undefined,
      orderBy: { emp_name: 'asc' },
    });
    return NextResponse.json(employees);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { emp_name, emp_phone, emp_cnic, emp_address, designation, department, join_date, basic_salary } = body;
    if (!emp_name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const employee = await prisma.employee.create({
      data: {
        emp_name,
        emp_phone: emp_phone || null,
        emp_cnic: emp_cnic || null,
        emp_address: emp_address || null,
        designation: designation || null,
        department: department || null,
        join_date: join_date ? new Date(join_date) : new Date(),
        basic_salary: parseFloat(basic_salary) || 0,
      },
    });
    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'CNIC already registered' }, { status: 400 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { emp_id, emp_name, emp_phone, emp_cnic, emp_address, designation, department, join_date, basic_salary, status } = body;
    if (!emp_id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const employee = await prisma.employee.update({
      where: { emp_id: parseInt(emp_id) },
      data: {
        emp_name,
        emp_phone: emp_phone || null,
        emp_cnic: emp_cnic || null,
        emp_address: emp_address || null,
        designation: designation || null,
        department: department || null,
        join_date: join_date ? new Date(join_date) : undefined,
        basic_salary: parseFloat(basic_salary) || 0,
        status: status || 'ACTIVE',
      },
    });
    return NextResponse.json(employee);
  } catch (error) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'CNIC already registered' }, { status: 400 });
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
    await prisma.employee.delete({ where: { emp_id: id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
