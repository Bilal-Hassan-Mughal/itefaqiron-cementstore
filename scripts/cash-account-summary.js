const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cash = await prisma.customer.findFirst({
    where: { cus_name: 'Cash Account' },
    include: { customer_category: true },
  });
  if (!cash) {
    console.log('Cash Account not found');
    return;
  }

  const entries = await prisma.ledger.findMany({
    where: { cus_id: cash.cus_id },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
  });

  const firstOpen = Number(entries[0]?.opening_balance || 0);
  let sumDebit = 0;
  let sumCredit = 0;
  for (const e of entries) {
    sumDebit += Number(e.debit_amount || 0);
    sumCredit += Number(e.credit_amount || 0);
  }
  const recalcClosing = Math.round((firstOpen + sumDebit - sumCredit) * 100) / 100;
  const lastClosing = Number(entries[entries.length - 1]?.closing_balance || 0);
  const storedBal = Number(cash.cus_balance || 0);

  console.log('=== CASH ACCOUNT CALCULATION SUMMARY ===');
  console.log(`Customer: ${cash.cus_name} (id ${cash.cus_id})`);
  console.log(`Category: ${cash.customer_category?.cus_cat_title || '—'}`);
  console.log(`Ledger rows: ${entries.length}`);
  console.log('');
  console.log('Formula (same as app recalculateLedgerBalances):');
  console.log('  closing = opening + debit − credit  (per row, chained in time order)');
  console.log('');
  console.log(`First row opening (seed / carry-forward):     PKR ${firstOpen.toLocaleString()}`);
  console.log(`Sum of all debits  (cash IN to this account): PKR ${sumDebit.toLocaleString()}`);
  console.log(`Sum of all credits (cash OUT):                PKR ${sumCredit.toLocaleString()}`);
  console.log(`Recalculated final balance:                   PKR ${recalcClosing.toLocaleString()}`);
  console.log(`Last ledger row closing:                      PKR ${lastClosing.toLocaleString()}`);
  console.log(`customers.cus_balance (UI):                   PKR ${storedBal.toLocaleString()}`);
  console.log('');
  console.log(`Ledger chain OK: ${Math.abs(lastClosing - recalcClosing) < 0.02 ? 'YES' : 'NO'}`);
  console.log(`cus_balance matches ledger: ${Math.abs(storedBal - lastClosing) < 0.02 ? 'YES' : 'NO'}`);

  const pay3937 = entries.filter((e) => e.bill_no === 'PAY-3937');
  console.log('\n=== PAY-3937 (haji rafqat cash receive) on Cash Account ===');
  pay3937.forEach((e) => {
    console.log(
      `l_id ${e.l_id}: open ${e.opening_balance} + D ${e.debit_amount} − C ${e.credit_amount} = close ${e.closing_balance}`
    );
  });

  const recent = entries.slice(-8);
  console.log('\n=== Last 8 cash ledger movements ===');
  recent.forEach((e) => {
    const d = e.created_at.toISOString().slice(0, 10);
    console.log(
      `${d} | ${e.bill_no || '—'} | D ${Number(e.debit_amount)} C ${Number(e.credit_amount)} | close ${e.closing_balance} | ${(e.details || '').slice(0, 60)}`
    );
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
