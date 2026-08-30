import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope } from '@/lib/branch-server';

// POST - Post journal entry (change status from DRAFT to POSTED)
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { journal_id, posted_by } = body;

    if (!journal_id) {
      return NextResponse.json({ error: 'Journal ID is required' }, { status: 400 });
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get existing journal
      const existingJournal = await tx.journal.findUnique({
        where: { journal_id },
        include: {
          journal_details: true
        }
      });

      if (!existingJournal) {
        throw new Error('Journal not found');
      }

      if (existingJournal.status === 'POSTED') {
        throw new Error('Journal is already posted');
      }

      if (existingJournal.status === 'CANCELLED') {
        throw new Error('Cannot post cancelled journal');
      }

      // Validate journal details (must have at least one debit and one credit)
      const totalDebits = existingJournal.journal_details.reduce((sum, detail) => sum + parseFloat(detail.debit_amount), 0);
      const totalCredits = existingJournal.journal_details.reduce((sum, detail) => sum + parseFloat(detail.credit_amount), 0);

      if (Math.abs(totalDebits - totalCredits) > 0.01) {
        throw new Error('Total debits must equal total credits');
      }

      if (totalDebits === 0 || totalCredits === 0) {
        throw new Error('Journal must have both debit and credit entries');
      }

      // Update journal status to POSTED
      const journal = await tx.journal.update({
        where: { journal_id },
        data: {
          status: 'POSTED',
          posted_by,
          posted_at: new Date()
        }
      });

      // Create ledger entries for each journal detail
      for (const detail of existingJournal.journal_details) {
        // Get customer's current balance
        const customer = await tx.customer.findUnique({
          where: { cus_id: detail.account_id }
        });

        if (!customer) {
          throw new Error(`Customer with ID ${detail.account_id} not found`);
        }

        // Create ledger entry for debit
        if (detail.debit_amount > 0) {
          const l_id_j_dr = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: l_id_j_dr,
              cus_id: detail.account_id,
              opening_balance: customer.cus_balance,
              debit_amount: parseFloat(detail.debit_amount),
              credit_amount: 0,
              closing_balance: customer.cus_balance + parseFloat(detail.debit_amount),
              bill_no: `JRN-${journal.journal_id}`,
              trnx_type: 'CASH',
              ledger_type: 'Journal',
              details: detail.description || `Journal Entry - ${journal.journal_type}`,
              payments: 0,
              updated_by: posted_by
            }
          });

          // Update customer balance
          await tx.customer.update({
            where: { cus_id: detail.account_id },
            data: {
              cus_balance: customer.cus_balance + parseFloat(detail.debit_amount)
            }
          });
        }

        // Create ledger entry for credit
        if (detail.credit_amount > 0) {
          const l_id_j_cr = await getNextId('ledger', 'l_id', tx);
          await tx.ledger.create({
            data: {
              l_id: l_id_j_cr,
              cus_id: detail.account_id,
              opening_balance: customer.cus_balance,
              debit_amount: 0,
              credit_amount: parseFloat(detail.credit_amount),
              closing_balance: customer.cus_balance - parseFloat(detail.credit_amount),
              bill_no: `JRN-${journal.journal_id}`,
              trnx_type: 'CASH',
              ledger_type: 'Journal',
              details: detail.description || `Journal Entry - ${journal.journal_type}`,
              payments: parseFloat(detail.credit_amount),
              updated_by: posted_by
            }
          });

          // Update customer balance
          await tx.customer.update({
            where: { cus_id: detail.account_id },
            data: {
              cus_balance: customer.cus_balance - parseFloat(detail.credit_amount)
            }
          });
        }
      }

      return journal;
    }, {
      timeout: 15000
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error posting journal:', error);
    return NextResponse.json({ error: 'Failed to post journal' }, { status: 500 });
  }
}


