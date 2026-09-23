const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditCashAccount() {
  const cashCust = await prisma.customer.findFirst({ where: { cus_name: 'Cash Account' } });
  const cusId = cashCust.cus_id;

  // Let's check both sort orders:
  // Order A: ORDER BY created_at ASC, l_id ASC (Standard chronological)
  const entriesChron = await prisma.ledger.findMany({
    where: { cus_id: cusId },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }]
  });

  console.log('=== FULL CHRONOLOGICAL AUDIT OF CASH ACCOUNT LEDGER ===');
  console.log(`Total entries: ${entriesChron.length}`);
  console.log(`First entry (l_id ${entriesChron[0].l_id}, ${entriesChron[0].created_at.toISOString()}): opening = ${entriesChron[0].opening_balance}`);
  console.log(`Last entry (l_id ${entriesChron[entriesChron.length - 1].l_id}, ${entriesChron[entriesChron.length - 1].created_at.toISOString()}): closing = ${entriesChron[entriesChron.length - 1].closing_balance}`);

  let totalOpeningGaps = 0;
  let totalFormulaGaps = 0;
  const gapList = [];

  for (let i = 0; i < entriesChron.length; i++) {
    const curr = entriesChron[i];
    const prev = i > 0 ? entriesChron[i - 1] : null;

    const prevClose = prev ? Number(prev.closing_balance) : Number(curr.opening_balance);
    const currOpen = Number(curr.opening_balance);
    const debit = Number(curr.debit_amount || 0);
    const credit = Number(curr.credit_amount || 0);
    const currClose = Number(curr.closing_balance);

    const openDiff = prev ? Math.round((currOpen - prevClose) * 100) / 100 : 0;
    const calcClose = Math.round((currOpen + debit - credit) * 100) / 100;
    const formulaDiff = Math.round((currClose - calcClose) * 100) / 100;

    if (Math.abs(openDiff) > 0.01 || Math.abs(formulaDiff) > 0.01) {
      gapList.push({
        index: i,
        l_id: curr.l_id,
        created_at: curr.created_at.toISOString(),
        details: curr.details,
        bill_no: curr.bill_no,
        prev_l_id: prev?.l_id,
        prev_created_at: prev?.created_at.toISOString(),
        prev_details: prev?.details,
        prev_closing: prevClose,
        curr_opening: currOpen,
        opening_jump: openDiff,
        debit,
        credit,
        curr_closing: currClose,
        calculated_closing: calcClose,
        formula_gap: formulaDiff
      });
      totalOpeningGaps += openDiff;
      totalFormulaGaps += formulaDiff;
    }
  }

  console.log(`\nFound ${gapList.length} gap points in chronological sequence.`);
  console.log(`Net sum of opening jumps: ${totalOpeningGaps.toFixed(2)}`);
  console.log(`Net sum of formula gaps:  ${totalFormulaGaps.toFixed(2)}`);
  console.log(`Combined gap impact:      ${(totalOpeningGaps + totalFormulaGaps).toFixed(2)}`);

  console.log('\n--- DETAILED BREAKDOWN OF EVERY GAP POINT ---');
  gapList.forEach((g, idx) => {
    console.log(`\n#${idx + 1} [Index ${g.index}] Ledger ID: ${g.l_id} (${g.created_at})`);
    console.log(`    Details: "${g.details}" | Bill: ${g.bill_no || 'N/A'}`);
    console.log(`    Previous Entry: l_id ${g.prev_l_id} (${g.prev_created_at}) closed at: PKR ${g.prev_closing.toFixed(2)}`);
    console.log(`    Current Entry started at opening:                           PKR ${g.curr_opening.toFixed(2)}`);
    if (Math.abs(g.opening_jump) > 0.01) {
      console.log(`    ⚠️ OPENING BALANCE JUMP (GAP):                              PKR ${g.opening_jump > 0 ? '+' : ''}${g.opening_jump.toFixed(2)}`);
    }
    console.log(`    Transaction: Debit=${g.debit.toFixed(2)}, Credit=${g.credit.toFixed(2)}`);
    console.log(`    Recorded Closing: PKR ${g.curr_closing.toFixed(2)} | Calculated: PKR ${g.calculated_closing.toFixed(2)}`);
    if (Math.abs(g.formula_gap) > 0.01) {
      console.log(`    ⚠️ FORMULA ERROR:                                           PKR ${g.formula_gap > 0 ? '+' : ''}${g.formula_gap.toFixed(2)}`);
    }
  });

  await prisma.$disconnect();
}

auditCashAccount().catch(console.error);
