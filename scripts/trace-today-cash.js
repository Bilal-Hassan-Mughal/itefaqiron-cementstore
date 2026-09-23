const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkToday() {
  const cashCust = await prisma.customer.findFirst({ where: { cus_name: 'Cash Account' } });
  console.log('Cash Customer:', { id: cashCust.cus_id, name: cashCust.cus_name, balance: cashCust.cus_balance });

  // Get total summary
  const totalAgg = await prisma.ledger.aggregate({
    where: { cus_id: cashCust.cus_id },
    _sum: { debit_amount: true, credit_amount: true },
    _count: { l_id: true }
  });
  console.log('Lifetime aggregate:', totalAgg);

  // First entry overall
  const firstOverall = await prisma.ledger.findFirst({
    where: { cus_id: cashCust.cus_id },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }]
  });
  console.log('First entry overall:', {
    l_id: firstOverall.l_id,
    created_at: firstOverall.created_at,
    opening_balance: firstOverall.opening_balance,
    debit: firstOverall.debit_amount,
    credit: firstOverall.credit_amount,
    closing_balance: firstOverall.closing_balance
  });

  // Last entry overall
  const lastOverall = await prisma.ledger.findFirst({
    where: { cus_id: cashCust.cus_id },
    orderBy: [{ created_at: 'desc' }, { l_id: 'desc' }]
  });
  console.log('Last entry overall:', {
    l_id: lastOverall.l_id,
    created_at: lastOverall.created_at,
    opening_balance: lastOverall.opening_balance,
    debit: lastOverall.debit_amount,
    credit: lastOverall.credit_amount,
    closing_balance: lastOverall.closing_balance
  });

  // Entries for 2026-09-23 in PKT (UTC+5)
  // 2026-09-23 00:00:00 PKT = 2026-09-22 19:00:00 UTC
  // 2026-09-23 23:59:59 PKT = 2026-09-23 18:59:59 UTC
  const todayStart = new Date('2026-09-22T19:00:00.000Z');
  const todayEnd = new Date('2026-09-23T18:59:59.999Z');

  const todayEntries = await prisma.ledger.findMany({
    where: {
      cus_id: cashCust.cus_id,
      created_at: { gte: todayStart, lte: todayEnd }
    },
    orderBy: [
      { created_at: 'asc' },
      { l_id: 'asc' }
    ]
  });

  console.log('\n--- TODAY (2026-09-23) ENTRIES ---');
  console.log('Today entries count:', todayEntries.length);
  if (todayEntries.length > 0) {
    console.log('First entry today:', {
      l_id: todayEntries[0].l_id,
      created_at: todayEntries[0].created_at,
      details: todayEntries[0].details,
      opening_balance: todayEntries[0].opening_balance,
      debit: todayEntries[0].debit_amount,
      credit: todayEntries[0].credit_amount,
      closing_balance: todayEntries[0].closing_balance
    });
    console.log('Last entry today:', {
      l_id: todayEntries[todayEntries.length - 1].l_id,
      created_at: todayEntries[todayEntries.length - 1].created_at,
      details: todayEntries[todayEntries.length - 1].details,
      opening_balance: todayEntries[todayEntries.length - 1].opening_balance,
      debit: todayEntries[todayEntries.length - 1].debit_amount,
      credit: todayEntries[todayEntries.length - 1].credit_amount,
      closing_balance: todayEntries[todayEntries.length - 1].closing_balance
    });

    let todayDebit = 0;
    let todayCredit = 0;
    for (const e of todayEntries) {
      todayDebit += Number(e.debit_amount || 0);
      todayCredit += Number(e.credit_amount || 0);
    }
    console.log(`Today Total Debit: ${todayDebit.toFixed(2)}`);
    console.log(`Today Total Credit: ${todayCredit.toFixed(2)}`);
    console.log(`Today Net: ${(todayDebit - todayCredit).toFixed(2)}`);
    console.log(`Opening + Today Net: ${(Number(todayEntries[0].opening_balance) + todayDebit - todayCredit).toFixed(2)}`);
  }

  // Also check the entry immediately before today
  const lastBeforeToday = await prisma.ledger.findFirst({
    where: {
      cus_id: cashCust.cus_id,
      created_at: { lt: todayStart }
    },
    orderBy: [
      { created_at: 'desc' },
      { l_id: 'desc' }
    ]
  });
  console.log('\nLast entry BEFORE today (yesterday closing):', lastBeforeToday ? {
    l_id: lastBeforeToday.l_id,
    created_at: lastBeforeToday.created_at,
    details: lastBeforeToday.details,
    opening_balance: lastBeforeToday.opening_balance,
    debit: lastBeforeToday.debit_amount,
    credit: lastBeforeToday.credit_amount,
    closing_balance: lastBeforeToday.closing_balance
  } : 'none');

  await prisma.$disconnect();
}

checkToday().catch(console.error);
