import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';
import { rejectIfDayClosed } from '@/lib/day-end-guard';
import { createLedgerEntry } from '@/lib/ledger-helper';
import { getNextId } from '@/lib/id-helper';
import {
  ensureEmployeeLedgerSchema,
  employeeReceiptBillNo,
  getEmployeeLedgerClosing,
  recordEmployeeReceiptCredit,
} from '@/lib/employee-ledger';

async function recordCashBankReceipt(tx, {
  receiptId,
  empName,
  amount,
  accountId,
  paymentMode,
  reference,
  notes,
}) {
  const account = await tx.customer.findUnique({ where: { cus_id: accountId } });
  if (!account) throw new Error('Payment account not found');

  const isBank = paymentMode === 'BANK_TRANSFER' || paymentMode === 'BANK';
  const billNo = employeeReceiptBillNo(receiptId);
  const currentBalance = parseFloat(account.cus_balance || 0);
  const amt = parseFloat(amount);

  const ledgerEntryData = createLedgerEntry({
    cus_id: accountId,
    opening_balance: currentBalance,
    debit_amount: amt,
    credit_amount: 0,
    bill_no: billNo,
    trnx_type: isBank ? 'BANK_TRANSFER' : 'CASH',
    ledger_type: 'Employee Receipt',
    details: [
      `Payment received from employee ${empName}`,
      notes || null,
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

export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    await ensureEmployeeLedgerSchema(prisma);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id'), 10) : null;
    const empId = searchParams.get('emp_id') ? parseInt(searchParams.get('emp_id'), 10) : null;
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const mode = searchParams.get('payment_mode');
    const q = searchParams.get('q');

    if (id) {
      const rows = await prisma.$queryRawUnsafe(`
        SELECT r.*, e.emp_name, e.designation, c.cus_name AS account_name
        FROM employee_receipts r
        INNER JOIN employees e ON e.emp_id = r.emp_id
        INNER JOIN customers c ON c.cus_id = r.account_id
        WHERE r.receipt_id = ${id} AND r.branch_id = ${branchId}
        LIMIT 1
      `);
      const row = rows?.[0];
      if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return NextResponse.json({
        receipt_id: row.receipt_id,
        emp_id: row.emp_id,
        amount: parseFloat(row.amount),
        receipt_date: row.receipt_date,
        payment_mode: row.payment_mode,
        account_id: row.account_id,
        reference: row.reference,
        notes: row.notes,
        created_at: row.created_at,
        ledger_bill_no: employeeReceiptBillNo(row.receipt_id),
        employee: { emp_name: row.emp_name, designation: row.designation },
        account: { cus_name: row.account_name },
      });
    }

    let sql = `
      SELECT r.*, e.emp_name, e.designation, c.cus_name AS account_name
      FROM employee_receipts r
      INNER JOIN employees e ON e.emp_id = r.emp_id
      INNER JOIN customers c ON c.cus_id = r.account_id
      WHERE r.branch_id = ${branchId}
    `;
    if (empId) sql += ` AND r.emp_id = ${empId}`;
    if (from) sql += ` AND r.receipt_date >= '${String(from).slice(0, 10)}'`;
    if (to) sql += ` AND r.receipt_date <= '${String(to).slice(0, 10)}'`;
    if (mode) sql += ` AND r.payment_mode = '${String(mode).replace(/'/g, "''")}'`;
    if (q) {
      const safe = String(q).replace(/'/g, "''");
      sql += ` AND (e.emp_name LIKE '%${safe}%' OR r.reference LIKE '%${safe}%' OR r.notes LIKE '%${safe}%')`;
    }
    sql += ' ORDER BY r.receipt_date DESC, r.receipt_id DESC LIMIT 500';

    const rows = await prisma.$queryRawUnsafe(sql);
    const list = (rows || []).map((row) => ({
      receipt_id: row.receipt_id,
      emp_id: row.emp_id,
      amount: parseFloat(row.amount),
      receipt_date: row.receipt_date,
      payment_mode: row.payment_mode,
      account_id: row.account_id,
      reference: row.reference,
      notes: row.notes,
      created_at: row.created_at,
      ledger_bill_no: employeeReceiptBillNo(row.receipt_id),
      employee: { emp_name: row.emp_name, designation: row.designation },
      account: { cus_name: row.account_name },
    }));
    return NextResponse.json(list);
  } catch (error) {
    console.error('employee-receipts GET', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const {
      emp_id,
      amount,
      receipt_date,
      payment_mode,
      account_id,
      reference,
      notes,
    } = body;

    const empId = parseInt(emp_id, 10);
    const amt = parseFloat(amount);
    const accId = parseInt(account_id, 10);
    if (!empId) return NextResponse.json({ error: 'Employee is required' }, { status: 400 });
    if (!amt || amt <= 0) return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    if (!accId) return NextResponse.json({ error: 'Cash or bank account is required' }, { status: 400 });

    const payMode = payment_mode || 'CASH';
    const dateStr = receipt_date ? String(receipt_date).slice(0, 10) : new Date().toISOString().slice(0, 10);

    await ensureEmployeeLedgerSchema(prisma);

    const result = await prisma.$transaction(async (tx) => {
      const emp = await tx.employee.findFirst({
        where: { emp_id: empId, branch_id: branchId },
      });
      if (!emp) throw new Error('Employee not found');

      const balanceBefore = await getEmployeeLedgerClosing(tx, empId);

      await tx.$executeRawUnsafe(`
        INSERT INTO employee_receipts (branch_id, emp_id, amount, receipt_date, payment_mode, account_id, reference, notes, created_at)
        VALUES (${branchId}, ${empId}, ${amt}, '${dateStr}', '${payMode}', ${accId},
          ${reference ? `'${String(reference).replace(/'/g, "''")}'` : 'NULL'},
          ${notes ? `'${String(notes).replace(/'/g, "''")}'` : 'NULL'},
          NOW())
      `);
      const idRows = await tx.$queryRawUnsafe(`
        SELECT receipt_id FROM employee_receipts
        WHERE emp_id = ${empId} AND amount = ${amt} AND receipt_date = '${dateStr}'
        ORDER BY receipt_id DESC LIMIT 1
      `);
      const receiptId = idRows?.[0]?.receipt_id;
      if (!receiptId) throw new Error('Failed to create receipt');

      await recordCashBankReceipt(tx, {
        receiptId,
        empName: emp.emp_name,
        amount: amt,
        accountId: accId,
        paymentMode: payMode,
        reference,
        notes,
      });

      await recordEmployeeReceiptCredit(tx, {
        branchId,
        empId,
        empName: emp.emp_name,
        receiptId,
        amount: amt,
        notes,
        receiptDate: dateStr,
        paymentMode: payMode,
        reference,
      });

      const balanceAfter = await getEmployeeLedgerClosing(tx, empId);

      const acc = await tx.customer.findUnique({
        where: { cus_id: accId },
        select: { cus_name: true },
      });

      return {
        receipt_id: receiptId,
        emp_id: empId,
        amount: amt,
        receipt_date: dateStr,
        payment_mode: payMode,
        account_id: accId,
        reference: reference || null,
        notes: notes || null,
        ledger_bill_no: employeeReceiptBillNo(receiptId),
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        employee: { emp_name: emp.emp_name, designation: emp.designation },
        account: { cus_name: acc?.cus_name || '—' },
      };
    }, { timeout: 30000 });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('employee-receipts POST', error);
    return NextResponse.json({ error: error.message || 'Failed to save receipt' }, { status: 500 });
  }
}
