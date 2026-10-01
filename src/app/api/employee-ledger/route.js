import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';
import {
  ensureEmployeeLedgerSchema,
  fetchEmployeeLedgerEntries,
  fetchBranchEmployeeLedgerEntries,
  getEmployeeLedgerClosing,
  getEmployeeLedgerClosingsMap,
  reconcileEmployeeLedgerForEmployee,
} from '@/lib/employee-ledger';

export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    await ensureEmployeeLedgerSchema(prisma);
    const { searchParams } = new URL(request.url);
    const empId = searchParams.get('emp_id') ? parseInt(searchParams.get('emp_id'), 10) : null;
    const summary = searchParams.get('summary') === 'true';
    const transactions = searchParams.get('transactions') === 'true';
    const reconcile = searchParams.get('reconcile') === 'true';
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const type = searchParams.get('type');
    const q = searchParams.get('q');

    if (summary) {
      const employees = await prisma.$queryRawUnsafe(`
        SELECT emp_id, emp_name, designation, department, status, opening_balance
        FROM employees
        WHERE branch_id = ${branchId}
        ORDER BY emp_name ASC
      `);
      const empList = employees || [];
      let closingMap = await getEmployeeLedgerClosingsMap(prisma, empList.map((e) => e.emp_id));

      if (reconcile) {
        closingMap = new Map();
        for (const emp of empList) {
          const closing = await reconcileEmployeeLedgerForEmployee(prisma, emp.emp_id, branchId);
          closingMap.set(Number(emp.emp_id), closing);
        }
      }

      const result = empList.map((emp) => {
        const closing = closingMap.get(Number(emp.emp_id))
          ?? parseFloat(emp.opening_balance || 0);
        return {
          emp_id: emp.emp_id,
          emp_name: emp.emp_name,
          designation: emp.designation,
          department: emp.department || '',
          status: emp.status || 'ACTIVE',
          opening_balance: parseFloat(emp.opening_balance || 0),
          closing_balance: closing,
          ledger_balance: closing,
        };
      });
      return NextResponse.json(result);
    }

    if (transactions) {
      if (reconcile) {
        const empRows = await prisma.$queryRawUnsafe(`
          SELECT emp_id FROM employees WHERE branch_id = ${branchId}
          ${empId ? `AND emp_id = ${empId}` : ''}
        `);
        for (const row of empRows || []) {
          await reconcileEmployeeLedgerForEmployee(prisma, row.emp_id, branchId);
        }
      }
      const entries = await fetchBranchEmployeeLedgerEntries(prisma, branchId, {
        empId,
        from,
        to,
        type: type && type !== 'ALL' ? type : null,
        q,
      });
      let closing = null;
      if (empId) {
        closing = reconcile
          ? await reconcileEmployeeLedgerForEmployee(prisma, empId, branchId)
          : await getEmployeeLedgerClosing(prisma, empId);
      }
      return NextResponse.json({
        entries,
        emp_id: empId,
        closing_balance: closing,
        count: entries.length,
      });
    }

    if (!empId) {
      return NextResponse.json({ error: 'emp_id or transactions=true required' }, { status: 400 });
    }

    const empRows = await prisma.$queryRawUnsafe(`
      SELECT * FROM employees WHERE emp_id = ${empId} AND branch_id = ${branchId} LIMIT 1
    `);
    const emp = empRows?.[0];
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const closing = reconcile
      ? await reconcileEmployeeLedgerForEmployee(prisma, empId, branchId)
      : await getEmployeeLedgerClosing(prisma, empId);
    const entries = await fetchEmployeeLedgerEntries(prisma, empId, { branchId });

    return NextResponse.json({
      employee: {
        emp_id: emp.emp_id,
        emp_name: emp.emp_name,
        designation: emp.designation,
        department: emp.department || '',
        opening_balance: parseFloat(emp.opening_balance || 0),
      },
      closing_balance: closing,
      ledger_balance: closing,
      entries,
    });
  } catch (error) {
    console.error('Employee ledger GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
