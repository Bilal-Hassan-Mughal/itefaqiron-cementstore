import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const accounts = await prisma.customer.findMany({
      where: {
        OR: [
          { customer_category: { cus_cat_title: { contains: 'bank' } } },
          { customer_type: { cus_type_title: { contains: 'bank' } } }
        ]
      },
      include: {
        customer_category: { select: { cus_cat_id: true, cus_cat_title: true } },
        customer_type: { select: { cus_type_id: true, cus_type_title: true } },
        city: { select: { city_id: true, city_name: true } }
      },
      orderBy: { cus_name: 'asc' }
    });

    let totalBalance = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let zeroCount = 0;

    const formattedAccounts = await Promise.all(
      accounts.map(async (acc) => {
        const bal = parseFloat(acc.cus_balance || 0);
        totalBalance += bal;

        if (bal > 0) positiveCount++;
        else if (bal < 0) negativeCount++;
        else zeroCount++;

        const lastLedger = await prisma.ledger.findFirst({
          where: { cus_id: acc.cus_id },
          orderBy: [
            { created_at: 'desc' },
            { l_id: 'desc' }
          ],
          select: { created_at: true, trnx_type: true }
        });

        return {
          cus_id: acc.cus_id,
          cus_name: acc.cus_name,
          cus_phone_no: acc.cus_phone_no,
          cus_balance: bal,
          category: acc.customer_category?.cus_cat_title || 'Bank',
          type: acc.customer_type?.cus_type_title || 'Bank',
          city: acc.city?.city_name || '',
          last_transaction_date: lastLedger?.created_at || acc.updated_at || null,
          last_trnx_type: lastLedger?.trnx_type || null
        };
      })
    );

    return NextResponse.json({
      accounts: formattedAccounts,
      summary: {
        totalAccounts: accounts.length,
        totalBalance,
        positiveCount,
        negativeCount,
        zeroCount
      }
    });
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    return NextResponse.json({ error: 'Failed to fetch bank accounts: ' + error.message }, { status: 500 });
  }
}
