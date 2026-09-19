import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';
import { pkBusinessDate } from '@/lib/date-helper';


// GET - Fetch day end history with pagination and filtering
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');

    const skip = (page - 1) * limit;

    // Build where clause
    const whereClause = { branch_id: branchId };
    
    if (startDate && endDate) {
      whereClause.business_date = {
        gte: pkBusinessDate(startDate),
        lte: pkBusinessDate(endDate),
      };
    } else if (startDate) {
      whereClause.business_date = {
        gte: pkBusinessDate(startDate),
      };
    } else if (endDate) {
      whereClause.business_date = {
        lte: pkBusinessDate(endDate),
      };
    }

    if (status) {
      whereClause.status = status;
    } else {
      whereClause.OR = [
        { status: 'CLOSED' },
        { closed_at: { not: null } },
        { closing_cash: { not: null } },
      ];
    }

    // Get day ends with pagination
    const [dayEnds, totalCount] = await Promise.all([
      prisma.dayEnd.findMany({
        where: whereClause,
        include: {
          closed_by_user: {
            select: {
              full_name: true,
              role: true
            }
          },
          _count: {
            select: {
              day_end_details: true
            }
          }
        },
        orderBy: {
          business_date: 'desc'
        },
        skip,
        take: limit
      }),
      prisma.dayEnd.count({
        where: whereClause
      })
    ]);

    // Calculate summary statistics
    const summary = await prisma.dayEnd.aggregate({
      where: whereClause,
      _sum: {
        total_sales: true,
        total_purchases: true,
        total_expenses: true,
        total_receipts: true,
        total_payments: true,
        opening_cash: true,
        closing_cash: true
      },
      _avg: {
        total_sales: true,
        total_purchases: true,
        total_expenses: true,
        total_receipts: true,
        total_payments: true
      }
    });

    return NextResponse.json({
      dayEnds,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
        hasNext: page * limit < totalCount,
        hasPrev: page > 1
      },
      summary: {
        totalDays: totalCount,
        totalSales: summary._sum.total_sales || 0,
        totalPurchases: summary._sum.total_purchases || 0,
        totalExpenses: summary._sum.total_expenses || 0,
        totalReceipts: summary._sum.total_receipts || 0,
        totalPayments: summary._sum.total_payments || 0,
        totalOpeningCash: summary._sum.opening_cash || 0,
        totalClosingCash: summary._sum.closing_cash || 0,
        averageSales: summary._avg.total_sales || 0,
        averagePurchases: summary._avg.total_purchases || 0,
        averageExpenses: summary._avg.total_expenses || 0
      }
    });
  } catch (error) {
    console.error('Error fetching day end history:', error);
    return NextResponse.json({ error: 'Failed to fetch day end history' }, { status: 500 });
  }
}


