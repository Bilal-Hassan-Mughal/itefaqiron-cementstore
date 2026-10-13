import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';

export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  const { searchParams } = new URL(request.url);
  const fromDate  = searchParams.get('fromDate');
  const toDate    = searchParams.get('toDate');
  const cusCatId  = searchParams.get('cusCatId')  ? parseInt(searchParams.get('cusCatId'))  : null;
  const supCatId  = searchParams.get('supCatId')  ? parseInt(searchParams.get('supCatId'))  : null;

  try {
    const allCategories = await prisma.customerCategory.findMany({
      select: { cus_cat_id: true, cus_cat_title: true }
    });
    const catMap = new Map(allCategories.map(c => [c.cus_cat_id, (c.cus_cat_title || '').toLowerCase()]));

    const customers = await prisma.customer.findMany({
      select: {
        cus_id: true,
        cus_name: true,
        cus_balance: true,
        cus_category: true,
        customer_category: { select: { cus_cat_title: true } },
      },
    });

    // If toDate given, compute closing balance as of that date
    let balancesAsOf = null;
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);

      // Raw query to get the latest closing balance for each customer as of 'to' date
      const latestEntries = await prisma.$queryRaw`
        SELECT l.cus_id, l.closing_balance
        FROM ledger l
        INNER JOIN (
          SELECT cus_id, MAX(l_id) AS max_l_id
          FROM ledger
          WHERE created_at <= ${to}
          GROUP BY cus_id
        ) latest ON l.l_id = latest.max_l_id
      `;

      balancesAsOf = new Map(
        latestEntries.map((e) => [e.cus_id, parseFloat(e.closing_balance || 0)])
      );
    }

    const customerList = [];
    const supplierList = [];

    customers.forEach((c) => {
      const catTitle =
        catMap.get(c.cus_category) || (c.customer_category?.cus_cat_title || '').toLowerCase();
      const isSupplier = catTitle.includes('supplier');
      const isCashOrBank = catTitle.includes('cash') || catTitle.includes('bank');
      if (isCashOrBank) return;

      let balance;
      if (balancesAsOf) {
        // Use historical closing balance if available, otherwise 0
        balance = balancesAsOf.get(c.cus_id) ?? 0;
      } else {
        // Fallback to real-time balance if no toDate filter
        balance = parseFloat(c.cus_balance || 0);
      }

      if (balance === 0) return;

      // For suppliers, negative balance means we owe them (payable). 
      // But usually in this system, balances are stored such that positive is receivable, negative is payable?
      // Let's check computeMonthEndOutstanding logic: 
      // if (bal > 0) receivable += bal; else if (bal < 0) payable += Math.abs(bal);
      // So suppliers with negative balances are the ones we owe.
      
      const entry = {
        name: c.cus_name,
        balance: Math.abs(balance), // Graph shows absolute magnitude
        rawBalance: balance,
        categoryId: c.cus_category,
        categoryTitle: c.customer_category?.cus_cat_title || '',
      };

      if (isSupplier) {
        // Only show suppliers where we have a payable balance (negative)
        // or if they want to see all suppliers with any balance. 
        // User said: "current balance of suppleris account tham we have to pay"
        // This usually means rawBalance < 0.
        if (balance < 0) {
          if (!supCatId || c.cus_category === supCatId) supplierList.push(entry);
        }
      } else {
        // Only show customers who owe us (positive)
        if (balance > 0) {
          if (!cusCatId || c.cus_category === cusCatId) customerList.push(entry);
        }
      }
    });

    customerList.sort((a, b) => b.balance - a.balance);
    supplierList.sort((a, b) => b.balance - a.balance);

    return NextResponse.json({
      success: true,
      customers: customerList.slice(0, 15),
      suppliers: supplierList.slice(0, 15)
    });
  } catch (err) {
    console.error('Balance chart error:', err);
    return NextResponse.json({ error: 'Failed to fetch balance chart data' }, { status: 500 });
  }
}
