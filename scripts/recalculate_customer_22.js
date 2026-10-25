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

function calculateClosingBalance(openingBalance, debitAmount = 0, creditAmount = 0) {
  const opening = parseFloat(openingBalance || 0);
  const debit = parseFloat(debitAmount || 0);
  const credit = parseFloat(creditAmount || 0);

  return Number((opening + debit - credit).toFixed(2));
}

async function forceRecalculate() {
  const cusId = 22;
  const allEntries = await prisma.ledger.findMany({
    where: { cus_id: cusId }
  });
  allEntries.sort(compareChronologically);

  console.log(`Starting recalculation for ${allEntries.length} entries of customer ${cusId}...`);

  const initialOpening = parseFloat(allEntries[0].opening_balance || 494972);
  let currentRunning = initialOpening;
  let updateCount = 0;

  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];
    const op = currentRunning;
    const cl = calculateClosingBalance(op, entry.debit_amount, entry.credit_amount);

    if (Math.abs(Number(entry.opening_balance) - op) > 0.001 || Math.abs(Number(entry.closing_balance) - cl) > 0.001) {
      await prisma.ledger.update({
        where: { l_id: entry.l_id },
        data: { opening_balance: op, closing_balance: cl }
      });
      updateCount++;
    }

    currentRunning = cl;
  }

  await prisma.customer.update({
    where: { cus_id: cusId },
    data: { cus_balance: currentRunning }
  });

  console.log(`Updated ${updateCount} rows.`);
  console.log(`Current Balance for insaf steel adda: ${currentRunning}`);
}

forceRecalculate()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
