const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function analyzeTodayCash() {
  console.log('=== DETAILED BREAKDOWN OF TODAY & RECENT CASH ACTIVITY ===');
  
  // Date ranges: 
  // 2026-09-23 00:00:00 to 23:59:59 PKT (2026-09-22 19:00:00 UTC to 2026-09-23 18:59:59 UTC)
  const todayStart = new Date('2026-09-22T19:00:00.000Z');
  const todayEnd = new Date('2026-09-23T18:59:59.999Z');

  // 1. Day Ends / Cash drawer counts
  const recentDayEnds = await prisma.dayEnd.findMany({
    orderBy: { business_date: 'desc' },
    take: 5,
    include: { day_end_details: true }
  });
  console.log('\n--- RECENT DAY ENDS ---');
  for (const d of recentDayEnds) {
    const bDate = d.business_date instanceof Date ? d.business_date.toISOString().split('T')[0] : d.business_date;
    console.log(`DayEnd ID ${d.day_end_id}, Date: ${bDate}, OpeningCash: ${d.opening_cash}, ClosingCash: ${d.closing_cash}, CashInHand: ${d.cash_in_hand}`);
  }

  // 2. All Cash Account ledger entries for TODAY
  const todayCashLedger = await prisma.ledger.findMany({
    where: {
      cus_id: 2551,
      created_at: { gte: todayStart, lte: todayEnd }
    },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }]
  });

  console.log(`\n--- TODAY CASH LEDGER ENTRIES (${todayCashLedger.length}) ---`);
  let debitSum = 0;
  let creditSum = 0;
  const categories = {
    sales: { count: 0, sum: 0 },
    payments_received: { count: 0, sum: 0 },
    payments_paid: { count: 0, sum: 0 },
    expenses: { count: 0, sum: 0 },
    transfers: { count: 0, sum: 0 },
    other: { count: 0, sum: 0 }
  };

  for (const l of todayCashLedger) {
    const d = Number(l.debit_amount || 0);
    const c = Number(l.credit_amount || 0);
    debitSum += d;
    creditSum += c;

    const details = (l.details || '').toLowerCase();
    if (details.includes('bill') || details.includes('order')) {
      categories.sales.count++;
      categories.sales.sum += d;
    } else if (details.includes('receiving') || details.includes('receive payment')) {
      categories.payments_received.count++;
      categories.payments_received.sum += d;
    } else if (details.includes('payment for') || details.includes('expense')) {
      categories.expenses.count++;
      categories.expenses.sum += c;
    } else if (details.includes('pay payment') || details.includes('payment to') || details.includes('payment ')) {
      categories.payments_paid.count++;
      categories.payments_paid.sum += c;
    } else if (details.includes('transfer')) {
      categories.transfers.count++;
      categories.transfers.sum += (d - c);
    } else {
      categories.other.count++;
      categories.other.sum += (d - c);
    }
  }

  console.log('Today Cash In (Debits):', debitSum);
  console.log('Today Cash Out (Credits):', creditSum);
  console.log('Today Net Change:', debitSum - creditSum);
  console.log('\nBreakdown by Transaction Type:', JSON.stringify(categories, null, 2));

  // 3. Are there any sales created today where payment_type was CASH but cash_payment was 0?
  const todaySales = await prisma.sale.findMany({
    where: { created_at: { gte: todayStart, lte: todayEnd } },
    select: {
      sale_id: true,
      bill_number: true,
      bill_type: true,
      total_amount: true,
      payment: true,
      cash_payment: true,
      bank_payment: true,
      customer: { select: { cus_name: true } }
    }
  });

  console.log(`\n--- TODAY SALES TOTALS (${todaySales.length} sales) ---`);
  let totalSaleCash = 0;
  let totalSaleBank = 0;
  let totalSaleAmount = 0;
  for (const s of todaySales) {
    totalSaleAmount += Number(s.total_amount);
    totalSaleCash += Number(s.cash_payment || 0);
    totalSaleBank += Number(s.bank_payment || 0);
  }
  console.log(`Today Total Sales Amount: PKR ${totalSaleAmount.toFixed(2)}`);
  console.log(`Today Total Sales Cash:   PKR ${totalSaleCash.toFixed(2)}`);
  console.log(`Today Total Sales Bank:   PKR ${totalSaleBank.toFixed(2)}`);

  // 4. Check for any transaction today with amount around 43,600 or summing to 43,599.90
  console.log('\n--- SEARCHING FOR ~43,600 TRANSACTIONS TODAY & YESTERDAY ---');
  const possibleEntries = await prisma.ledger.findMany({
    where: {
      created_at: { gte: new Date('2026-09-22T00:00:00.000Z') },
      OR: [
        { debit_amount: { gte: 40000, lte: 45000 } },
        { credit_amount: { gte: 40000, lte: 45000 } },
        { details: { contains: '43' } }
      ]
    }
  });
  console.log('Entries between 40k and 45k:', possibleEntries.map(e => ({
    l_id: e.l_id,
    cus_id: e.cus_id,
    bill_no: e.bill_no,
    debit: e.debit_amount,
    credit: e.credit_amount,
    details: e.details,
    date: e.created_at
  })));

  await prisma.$disconnect();
}

analyzeTodayCash().catch(console.error);
