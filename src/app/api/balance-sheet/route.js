import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';


// GET - Generate balance sheet data
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    // Get all customers with their current balances
    const customers = await prisma.customer.findMany({
      select: {
        cus_id: true,
        cus_name: true,
        cus_balance: true,
        cus_category: true,
        cus_type: true,
        created_at: true
      },
      orderBy: {
        cus_balance: 'desc'
      }
    });

    // Calculate totals
    const totalAssets = customers
      .filter(c => c.cus_balance > 0)
      .reduce((sum, c) => sum + parseFloat(c.cus_balance), 0);

    const totalLiabilities = Math.abs(customers
      .filter(c => c.cus_balance < 0)
      .reduce((sum, c) => sum + parseFloat(c.cus_balance), 0));

    // Get sales data for the date
    const salesData = await prisma.sale.findMany({
      where: {
        created_at: {
          gte: new Date(date + 'T00:00:00.000Z'),
          lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000)
        }
      },
      select: {
        total_amount: true,
        payment_type: true
      }
    });

    // Get purchase data for the date
    const purchaseData = await prisma.purchase.findMany({
      where: {
        created_at: {
          gte: new Date(date + 'T00:00:00.000Z'),
          lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000)
        }
      },
      select: {
        total_amount: true,
        payment_type: true
      }
    });

    // Get expense data for the date
    const expenseData = await prisma.expense.findMany({
      where: {
        created_at: {
          gte: new Date(date + 'T00:00:00.000Z'),
          lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000)
        }
      },
      select: {
        exp_amount: true
      }
    });

    // Get journal entries for the date
    const journalData = await prisma.journal.findMany({
      where: {
        journal_date: {
          gte: new Date(date + 'T00:00:00.000Z'),
          lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000)
        },
        status: 'POSTED'
      },
      include: {
        journal_details: {
          include: {
            account: {
              select: {
                cus_name: true
              }
            }
          }
        }
      }
    });

    // Calculate daily cash flow
    const totalSales = salesData.reduce((sum, s) => sum + parseFloat(s.total_amount), 0);
    const totalPurchases = purchaseData.reduce((sum, p) => sum + parseFloat(p.total_amount), 0);
    const totalExpenses = expenseData.reduce((sum, e) => sum + parseFloat(e.exp_amount), 0);

    // Calculate cash sales and purchases
    const cashSales = salesData
      .filter(s => s.payment_type === 'CASH')
      .reduce((sum, s) => sum + parseFloat(s.total_amount), 0);

    const cashPurchases = purchaseData
      .filter(p => p.payment_type === 'CASH')
      .reduce((sum, p) => sum + parseFloat(p.total_amount), 0);

    const cashExpenses = totalExpenses;

    // Calculate net cash flow
    const netCashFlow = cashSales - cashPurchases - cashExpenses;

    // Get day end data
    const dayEndData = await prisma.dayEnd.findUnique({
      where: {
        business_date: new Date(date)
      }
    });

    // Organize balance sheet data
    const balanceSheet = {
      date: date,
      assets: {
        currentAssets: {
          cash: dayEndData?.closing_cash || 0,
          accountsReceivable: totalAssets,
          total: (dayEndData?.closing_cash || 0) + totalAssets
        },
        totalAssets: (dayEndData?.closing_cash || 0) + totalAssets
      },
      liabilities: {
        accountsPayable: totalLiabilities,
        totalLiabilities: totalLiabilities
      },
      equity: {
        retainedEarnings: ((dayEndData?.closing_cash || 0) + totalAssets) - totalLiabilities,
        totalEquity: ((dayEndData?.closing_cash || 0) + totalAssets) - totalLiabilities
      }
    };

    // Daily transaction summary
    const dailySummary = {
      sales: {
        total: totalSales,
        cash: cashSales,
        credit: totalSales - cashSales,
        count: salesData.length
      },
      purchases: {
        total: totalPurchases,
        cash: cashPurchases,
        credit: totalPurchases - cashPurchases,
        count: purchaseData.length
      },
      expenses: {
        total: totalExpenses,
        cash: cashExpenses,
        credit: totalExpenses - cashExpenses,
        count: expenseData.length
      },
      cashFlow: {
        opening: dayEndData?.opening_cash || 0,
        closing: dayEndData?.closing_cash || 0,
        net: netCashFlow
      },
      journals: {
        count: journalData.length,
        entries: journalData
      }
    };

    return NextResponse.json({
      balanceSheet,
      dailySummary,
      customers: customers.map(c => ({
        ...c,
        cus_balance: parseFloat(c.cus_balance)
      }))
    });

  } catch (error) {
    console.error('Error generating balance sheet:', error);
    return NextResponse.json({ error: 'Failed to generate balance sheet' }, { status: 500 });
  }
}


