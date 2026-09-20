import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLedgerEntry } from '@/lib/ledger-helper';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope } from '@/lib/branch-server';
import { rejectIfDayClosed } from '@/lib/day-end-guard';

export const dynamic = 'force-dynamic';

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseEntryDate(dateStr) {
  const now = new Date();
  if (!dateStr) return now;
  const [year, month, day] = dateStr.split('-').map(Number);
  const entryDate = new Date(now);
  entryDate.setFullYear(year);
  entryDate.setMonth(month - 1);
  entryDate.setDate(day);
  return entryDate;
}

function isEntryDateTodayOrLater(entryDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const entryDay = new Date(entryDate);
  entryDay.setHours(0, 0, 0, 0);
  return entryDay >= today;
}

function cleanTransferDescription(details) {
  if (!details) return '';
  return details.replace(/\s*\(From\s+.*?\)\s*|\s*\(To\s+.*?\)\s*/gi, '').trim();
}

async function resolveOpeningBalance(tx, cus_id, target_created_at) {
  const priorEntry = await tx.ledger.findFirst({
    where: { cus_id, created_at: { lt: target_created_at } },
    orderBy: [{ created_at: 'desc' }, { l_id: 'desc' }],
    select: { closing_balance: true },
  });
  if (priorEntry) return parseFloat(priorEntry.closing_balance || 0);

  const customer = await tx.customer.findUnique({
    where: { cus_id },
    select: { cus_balance: true },
  });
  return parseFloat(customer?.cus_balance || 0);
}

async function recalculateLedgerBalances(tx, cus_id) {
  const customer = await tx.customer.findUnique({
    where: { cus_id },
    include: { customer_category: true },
  });
  if (!customer) return;

  const entries = await tx.ledger.findMany({
    where: { cus_id },
    orderBy: [{ created_at: 'asc' }, { l_id: 'asc' }],
  });

  entries.sort((a, b) => {
    const timeDiff = a.created_at.getTime() - b.created_at.getTime();
    if (timeDiff !== 0) return timeDiff;
    const billA = parseInt(String(a.bill_no || '').replace(/\D/g, '')) || 0;
    const billB = parseInt(String(b.bill_no || '').replace(/\D/g, '')) || 0;
    if (billA !== billB) return billA - billB;
    return a.l_id - b.l_id;
  });

  let runningBalance = 0;
  const updates = [];
  if (entries.length > 0) {
    runningBalance = parseFloat(entries[0].opening_balance || 0);
    for (const entry of entries) {
      const opening = runningBalance;
      const debit = parseFloat(entry.debit_amount || 0);
      const credit = parseFloat(entry.credit_amount || 0);
      const closing = opening + debit - credit;
      if (
        Math.abs(parseFloat(entry.opening_balance) - opening) > 0.01 ||
        Math.abs(parseFloat(entry.closing_balance) - closing) > 0.01
      ) {
        updates.push(
          tx.ledger.update({
            where: { l_id: entry.l_id },
            data: {
              opening_balance: Number(opening.toFixed(2)),
              closing_balance: Number(closing.toFixed(2)),
            },
          })
        );
      }
      runningBalance = closing;
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }

  await tx.customer.update({
    where: { cus_id },
    data: { cus_balance: Number(runningBalance.toFixed(2)) },
  });
}

async function createTransferEntries(tx, {
  source_id,
  destination_id,
  amount,
  date,
  description,
  updated_by,
  bill_no: existingBillNo,
}) {
  const transferAmount = parseFloat(amount);
  const srcId = parseInt(source_id);
  const destId = parseInt(destination_id);

  const sourceAccount = await tx.customer.findUnique({
    where: { cus_id: srcId },
    include: { customer_category: true },
  });
  if (!sourceAccount) throw new Error('Source account not found');

  const destAccount = await tx.customer.findUnique({
    where: { cus_id: destId },
    include: { customer_category: true },
  });
  if (!destAccount) throw new Error('Destination account not found');

  const isSrcBank = (sourceAccount.customer_category?.cus_cat_title || '').toLowerCase().includes('bank');
  const isSrcCash = (sourceAccount.customer_category?.cus_cat_title || '').toLowerCase().includes('cash');
  const isDestBank = (destAccount.customer_category?.cus_cat_title || '').toLowerCase().includes('bank');
  const isDestCash = (destAccount.customer_category?.cus_cat_title || '').toLowerCase().includes('cash');

  const entryDate = parseEntryDate(date);
  const useLiveBalance = isEntryDateTodayOrLater(entryDate);
  const startLedgerId = await getNextId('ledger', 'l_id', tx);
  const billNo = existingBillNo || `TRF-${startLedgerId}`;

  const sourceOpening = useLiveBalance
    ? parseFloat(sourceAccount.cus_balance || 0)
    : await resolveOpeningBalance(tx, sourceAccount.cus_id, entryDate);
  const sourceDetails = `${description || 'Internal Transfer'} (To ${destAccount.cus_name})`;

  const sourceLedgerId = startLedgerId;
  const sourceLedgerEntry = createLedgerEntry({
    cus_id: sourceAccount.cus_id,
    opening_balance: sourceOpening,
    debit_amount: 0,
    credit_amount: transferAmount,
    bill_no: billNo,
    trnx_type: 'BANK_TRANSFER',
    ledger_type: 'Transfer',
    details: sourceDetails,
    payments: transferAmount,
    cash_payment: isSrcCash ? transferAmount : 0,
    bank_payment: isSrcBank ? transferAmount : 0,
    updated_by: updated_by ? parseInt(updated_by) : null,
  });

  await tx.ledger.create({
    data: { l_id: sourceLedgerId, ...sourceLedgerEntry, created_at: entryDate },
  });

  await tx.customer.update({
    where: { cus_id: sourceAccount.cus_id },
    data: { cus_balance: sourceLedgerEntry.closing_balance },
  });

  const destOpening =
    sourceAccount.cus_id === destAccount.cus_id
      ? sourceLedgerEntry.closing_balance
      : useLiveBalance
        ? parseFloat(destAccount.cus_balance || 0)
        : await resolveOpeningBalance(tx, destAccount.cus_id, entryDate);

  const destDetails = `${description || 'Internal Transfer'} (From ${sourceAccount.cus_name})`;
  const destLedgerId = startLedgerId + 1;
  const destLedgerEntry = createLedgerEntry({
    cus_id: destAccount.cus_id,
    opening_balance: destOpening,
    debit_amount: transferAmount,
    credit_amount: 0,
    bill_no: billNo,
    trnx_type: 'BANK_TRANSFER',
    ledger_type: 'Transfer',
    details: destDetails,
    payments: transferAmount,
    cash_payment: isDestCash ? transferAmount : 0,
    bank_payment: isDestBank ? transferAmount : 0,
    updated_by: updated_by ? parseInt(updated_by) : null,
  });

  await tx.ledger.create({
    data: { l_id: destLedgerId, ...destLedgerEntry, created_at: entryDate },
  });

  await tx.customer.update({
    where: { cus_id: destAccount.cus_id },
    data: { cus_balance: destLedgerEntry.closing_balance },
  });

  return {
    bill_no: billNo,
    source: {
      id: sourceAccount.cus_id,
      name: sourceAccount.cus_name,
      new_balance: sourceLedgerEntry.closing_balance,
    },
    destination: {
      id: destAccount.cus_id,
      name: destAccount.cus_name,
      new_balance: destLedgerEntry.closing_balance,
    },
  };
}

// GET - Fetch accounts, recent transfers, or single transfer by bill_no
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const billNo = searchParams.get('bill_no');

    if (billNo) {
      const entries = await prisma.ledger.findMany({
        where: { bill_no: billNo, ledger_type: 'Transfer' },
        include: {
          customer: { select: { cus_id: true, cus_name: true } },
        },
        orderBy: { l_id: 'asc' },
      });

      if (entries.length !== 2) {
        return errorResponse('Transfer not found or invalid', 404);
      }

      const sourceEntry = entries.find((e) => parseFloat(e.credit_amount || 0) > 0);
      const destEntry = entries.find((e) => parseFloat(e.debit_amount || 0) > 0);
      if (!sourceEntry || !destEntry) {
        return errorResponse('Transfer entries are incomplete', 404);
      }

      const entryDate = sourceEntry.created_at
        ? new Date(sourceEntry.created_at).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];

      return NextResponse.json({
        bill_no: billNo,
        source_id: sourceEntry.cus_id,
        destination_id: destEntry.cus_id,
        source_name: sourceEntry.customer?.cus_name,
        destination_name: destEntry.customer?.cus_name,
        amount: parseFloat(sourceEntry.payments || sourceEntry.credit_amount || 0),
        date: entryDate,
        description: cleanTransferDescription(sourceEntry.details),
      });
    }

    const [accounts, recentEntries] = await Promise.all([
      prisma.customer.findMany({
        where: {
          customer_category: {
            cus_cat_title: { in: ['Bank', 'Cash Account', 'Cash'] },
          },
        },
        select: {
          cus_id: true,
          cus_name: true,
          cus_balance: true,
          customer_category: { select: { cus_cat_title: true } },
        },
        orderBy: { cus_name: 'asc' },
      }),
      prisma.ledger.findMany({
        where: { ledger_type: 'Transfer' },
        include: { customer: { select: { cus_name: true } } },
        orderBy: [{ created_at: 'desc' }, { l_id: 'desc' }],
        take: 30,
      }),
    ]);

    return NextResponse.json({ accounts, recentTransfers: recentEntries });
  } catch (error) {
    console.error('❌ Error fetching internal transfer data:', error);
    return errorResponse(`Failed to fetch data: ${error.message}`, 500);
  }
}

// POST - Execute internal transfer
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const { source_id, destination_id, amount, date, description, updated_by } = body;

    if (!source_id || !destination_id || !amount) {
      return errorResponse('Source account, destination account, and amount are required');
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return errorResponse('Amount must be a valid positive number greater than zero');
    }

    if (parseInt(source_id) === parseInt(destination_id)) {
      return errorResponse('Source and destination accounts must be different');
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const transfer = await createTransferEntries(tx, {
          source_id,
          destination_id,
          amount: transferAmount,
          date,
          description,
          updated_by,
        });
        return { success: true, message: 'Transfer completed successfully', ...transfer };
      },
      { timeout: 60000, maxWait: 60000 }
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Error executing internal transfer:', error);
    return errorResponse(`Transfer failed: ${error.message}`, 500);
  }
}

// PUT - Edit existing internal transfer
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const { bill_no, source_id, destination_id, amount, date, description, updated_by } = body;

    if (!bill_no || !source_id || !destination_id || !amount) {
      return errorResponse('Transfer reference, source, destination, and amount are required');
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return errorResponse('Amount must be a valid positive number greater than zero');
    }

    if (parseInt(source_id) === parseInt(destination_id)) {
      return errorResponse('Source and destination accounts must be different');
    }

    const result = await prisma.$transaction(async (tx) => {
      const oldEntries = await tx.ledger.findMany({
        where: { bill_no, ledger_type: 'Transfer' },
      });

      if (oldEntries.length !== 2) {
        throw new Error('Transfer not found or cannot be edited');
      }

      const affectedIds = [...new Set(oldEntries.map((e) => e.cus_id))];

      await tx.ledger.deleteMany({
        where: { bill_no, ledger_type: 'Transfer' },
      });

      for (const cusId of affectedIds) {
        await recalculateLedgerBalances(tx, cusId);
      }

      const transfer = await createTransferEntries(tx, {
        source_id,
        destination_id,
        amount: transferAmount,
        date,
        description,
        updated_by,
        bill_no,
      });

      const newAffected = new Set([
        ...affectedIds,
        parseInt(source_id),
        parseInt(destination_id),
      ]);
      for (const cusId of newAffected) {
        await recalculateLedgerBalances(tx, cusId);
      }

      return {
        success: true,
        message: 'Transfer updated successfully',
        ...transfer,
      };
    }, { timeout: 60000, maxWait: 60000 });

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Error updating internal transfer:', error);
    return errorResponse(`Update failed: ${error.message}`, 500);
  }
}
