import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createLedgerEntry } from '@/lib/ledger-helper';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope, resolveUpdatedByUserId } from '@/lib/branch-server';
import { rejectIfDayClosed } from '@/lib/day-end-guard';

const EXPENSE_TX_OPTIONS = { timeout: 60000, maxWait: 60000 };

async function writeExpenseLedgerEntry(tx, {
  account,
  amount,
  billNo,
  trnxType,
  details,
  updatedBy,
  lId,
  cashPayment = 0,
  bankPayment = 0,
}) {
  const currentBalance = parseFloat(account.cus_balance || 0);
  const ledgerEntryData = createLedgerEntry({
    cus_id: account.cus_id,
    opening_balance: currentBalance,
    debit_amount: 0,
    credit_amount: amount,
    bill_no: billNo,
    trnx_type: trnxType,
    ledger_type: 'Expense',
    details,
    payments: amount,
    cash_payment: cashPayment,
    bank_payment: bankPayment,
    updated_by: updatedBy,
  });

  await tx.ledger.create({
    data: {
      l_id: lId,
      ...ledgerEntryData,
    },
  });

  await tx.customer.update({
    where: { cus_id: account.cus_id },
    data: { cus_balance: ledgerEntryData.closing_balance },
  });

  return ledgerEntryData.closing_balance;
}

// GET - Fetch all expenses with related data
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (id) {
      // Fetch single expense
      const expense = await prisma.expense.findUnique({
        where: { exp_id: id },
        include: {
          expense_title: true,
          paid_from_account: {
            select: {
              cus_id: true,
              cus_name: true
            }
          },
          bank_account: {
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

      if (!expense) {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
      }

      return NextResponse.json(expense);
    } else {
      // Fetch all expenses
      const expenses = await prisma.expense.findMany({
        include: {
          expense_title: true,
          paid_from_account: {
            select: {
              cus_id: true,
              cus_name: true
            }
          },
          bank_account: {
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
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      return NextResponse.json(expenses);
    }
  } catch (error) {
    console.error('Error fetching expenses:', error);
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

// POST - Create new expense (always paid immediately with ledger creation)
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const {
      exp_title,
      exp_type,
      exp_detail,
      exp_amount,
      paymentMethod, // 'CASH', 'BANK', or 'PARTIAL'
      paid_from_account_id, // Cash Account ID (required for CASH / PARTIAL)
      bank_account_id, // Bank Account ID (required for BANK / PARTIAL)
      cash_amount, // Cash Amount (required for PARTIAL)
      bank_amount, // Bank Amount (required for PARTIAL)
      payment_reference,
      updated_by
    } = body;

    // Validate required fields
    if (!exp_title || !exp_type || !exp_amount || !paymentMethod) {
      return NextResponse.json({ error: 'Title, type, amount, and payment method are required' }, { status: 400 });
    }

    const expenseAmount = parseFloat(exp_amount);
    if (expenseAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
    }

    // Validate based on payment method
    let cashAmt = 0;
    let bankAmt = 0;

    if (paymentMethod === 'CASH') {
      if (!paid_from_account_id) {
        return NextResponse.json({ error: 'Cash account is required for cash payments' }, { status: 400 });
      }
      cashAmt = expenseAmount;
    } else if (paymentMethod === 'BANK') {
      if (!bank_account_id) {
        return NextResponse.json({ error: 'Bank account is required for bank payments' }, { status: 400 });
      }
      bankAmt = expenseAmount;
    } else if (paymentMethod === 'PARTIAL') {
      if (!paid_from_account_id || !bank_account_id) {
        return NextResponse.json({ error: 'Both cash and bank accounts are required for partial payments' }, { status: 400 });
      }
      cashAmt = parseFloat(cash_amount || 0);
      bankAmt = parseFloat(bank_amount || 0);

      if (cashAmt <= 0 || bankAmt <= 0) {
        return NextResponse.json({ error: 'Cash and bank amounts must be greater than zero for partial payments' }, { status: 400 });
      }

      if (Math.abs(cashAmt + bankAmt - expenseAmount) > 0.01) {
        return NextResponse.json({ error: 'Sum of cash and bank amounts must equal total expense amount' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    // Check if expense title exists
    const expenseTitle = await prisma.expenseTitle.findUnique({
      where: { id: parseInt(exp_type) }
    });

    if (!expenseTitle) {
      return NextResponse.json({ error: 'Invalid expense type' }, { status: 400 });
    }

    const validatedUpdatedBy = await resolveUpdatedByUserId(request, updated_by, prisma);

    const result = await prisma.$transaction(async (tx) => {
      let cashAccount = null;
      let bankAccount = null;

      if (cashAmt > 0) {
        cashAccount = await tx.customer.findUnique({
          where: { cus_id: parseInt(paid_from_account_id) }
        });
        if (!cashAccount) throw new Error('Cash account not found');
      }

      if (bankAmt > 0) {
        bankAccount = await tx.customer.findUnique({
          where: { cus_id: parseInt(bank_account_id) }
        });
        if (!bankAccount) throw new Error('Bank account not found');
      }

      const exp_id = body.exp_id || await getNextId('expense', 'exp_id', tx);

      // Create expense
      const expense = await tx.expense.create({
        data: {
          exp_id,
          exp_title: exp_title.trim(),
          exp_type: parseInt(exp_type),
          exp_detail: exp_detail?.trim() || null,
          exp_amount: expenseAmount,
          is_paid: true,
          paid_from_account_id: cashAmt > 0 ? parseInt(paid_from_account_id) : null,
          cash_amount: cashAmt,
          bank_account_id: bankAmt > 0 ? parseInt(bank_account_id) : null,
          bank_amount: bankAmt,
          payment_date: new Date(),
          payment_reference: payment_reference || null,
          updated_by: validatedUpdatedBy
        },
        include: {
          expense_title: true,
          updated_by_user: {
            select: {
              full_name: true,
              role: true
            }
          }
        }
      });

      const billNo = `EXP-${expense.exp_id}`;
      const ledgerWriteCount = (cashAmt > 0 ? 1 : 0) + (bankAmt > 0 ? 1 : 0);
      let nextLedgerId = ledgerWriteCount > 0 ? await getNextId('ledger', 'l_id', tx) : null;

      if (cashAmt > 0 && cashAccount) {
        await writeExpenseLedgerEntry(tx, {
          account: cashAccount,
          amount: cashAmt,
          billNo,
          trnxType: 'CASH_PAYMENT',
          details: `Payment for ${expense.expense_title?.title || 'Expense'}: ${expense.exp_title}${paymentMethod === 'PARTIAL' ? ' (Partial cash payment)' : ''}${payment_reference ? ` - Ref: ${payment_reference}` : ''}`,
          updatedBy: validatedUpdatedBy,
          lId: nextLedgerId,
          cashPayment: cashAmt,
          bankPayment: 0,
        });
        nextLedgerId += 1;
      }

      if (bankAmt > 0 && bankAccount) {
        const activeBank =
          cashAccount && cashAccount.cus_id === bankAccount.cus_id
            ? await tx.customer.findUnique({ where: { cus_id: bankAccount.cus_id } })
            : bankAccount;
        if (!activeBank) throw new Error('Bank account not found');

        await writeExpenseLedgerEntry(tx, {
          account: activeBank,
          amount: bankAmt,
          billNo,
          trnxType: 'BANK_PAYMENT',
          details: `Payment for ${expense.expense_title?.title || 'Expense'}: ${expense.exp_title}${paymentMethod === 'PARTIAL' ? ' (Partial bank payment)' : ''}${payment_reference ? ` - Ref: ${payment_reference}` : ''}`,
          updatedBy: validatedUpdatedBy,
          lId: nextLedgerId,
          cashPayment: 0,
          bankPayment: bankAmt,
        });
      }

      return expense;
    }, EXPENSE_TX_OPTIONS);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating expense:', error);
    return NextResponse.json(
      { error: `Failed to create expense: ${error.message}` },
      { status: 500 }
    );
  }
}

// PUT - Update expense (handles ledger adjustments if payment details change)
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const {
      id,
      exp_title,
      exp_type,
      exp_detail,
      exp_amount,
      paymentMethod,
      paid_from_account_id,
      bank_account_id,
      cash_amount,
      bank_amount,
      payment_reference,
      updated_by
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
    }

    if (!exp_title || !exp_type || !exp_amount || !paymentMethod) {
      return NextResponse.json({ error: 'Title, type, amount, and payment method are required' }, { status: 400 });
    }

    const expenseAmount = parseFloat(exp_amount);
    if (expenseAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 });
    }

    // Validate based on payment method
    let cashAmt = 0;
    let bankAmt = 0;

    if (paymentMethod === 'CASH') {
      if (!paid_from_account_id) {
        return NextResponse.json({ error: 'Cash account is required for cash payments' }, { status: 400 });
      }
      cashAmt = expenseAmount;
    } else if (paymentMethod === 'BANK') {
      if (!bank_account_id) {
        return NextResponse.json({ error: 'Bank account is required for bank payments' }, { status: 400 });
      }
      bankAmt = expenseAmount;
    } else if (paymentMethod === 'PARTIAL') {
      if (!paid_from_account_id || !bank_account_id) {
        return NextResponse.json({ error: 'Both cash and bank accounts are required for partial payments' }, { status: 400 });
      }
      cashAmt = parseFloat(cash_amount || 0);
      bankAmt = parseFloat(bank_amount || 0);

      if (cashAmt <= 0 || bankAmt <= 0) {
        return NextResponse.json({ error: 'Cash and bank amounts must be greater than zero for partial payments' }, { status: 400 });
      }

      if (Math.abs(cashAmt + bankAmt - expenseAmount) > 0.01) {
        return NextResponse.json({ error: 'Sum of cash and bank amounts must equal total expense amount' }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: 'Invalid payment method' }, { status: 400 });
    }

    // Check if expense exists
    const existingExpense = await prisma.expense.findUnique({
      where: { exp_id: id }
    });

    if (!existingExpense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    // Check if expense title exists
    const expenseTitle = await prisma.expenseTitle.findUnique({
      where: { id: parseInt(exp_type) }
    });

    if (!expenseTitle) {
      return NextResponse.json({ error: 'Invalid expense type' }, { status: 400 });
    }

    const validatedUpdatedBy = await resolveUpdatedByUserId(request, updated_by, prisma);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Revert old account balances
      if (existingExpense.paid_from_account_id && parseFloat(existingExpense.cash_amount || 0) > 0) {
        const cashAcc = await tx.customer.findUnique({
          where: { cus_id: existingExpense.paid_from_account_id }
        });
        if (cashAcc) {
          await tx.customer.update({
            where: { cus_id: existingExpense.paid_from_account_id },
            data: { cus_balance: parseFloat(cashAcc.cus_balance || 0) + parseFloat(existingExpense.cash_amount) }
          });
        }
      }

      if (existingExpense.bank_account_id && parseFloat(existingExpense.bank_amount || 0) > 0) {
        const bankAcc = await tx.customer.findUnique({
          where: { cus_id: existingExpense.bank_account_id }
        });
        if (bankAcc) {
          await tx.customer.update({
            where: { cus_id: existingExpense.bank_account_id },
            data: { cus_balance: parseFloat(bankAcc.cus_balance || 0) + parseFloat(existingExpense.bank_amount) }
          });
        }
      }

      // 2. Delete old ledger entries for this expense
      await tx.ledger.deleteMany({
        where: { bill_no: `EXP-${id}` }
      });

      // 3. Update expense record
      const updatedExpense = await tx.expense.update({
        where: { exp_id: id },
        data: {
          exp_title: exp_title.trim(),
          exp_type: parseInt(exp_type),
          exp_detail: exp_detail?.trim() || null,
          exp_amount: expenseAmount,
          is_paid: true,
          paid_from_account_id: cashAmt > 0 ? parseInt(paid_from_account_id) : null,
          cash_amount: cashAmt,
          bank_account_id: bankAmt > 0 ? parseInt(bank_account_id) : null,
          bank_amount: bankAmt,
          payment_date: new Date(),
          payment_reference: payment_reference || null,
          updated_by: validatedUpdatedBy
        },
        include: {
          expense_title: true,
          updated_by_user: {
            select: {
              full_name: true,
              role: true
            }
          }
        }
      });

      // Fetch accounts to apply new balance adjustments (with updated balance post-reversal)
      let cashAccount = null;
      let bankAccount = null;

      if (cashAmt > 0) {
        cashAccount = await tx.customer.findUnique({
          where: { cus_id: parseInt(paid_from_account_id) }
        });
        if (!cashAccount) throw new Error('Cash account not found');
      }

      if (bankAmt > 0) {
        bankAccount = await tx.customer.findUnique({
          where: { cus_id: parseInt(bank_account_id) }
        });
        if (!bankAccount) throw new Error('Bank account not found');
      }

      const billNo = `EXP-${id}`;
      const ledgerWriteCount = (cashAmt > 0 ? 1 : 0) + (bankAmt > 0 ? 1 : 0);
      let nextLedgerId = ledgerWriteCount > 0 ? await getNextId('ledger', 'l_id', tx) : null;

      if (cashAmt > 0 && cashAccount) {
        await writeExpenseLedgerEntry(tx, {
          account: cashAccount,
          amount: cashAmt,
          billNo,
          trnxType: 'CASH_PAYMENT',
          details: `Payment for ${updatedExpense.expense_title?.title || 'Expense'}: ${updatedExpense.exp_title}${paymentMethod === 'PARTIAL' ? ' (Partial cash payment)' : ''}${payment_reference ? ` - Ref: ${payment_reference}` : ''}`,
          updatedBy: validatedUpdatedBy,
          lId: nextLedgerId,
          cashPayment: cashAmt,
          bankPayment: 0,
        });
        nextLedgerId += 1;
      }

      if (bankAmt > 0 && bankAccount) {
        const activeBank =
          cashAccount && cashAccount.cus_id === bankAccount.cus_id
            ? await tx.customer.findUnique({ where: { cus_id: bankAccount.cus_id } })
            : bankAccount;
        if (!activeBank) throw new Error('Bank account not found');

        await writeExpenseLedgerEntry(tx, {
          account: activeBank,
          amount: bankAmt,
          billNo,
          trnxType: 'BANK_PAYMENT',
          details: `Payment for ${updatedExpense.expense_title?.title || 'Expense'}: ${updatedExpense.exp_title}${paymentMethod === 'PARTIAL' ? ' (Partial bank payment)' : ''}${payment_reference ? ` - Ref: ${payment_reference}` : ''}`,
          updatedBy: validatedUpdatedBy,
          lId: nextLedgerId,
          cashPayment: 0,
          bankPayment: bankAmt,
        });
      }

      return updatedExpense;
    }, EXPENSE_TX_OPTIONS);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating expense:', error);
    return NextResponse.json(
      { error: `Failed to update expense: ${error.message}` },
      { status: 500 }
    );
  }
}

// DELETE - Delete expense (reverts ledger entries/balances if paid)
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (!id) {
      return NextResponse.json({ error: 'Expense ID is required' }, { status: 400 });
    }

    // Get expense
    const expense = await prisma.expense.findUnique({
      where: { exp_id: id }
    });

    if (!expense) {
      return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // Revert Cash balance
      if (expense.paid_from_account_id && parseFloat(expense.cash_amount || 0) > 0) {
        const cashAcc = await tx.customer.findUnique({
          where: { cus_id: expense.paid_from_account_id }
        });
        if (cashAcc) {
          await tx.customer.update({
            where: { cus_id: expense.paid_from_account_id },
            data: { cus_balance: parseFloat(cashAcc.cus_balance || 0) + parseFloat(expense.cash_amount) }
          });
        }
      }

      // Revert Bank balance
      if (expense.bank_account_id && parseFloat(expense.bank_amount || 0) > 0) {
        const bankAcc = await tx.customer.findUnique({
          where: { cus_id: expense.bank_account_id }
        });
        if (bankAcc) {
          await tx.customer.update({
            where: { cus_id: expense.bank_account_id },
            data: { cus_balance: parseFloat(bankAcc.cus_balance || 0) + parseFloat(expense.bank_amount) }
          });
        }
      }

      // Delete ledger entries
      await tx.ledger.deleteMany({
        where: { bill_no: `EXP-${id}` }
      });

      // Delete expense
      await tx.expense.delete({
        where: { exp_id: id }
      });
    }, EXPENSE_TX_OPTIONS);

    return NextResponse.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    return NextResponse.json(
      { error: `Failed to delete expense: ${error.message}` },
      { status: 500 }
    );
  }
}
