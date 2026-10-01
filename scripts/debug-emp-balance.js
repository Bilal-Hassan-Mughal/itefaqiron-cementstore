require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function recalcLedger(db, empId) {
  const entries = await db.$queryRawUnsafe(
    `SELECT el_id, debit_amount, credit_amount FROM employee_ledger WHERE emp_id=${empId} ORDER BY el_id ASC`
  );
  let running = 0;
  for (const e of entries || []) {
    const opening = running;
    const closing = opening + parseFloat(e.debit_amount || 0) - parseFloat(e.credit_amount || 0);
    await db.$executeRawUnsafe(
      `UPDATE employee_ledger SET opening_balance=${opening}, closing_balance=${closing} WHERE el_id=${parseInt(e.el_id, 10)}`
    );
    running = closing;
  }
  return running;
}

(async () => {
  const emps = await p.$queryRawUnsafe(
    "SELECT emp_id, emp_name, opening_balance, status FROM employees WHERE LOWER(emp_name) LIKE '%test%2%' LIMIT 5"
  );
  console.log('employees', emps);
  if (!emps?.length) {
    await p.$disconnect();
    return;
  }
  const id = Number(emps[0].emp_id);
  const ledger = await p.$queryRawUnsafe(
    `SELECT el_id, trnx_type, bill_no, debit_amount, credit_amount, opening_balance, closing_balance, created_at
     FROM employee_ledger WHERE emp_id=${id} ORDER BY el_id ASC`
  );
  console.log('ledger', ledger);
  const adv = await p.$queryRawUnsafe(
    `SELECT advance_id, amount, status, advance_date, payroll_id FROM employee_advances WHERE emp_id=${id} ORDER BY advance_id DESC`
  );
  console.log('advances', adv);
  const pay = await p.$queryRawUnsafe(
    `SELECT payroll_id, month, year, net_salary, advance_deduction, status, payment_date, LEFT(notes,120) notes FROM payrolls WHERE emp_id=${id} ORDER BY year, month`
  );
  console.log('payrolls', pay);
  const notes = await p.$queryRawUnsafe('SELECT notes FROM payrolls WHERE payroll_id=15');
  console.log('notes15', notes[0]?.notes);
  let fixed = await recalcLedger(p, id);
  console.log('recalculated closing', fixed);

  const snapRaw = notes[0]?.notes || '';
  if (snapRaw.includes('__HR_CLR__')) {
    try {
      const snap = JSON.parse(snapRaw.replace('__HR_CLR__', ''));
      const total = parseFloat(snap.total_payable || 0);
      const paid = parseFloat(snap.amount_paid || 0);
      const under = Math.max(0, Math.round((total - paid) * 100) / 100);
      const bill = 'EMP-PAYROLL-15-SALARY-UNDERPAID';
      if (under > 0.009) {
        const exists = await p.$queryRawUnsafe(
          `SELECT 1 ok FROM employee_ledger WHERE emp_id=${id} AND bill_no='${bill}' LIMIT 1`
        );
        if (!exists?.length) {
          const prev = fixed;
          const closing = prev - under;
          await p.$executeRawUnsafe(`
            INSERT INTO employee_ledger (branch_id, emp_id, created_at, trnx_type, bill_no, details,
              debit_amount, credit_amount, opening_balance, closing_balance)
            VALUES (1, ${id}, NOW(), 'SALARY_UNDERPAID', '${bill}',
              'Salary underpaid carry (repair) 9/2026 — Teste 2 · Rs ${under.toFixed(2)}',
              0, ${under}, ${prev}, ${closing})
          `);
          fixed = closing;
          console.log('posted underpaid carry', under, 'new closing', fixed);
        }
      }
    } catch (e) {
      console.warn('snap repair skip', e.message);
    }
  }

  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
