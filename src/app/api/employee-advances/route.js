import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';


// GET - List advances or summary per employee
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    const { searchParams } = new URL(request.url);
    const empId = searchParams.get('emp_id') ? parseInt(searchParams.get('emp_id')) : null;
    const status = searchParams.get('status');
    const summary = searchParams.get('summary') === 'true';

    if (summary) {
      const employees = await prisma.employee.findMany({
        where: { status: 'ACTIVE' },
      });

      let advances = [];
      if (prisma.employeeAdvance) {
        advances = await prisma.employeeAdvance.findMany();
      } else {
        advances = await prisma.$queryRaw`
          SELECT ea.* FROM employee_advances ea
          INNER JOIN employees e ON ea.emp_id = e.emp_id
          WHERE e.branch_id = ${branchId}
          ORDER BY ea.advance_date DESC
        `;
      }

      const result = employees.map((emp) => {
        const empAdv = advances.filter((a) => parseInt(a.emp_id) === parseInt(emp.emp_id));
        const totalGiven = empAdv.reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
        const pendingAmount = empAdv
          .filter((a) => a.status === 'PENDING')
          .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);
        const deductedAmount = empAdv
          .filter((a) => a.status === 'DEDUCTED')
          .reduce((sum, a) => sum + parseFloat(a.amount || 0), 0);

        return {
          emp_id: emp.emp_id,
          emp_name: emp.emp_name,
          designation: emp.designation,
          department: emp.department,
          basic_salary: parseFloat(emp.basic_salary || 0),
          total_advances_given: totalGiven,
          pending_advance_balance: pendingAmount,
          total_deducted: deductedAmount,
          advances_count: empAdv.length,
        };
      });

      return NextResponse.json(result);
    }

    let advances = [];
    if (prisma.employeeAdvance) {
      const where = {};
      if (empId) where.emp_id = empId;
      if (status) where.status = status;
      advances = await prisma.employeeAdvance.findMany({
        where,
        include: {
          employee: {
            select: { emp_id: true, emp_name: true, designation: true, department: true, basic_salary: true },
          },
        },
        orderBy: { advance_date: 'desc' },
      });
    } else {
      let query = `
        SELECT ea.*, e.emp_name, e.designation, e.department, e.basic_salary
        FROM employee_advances ea
        LEFT JOIN employees e ON ea.emp_id = e.emp_id
        WHERE e.branch_id = ${branchId}
      `;
      if (empId) query += ` AND ea.emp_id = ${empId}`;
      if (status) query += ` AND ea.status = '${status}'`;
      query += ` ORDER BY ea.advance_date DESC`;

      const rows = await prisma.$queryRawUnsafe(query);
      advances = rows.map((r) => ({
        advance_id: r.advance_id,
        emp_id: r.emp_id,
        amount: parseFloat(r.amount || 0),
        advance_date: r.advance_date,
        payment_mode: r.payment_mode,
        account_id: r.account_id,
        reason: r.reason,
        status: r.status,
        payroll_id: r.payroll_id,
        created_at: r.created_at,
        updated_at: r.updated_at,
        employee: {
          emp_id: r.emp_id,
          emp_name: r.emp_name,
          designation: r.designation,
          department: r.department,
          basic_salary: parseFloat(r.basic_salary || 0),
        },
      }));
    }

    return NextResponse.json(advances);
  } catch (error) {
    console.error('Error fetching employee advances:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - Issue new advance salary
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    const body = await request.json();
    const { emp_id, amount, advance_date, payment_mode, account_id, reason } = body;

    if (!emp_id) return NextResponse.json({ error: 'Employee is required' }, { status: 400 });
    if (!amount || parseFloat(amount) <= 0) return NextResponse.json({ error: 'Valid advance amount is required' }, { status: 400 });

    let advance;
    if (prisma.employeeAdvance) {
      advance = await prisma.employeeAdvance.create({
        data: {
          emp_id: parseInt(emp_id),
          amount: parseFloat(amount),
          advance_date: advance_date ? new Date(advance_date) : new Date(),
          payment_mode: payment_mode || 'CASH',
          account_id: account_id ? parseInt(account_id) : null,
          reason: reason || null,
          status: 'PENDING',
        },
        include: {
          employee: { select: { emp_id: true, emp_name: true, designation: true } },
        },
      });
    } else {
      const advDate = advance_date ? advance_date : new Date().toISOString().split('T')[0];
      const payMode = payment_mode || 'CASH';
      const accId = account_id ? parseInt(account_id) : null;
      const resText = reason ? reason.replace(/'/g, "''") : '';

      await prisma.$executeRawUnsafe(`
        INSERT INTO employee_advances (emp_id, amount, advance_date, payment_mode, account_id, reason, status, created_at, updated_at)
        VALUES (${parseInt(emp_id)}, ${parseFloat(amount)}, '${advDate}', '${payMode}', ${accId ? accId : 'NULL'}, '${resText}', 'PENDING', NOW(), NOW())
      `);

      const emp = await prisma.employee.findUnique({ where: { emp_id: parseInt(emp_id) } });
      advance = {
        emp_id: parseInt(emp_id),
        amount: parseFloat(amount),
        advance_date: advDate,
        payment_mode: payMode,
        reason: reason || null,
        status: 'PENDING',
        employee: emp,
      };
    }

    return NextResponse.json(advance, { status: 201 });
  } catch (error) {
    console.error('Error creating advance salary:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT - Update advance salary / change status
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    const body = await request.json();
    const { advance_id, amount, advance_date, payment_mode, account_id, reason, status } = body;

    if (!advance_id) return NextResponse.json({ error: 'Advance ID is required' }, { status: 400 });

    if (prisma.employeeAdvance) {
      const updateData = {};
      if (amount !== undefined) updateData.amount = parseFloat(amount);
      if (advance_date !== undefined) updateData.advance_date = new Date(advance_date);
      if (payment_mode !== undefined) updateData.payment_mode = payment_mode;
      if (account_id !== undefined) updateData.account_id = account_id ? parseInt(account_id) : null;
      if (reason !== undefined) updateData.reason = reason;
      if (status !== undefined) updateData.status = status;

      const updated = await prisma.employeeAdvance.update({
        where: { advance_id: parseInt(advance_id) },
        data: updateData,
        include: { employee: true },
      });
      return NextResponse.json(updated);
    } else {
      let setClause = [];
      if (amount !== undefined) setClause.push(`amount = ${parseFloat(amount)}`);
      if (advance_date !== undefined) setClause.push(`advance_date = '${advance_date}'`);
      if (payment_mode !== undefined) setClause.push(`payment_mode = '${payment_mode}'`);
      if (reason !== undefined) setClause.push(`reason = '${reason.replace(/'/g, "''")}'`);
      if (status !== undefined) setClause.push(`status = '${status}'`);
      setClause.push(`updated_at = NOW()`);

      await prisma.$executeRawUnsafe(`
        UPDATE employee_advances
        SET ${setClause.join(', ')}
        WHERE advance_id = ${parseInt(advance_id)}
      `);

      return NextResponse.json({ success: true, advance_id });
    }
  } catch (error) {
    console.error('Error updating advance salary:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Cancel or remove advance salary
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (!id) return NextResponse.json({ error: 'Advance ID is required' }, { status: 400 });

    await prisma.$executeRawUnsafe(`DELETE FROM employee_advances WHERE advance_id = ${id} AND status != 'DEDUCTED'`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting advance salary:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
