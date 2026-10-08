/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const BR = 10;

async function recalc(cusId) {
  const entries = await p.ledger.findMany({ where: { cus_id: cusId }, orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }] });
  if (!entries.length) return;
  let run = parseFloat(entries[0].opening_balance || 0);
  for (const e of entries) {
    const open = run;
    const close = Number((open + parseFloat(e.debit_amount || 0) - parseFloat(e.credit_amount || 0)).toFixed(2));
    await p.ledger.update({ where: { l_id: e.l_id }, data: { opening_balance: open, closing_balance: close } });
    run = close;
  }
  await p.customer.update({ where: { cus_id: cusId }, data: { cus_balance: run } });
}

(async () => {
  const ids = new Set();
  const pur = await p.purchase.findMany({ where: { branch_id: BR }, select: { cus_id: true } });
  const sal = await p.sale.findMany({ where: { branch_id: BR }, select: { cus_id: true } });
  pur.forEach((r) => ids.add(r.cus_id));
  sal.forEach((r) => ids.add(r.cus_id));
  const extra = await p.customer.findMany({
    where: { branch_id: BR, OR: [{ cus_name: { contains: 'Cash' } }, { cus_name: { contains: 'Meezan' } }] },
    select: { cus_id: true },
  });
  extra.forEach((r) => ids.add(r.cus_id));
  for (const id of ids) {
    await recalc(id);
    console.log('recalc', id);
  }
  console.log('ledger rows branch purchases', pur.length, 'sales', sal.length);
  await p.$disconnect();
})();
