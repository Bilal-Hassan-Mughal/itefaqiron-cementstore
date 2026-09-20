import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLedgerEntry } from '@/lib/ledger-helper';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope, resolveUpdatedByUserId } from '@/lib/branch-server';

const EXPENSE_TX_OPTIONS = { timeout: 60000, maxWait: 60000 };
import { rejectIfDayClosed } from '@/lib/day-end-guard';

// POST - Mark expense as paid
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

    try {
        const body = await request.json();
        const {
            expense_id,
            paid_from_account_id,
            payment_reference,
            updated_by
        } = body;

        // Validate required fields
        if (!expense_id) {
            return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
        }

        if (!paid_from_account_id) {
            return NextResponse.json({ error: 'Payment account is required' }, { status: 400 });
        }

        // Get the expense
        const expense = await prisma.expense.findUnique({
            where: { exp_id: parseInt(expense_id) },
            include: {
                expense_title: true
            }
        });

        if (!expense) {
            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        }

        if (expense.is_paid) {
            return NextResponse.json({ error: 'Expense is already paid' }, { status: 400 });
        }

        // Get payment account
        const paymentAccount = await prisma.customer.findUnique({
            where: { cus_id: parseInt(paid_from_account_id) },
            select: { cus_balance: true, cus_name: true }
        });

        if (!paymentAccount) {
            return NextResponse.json({ error: 'Payment account not found' }, { status: 404 });
        }

        const validatedUpdatedBy = await resolveUpdatedByUserId(request, updated_by, prisma);

        // Process payment in transaction
        const result = await prisma.$transaction(async (tx) => {
            const expenseAmount = parseFloat(expense.exp_amount);
            const currentBalance = parseFloat(paymentAccount.cus_balance || 0);

            // Determine transaction type based on account type (simplified for now)
            // If it's a bank account, use BANK_PAYMENT, otherwise CASH_PAYMENT
            const trnxType = paymentAccount.cus_name?.toLowerCase().includes('bank') ? 'BANK_PAYMENT' : 'CASH_PAYMENT';

            console.log(`💰 Processing expense payment: ${expenseAmount} from ${paymentAccount.cus_name} (Current: ${currentBalance})`);

            // Create ledger entry using helper
            const ledgerEntryData = createLedgerEntry({
                cus_id: parseInt(paid_from_account_id),
                opening_balance: currentBalance,
                debit_amount: 0,
                credit_amount: expenseAmount,
                bill_no: `EXP-${expense_id}`,
                trnx_type: trnxType,
                ledger_type: 'Expense',
                details: `Payment for ${expense.expense_title?.title || 'Expense'}: ${expense.exp_title}${payment_reference ? ` - Ref: ${payment_reference}` : ''}`,
                payments: expenseAmount,
                updated_by: validatedUpdatedBy
            });

            const l_id = await getNextId('ledger', 'l_id', tx);
            await tx.ledger.create({
                data: {
                    l_id,
                    ...ledgerEntryData
                }
            });

            const newBalance = ledgerEntryData.closing_balance;

            // Update payment account balance
            await tx.customer.update({
                where: { cus_id: parseInt(paid_from_account_id) },
                data: { cus_balance: newBalance }
            });

            // Mark expense as paid
            const updatedExpense = await tx.expense.update({
                where: { exp_id: parseInt(expense_id) },
                data: {
                    is_paid: true,
                    paid_from_account_id: parseInt(paid_from_account_id),
                    payment_date: new Date(),
                    payment_reference: payment_reference || null
                },
                include: {
                    expense_title: true,
                    paid_from_account: {
                        select: {
                            cus_id: true,
                            cus_name: true
                        }
                    },
                    updated_by_user: {
                        select: {
                            full_name: true,
                            role: true
                        }
                    }
                }
            });

            console.log(`✅ Expense ${expense_id} marked as paid. New balance: ${newBalance}`);
            return updatedExpense;
        }, EXPENSE_TX_OPTIONS);

        return NextResponse.json(result);
    } catch (error) {
        console.error('❌ Error marking expense as paid:', error);
        return NextResponse.json({
            error: 'Failed to mark expense as paid',
            details: error.message
        }, { status: 500 });
    }
}
