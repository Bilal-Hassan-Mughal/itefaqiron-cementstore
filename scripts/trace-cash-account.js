const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function traceCashAccount() {
  console.log('=== TRACING CASH ACCOUNT LEDGER ===');
  
  // 1. Find Cash Account customer(s)
  const cashCustomers = await prisma.customer.findMany({
    where: {
      OR: [
        { cus_name: { contains: 'Cash' } },
        { customer_category: { cus_cat_title: { contains: 'Cash' } } }
      ]
    },
    include: {
      customer_category: true,
      customer_type: true
    }
  });

  console.log('Cash Customers found:', cashCustomers.map(c => ({
    id: c.cus_id,
    name: c.cus_name,
    balance: c.cus_balance,
    category: c.customer_category?.cus_cat_title,
    type: c.customer_type?.cus_type_title
  })));

  if (cashCustomers.length === 0) {
    console.error('No cash account found!');
    return;
  }

  // Let's trace for the main "Cash Account"
  const cashCust = cashCustomers.find(c => c.cus_name.toLowerCase() === 'cash account') || cashCustomers[0];
  const cusId = cashCust.cus_id;
  console.log(`\nAnalyzing cus_id = ${cusId} ("${cashCust.cus_name}")`);
  console.log(`Current cus_balance in DB: ${cashCust.cus_balance}`);

  // Fetch all ledger entries
  const entries = await prisma.ledger.findMany({
    where: { cus_id: cusId },
    orderBy: [
      { created_at: 'asc' },
      { l_id: 'asc' }
    ]
  });

  console.log(`Total ledger entries for Cash Account: ${entries.length}`);

  if (entries.length === 0) {
    console.log('No ledger entries found!');
    return;
  }

  // Summary statistics
  let totalDebit = 0;
  let totalCredit = 0;
  for (const e of entries) {
    totalDebit += Number(e.debit_amount || 0);
    totalCredit += Number(e.credit_amount || 0);
  }
  console.log(`First entry date: ${entries[0].created_at.toISOString()}`);
  console.log(`Last entry date:  ${entries[entries.length - 1].created_at.toISOString()}`);
  console.log(`Total Debit sum:  ${totalDebit.toFixed(2)}`);
  console.log(`Total Credit sum: ${totalCredit.toFixed(2)}`);
  console.log(`Net (Debit - Credit): ${(totalDebit - totalCredit).toFixed(2)}`);
  console.log(`First entry opening_balance: ${entries[0].opening_balance}`);
  console.log(`Expected final closing if opening=0: ${(totalDebit - totalCredit).toFixed(2)}`);
  console.log(`Expected final closing with first opening (${entries[0].opening_balance}): ${(Number(entries[0].opening_balance) + totalDebit - totalCredit).toFixed(2)}`);
  console.log(`Actual last entry closing_balance: ${entries[entries.length - 1].closing_balance}`);

  // Trace step-by-step
  console.log('\n--- SCANNING FOR DISCREPANCIES / GAPS ---');
  let gaps = [];
  let prevEntry = null;

  for (let i = 0; i < entries.length; i++) {
    const curr = entries[i];
    const prevClosing = prevEntry ? Number(prevEntry.closing_balance) : Number(curr.opening_balance);
    const currOpening = Number(curr.opening_balance);
    const debit = Number(curr.debit_amount || 0);
    const credit = Number(curr.credit_amount || 0);
    const currClosing = Number(curr.closing_balance);
    
    // Check 1: Does opening balance match previous closing balance?
    const openingDiff = prevEntry ? currOpening - prevClosing : 0;
    
    // Check 2: Does closing balance match formula: opening + debit - credit?
    const expectedClosing = currOpening + debit - credit;
    const formulaDiff = currClosing - expectedClosing;

    if (Math.abs(openingDiff) > 0.01 || Math.abs(formulaDiff) > 0.01) {
      gaps.push({
        index: i,
        l_id: curr.l_id,
        created_at: curr.created_at.toISOString(),
        details: curr.details,
        bill_no: curr.bill_no,
        prev_lid: prevEntry?.l_id,
        prev_closing: prevClosing,
        curr_opening: currOpening,
        opening_gap: openingDiff,
        debit,
        credit,
        curr_closing: currClosing,
        expected_closing: expectedClosing,
        formula_gap: formulaDiff
      });
    }

    prevEntry = curr;
  }

  console.log(`Total gaps found: ${gaps.length}`);
  if (gaps.length > 0) {
    console.log('\nFirst 20 gaps:');
    console.log(JSON.stringify(gaps.slice(0, 20), null, 2));
  } else {
    console.log('No sequential gaps found in chronological order (created_at asc, l_id asc)!');
  }

  // Also check if entries are ordered differently in UI (e.g. by l_id only or bill_no or created_at desc)
  console.log('\n--- CHECKING ORDERING BY l_id ASC ---');
  const entriesByLid = [...entries].sort((a, b) => a.l_id - b.l_id);
  let gapsByLid = [];
  let prevByLid = null;
  for (let i = 0; i < entriesByLid.length; i++) {
    const curr = entriesByLid[i];
    const prevClosing = prevByLid ? Number(prevByLid.closing_balance) : Number(curr.opening_balance);
    const currOpening = Number(curr.opening_balance);
    const debit = Number(curr.debit_amount || 0);
    const credit = Number(curr.credit_amount || 0);
    const currClosing = Number(curr.closing_balance);
    const openingDiff = prevByLid ? currOpening - prevClosing : 0;
    const expectedClosing = currOpening + debit - credit;
    const formulaDiff = currClosing - expectedClosing;

    if (Math.abs(openingDiff) > 0.01 || Math.abs(formulaDiff) > 0.01) {
      gapsByLid.push({
        index: i,
        l_id: curr.l_id,
        created_at: curr.created_at.toISOString(),
        details: curr.details,
        prev_lid: prevByLid?.l_id,
        prev_closing: prevClosing,
        curr_opening: currOpening,
        opening_gap: openingDiff,
        curr_closing: currClosing,
        expected_closing: expectedClosing,
        formula_gap: formulaDiff
      });
    }
    prevByLid = curr;
  }
  console.log(`Total gaps when ordered by l_id asc: ${gapsByLid.length}`);
  if (gapsByLid.length > 0) {
    console.log('First 10 gaps by l_id:');
    console.log(JSON.stringify(gapsByLid.slice(0, 10), null, 2));
  }

  await prisma.$disconnect();
}

traceCashAccount().catch(console.error);
