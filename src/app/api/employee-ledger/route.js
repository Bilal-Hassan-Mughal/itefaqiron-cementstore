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
      const limitParam = searchParams.get('limit');
      const summaryQ = searchParams.get('q');

      const buildSummaryWhere = () => {
        const where = { branch_id: branchId };
        if (summaryQ && String(summaryQ).trim()) {
          const term = String(summaryQ).trim();
          where.OR = [
            { emp_name: { contains: term } },
            { designation: { contains: term } },
            { department: { contains: term } },
          ];
        }
        return where;
      };

      const mapSummaryRow = (emp, closingMap) => {
        const closing = closingMap.get(Number(emp.emp_id))
          ?? parseFloat(emp.opening_balance || 0);
        return {
          emp_id: emp.emp_id,
          emp_name: emp.emp_name,
          designation: emp.designation,
          department: emp.department || '',
          status: emp.status || 'ACTIVE',
          opening_balance: parseFloat(emp.opening_balance || 0),
          starting_balance: parseFloat(emp.opening_balance || 0),
          closing_balance: closing,
          ledger_balance: closing,
          account_balance: closing,
        };
      };

      if (searchParams.get('stats') === 'true') {
        const empList = await prisma.employee.findMany({
          where: { branch_id: branchId },
          select: { emp_id: true, opening_balance: true },
        });
        let closingMap = await getEmployeeLedgerClosingsMap(prisma, empList.map((e) => e.emp_id));
        if (reconcile) {
          closingMap = new Map();
          for (const emp of empList) {
            const closing = await reconcileEmployeeLedgerForEmployee(prisma, emp.emp_id, branchId);
            closingMap.set(Number(emp.emp_id), closing);
          }
        }
        let receivable = 0;
        let payable = 0;
        let owesCount = 0;
        let settledCount = 0;
        for (const emp of empList) {
          const b = closingMap.get(Number(emp.emp_id)) ?? parseFloat(emp.opening_balance || 0);
          if (b > 0.009) {
            receivable += b;
            owesCount += 1;
          } else if (b < -0.009) {
            payable += Math.abs(b);
          } else {
            settledCount += 1;
          }
        }
        return NextResponse.json({
          total: empList.length,
          receivable: Math.round(receivable * 100) / 100,
          payable: Math.round(payable * 100) / 100,
          owesCount,
          settledCount,
        });
      }

      const where = buildSummaryWhere();
      const select = {
        emp_id: true,
        emp_name: true,
        designation: true,
        department: true,
        status: true,
        opening_balance: true,
      };

      if (limitParam) {
        const take = Math.min(Math.max(parseInt(limitParam, 10) || 40, 1), 100);
        const skip = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);
        const [total, empList] = await Promise.all([
          prisma.employee.count({ where }),
          prisma.employee.findMany({
            where,
            orderBy: { emp_name: 'asc' },
            skip,
            take,
            select,
          }),
        ]);
        let closingMap = await getEmployeeLedgerClosingsMap(prisma, empList.map((e) => e.emp_id));
        if (reconcile) {
          closingMap = new Map();
          for (const emp of empList) {
            const closing = await reconcileEmployeeLedgerForEmployee(prisma, emp.emp_id, branchId);
            closingMap.set(Number(emp.emp_id), closing);
          }
        }
        const items = empList.map((emp) => mapSummaryRow(emp, closingMap));
        return NextResponse.json({
          items,
          total,
          limit: take,
          offset: skip,
          hasMore: skip + items.length < total,
        });
      }

      const empList = await prisma.employee.findMany({
        where,
        orderBy: { emp_name: 'asc' },
        select,
      });
      let closingMap = await getEmployeeLedgerClosingsMap(prisma, empList.map((e) => e.emp_id));

      if (reconcile) {
        closingMap = new Map();
        for (const emp of empList) {
          const closing = await reconcileEmployeeLedgerForEmployee(prisma, emp.emp_id, branchId);
          closingMap.set(Number(emp.emp_id), closing);
        }
      }

      const result = empList.map((emp) => mapSummaryRow(emp, closingMap));
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
      const txLimit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200', 10) || 200, 1), 500);
      const txOffset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);
      const entries = await fetchBranchEmployeeLedgerEntries(prisma, branchId, {
        empId,
        from,
        to,
        type: type && type !== 'ALL' ? type : null,
        q,
        limit: txLimit,
        offset: txOffset,
      });
      let closing = null;
      if (empId) {
        closing = await getEmployeeLedgerClosing(prisma, empId);
      }
      return NextResponse.json({
        entries,
        emp_id: empId,
        closing_balance: closing,
        count: entries.length,
        limit: txLimit,
        offset: txOffset,
        hasMore: entries.length >= txLimit,
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
        starting_balance: parseFloat(emp.opening_balance || 0),
      },
      closing_balance: closing,
      ledger_balance: closing,
      account_balance: closing,
      entries,
    });
  } catch (error) {
    console.error('Employee ledger GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
