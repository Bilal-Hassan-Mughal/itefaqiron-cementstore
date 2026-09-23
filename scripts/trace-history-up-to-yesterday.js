const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function traceHistoryUpToYesterday() {
  const cashCusId = 2551;
  const cutoff = new Date('2026-09-22T19:00:00.000Z'); // Start of Sept 23 in PKT

  const entries = await prisma.ledger.findMany({
    where: {
      cus_id: cashCusId,
      created_at: { lt: cutoff }
    },
    orderBy: [
      { created_at: 'asc' },
      { l_id: 'asc' }
    ]
  });

  console.log(`=== AUDIT OF CASH ACCOUNT UP TO YESTERDAY'S CLOSE (23,275.10) ===`);
  console.log(`Total transactions in this period: ${entries.length}`);

  const firstEntry = entries[0];
  const lastEntry = entries[entries.length - 1];

  console.log(`First Entry: l_id ${firstEntry.l_id} (${firstEntry.created_at.toISOString().split('T')[0]}) -> Opening: PKR ${Number(firstEntry.opening_balance).toFixed(2)}`);
  console.log(`Last Entry:  l_id ${lastEntry.l_id} (${lastEntry.created_at.toISOString().split('T')[0]}) -> Closing: PKR ${Number(lastEntry.closing_balance).toFixed(2)}`);

  let totalDebit = 0;
  let totalCredit = 0;

  // Inflow categorization
  const inflows = {
    sales_bills: { count: 0, amount: 0 },
    customer_receivings: { count: 0, amount: 0 },
    order_advances: { count: 0, amount: 0 },
    other_in: { count: 0, amount: 0 }
  };

  // Outflow categorization
  const outflows = {
    bank_transfers: { count: 0, amount: 0 },
    supplier_vendor_payments: { count: 0, amount: 0 },
    cargo_labour_carriage: { count: 0, amount: 0 },
    expenses: { count: 0, amount: 0 },
    refunds_returns: { count: 0, amount: 0 },
    other_out: { count: 0, amount: 0 }
  };

  // Monthly breakdown
  const monthly = {};

  for (const e of entries) {
    const deb = Number(e.debit_amount || 0);
    const cr = Number(e.credit_amount || 0);
    totalDebit += deb;
    totalCredit += cr;

    // Monthly bucket (YYYY-MM)
    const monthKey = e.created_at.toISOString().slice(0, 7);
    if (!monthly[monthKey]) {
      monthly[monthKey] = {
        opening: Number(e.opening_balance),
        debit: 0,
        credit: 0,
        closing: 0,
        count: 0
      };
    }
    monthly[monthKey].debit += deb;
    monthly[monthKey].credit += cr;
    monthly[monthKey].closing = Number(e.closing_balance);
    monthly[monthKey].count++;

    const det = (e.details || '').toLowerCase();
    const bill = (e.bill_no || '').toLowerCase();

    if (deb > 0) {
      if (det.includes('order')) {
        inflows.order_advances.count++;
        inflows.order_advances.amount += deb;
      } else if (det.includes('bill') || det.includes('sale')) {
        inflows.sales_bills.count++;
        inflows.sales_bills.amount += deb;
      } else if (det.includes('receiving') || det.includes('receive payment')) {
        inflows.customer_receivings.count++;
        inflows.customer_receivings.amount += deb;
      } else {
        inflows.other_in.count++;
        inflows.other_in.amount += deb;
      }
    }

    if (cr > 0) {
      if (det.includes('transfer') || bill.startsWith('trf-') || det.includes('to ubl') || det.includes('to mcb') || det.includes('to hbl') || det.includes('to bop')) {
        outflows.bank_transfers.count++;
        outflows.bank_transfers.amount += cr;
      } else if (det.includes('cargo') || det.includes('labour') || det.includes('raksha') || det.includes('delivery')) {
        outflows.cargo_labour_carriage.count++;
        outflows.cargo_labour_carriage.amount += cr;
      } else if (det.includes('payment for') || bill.startsWith('exp-') || det.includes('expense')) {
        outflows.expenses.count++;
        outflows.expenses.amount += cr;
      } else if (det.includes('refund') || det.includes('return') || det.includes('wapsi')) {
        outflows.refunds_returns.count++;
        outflows.refunds_returns.amount += cr;
      } else if (det.includes('payment to') || det.includes('pay payment') || det.includes('payment ')) {
        outflows.supplier_vendor_payments.count++;
        outflows.supplier_vendor_payments.amount += cr;
      } else {
        outflows.other_out.count++;
        outflows.other_out.amount += cr;
      }
    }
  }

  console.log('\n--- OVERALL TOTALS UP TO YESTERDAY ---');
  console.log(`Initial Opening Balance:   PKR ${Number(firstEntry.opening_balance).toFixed(2)}`);
  console.log(`Total Cash Inflows (Deb):  PKR ${totalDebit.toFixed(2)}`);
  console.log(`Total Cash Outflows (Cr):  PKR ${totalCredit.toFixed(2)}`);
  console.log(`Net Movement (In - Out):   PKR ${(totalDebit - totalCredit).toFixed(2)}`);
  console.log(`Final Closing Balance:     PKR ${Number(lastEntry.closing_balance).toFixed(2)}`);
  console.log(`Calculated Check:          PKR ${(Number(firstEntry.opening_balance) + totalDebit - totalCredit).toFixed(2)}`);

  console.log('\n--- MONTH-BY-MONTH BREAKDOWN ---');
  console.log('Month   | Entries | Opening Balance | Total In (Debit) | Total Out (Credit) | Net Change    | Closing Balance');
  console.log('-----------------------------------------------------------------------------------------------------------');
  for (const [m, data] of Object.entries(monthly)) {
    const net = data.debit - data.credit;
    console.log(`${m} | ${String(data.count).padStart(7)} | ${data.opening.toFixed(2).padStart(15)} | ${data.debit.toFixed(2).padStart(16)} | ${data.credit.toFixed(2).padStart(18)} | ${net.toFixed(2).padStart(13)} | ${data.closing.toFixed(2).padStart(15)}`);
  }

  console.log('\n--- INFLOWS (CASH IN) CATEGORIES ---');
  console.log(JSON.stringify(inflows, null, 2));

  console.log('\n--- OUTFLOWS (CASH OUT) CATEGORIES ---');
  console.log(JSON.stringify(outflows, null, 2));

  // Top 10 largest cash deposits to banks / transfers
  const topTransfers = entries
    .filter(e => Number(e.credit_amount) >= 500000)
    .sort((a, b) => Number(b.credit_amount) - Number(a.credit_amount))
    .slice(0, 15);
  console.log('\n--- TOP MAJOR CASH OUTFLOWS (>= 500,000 PKR) ---');
  for (const t of topTransfers) {
    console.log(`${t.created_at.toISOString().split('T')[0]} | PKR ${Number(t.credit_amount).toFixed(2).padStart(12)} | Bill: ${(t.bill_no || '').padEnd(10)} | Details: ${t.details}`);
  }

  await prisma.$disconnect();
}

traceHistoryUpToYesterday().catch(console.error);
