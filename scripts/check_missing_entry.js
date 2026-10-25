const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const compareChronologically = (a, b) => {
  const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (timeA !== timeB) return timeA - timeB;

  const billA = parseInt(a.bill_no) || 0;
  const billB = parseInt(b.bill_no) || 0;
  if (billA !== billB) return billA - billB;

  return (a.l_id || 0) - (b.l_id || 0);
};

async function audit(cusId) {
  const cus = await prisma.customer.findUnique({ where: { cus_id: cusId } });
  const entries = await prisma.ledger.findMany({ where: { cus_id: cusId } });
  entries.sort(compareChronologically);

  let discrepancies = 0;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const calc = Number((Number(entry.opening_balance) + Number(entry.debit_amount) - Number(entry.credit_amount)).toFixed(2));
    if (Math.abs(calc - Number(entry.closing_balance)) > 0.01) {
      discrepancies++;
      console.log(`Math error at l_id ${entry.l_id}: op=${entry.opening_balance}, d=${entry.debit_amount}, c=${entry.credit_amount}, cl=${entry.closing_balance}, expected=${calc}`);
    }
    if (i > 0) {
      const prev = entries[i - 1];
      if (Math.abs(Number(entry.opening_balance) - Number(prev.closing_balance)) > 0.01) {
        discrepancies++;
        console.log(`Chain error at l_id ${entry.l_id}: op=${entry.opening_balance}, prev_cl=${prev.closing_balance}`);
      }
    }
  }

  const finalClosing = entries.length > 0 ? entries[entries.length - 1].closing_balance : cus.cus_balance;
  console.log(`Customer ${cusId} (${cus.cus_name}): Entries=${entries.length}, Discrepancies=${discrepancies}, FinalClosing=${finalClosing}, CusBalance=${cus.cus_balance}`);
}

async function run() {
  await audit(2714);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
