const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PAYMENT_ID = 3937;
const BILL = `PAY-${PAYMENT_ID}`;
const CUSTOMER_ID = 262;

async function main() {
  const payment = await prisma.payment.findUnique({
    where: { payment_id: PAYMENT_ID },
    include: {
      payment_details: true,
      account: { select: { cus_id: true, cus_name: true, cus_balance: true } },
      cash_account: { select: { cus_id: true, cus_name: true, cus_balance: true } },
    },
  });

  console.log('=== Payment record ===');
  if (!payment) {
    console.log(`Payment ${PAYMENT_ID} NOT FOUND (payment row may have been deleted).`);
  } else {
    console.log(JSON.stringify(payment, null, 2));
  }

  const ledgerByBill = await prisma.ledger.findMany({
    where: { bill_no: BILL },
    orderBy: { l_id: 'asc' },
    include: { customer: { select: { cus_name: true } } },
  });

  console.log(`\n=== Ledger rows with bill_no ${BILL} (count=${ledgerByBill.length}) ===`);
  for (const row of ledgerByBill) {
    console.log(
      `l_id=${row.l_id} cus=${row.cus_id} (${row.customer?.cus_name}) | O=${row.opening_balance} D=${row.debit_amount} C=${row.credit_amount} Cl=${row.closing_balance} | ${row.created_at.toISOString()}`
    );
    console.log(`  details: ${row.details?.slice(0, 120)}`);
  }

  const expectedLines = 2; // customer + cash for full cash receive
  if (ledgerByBill.length < expectedLines) {
    console.log(`\n⚠ Expected at least ${expectedLines} ledger line(s) for cash RECEIVE; found ${ledgerByBill.length}.`);
  } else {
    console.log('\n✓ Ledger line count looks normal for cash receive (customer + cash account).');
  }

  const custLine = ledgerByBill.find((r) => r.cus_id === CUSTOMER_ID);
  if (custLine) {
    const open = Number(custLine.opening_balance);
    const close = Number(custLine.closing_balance);
    const d = Number(custLine.debit_amount);
    const c = Number(custLine.credit_amount);
    const mathOk = Math.abs(open + d - c - close) < 0.02;
    console.log(`\nCustomer line balance math: ${mathOk ? 'OK' : 'BROKEN'} (${open} + ${d} - ${c} = ${close})`);
  } else {
    console.log(`\n⚠ No ledger line on customer ${CUSTOMER_ID} for ${BILL}.`);
  }

  console.log('\n=== Customer ledger chain (5 rows before/after PAY line) ===');
  if (custLine) {
    const around = await prisma.ledger.findMany({
      where: { cus_id: CUSTOMER_ID },
      orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
    });
    const idx = around.findIndex((r) => r.l_id === custLine.l_id);
    const slice = around.slice(Math.max(0, idx - 3), idx + 4);
    for (const row of slice) {
      const mark = row.l_id === custLine.l_id ? ' <<<' : '';
      console.log(
        `l_id=${row.l_id} bill=${row.bill_no} O=${row.opening_balance} Cl=${row.closing_balance}${mark}`
      );
    }
    if (idx > 0) {
      const prev = around[idx - 1];
      const chainOk = Math.abs(Number(prev.closing_balance) - Number(custLine.opening_balance)) < 0.02;
      console.log(`Opening matches prior closing: ${chainOk ? 'OK' : 'MISMATCH'}`);
    }
    const last = around[around.length - 1];
    const bal = payment?.account?.cus_balance ?? null;
    if (bal != null) {
      const syncOk = Math.abs(Number(last.closing_balance) - Number(bal)) < 0.02;
      console.log(`Customer cus_balance (${bal}) matches last ledger closing (${last.closing_balance}): ${syncOk ? 'OK' : 'MISMATCH'}`);
    }
  }

  const orphanDetails = payment
    ? await prisma.paymentDetail.findMany({ where: { payment_id: PAYMENT_ID } })
    : [];
  console.log(`\n=== payment_details count: ${orphanDetails.length} ===`);
  orphanDetails.forEach((d) => console.log(`  account ${d.account_id} amount ${d.amount}`));

  const dupBills = await prisma.$queryRaw`
    SELECT bill_no, COUNT(*) AS cnt
    FROM ledger
    WHERE bill_no = ${BILL}
    GROUP BY bill_no
  `;
  console.log('\n=== Duplicate bill check ===', dupBills);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
