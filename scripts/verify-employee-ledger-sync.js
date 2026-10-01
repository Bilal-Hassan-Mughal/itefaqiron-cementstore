/**
 * Reconcile employee ledger(s) and verify running balance chain vs stored closing.
 * Usage: node scripts/verify-employee-ledger-sync.js [emp_id]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function main() {
  const {
    reconcileEmployeeLedgerForEmployee,
    getEmployeeLedgerClosing,
    ensureEmployeeLedgerSchema,
  } = await import('../src/lib/employee-ledger.js');
  const { prisma } = await import('../src/lib/prisma.js');

  const empArg = process.argv[2] ? parseInt(process.argv[2], 10) : null;
  await ensureEmployeeLedgerSchema(prisma);

  const emps = empArg
    ? await prisma.$queryRawUnsafe(`SELECT emp_id, emp_name, branch_id FROM employees WHERE emp_id = ${empArg}`)
    : await prisma.$queryRawUnsafe('SELECT emp_id, emp_name, branch_id FROM employees WHERE status = \'ACTIVE\' ORDER BY emp_id');

  let failures = 0;
  for (const emp of emps || []) {
    const id = Number(emp.emp_id);
    const branchId = Number(emp.branch_id || 1);
    const closingAfterReconcile = await reconcileEmployeeLedgerForEmployee(prisma, id, branchId);
    const closingRead = await getEmployeeLedgerClosing(prisma, id);

    const rows = await prisma.$queryRawUnsafe(`
      SELECT el_id, trnx_type, bill_no, debit_amount, credit_amount, opening_balance, closing_balance
      FROM employee_ledger WHERE emp_id = ${id} ORDER BY el_id ASC
    `);
    let running = 0;
    let chainOk = true;
    for (const r of rows || []) {
      const open = parseFloat(r.opening_balance ?? 0);
      const close = parseFloat(r.closing_balance ?? 0);
      const debit = parseFloat(r.debit_amount || 0);
      const credit = parseFloat(r.credit_amount || 0);
      const expectedOpen = running;
      const expectedClose = expectedOpen + debit - credit;
      if (Math.abs(open - expectedOpen) > 0.02 || Math.abs(close - expectedClose) > 0.02) {
        chainOk = false;
        console.error(`  chain break el_id=${r.el_id} bill=${r.bill_no} stored ${open}->${close} expected ${expectedOpen}->${expectedClose}`);
      }
      running = expectedClose;
    }

    const pending = await prisma.$queryRawUnsafe(`
      SELECT advance_id, amount FROM employee_advances WHERE emp_id = ${id} AND status = 'PENDING'
    `);
    let pendingOk = true;
    for (const a of pending || []) {
      const bill = `EMP-ADV-${a.advance_id}`;
      const has = await prisma.$queryRawUnsafe(`
        SELECT 1 ok FROM employee_ledger WHERE emp_id = ${id} AND bill_no = '${bill}' LIMIT 1
      `);
      if (!has?.length) {
        pendingOk = false;
        console.error(`  missing ADVANCE debit for pending advance_id=${a.advance_id}`);
      }
    }

    const ok =
      chainOk
      && pendingOk
      && Math.abs(closingAfterReconcile - closingRead) < 0.02
      && (rows.length === 0 || Math.abs(running - closingRead) < 0.02);

    console.log(
      `${ok ? 'OK' : 'FAIL'} emp ${id} ${emp.emp_name} closing=${closingRead.toFixed(2)} rows=${rows?.length || 0}`
    );
    if (!ok) failures += 1;
  }

  await prisma.$disconnect();
  process.exit(failures > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
