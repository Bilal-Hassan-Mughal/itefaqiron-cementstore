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

async function fixMapleleafCement() {
  const purId = 463;
  const cusId = 2580; // mapleleaf cement

  const pur = await prisma.purchase.findUnique({
    where: { pur_id: purId },
    include: { customer: true, cargo_account: true }
  });

  if (!pur) throw new Error('Purchase 463 not found');

  const existing = await prisma.ledger.findFirst({
    where: {
      cus_id: cusId,
      bill_no: String(purId),
      ledger_type: 'Purchase'
    }
  });

  if (existing) {
    console.log('Ledger entry already exists:', existing.l_id);
    return;
  }

  const maxLedger = await prisma.ledger.findFirst({
    orderBy: { l_id: 'desc' },
    select: { l_id: true }
  });
  let nextLId = (maxLedger?.l_id || 0) + 1;

  const billAmount = parseFloat(pur.total_amount || 956800);
  const outDelivery = parseFloat(pur.out_delivery_amount || 104500);
  const outLabour = parseFloat(pur.out_labour_amount || 5120);
  const totalOutCharges = outDelivery + outLabour; // 109620

  const supplierInvoiceDetails = `Purchase Invoice from mapleleaf cement - Vehicle: ${pur.vehicle_no || '180'}`;
  const cargoOutDetails = `Cargo/Out Charges added to mapleleaf cement — Delivery: ${outDelivery} + Labour: ${outLabour} - Purchase #${purId}`;

  // 1. Supplier CREDIT entry (Invoice amount: 956,800)
  const creditEntry = await prisma.ledger.create({
    data: {
      l_id: nextLId++,
      branch_id: pur.branch_id || 1,
      cus_id: cusId,
      opening_balance: 0,
      debit_amount: 0,
      credit_amount: billAmount,
      closing_balance: -billAmount,
      bill_no: String(purId),
      trnx_type: 'CREDIT',
      details: supplierInvoiceDetails,
      payments: 0,
      cash_payment: 0,
      bank_payment: 0,
      updated_by: pur.updated_by || null,
      ledger_type: 'Purchase',
      created_at: pur.created_at
    }
  });
  console.log('Created Invoice entry for Mapleleaf:', creditEntry.l_id);

  // 2. Supplier DEBIT entry for Out Charges (109,620)
  const debitEntry = await prisma.ledger.create({
    data: {
      l_id: nextLId++,
      branch_id: pur.branch_id || 1,
      cus_id: cusId,
      opening_balance: 0,
      debit_amount: totalOutCharges,
      credit_amount: 0,
      closing_balance: totalOutCharges,
      bill_no: String(purId),
      trnx_type: 'DEBIT',
      details: cargoOutDetails,
      payments: 0,
      cash_payment: 0,
      bank_payment: 0,
      updated_by: pur.updated_by || null,
      ledger_type: 'Purchase',
      created_at: new Date(new Date(pur.created_at).getTime() + 1000)
    }
  });
  console.log('Created Cargo/Out entry for Mapleleaf:', debitEntry.l_id);

  // Now chronologically recalculate all ledger entries for Mapleleaf (cus_id: 2580)
  const allEntries = await prisma.ledger.findMany({
    where: { cus_id: cusId }
  });

  allEntries.sort(compareChronologically);
  console.log('Total entries to rebalance:', allEntries.length);

  // Preserve initial opening balance from first entry
  let currentBalance = parseFloat(allEntries[0].opening_balance || 0);

  const updates = [];
  for (let i = 0; i < allEntries.length; i++) {
    const entry = allEntries[i];
    const open = currentBalance;
    const debit = parseFloat(entry.debit_amount || 0);
    const credit = parseFloat(entry.credit_amount || 0);
    const close = calculateClosingBalance(open, debit, credit);

    if (entry.opening_balance !== open || entry.closing_balance !== close) {
      updates.push({
        l_id: entry.l_id,
        opening_balance: open,
        closing_balance: close
      });
    }

    currentBalance = close;
  }

  console.log('Entries needing update:', updates.length);
  for (let i = 0; i < updates.length; i += 50) {
    const chunk = updates.slice(i, i + 50);
    const ids = chunk.map((e) => e.l_id).join(',');
    let openCases = '';
    let closeCases = '';
    for (const e of chunk) {
      openCases  += ` WHEN ${e.l_id} THEN ${e.opening_balance}`;
      closeCases += ` WHEN ${e.l_id} THEN ${e.closing_balance}`;
    }
    await prisma.$executeRawUnsafe(
      `UPDATE ledger SET opening_balance = CASE l_id ${openCases} END, closing_balance = CASE l_id ${closeCases} END WHERE l_id IN (${ids})`
    );
  }

  await prisma.$executeRawUnsafe(
    `UPDATE customers SET cus_balance = ${currentBalance} WHERE cus_id = ${cusId}`
  );

  console.log('Finished! New final balance for Mapleleaf Cement (cus_id ' + cusId + '):', currentBalance);
}

fixMapleleafCement()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    return prisma.$disconnect();
  });

