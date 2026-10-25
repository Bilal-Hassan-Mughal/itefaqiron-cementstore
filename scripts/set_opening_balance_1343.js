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

async function setOpeningBalance74724() {
  const cusId = 1343;
  const targetOpening = 74724;

  const allEntries = await prisma.ledger.findMany({
    where: { cus_id: cusId }
  });

  allEntries.sort(compareChronologically);
  console.log(`Total entries for customer ${cusId}: ${allEntries.length}`);

  let currentRunning = targetOpening;
  const updates = [];

  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];
    const op = currentRunning;
    const cl = calculateClosingBalance(op, entry.debit_amount, entry.credit_amount);

    if (Math.abs(Number(entry.opening_balance) - op) > 0.001 || Math.abs(Number(entry.closing_balance) - cl) > 0.001) {
      updates.push({
        l_id: entry.l_id,
        opening_balance: op,
        closing_balance: cl
      });
    }

    currentRunning = cl;
  }

  console.log(`Entries needing update for customer ${cusId}: ${updates.length}`);

  const CHUNK_SIZE = 50;
  for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
    const chunk = updates.slice(i, i + CHUNK_SIZE);
    const whenOpening = chunk.map(u => `WHEN ${u.l_id} THEN ${u.opening_balance}`).join(' ');
    const whenClosing = chunk.map(u => `WHEN ${u.l_id} THEN ${u.closing_balance}`).join(' ');
    const ids = chunk.map(u => u.l_id).join(', ');

    await prisma.$executeRawUnsafe(`
      UPDATE ledger
      SET opening_balance = CASE l_id ${whenOpening} END,
          closing_balance = CASE l_id ${whenClosing} END
      WHERE l_id IN (${ids})
    `);
  }

  await prisma.customer.update({
    where: { cus_id: cusId },
    data: { cus_balance: currentRunning }
  });

  console.log(`\n✅ Finished successfully!`);
  console.log(`Customer ${cusId} opening balance set to: ${targetOpening}`);
  console.log(`Customer ${cusId} new final balance: ${currentRunning}`);
}

setOpeningBalance74724()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
