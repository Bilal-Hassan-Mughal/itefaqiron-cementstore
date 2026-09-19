import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateClosingBalance, createLedgerEntry } from '@/lib/ledger-helper';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope } from '@/lib/branch-server';
import { rejectIfDayClosed } from '@/lib/day-end-guard';

export const dynamic = 'force-dynamic';

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// GET - Fetch Cash Account and Adjustment Account balances & recent adjustments
export async function GET() {
  try {
    const [cashAccount, adjAccount, recentEntries] = await Promise.all([
      prisma.customer.findUnique({
        where: { cus_id: 2551 },
        select: { cus_id: true, cus_name: true, cus_balance: true }
      }),
      prisma.customer.findUnique({
        where: { cus_id: 2777 },
        select: {
          cus_id: true,
          cus_name: true,
          cus_balance: true,
          customer_category: { select: { cus_cat_title: true } },
          customer_type: { select: { cus_type_title: true } }
        }
      }),
      prisma.ledger.findMany({
        where: {
          cus_id: { in: [2551, 2777] },
          ledger_type: 'Adjustment'
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
        take: 50
      })
    ]);

    return NextResponse.json({
      cashAccount,
      adjustmentAccount: adjAccount,
      recentTransfers: recentEntries
    });
  } catch (error) {
    console.error('❌ Error fetching adjustment data:', error);
    return errorResponse(`Failed to fetch adjustment data: ${error.message}`, 500);
  }
}

// POST - Execute Adjustment Account transfer
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const { direction, amount, date, description, updated_by } = body;

    // Validate inputs
    if (!direction || !amount) {
      return errorResponse('Direction and amount are required');
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      return errorResponse('Amount must be a valid positive number greater than zero');
    }

    if (direction !== 'cash_to_adjustment' && direction !== 'adjustment_to_cash') {
      return errorResponse('Invalid transfer direction');
    }

    const result = await prisma.$transaction(async (tx) => {
      // Fetch both accounts
      const cashAccount = await tx.customer.findUnique({ where: { cus_id: 2551 } });
      const adjAccount = await tx.customer.findUnique({ where: { cus_id: 2777 } });

      if (!cashAccount) throw new Error('Cash Account (ID 2551) not found');
      if (!adjAccount) throw new Error('Adjustment Account (ID 2777) not found');

      const cashOpening = parseFloat(cashAccount.cus_balance || 0);
      const adjOpening = parseFloat(adjAccount.cus_balance || 0);

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

      // Generate ledger IDs
      const cashLedgerId = await getNextId('ledger', 'l_id', tx);
      const adjLedgerId = cashLedgerId + 1;

      let cashDetails = '';
      let adjDetails = '';
      let cashDebit = 0, cashCredit = 0;
      let adjDebit = 0, adjCredit = 0;

      const billNo = `ADJ-TRF-${cashLedgerId}`;

      if (direction === 'cash_to_adjustment') {
        // Cash Account credit (deduct from Cash)
        // Adjustment Account debit (increase Adjustment)
        cashCredit = transferAmount;
        adjDebit = transferAmount;
        cashDetails = `${description || 'Adjustment account transfer'} (To Adjustment Account)`;
        adjDetails = `${description || 'Adjustment account transfer'} (From Cash Account)`;
      } else {
        // Cash Account debit (increase Cash)
        // Adjustment Account credit (deduct from Adjustment)
        cashDebit = transferAmount;
        adjCredit = transferAmount;
        cashDetails = `${description || 'Adjustment account transfer'} (From Adjustment Account)`;
        adjDetails = `${description || 'Adjustment account transfer'} (To Cash Account)`;
      }

      // Source / Cash Entry
      const cashLedgerEntry = createLedgerEntry({
        cus_id: cashAccount.cus_id,
        opening_balance: cashOpening,
        debit_amount: cashDebit,
        credit_amount: cashCredit,
        bill_no: billNo,
        trnx_type: 'CASH',
        ledger_type: 'Adjustment',
        details: cashDetails,
        payments: transferAmount,
        cash_payment: direction === 'cash_to_adjustment' ? 0 : transferAmount,
        bank_payment: 0,
        updated_by: updated_by ? parseInt(updated_by) : null
      });

      await tx.ledger.create({
        data: {
          l_id: cashLedgerId,
          ...cashLedgerEntry,
          created_at: entryDate
        }
      });

      await tx.customer.update({
        where: { cus_id: cashAccount.cus_id },
        data: { cus_balance: cashLedgerEntry.closing_balance }
      });

      // Destination / Adjustment Entry
      const adjLedgerEntry = createLedgerEntry({
        cus_id: adjAccount.cus_id,
        opening_balance: adjOpening,
        debit_amount: adjDebit,
        credit_amount: adjCredit,
        bill_no: billNo,
        trnx_type: 'CASH',
        ledger_type: 'Adjustment',
        details: adjDetails,
        payments: transferAmount,
        cash_payment: 0,
        bank_payment: 0,
        updated_by: updated_by ? parseInt(updated_by) : null
      });

      await tx.ledger.create({
        data: {
          l_id: adjLedgerId,
          ...adjLedgerEntry,
          created_at: entryDate
        }
      });

      await tx.customer.update({
        where: { cus_id: adjAccount.cus_id },
        data: { cus_balance: adjLedgerEntry.closing_balance }
      });

      return {
        success: true,
        message: 'Adjustment transfer posted successfully',
        cashAccount: {
          id: cashAccount.cus_id,
          name: cashAccount.cus_name,
          previous_balance: cashOpening,
          new_balance: cashLedgerEntry.closing_balance
        },
        adjustmentAccount: {
          id: adjAccount.cus_id,
          name: adjAccount.cus_name,
          previous_balance: adjOpening,
          new_balance: adjLedgerEntry.closing_balance
        }
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Error executing adjustment transfer:', error);
    return errorResponse(`Transfer failed: ${error.message}`, 500);
  }
}
