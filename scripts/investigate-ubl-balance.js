const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const fmt = (n) => Number(parseFloat(n || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function main() {
  const ubl = await prisma.customer.findFirst({
    where: { cus_name: { contains: 'Ubl bank' } },
    include: { customer_category: true },
  });
  if (!ubl) {
    console.log('UBL account not found');
    return;
  }
  const cusId = ubl.cus_id;
  console.log('Account:', ubl.cus_name, 'cus_id=', cusId, 'category=', ubl.customer_category?.cus_cat_title);
  console.log('Stored cus_balance:', fmt(ubl.cus_balance));

  const entries = await prisma.ledger.findMany({
    where: { cus_id: cusId },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
  });
  entries.sort((a, b) => {
    const t = a.created_at.getTime() - b.created_at.getTime();
    if (t !== 0) return t;
    const billA = parseInt(String(a.bill_no || '').replace(/\D/g, '')) || 0;
    const billB = parseInt(String(b.bill_no || '').replace(/\D/g, '')) || 0;
    if (billA !== billB) return billA - billB;
    return a.l_id - b.l_id;
  });

  console.log('Ledger row count:', entries.length);
  if (!entries.length) return;

  const first = entries[0];
  const last = entries[entries.length - 1];
  console.log('First row l_id', first.l_id, 'opening', fmt(first.opening_balance));
  console.log('Last row l_id', last.l_id, 'bill', last.bill_no, 'closing', fmt(last.closing_balance));

  let running = parseFloat(first.opening_balance || 0);
  let mismatchCount = 0;
  let maxGap = { l_id: null, gap: 0, expected: 0, actual: 0 };
  const brokenRows = [];

  for (const entry of entries) {
    const opening = running;
    const debit = parseFloat(entry.debit_amount || 0);
    const credit = parseFloat(entry.credit_amount || 0);
    const expectedClose = opening + debit - credit;
    const storedOpen = parseFloat(entry.opening_balance || 0);
    const storedClose = parseFloat(entry.closing_balance || 0);

    const openGap = Math.abs(storedOpen - opening);
    const closeGap = Math.abs(storedClose - expectedClose);
    if (openGap > 0.02 || closeGap > 0.02) {
      mismatchCount += 1;
      const gap = Math.max(openGap, closeGap);
      if (gap > maxGap.gap) {
        maxGap = { l_id: entry.l_id, bill: entry.bill_no, gap, expected: expectedClose, actual: storedClose, openExp: opening, openAct: storedOpen };
      }
    }
    if (debit === 0 && credit === 0 && parseFloat(entry.payments || 0) > 0) {
      brokenRows.push({ l_id: entry.l_id, bill: entry.bill_no, payments: entry.payments, details: entry.details });
    }
    running = expectedClose;
  }

  console.log('\nRecalculated chain closing (from first opening + D/C):', fmt(running));
  console.log('Gap stored vs recalculated:', fmt(parseFloat(ubl.cus_balance) - running));
  console.log('Rows with opening/closing mismatch vs chain:', mismatchCount);
  if (maxGap.l_id) {
    console.log('Largest mismatch at l_id', maxGap.l_id, 'bill', maxGap.bill, 'gap', fmt(maxGap.gap));
    console.log('  expected close', fmt(maxGap.expected), 'stored close', fmt(maxGap.actual));
  }

  let sumD = 0;
  let sumC = 0;
  for (const e of entries) {
    sumD += parseFloat(e.debit_amount || 0);
    sumC += parseFloat(e.credit_amount || 0);
  }
  const netFromFirstOpen = parseFloat(first.opening_balance) + sumD - sumC;
  console.log('\nSum debits:', fmt(sumD), 'Sum credits:', fmt(sumC));
  console.log('First opening + net D-C:', fmt(netFromFirstOpen));

  const clientReported = 3903403;
  console.log('\n--- vs client figure PKR', fmt(clientReported), '---');
  console.log('Stored balance - client:', fmt(parseFloat(ubl.cus_balance) - clientReported));
  console.log('Recalc chain - client:', fmt(running - clientReported));
  console.log('Last row closing - client:', fmt(parseFloat(last.closing_balance) - clientReported));

  const pay3914 = await prisma.ledger.count({ where: { cus_id: cusId, bill_no: 'PAY-3914' } });
  console.log('\nPAY-3914 rows on UBL:', pay3914);

  const recent = entries.slice(-15);
  console.log('\nLast 15 ledger movements:');
  for (const e of recent) {
    console.log(
      `${e.created_at.toISOString().slice(0, 10)} l_id=${e.l_id} ${e.bill_no || '-'} D=${fmt(e.debit_amount)} C=${fmt(e.credit_amount)} close=${fmt(e.closing_balance)} | ${(e.details || '').slice(0, 55)}`
    );
  }

  const dupBills = await prisma.$queryRaw`
    SELECT bill_no, COUNT(*) as cnt, SUM(debit_amount) as sd, SUM(credit_amount) as sc
    FROM ledger
    WHERE cus_id = ${cusId} AND bill_no IS NOT NULL AND bill_no != ''
    GROUP BY bill_no
    HAVING COUNT(*) > 2
    ORDER BY cnt DESC
    LIMIT 15
  `.catch(() => []);

  if (dupBills?.length) {
    console.log('\nBill refs with >2 rows (sample):');
    for (const r of dupBills) console.log(r);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
