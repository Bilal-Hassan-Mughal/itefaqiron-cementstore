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

async function addMissingSale460Proper() {
  const saleId = 460;
  const cusId = 1;
  const bankId = 1650; // Ubl bank

  const sale = await prisma.sale.findUnique({
    where: { sale_id: saleId },
    include: { customer: true }
  });

  if (!sale) {
    throw new Error(`Sale ${saleId} not found!`);
  }

  const maxLedger = await prisma.ledger.findFirst({
    orderBy: { l_id: 'desc' },
    select: { l_id: true }
  });
  let nextLId = (maxLedger?.l_id || 0) + 1;

  const totalAmount = parseFloat(sale.total_amount); // 262700
  const bankPaymentAmount = parseFloat(sale.bank_payment || 262700); // 262700
  const discountAmount = parseFloat(sale.discount || 0);

  let billDetails = `Sale Bill - ${sale.bill_type || 'BILL'} - Customer Account (Debit)`;
  if (discountAmount > 0) {
    billDetails += ` [Discount Applied: ${discountAmount}]`;
  }

  // 1. Ensure Customer DEBIT entry exists
  let debitEntry = await prisma.ledger.findFirst({
    where: {
      cus_id: cusId,
      bill_no: saleId.toString(),
      trnx_type: 'DEBIT'
    }
  });

  if (!debitEntry) {
    debitEntry = await prisma.ledger.create({
      data: {
        l_id: nextLId++,
        branch_id: sale.branch_id || 1,
        cus_id: cusId,
        opening_balance: 0,
        debit_amount: totalAmount,
        credit_amount: 0,
        closing_balance: totalAmount,
        bill_no: sale.sale_id.toString(),
        trnx_type: 'DEBIT',
        details: billDetails,
        payments: 0,
        cash_payment: 0,
        bank_payment: 0,
        updated_by: sale.updated_by || 6,
        ledger_type: 'Sale',
        created_at: sale.created_at
      }
    });
    console.log(`✅ Created Customer Debit Entry: l_id = ${debitEntry.l_id}`);
  } else {
    console.log(`Customer Debit Entry already exists: l_id = ${debitEntry.l_id}`);
  }

  // 2. Ensure Customer CREDIT entry exists (Payment received: 262700)
  let creditEntry = await prisma.ledger.findFirst({
    where: {
      cus_id: cusId,
      bill_no: saleId.toString(),
      trnx_type: 'CREDIT'
    }
  });

  if (!creditEntry) {
    creditEntry = await prisma.ledger.create({
      data: {
        l_id: nextLId++,
        branch_id: sale.branch_id || 1,
        cus_id: cusId,
        opening_balance: 0,
        debit_amount: 0,
        credit_amount: bankPaymentAmount,
        closing_balance: -bankPaymentAmount,
        bill_no: sale.sale_id.toString(),
        trnx_type: 'CREDIT',
        details: `Payment Received - ${sale.bill_type || 'BILL'} - Customer Account (Credit) [Bank (Ubl bank): ${bankPaymentAmount}]`,
        payments: bankPaymentAmount,
        cash_payment: 0,
        bank_payment: bankPaymentAmount,
        updated_by: sale.updated_by || 6,
        ledger_type: 'Sale',
        created_at: sale.created_at
      }
    });
    console.log(`✅ Created Customer Credit Entry: l_id = ${creditEntry.l_id}`);
  } else {
    console.log(`Customer Credit Entry already exists: l_id = ${creditEntry.l_id}`);
  }

  // 3. Ensure Bank (Ubl bank) DEBIT entry exists (Payment received: 262700)
  let bankEntry = await prisma.ledger.findFirst({
    where: {
      cus_id: bankId,
      bill_no: saleId.toString(),
      trnx_type: 'DEBIT'
    }
  });

  if (!bankEntry) {
    bankEntry = await prisma.ledger.create({
      data: {
        l_id: nextLId++,
        branch_id: sale.branch_id || 1,
        cus_id: bankId,
        opening_balance: 0,
        debit_amount: bankPaymentAmount,
        credit_amount: 0,
        closing_balance: bankPaymentAmount,
        bill_no: sale.sale_id.toString(),
        trnx_type: 'DEBIT',
        details: `Payment Received - ${sale.bill_type || 'BILL'} - ${sale.customer.cus_name} - BANK Account: Ubl bank (Debit)`,
        payments: bankPaymentAmount,
        cash_payment: 0,
        bank_payment: bankPaymentAmount,
        updated_by: sale.updated_by || 6,
        ledger_type: 'Sale',
        created_at: sale.created_at
      }
    });
    console.log(`✅ Created Bank Debit Entry: l_id = ${bankEntry.l_id}`);

    // Recalculate Ubl bank ledger chain
    console.log(`Recalculating Ubl bank (${bankId})...`);
    const allBankEntries = await prisma.ledger.findMany({
      where: { cus_id: bankId },
      orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }]
    });

    let bankRunning = allBankEntries.length > 0 ? allBankEntries[0].opening_balance : 0;
    const bankUpdates = [];
    for (const entry of allBankEntries) {
      const open = bankRunning;
      const close = Number((open + entry.debit_amount - entry.credit_amount).toFixed(2));
      if (entry.opening_balance !== open || entry.closing_balance !== close) {
        bankUpdates.push({ l_id: entry.l_id, opening_balance: open, closing_balance: close });
      }
      bankRunning = close;
    }

    console.log(`Bank entries needing balance update: ${bankUpdates.length}`);
    for (let i = 0; i < bankUpdates.length; i += 50) {
      const chunk = bankUpdates.slice(i, i + 50);
      const ids = chunk.map((e) => e.l_id).join(',');
      let openCases = '';
      let closeCases = '';
      for (const e of chunk) {
        openCases  += ` WHEN ${e.l_id} THEN ${e.opening_balance}`;
        closeCases += ` WHEN ${e.l_id} THEN ${e.closing_balance}`;
      }
      await prisma.$executeRawUnsafe(
        `UPDATE ledger SET
           opening_balance = CASE l_id ${openCases} END,
           closing_balance = CASE l_id ${closeCases} END
         WHERE l_id IN (${ids})`
      );
    }
    await prisma.$executeRawUnsafe(
      `UPDATE customers SET cus_balance = ${bankRunning} WHERE cus_id = ${bankId}`
    );
    console.log(`✅ Ubl bank recalculated. Final balance: ${bankRunning}`);
  }

  // 4. Recalculate Customer 1 (old Cash Sales)
  console.log(`\nRecalculating Customer 1 (${sale.customer.cus_name})...`);
  const allEntries = await prisma.ledger.findMany({
    where: { cus_id: cusId }
  });

  allEntries.sort(compareChronologically);
  console.log(`Total entries for cus 1: ${allEntries.length}`);

  // Preserving initial opening balance: -64432 (from entry l_id 128)
  let currentBalance = -64432;

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

  console.log(`Entries needing update for cus 1: ${updates.length}`);
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
      `UPDATE ledger SET
         opening_balance = CASE l_id ${openCases} END,
         closing_balance = CASE l_id ${closeCases} END
       WHERE l_id IN (${ids})`
    );
  }

  await prisma.$executeRawUnsafe(
    `UPDATE customers SET cus_balance = ${currentBalance} WHERE cus_id = ${cusId}`
  );

  console.log(`\n✅ Finished successfully!`);
  console.log(`Customer ${cusId} final balance: ${currentBalance}`);
}

addMissingSale460Proper()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
