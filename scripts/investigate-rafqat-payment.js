const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { cus_name: { contains: 'rafqat' } },
        { cus_phone_no: { contains: '3446260860' } },
      ],
    },
    select: { cus_id: true, cus_name: true, cus_phone_no: true, cus_balance: true },
  });
  console.log('=== Customers ===');
  console.log(JSON.stringify(customers, null, 2));
  if (!customers.length) return;

  for (const c of customers) {
    const cusId = c.cus_id;
    console.log(`\n=== Payments for ${c.cus_name} (${cusId}) ===`);
    const payments = await prisma.payment.findMany({
      where: { account_id: cusId },
      orderBy: { created_at: 'desc' },
      take: 8,
      include: {
        cash_account: { select: { cus_id: true, cus_name: true } },
        bank_account: { select: { cus_id: true, cus_name: true } },
        created_by_user: { select: { full_name: true } },
        payment_details: true,
      },
    });
    for (const p of payments) {
      console.log(
        `PAY-${p.payment_id} | ${p.payment_type} | total=${p.total_amount} cash=${p.cash_amount} | date=${p.payment_date} | created=${p.created_at.toISOString()} | by=${p.created_by_user?.full_name}`
      );
      console.log(`  desc: ${p.description}`);
    }

    const pay230 = payments.filter((p) => Math.abs(Number(p.total_amount) - 230000) < 1);
    const targetPayId = pay230[0]?.payment_id;

    console.log(`\n=== Ledger rows (customer ${cusId}) around 230k receive ===`);
    const ledgers = await prisma.ledger.findMany({
      where: { cus_id: cusId },
      orderBy: [{ created_at: 'desc' }, { l_id: 'desc' }],
      take: 20,
    });
    for (const l of ledgers) {
      console.log(
        `l_id=${l.l_id} bill=${l.bill_no} | open=${l.opening_balance} D=${l.debit_amount} C=${l.credit_amount} close=${l.closing_balance} | ${l.created_at.toISOString()}`
      );
      console.log(`  ${l.details?.slice(0, 100)}`);
    }

    if (targetPayId) {
      const ref = `PAY-${targetPayId}`;
      console.log(`\n=== All ledger lines for ${ref} ===`);
      const linked = await prisma.ledger.findMany({
        where: { bill_no: ref },
        orderBy: { l_id: 'asc' },
        include: { customer: { select: { cus_id: true, cus_name: true } } },
      });
      for (const l of linked) {
        console.log(
          `${l.customer.cus_name} (${l.cus_id}) | open=${l.opening_balance} D=${l.debit_amount} C=${l.credit_amount} close=${l.closing_balance} type=${l.trnx_type}`
        );
      }

      const before = await prisma.ledger.findFirst({
        where: {
          cus_id: cusId,
          OR: [{ created_at: { lt: linked.find((x) => x.cus_id === cusId)?.created_at } }, { l_id: { lt: linked.find((x) => x.cus_id === cusId)?.l_id } }],
        },
        orderBy: [{ created_at: 'desc' }, { l_id: 'desc' }],
      });
      const custLine = linked.find((x) => x.cus_id === cusId);
      if (custLine) {
        const mathOk =
          Math.abs(Number(custLine.opening_balance) - Number(custLine.closing_balance) + Number(custLine.credit_amount) - Number(custLine.debit_amount)) <
          0.02;
        console.log(`\nCustomer line math (open + debit - credit = close): ${mathOk ? 'OK' : 'MISMATCH'}`);
        console.log(`Voucher prev=${custLine.opening_balance} rem=${custLine.closing_balance} paid=${custLine.credit_amount}`);
      }
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
