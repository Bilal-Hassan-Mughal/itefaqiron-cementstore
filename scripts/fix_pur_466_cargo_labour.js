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

async function recalculateAccount(cusId) {
  const allEntries = await prisma.ledger.findMany({
    where: { cus_id: cusId }
  });

  allEntries.sort(compareChronologically);
  console.log(`Rebalancing account ${cusId}: ${allEntries.length} entries`);

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

  console.log(`Account ${cusId}: ${updates.length} entries updated. Final balance: ${currentBalance}`);

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
}

async function addPur466CargoAndLabour() {
  const purId = 466;
  const pur = await prisma.purchase.findUnique({
    where: { pur_id: purId }
  });

  if (!pur) throw new Error('Purchase 466 not found');

  const maxLedger = await prisma.ledger.findFirst({
    orderBy: { l_id: 'desc' },
    select: { l_id: true }
  });
  let nextLId = (maxLedger?.l_id || 0) + 1;

  // 1. Out Delivery for Vehicle 592 (cus_id: 2695)
  const cargoCusId = pur.cargo_account_id || 2695;
  const outDeliveryAmt = parseFloat(pur.out_delivery_amount || 63000);

  const existingCargo = await prisma.ledger.findFirst({
    where: {
      cus_id: cargoCusId,
      bill_no: String(purId),
      ledger_type: 'Purchase'
    }
  });

  if (!existingCargo && outDeliveryAmt > 0) {
    await prisma.ledger.create({
      data: {
        l_id: nextLId++,
        branch_id: pur.branch_id || 1,
        cus_id: cargoCusId,
        opening_balance: 0,
        debit_amount: 0,
        credit_amount: outDeliveryAmt,
        closing_balance: -outDeliveryAmt,
        bill_no: String(purId),
        trnx_type: 'CREDIT',
        details: `Out Delivery - Purchase #${purId}`,
        payments: 0,
        cash_payment: 0,
        bank_payment: 0,
        updated_by: pur.updated_by || null,
        ledger_type: 'Purchase',
        created_at: new Date(new Date(pur.created_at).getTime() + 2000)
      }
    });
    console.log(`✅ Created Out Delivery entry for Vehicle 592 (cus_id: ${cargoCusId})`);
    await recalculateAccount(cargoCusId);
  } else {
    console.log('ℹ️ Cargo entry already exists or amount is 0');
  }

  // 2. Out Labour (cus_id: 2717)
  const labourCusId = 2717;
  const outLabourAmt = parseFloat(pur.out_labour_amount || 4000);

  const existingLabour = await prisma.ledger.findFirst({
    where: {
      cus_id: labourCusId,
      bill_no: String(purId),
      ledger_type: 'Purchase'
    }
  });

  if (!existingLabour && outLabourAmt > 0) {
    await prisma.ledger.create({
      data: {
        l_id: nextLId++,
        branch_id: pur.branch_id || 1,
        cus_id: labourCusId,
        opening_balance: 0,
        debit_amount: 0,
        credit_amount: outLabourAmt,
        closing_balance: -outLabourAmt,
        bill_no: String(purId),
        trnx_type: 'CREDIT',
        details: `Out Labour - Purchase #${purId}`,
        payments: 0,
        cash_payment: 0,
        bank_payment: 0,
        updated_by: pur.updated_by || null,
        ledger_type: 'Purchase',
        created_at: new Date(new Date(pur.created_at).getTime() + 3000)
      }
    });
    console.log(`✅ Created Out Labour entry (cus_id: ${labourCusId})`);
    await recalculateAccount(labourCusId);
  } else {
    console.log('ℹ️ Labour entry already exists or amount is 0');
  }
}

addPur466CargoAndLabour()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    return prisma.$disconnect();
  });

