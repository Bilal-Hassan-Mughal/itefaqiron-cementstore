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

async function addMissingSale543() {
  const saleId = 543;
  const cusId = 968;

  const sale = await prisma.sale.findUnique({
    where: { sale_id: saleId },
    include: { customer: true }
  });

  if (!sale) {
    throw new Error(`Sale ${saleId} not found!`);
  }

  // Check if entries already exist
  const existingDebit = await prisma.ledger.findFirst({
    where: {
      cus_id: cusId,
      bill_no: saleId.toString(),
      trnx_type: 'DEBIT'
    }
  });

  if (existingDebit) {
    console.log(`Debit ledger entry already exists for sale ${saleId}: l_id=${existingDebit.l_id}`);
    return;
  }

  const maxLedger = await prisma.ledger.findFirst({
    orderBy: { l_id: 'desc' },
    select: { l_id: true }
  });
  let nextLId = (maxLedger?.l_id || 0) + 1;

  const totalAmount = parseFloat(sale.total_amount); // 36005
  const cashAmount = parseFloat(sale.cash_payment || 0); // 36000
  const discountAmount = parseFloat(sale.discount || 0);

  let billDetails = `Sale Bill - ${sale.bill_type || 'BILL'} - Customer Account (Debit)`;
  if (discountAmount > 0) {
    billDetails += ` [Discount Applied: ${discountAmount}]`;
  }

  // 1. Customer DEBIT entry (Bill amount)
  const debitEntry = await prisma.ledger.create({
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
  console.log(`✅ Created Customer Debit Entry for Sale 543:`, debitEntry);

  // 2. Customer CREDIT entry (Cash Payment Received)
  if (cashAmount > 0) {
    const paymentEntry = await prisma.ledger.create({
      data: {
        l_id: nextLId++,
        branch_id: sale.branch_id || 1,
        cus_id: cusId,
        opening_balance: 0,
        debit_amount: 0,
        credit_amount: cashAmount,
        closing_balance: -cashAmount,
        bill_no: sale.sale_id.toString(),
        trnx_type: 'CREDIT',
        details: `Payment Received - ${sale.bill_type || 'BILL'} - Customer Account (Credit) [Cash: ${cashAmount}]`,
        payments: cashAmount,
        cash_payment: cashAmount,
        bank_payment: 0,
        updated_by: sale.updated_by || 6,
        ledger_type: 'Sale',
        created_at: sale.created_at
      }
    });
    console.log(`✅ Created Customer Credit Payment Entry for Sale 543:`, paymentEntry);

    // 3. Cash Account DEBIT entry
    const cashCustomer = await prisma.customer.findFirst({
      where: { cus_name: 'Cash Account' }
    });
    if (cashCustomer) {
      const cashLedgerEntry = await prisma.ledger.create({
        data: {
          l_id: nextLId++,
          branch_id: sale.branch_id || 1,
          cus_id: cashCustomer.cus_id,
          opening_balance: 0,
          debit_amount: cashAmount,
          credit_amount: 0,
          closing_balance: cashAmount,
          bill_no: sale.sale_id.toString(),
          trnx_type: 'DEBIT',
          details: `Payment Received - ${sale.bill_type || 'BILL'} - ${sale.customer.cus_name} - CASH Account (Debit)`,
          payments: cashAmount,
          cash_payment: cashAmount,
          bank_payment: 0,
          updated_by: sale.updated_by || 6,
          ledger_type: 'Sale',
          created_at: sale.created_at
        }
      });
      console.log(`✅ Created Cash Account Debit Entry for Sale 543:`, cashLedgerEntry);

      // Recalculate Cash Account
      console.log(`Recalculating Cash Account (${cashCustomer.cus_id})...`);
      const allCashEntries = await prisma.ledger.findMany({
        where: { cus_id: cashCustomer.cus_id },
        orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }]
      });

      let cashRunning = allCashEntries.length > 0 ? allCashEntries[0].opening_balance : 0;
      const cashUpdates = [];
      for (const entry of allCashEntries) {
        const open = cashRunning;
        const close = open + entry.debit_amount - entry.credit_amount;
        if (entry.opening_balance !== open || entry.closing_balance !== close) {
          cashUpdates.push({ l_id: entry.l_id, opening_balance: open, closing_balance: close });
        }
        cashRunning = close;
      }

      console.log(`Cash entries needing balance update: ${cashUpdates.length}`);
      const CHUNK_SIZE = 50;
      for (let i = 0; i < cashUpdates.length; i += CHUNK_SIZE) {
        const chunk = cashUpdates.slice(i, i + CHUNK_SIZE);
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
        `UPDATE customers SET cus_balance = ${cashRunning} WHERE cus_id = ${cashCustomer.cus_id}`
      );
      console.log(`✅ Cash Account recalculated. Final balance: ${cashRunning}`);
    }
  }

  // Recalculate Customer 968 (imran sahib sargodha road)
  console.log(`\nRecalculating Customer 968 (${sale.customer.cus_name})...`);
  const allEntries = await prisma.ledger.findMany({
    where: { cus_id: cusId }
  });

  allEntries.sort(compareChronologically);
  console.log(`Total entries for cus 968: ${allEntries.length}`);

  // Customer starting opening balance:
  // Before sale 543, previous_balance recorded on sale 543 was 46300.
  // Let's verify: 46300 + 36005 (debit) - 36000 (credit) = 46305.
  // Next sale l_id 12345 has opening balance 46305! Perfect match!
  let currentBalance = 46300;

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

  console.log(`Entries needing update for cus 968: ${updates.length}`);
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

addMissingSale543()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
