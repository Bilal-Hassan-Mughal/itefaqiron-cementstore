import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';
import { rejectIfDayClosed } from '@/lib/day-end-guard';
import { createLedgerEntry } from '@/lib/ledger-helper';
import { getNextId } from '@/lib/id-helper';

function advanceLedgerBillNo(advanceId) {
  return `ADV-${advanceId}`;
}

function advanceLedgerReversalBillNo(advanceId) {
  return `ADV-${advanceId}-REV`;
}

async function recordAdvanceLedgerPayment(tx, {
  advanceId,
  empName,
  amount,
  accountId,
  paymentMode,
  reference,
  reason,
}) {
  const account = await tx.customer.findUnique({ where: { cus_id: accountId } });
  if (!account) throw new Error('Payment account not found');

  const isBank = paymentMode === 'BANK_TRANSFER' || paymentMode === 'BANK';
  const billNo = advanceLedgerBillNo(advanceId);
  const currentBalance = parseFloat(account.cus_balance || 0);
  const amt = parseFloat(amount);

  const ledgerEntryData = createLedgerEntry({
    cus_id: accountId,
    opening_balance: currentBalance,
    debit_amount: 0,
    credit_amount: amt,
    bill_no: billNo,
    trnx_type: isBank ? 'BANK_PAYMENT' : 'CASH_PAYMENT',
    ledger_type: 'Salary Advance',
    details: [
      `Salary advance — ${empName}`,
      reason ? reason : null,
      reference ? `Ref: ${reference}` : null,
    ].filter(Boolean).join(' · '),
    payments: amt,
    cash_payment: isBank ? 0 : amt,
    bank_payment: isBank ? amt : 0,
  });

  const l_id = await getNextId('ledger', 'l_id', tx);
  await tx.ledger.create({ data: { l_id, ...ledgerEntryData } });
  await tx.customer.update({
    where: { cus_id: accountId },
    data: { cus_balance: ledgerEntryData.closing_balance },
  });
}

async function reverseAdvanceLedger(tx, advanceId, { empName = '' } = {}) {
  const originalBillNo = advanceLedgerBillNo(advanceId);
  const reverseBillNo = advanceLedgerReversalBillNo(advanceId);

  const existingReversal = await tx.ledger.findFirst({ where: { bill_no: reverseBillNo } });
  if (existingReversal) return;

  const entries = await tx.ledger.findMany({
    where: { bill_no: originalBillNo },
    orderBy: { l_id: 'asc' },
  });
  if (entries.length === 0) return;

  for (const entry of entries) {
    const acc = await tx.customer.findUnique({ where: { cus_id: entry.cus_id } });
    if (!acc) continue;

    const originalCredit = parseFloat(entry.credit_amount || 0);
    const originalDebit = parseFloat(entry.debit_amount || 0);
    const originalCash = parseFloat(entry.cash_payment || 0);
    const originalBank = parseFloat(entry.bank_payment || 0);
    const payAmt = originalCredit || originalDebit;
    const isBank = entry.trnx_type === 'BANK_PAYMENT' || originalBank > 0;

    const ledgerEntryData = createLedgerEntry({
      cus_id: entry.cus_id,
      opening_balance: parseFloat(acc.cus_balance || 0),
      debit_amount: originalCredit,
      credit_amount: originalDebit,
      bill_no: reverseBillNo,
      trnx_type: isBank ? 'BANK_TRANSFER' : 'CASH',
      ledger_type: 'Receiving',
      details: `Reversal — salary advance cancelled${empName ? ` — ${empName}` : ''} (ref ${originalBillNo})`,
      payments: payAmt,
      cash_payment: originalCash > 0 ? originalCash : (isBank ? 0 : payAmt),
      bank_payment: originalBank > 0 ? originalBank : (isBank ? payAmt : 0),
    });

    const l_id = await getNextId('ledger', 'l_id', tx);
    await tx.ledger.create({ data: { l_id, ...ledgerEntryData } });
    await tx.customer.update({
      where: { cus_id: entry.cus_id },
      data: { cus_balance: ledgerEntryData.closing_balance },
    });
  }
}

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
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const { emp_id, amount, advance_date, payment_mode, account_id, reason, payment_reference } = body;

    if (!emp_id) return NextResponse.json({ error: 'Employee is required' }, { status: 400 });
    if (!amount || parseFloat(amount) <= 0) return NextResponse.json({ error: 'Valid advance amount is required' }, { status: 400 });
    if (!account_id) return NextResponse.json({ error: 'Cash or bank account is required' }, { status: 400 });

    const empId = parseInt(emp_id, 10);
    const emp = await prisma.employee.findFirst({
      where: { emp_id: empId, branch_id: branchId },
    });
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const amt = parseFloat(amount);
    const payMode = payment_mode || 'CASH';
    const accId = parseInt(account_id, 10);
    const advDate = advance_date ? advance_date : new Date().toISOString().split('T')[0];
    const reasonText = reason ? String(reason).replace(/'/g, "''") : '';

    const advance = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`
        INSERT INTO employee_advances (emp_id, amount, advance_date, payment_mode, account_id, reason, status, created_at, updated_at)
        VALUES (${empId}, ${amt}, '${advDate}', '${payMode}', ${accId}, ${reasonText ? `'${reasonText}'` : 'NULL'}, 'PENDING', NOW(), NOW())
      `);

      const rows = await tx.$queryRawUnsafe(`
        SELECT advance_id FROM employee_advances
        WHERE emp_id = ${empId} AND amount = ${amt} AND DATE(advance_date) = '${advDate}' AND status = 'PENDING'
        ORDER BY advance_id DESC LIMIT 1
      `);
      const advanceId = rows?.[0]?.advance_id;
      if (!advanceId) throw new Error('Failed to create advance record');

      await recordAdvanceLedgerPayment(tx, {
        advanceId,
        empName: emp.emp_name,
        amount: amt,
        accountId: accId,
        paymentMode: payMode,
        reference: payment_reference || null,
        reason: reason || null,
      });

      return {
        advance_id: advanceId,
        emp_id: empId,
        amount: amt,
        advance_date: advDate,
        payment_mode: payMode,
        account_id: accId,
        reason: reason || null,
        status: 'PENDING',
        ledger_bill_no: advanceLedgerBillNo(advanceId),
        employee: {
          emp_id: emp.emp_id,
          emp_name: emp.emp_name,
          designation: emp.designation,
        },
      };
    });

    return NextResponse.json(advance, { status: 201 });
  } catch (error) {
    console.error('Error creating advance salary:', error);
    return NextResponse.json({ error: error.message || 'Failed to create advance' }, { status: 500 });
  }
}

// PUT - Update advance salary / change status
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

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
    }

    let setClause = [];
    if (amount !== undefined) setClause.push(`amount = ${parseFloat(amount)}`);
    if (advance_date !== undefined) setClause.push(`advance_date = '${advance_date}'`);
    if (payment_mode !== undefined) setClause.push(`payment_mode = '${payment_mode}'`);
    if (reason !== undefined) setClause.push(`reason = '${String(reason).replace(/'/g, "''")}'`);
    if (status !== undefined) setClause.push(`status = '${status}'`);
    setClause.push('updated_at = NOW()');

    await prisma.$executeRawUnsafe(`
      UPDATE employee_advances
      SET ${setClause.join(', ')}
      WHERE advance_id = ${parseInt(advance_id, 10)}
    `);

    return NextResponse.json({ success: true, advance_id });
  } catch (error) {
    console.error('Error updating advance salary:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE - Cancel pending advance (reverses ledger)
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id'), 10) : null;

    if (!id) return NextResponse.json({ error: 'Advance ID is required' }, { status: 400 });

    const rows = await prisma.$queryRawUnsafe(`
      SELECT ea.*, e.emp_name FROM employee_advances ea
      INNER JOIN employees e ON ea.emp_id = e.emp_id
      WHERE ea.advance_id = ${id} AND e.branch_id = ${branchId} AND ea.status = 'PENDING'
      LIMIT 1
    `);
    const row = rows?.[0];
    if (!row) {
      return NextResponse.json({ error: 'Pending advance not found or already settled' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await reverseAdvanceLedger(tx, id, { empName: row.emp_name || '' });
      await tx.$executeRawUnsafe(`DELETE FROM employee_advances WHERE advance_id = ${id}`);
    });

    return NextResponse.json({ success: true, ledger_reversal_bill_no: advanceLedgerReversalBillNo(id) });
  } catch (error) {
    console.error('Error deleting advance salary:', error);
    return NextResponse.json({ error: error.message || 'Failed to cancel advance' }, { status: 500 });
  }
}
