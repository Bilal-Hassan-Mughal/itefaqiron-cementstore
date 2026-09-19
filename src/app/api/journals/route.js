import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';
import { rejectIfDayClosed } from '@/lib/day-end-guard';


// GET - Fetch all journals with related data
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    if (id) {
      // Fetch single journal
      const journal = await prisma.journal.findUnique({
        where: { journal_id: id },
        include: {
          journal_details: {
            include: {
              account: {
                select: {
                  cus_id: true,
                  cus_name: true,
                  cus_phone_no: true
                }
              }
            }
          },
          created_by_user: {
            select: {
              full_name: true,
              role: true
            }
          },
          posted_by_user: {
            select: {
              full_name: true,
              role: true
            }
          }
        }
      });

      if (!journal) {
        return NextResponse.json({ error: 'Journal not found' }, { status: 404 });
      }

      return NextResponse.json(journal);
    } else {
      // Fetch all journals with optional filters
      const whereClause = {};
      
      if (status) {
        whereClause.status = status;
      }
      
      if (type) {
        whereClause.journal_type = type;
      }

      const journals = await prisma.journal.findMany({
        where: whereClause,
        include: {
          journal_details: {
            include: {
              account: {
                select: {
                  cus_id: true,
                  cus_name: true,
                  cus_phone_no: true
                }
              }
            }
          },
          created_by_user: {
            select: {
              full_name: true,
              role: true
            }
          },
          posted_by_user: {
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

      return NextResponse.json(journals);
    }
  } catch (error) {
    console.error('Error fetching journals:', error);
    return NextResponse.json({ error: 'Failed to fetch journals' }, { status: 500 });
  }
}

// POST - Create new journal entry
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const {
      journal_date,
      journal_type,
      reference,
      description,
      total_amount,
      journal_details,
      created_by
    } = body;

    // Validate required fields
    if (!journal_date || !journal_type || !total_amount || !journal_details || journal_details.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate journal details (must have at least one debit and one credit)
    const totalDebits = journal_details.reduce((sum, detail) => sum + parseFloat(detail.debit_amount || 0), 0);
    const totalCredits = journal_details.reduce((sum, detail) => sum + parseFloat(detail.credit_amount || 0), 0);

    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json({ error: 'Total debits must equal total credits' }, { status: 400 });
    }

    if (totalDebits === 0 || totalCredits === 0) {
      return NextResponse.json({ error: 'Journal must have both debit and credit entries' }, { status: 400 });
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Create journal
      const journal = await tx.journal.create({
        data: {
          journal_date: new Date(journal_date),
          journal_type,
          reference: reference || null,
          description: description || null,
          total_amount: parseFloat(total_amount),
          created_by
        }
      });

      // Create journal details
      const journalDetailPromises = journal_details.map(detail => 
        tx.journalDetail.create({
          data: {
            journal_id: journal.journal_id,
            account_id: detail.account_id,
            debit_amount: parseFloat(detail.debit_amount || 0),
            credit_amount: parseFloat(detail.credit_amount || 0),
            description: detail.description || null
          }
        })
      );

      await Promise.all(journalDetailPromises);

      return journal;
    }, {
      timeout: 15000
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating journal:', error);
    return NextResponse.json({ error: 'Failed to create journal' }, { status: 500 });
  }
}

// PUT - Update journal entry
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const body = await request.json();
    const {
      journal_id,
      journal_date,
      journal_type,
      reference,
      description,
      total_amount,
      journal_details,
      status,
      posted_by
    } = body;

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
        throw new Error('Cannot modify posted journal entries');
      }

      // Delete existing journal details
      await tx.journalDetail.deleteMany({
        where: { journal_id }
      });

      // Update journal
      const journal = await tx.journal.update({
        where: { journal_id },
        data: {
          journal_date: journal_date ? new Date(journal_date) : existingJournal.journal_date,
          journal_type: journal_type || existingJournal.journal_type,
          reference: reference || existingJournal.reference,
          description: description || existingJournal.description,
          total_amount: total_amount ? parseFloat(total_amount) : existingJournal.total_amount,
          status: status || existingJournal.status,
          posted_by: status === 'POSTED' ? posted_by : existingJournal.posted_by,
          posted_at: status === 'POSTED' ? new Date() : existingJournal.posted_at
        }
      });

      // Create new journal details
      if (journal_details && journal_details.length > 0) {
        const journalDetailPromises = journal_details.map(detail => 
          tx.journalDetail.create({
            data: {
              journal_id: journal.journal_id,
              account_id: detail.account_id,
              debit_amount: parseFloat(detail.debit_amount || 0),
              credit_amount: parseFloat(detail.credit_amount || 0),
              description: detail.description || null
            }
          })
        );

        await Promise.all(journalDetailPromises);
      }

      return journal;
    }, {
      timeout: 15000
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating journal:', error);
    return NextResponse.json({ error: 'Failed to update journal' }, { status: 500 });
  }
}

// DELETE - Delete journal entry
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const dayClosed = await rejectIfDayClosed();
  if (dayClosed) return dayClosed;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (!id) {
      return NextResponse.json({ error: 'Journal ID is required' }, { status: 400 });
    }

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Get existing journal
      const existingJournal = await tx.journal.findUnique({
        where: { journal_id: id }
      });

      if (!existingJournal) {
        throw new Error('Journal not found');
      }

      if (existingJournal.status === 'POSTED') {
        throw new Error('Cannot delete posted journal entries');
      }

      // Delete journal details (cascade should handle this, but being explicit)
      await tx.journalDetail.deleteMany({
        where: { journal_id: id }
      });

      // Delete journal
      await tx.journal.delete({
        where: { journal_id: id }
      });
    }, {
      timeout: 15000
    });

    return NextResponse.json({ message: 'Journal deleted successfully' });
  } catch (error) {
    console.error('Error deleting journal:', error);
    return NextResponse.json({ error: 'Failed to delete journal' }, { status: 500 });
  }
}


