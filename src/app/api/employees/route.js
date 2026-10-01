import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';
import {
  ensureEmployeeLedgerSchema,
  setEmployeeOpeningBalance,
  recalculateEmployeeLedger,
  getEmployeeLedgerClosingsMap,
} from '@/lib/employee-ledger';
import {
  fetchRegisterEmployeeList,
  enrichEmployeeRegisterRow,
} from './register-helpers';


export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;
    const status = searchParams.get('status');
    const lite = searchParams.get('lite') === 'true' || searchParams.get('lite') === '1';
    const register = searchParams.get('register') === 'true' || searchParams.get('register') === '1';

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

    const branchId = __branchScope.branchId ?? 1;

    if (register) {
      const list = await fetchRegisterEmployeeList(prisma, branchId, { status });
      return NextResponse.json(list);
    }

    const employees = await prisma.employee.findMany({
      where: {
        branch_id: branchId,
        ...(status ? { status } : {}),
      },
      orderBy: { emp_name: 'asc' },
    });

    if (lite) {
      return NextResponse.json(
        employees.map((emp) => ({
          ...emp,
          opening_balance: parseFloat(emp.opening_balance ?? 0),
        }))
      );
    }

    await ensureEmployeeLedgerSchema(prisma);
    const ledgerMap = await getEmployeeLedgerClosingsMap(
      prisma,
      employees.map((e) => e.emp_id)
    );
    const enriched = employees.map((emp) => ({
      ...emp,
      opening_balance: parseFloat(emp.opening_balance ?? 0),
      ledger_balance: ledgerMap.get(emp.emp_id) ?? parseFloat(emp.opening_balance ?? 0),
    }));
    return NextResponse.json(enriched);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const {
      emp_name,
      emp_phone,
      emp_cnic,
      emp_address,
      designation,
      department,
      join_date,
      basic_salary,
      opening_balance,
      allowed_leaves_per_month,
      allowed_absents_per_month,
    } = body;
    if (!emp_name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

    const branchId = __branchScope.branchId ?? 1;
    const openingVal = opening_balance != null && opening_balance !== '' ? parseFloat(opening_balance) : 0;
    const joinDate = join_date ? new Date(join_date) : new Date();

    await ensureEmployeeLedgerSchema(prisma);

    const employee = await prisma.$transaction(async (tx) => {
      const created = await tx.employee.create({
        data: {
          branch_id: branchId,
          emp_name,
          emp_phone: emp_phone || null,
          emp_cnic: emp_cnic || null,
          emp_address: emp_address || null,
          designation: designation || null,
          department: department || null,
          join_date: joinDate,
          basic_salary: parseFloat(basic_salary) || 0,
          allowed_leaves_per_month: Number.isFinite(parseInt(allowed_leaves_per_month, 10)) ? parseInt(allowed_leaves_per_month, 10) : 2,
          allowed_absents_per_month: Number.isFinite(parseInt(allowed_absents_per_month, 10)) ? parseInt(allowed_absents_per_month, 10) : 0,
        },
      });
      await setEmployeeOpeningBalance(tx, {
        branchId,
        empId: created.emp_id,
        empName: created.emp_name,
        openingBalance: Number.isFinite(openingVal) ? openingVal : 0,
        joinDate,
      });
      return created;
    }, { timeout: 15000 });

    const payload = await enrichEmployeeRegisterRow(prisma, employee);
    return NextResponse.json(payload, { status: 201 });
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
    const {
      emp_id,
      emp_name,
      emp_phone,
      emp_cnic,
      emp_address,
      designation,
      department,
      join_date,
      basic_salary,
      opening_balance,
      status,
      allowed_leaves_per_month,
      allowed_absents_per_month,
    } = body;
    if (!emp_id) return NextResponse.json({ error: 'ID required' }, { status: 400 });

    const branchId = __branchScope.branchId ?? 1;
    const empIdInt = parseInt(emp_id, 10);
    const openingVal = opening_balance != null && opening_balance !== '' ? parseFloat(opening_balance) : undefined;

    const scoped = await prisma.employee.findFirst({
      where: { emp_id: empIdInt, branch_id: branchId },
    });
    if (!scoped) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    await ensureEmployeeLedgerSchema(prisma);

    const employee = await prisma.$transaction(async (tx) => {
      const updated = await tx.employee.update({
        where: { emp_id: empIdInt },
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
          allowed_leaves_per_month: Number.isFinite(parseInt(allowed_leaves_per_month, 10)) ? parseInt(allowed_leaves_per_month, 10) : undefined,
          allowed_absents_per_month: Number.isFinite(parseInt(allowed_absents_per_month, 10)) ? parseInt(allowed_absents_per_month, 10) : undefined,
        },
      });
      if (openingVal !== undefined && Number.isFinite(openingVal)) {
        await setEmployeeOpeningBalance(tx, {
          branchId,
          empId: updated.emp_id,
          empName: updated.emp_name,
          openingBalance: openingVal,
          joinDate: join_date ? new Date(join_date) : updated.join_date,
        });
        await recalculateEmployeeLedger(tx, updated.emp_id);
      }
      return updated;
    }, { timeout: 30000 });
    const payload = await enrichEmployeeRegisterRow(prisma, employee);
    return NextResponse.json(payload);
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
    const id = parseInt(searchParams.get('id'), 10);
    const branchId = __branchScope.branchId ?? 1;
    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 });
    const scoped = await prisma.employee.findFirst({
      where: { emp_id: id, branch_id: branchId },
    });
    if (!scoped) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    await prisma.employee.delete({ where: { emp_id: id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
