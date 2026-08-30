import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateClosingBalance, createLedgerEntry } from '@/lib/ledger-helper';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope } from '@/lib/branch-server';

export const dynamic = 'force-dynamic';

// Helper for JSON errors
function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// GET - Fetch bank and cash accounts for dropdown & recent transfers
export async function GET() {
  try {
    const [accounts, recentEntries] = await Promise.all([
      prisma.customer.findMany({
        where: {
          customer_category: {
            cus_cat_title: {
              in: ['Bank', 'Cash Account', 'Cash']
            }
          }
        },
        select: {
          cus_id: true,
          cus_name: true,
          cus_balance: true,
          customer_category: {
            select: {
              cus_cat_title: true
            }
          }
        },
        orderBy: {
          cus_name: 'asc'
        }
      }),
      prisma.ledger.findMany({
        where: {
          ledger_type: 'Transfer'
        },
        include: {
          customer: {
            select: {
              cus_name: true
            }
          }
        },
        orderBy: [
          { created_at: 'desc' },
          { l_id: 'desc' }
        ],
        take: 30
      })
    ]);

    return NextResponse.json({ accounts, recentTransfers: recentEntries });
  } catch (error) {
    console.error('❌ Error fetching bank/cash accounts:', error);
    return errorResponse(`Failed to fetch accounts: ${error.message}`, 500);
  }
}

// POST - Execute internal transfer
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { source_id, destination_id, amount, date, description, updated_by } = body;

    // Validate inputs
    if (!source_id || !destination_id || !amount) {
      return errorResponse('Source account, destination account, and amount are required');
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return errorResponse('Amount must be a valid positive number greater than zero');
    }

    const srcId = parseInt(source_id);
    const destId = parseInt(destination_id);

    if (srcId === destId) {
      return errorResponse('Source and destination accounts must be different');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Fetch both accounts
      const sourceAccount = await tx.customer.findUnique({
        where: { cus_id: srcId },
        include: { customer_category: true }
      });
      if (!sourceAccount) throw new Error('Source account not found');

      const destAccount = await tx.customer.findUnique({
        where: { cus_id: destId },
        include: { customer_category: true }
      });
      if (!destAccount) throw new Error('Destination account not found');

      const sourceOpening = parseFloat(sourceAccount.cus_balance || 0);
      const destOpening = parseFloat(destAccount.cus_balance || 0);

      // Determine payment types
      const isSrcBank = (sourceAccount.customer_category?.cus_cat_title || '').toLowerCase().includes('bank');
      const isSrcCash = (sourceAccount.customer_category?.cus_cat_title || '').toLowerCase().includes('cash');

      const isDestBank = (destAccount.customer_category?.cus_cat_title || '').toLowerCase().includes('bank');
      const isDestCash = (destAccount.customer_category?.cus_cat_title || '').toLowerCase().includes('cash');

      const sourceCashPayment = isSrcCash ? transferAmount : 0;
      const sourceBankPayment = isSrcBank ? transferAmount : 0;

      const destCashPayment = isDestCash ? transferAmount : 0;
      const destBankPayment = isDestBank ? transferAmount : 0;

      // Setup Date in Pakistan Standard Time (UTC+5) preserving current time
      const now = new Date();
      let entryDate = now;
      if (date) {
        const [year, month, day] = date.split('-').map(Number);
        entryDate = new Date(now);
        entryDate.setFullYear(year);
        entryDate.setMonth(month - 1);
        entryDate.setDate(day);
      }

      // Get next ledger ID for Source Account (Credit entry)
      const sourceLedgerId = await getNextId('ledger', 'l_id', tx);
      const sourceDetails = `${description || 'Internal Transfer'} (To ${destAccount.cus_name})`;

      const sourceLedgerEntry = createLedgerEntry({
        cus_id: sourceAccount.cus_id,
        opening_balance: sourceOpening,
        debit_amount: 0,
        credit_amount: transferAmount,
        bill_no: `TRF-${sourceLedgerId}`,
        trnx_type: 'BANK_TRANSFER',
        ledger_type: 'Transfer',
        details: sourceDetails,
        payments: transferAmount,
        cash_payment: sourceCashPayment,
        bank_payment: sourceBankPayment,
        updated_by: updated_by ? parseInt(updated_by) : null
      });

      await tx.ledger.create({
        data: {
          l_id: sourceLedgerId,
          ...sourceLedgerEntry,
          created_at: entryDate
        }
      });

      await tx.customer.update({
        where: { cus_id: sourceAccount.cus_id },
        data: { cus_balance: sourceLedgerEntry.closing_balance }
      });

      // Destination Account (Debit entry)
      const activeDestOpening = (sourceAccount.cus_id === destAccount.cus_id)
        ? sourceLedgerEntry.closing_balance
        : destOpening;

      const destLedgerId = await getNextId('ledger', 'l_id', tx);
      const destDetails = `${description || 'Internal Transfer'} (From ${sourceAccount.cus_name})`;

      const destLedgerEntry = createLedgerEntry({
        cus_id: destAccount.cus_id,
        opening_balance: activeDestOpening,
        debit_amount: transferAmount,
        credit_amount: 0,
        bill_no: `TRF-${sourceLedgerId}`,
        trnx_type: 'BANK_TRANSFER',
        ledger_type: 'Transfer',
        details: destDetails,
        payments: transferAmount,
        cash_payment: destCashPayment,
        bank_payment: destBankPayment,
        updated_by: updated_by ? parseInt(updated_by) : null
      });

      await tx.ledger.create({
        data: {
          l_id: destLedgerId,
          ...destLedgerEntry,
          created_at: entryDate
        }
      });

      await tx.customer.update({
        where: { cus_id: destAccount.cus_id },
        data: { cus_balance: destLedgerEntry.closing_balance }
      });

      return {
        success: true,
        message: 'Transfer completed successfully',
        source: {
          id: sourceAccount.cus_id,
          name: sourceAccount.cus_name,
          previous_balance: sourceOpening,
          new_balance: sourceLedgerEntry.closing_balance
        },
        destination: {
          id: destAccount.cus_id,
          name: destAccount.cus_name,
          previous_balance: destOpening,
          new_balance: destLedgerEntry.closing_balance
        }
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Error executing internal transfer:', error);
    return errorResponse(`Transfer failed: ${error.message}`, 500);
  }
}
