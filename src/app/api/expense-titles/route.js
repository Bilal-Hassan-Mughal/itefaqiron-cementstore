import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope } from '@/lib/branch-server';

// GET - Fetch all expense titles
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;
    const listOnly = searchParams.get('list') === 'true';

    if (listOnly) {
      const expenseTitles = await prisma.expenseTitle.findMany({
        select: { id: true, title: true },
        orderBy: { title: 'asc' },
      });
      return NextResponse.json(expenseTitles);
    }

    if (id) {
      // Fetch single expense title
      const expenseTitle = await prisma.expenseTitle.findUnique({
        where: { id },
        include: {
          expenses: {
            include: {
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
          }
        }
      });

      if (!expenseTitle) {
        return NextResponse.json({ error: 'Expense title not found' }, { status: 404 });
      }

      return NextResponse.json(expenseTitle);
    } else {
      // Fetch all expense titles
      const expenseTitles = await prisma.expenseTitle.findMany({
        include: {
          expenses: {
            include: {
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
          }
        },
        orderBy: {
          created_at: 'desc'
        }
      });

      return NextResponse.json(expenseTitles);
    }
  } catch (error) {
    console.error('Error fetching expense titles:', error);
    return NextResponse.json({ error: 'Failed to fetch expense titles' }, { status: 500 });
  }
}

// POST - Create new expense title
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { title } = body;

    // Validate required fields
    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Check if title already exists
    const existingTitle = await prisma.expenseTitle.findUnique({
      where: { title: title.trim() }
    });

    if (existingTitle) {
      return NextResponse.json({ error: 'Expense title already exists' }, { status: 400 });
    }

    const idVal = body.id || await getNextId('expenseTitle', 'id');

    // Create expense title
    const expenseTitle = await prisma.expenseTitle.create({
      data: {
        id: idVal,
        title: title.trim()
      }
    });

    return NextResponse.json(expenseTitle, { status: 201 });
  } catch (error) {
    console.error('Error creating expense title:', error);
    return NextResponse.json({ error: 'Failed to create expense title' }, { status: 500 });
  }
}

// PUT - Update expense title
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { id, title } = body;

    if (!id) {
      return NextResponse.json({ error: 'Expense title ID is required' }, { status: 400 });
    }

    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    // Check if title already exists (excluding current record)
    const existingTitle = await prisma.expenseTitle.findFirst({
      where: {
        title: title.trim(),
        NOT: { id }
      }
    });

    if (existingTitle) {
      return NextResponse.json({ error: 'Expense title already exists' }, { status: 400 });
    }

    // Update expense title
    const expenseTitle = await prisma.expenseTitle.update({
      where: { id },
      data: {
        title: title.trim()
      }
    });

    return NextResponse.json(expenseTitle);
  } catch (error) {
    console.error('Error updating expense title:', error);
    return NextResponse.json({ error: 'Failed to update expense title' }, { status: 500 });
  }
}

// DELETE - Delete expense title
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (!id) {
      return NextResponse.json({ error: 'Expense title ID is required' }, { status: 400 });
    }

    // Check if expense title has associated expenses
    const expenseCount = await prisma.expense.count({
      where: { exp_type: id }
    });

    if (expenseCount > 0) {
      return NextResponse.json({ 
        error: `Cannot delete expense title. It has ${expenseCount} associated expense(s). Please delete the expenses first.` 
      }, { status: 400 });
    }

    // Delete expense title
    await prisma.expenseTitle.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Expense title deleted successfully' });
  } catch (error) {
    console.error('Error deleting expense title:', error);
    return NextResponse.json({ error: 'Failed to delete expense title' }, { status: 500 });
  }
}
