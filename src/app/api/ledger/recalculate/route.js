import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { ACCOUNT_NATURE, calculateClosingBalance } from '@/lib/ledger-helper';
import { initBranchScope } from '@/lib/branch-server';

const compareChronologically = (a, b) => {
  const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
  if (timeA !== timeB) return timeA - timeB;

  const billA = parseInt(a.bill_no) || 0;
  const billB = parseInt(b.bill_no) || 0;
  if (billA !== billB) return billA - billB;

  return (a.l_id || 0) - (b.l_id || 0);
};

export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const cus_id = parseInt(body.cus_id);

    if (!cus_id || isNaN(cus_id)) {
      return NextResponse.json({ success: false, error: 'cus_id is required' }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({
      where: { cus_id },
      include: { customer_category: true }
    });

    if (!customer) {
      return NextResponse.json({ success: false, error: 'Customer not found' }, { status: 404 });
    }

    const catTitle = (customer.customer_category?.cus_cat_title || '').toLowerCase();
    const isSupplier = catTitle.includes('supplier') || catTitle.includes('creditor');
    const accountNature = isSupplier ? ACCOUNT_NATURE.PAYABLE : ACCOUNT_NATURE.RECEIVABLE;

    const rawEntries = await prisma.ledger.findMany({
      where: { cus_id }
    });

    if (rawEntries.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No ledger entries found for this customer.',
        updatedCount: 0,
        finalBalance: customer.cus_balance
      });
    }

    const sortedEntries = [...rawEntries].sort(compareChronologically);

    let currentBalance = parseFloat(sortedEntries[0].opening_balance || 0);
    const updates = [];

    for (let i = 0; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];
      const opening = currentBalance;
      const debit = parseFloat(entry.debit_amount || 0);
      const credit = parseFloat(entry.credit_amount || 0);
      const closing = Number((opening + debit - credit).toFixed(2));

      updates.push({
        l_id: entry.l_id,
        new_opening: opening,
        new_closing: closing
      });

      currentBalance = closing;
    }

    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        await tx.ledger.update({
          where: { l_id: update.l_id },
          data: {
            opening_balance: update.new_opening,
            closing_balance: update.new_closing
          }
        });
      }

      await tx.customer.update({
        where: { cus_id },
        data: {
          cus_balance: currentBalance
        }
      });
    }, { timeout: 60000, maxWait: 10000 });

    return NextResponse.json({
      success: true,
      cus_id,
      customer_name: customer.cus_name,
      updatedEntriesCount: updates.length,
      previousBalance: customer.cus_balance,
      newCorrectedBalance: currentBalance
    });
  } catch (error) {
    console.error('Error recalculating customer ledger:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
