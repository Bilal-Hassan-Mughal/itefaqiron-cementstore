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
        customer_category: { select: { cus_cat_title: true } }
      }
    });

    // If date range given, compute net activity per customer from ledger entries
    let ledgerSums = null;
    if (fromDate || toDate) {
      const dateFilter = {};
      if (fromDate) dateFilter.gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        dateFilter.lte = to;
      }

      const entries = await prisma.ledger.groupBy({
        by: ['cus_id'],
        where: { created_at: dateFilter },
        _sum: { debit_amount: true, credit_amount: true }
      });

      ledgerSums = new Map(entries.map(e => [
        e.cus_id,
        {
          debit:  parseFloat(e._sum.debit_amount  || 0),
          credit: parseFloat(e._sum.credit_amount || 0)
        }
      ]));
    }

    const customerList = [];
    const supplierList = [];

    customers.forEach(c => {
      const catTitle = catMap.get(c.cus_category) || (c.customer_category?.cus_cat_title || '').toLowerCase();
      const isSupplier  = catTitle.includes('supplier');
      const isCashOrBank = catTitle.includes('cash') || catTitle.includes('bank');
      if (isCashOrBank) return;

      let balance;
      if (ledgerSums) {
        const s = ledgerSums.get(c.cus_id) || { debit: 0, credit: 0 };
        // PAYABLE (suppliers): credit - debit = net owed to supplier
        // RECEIVABLE (customers): debit - credit = net owed by customer
        balance = isSupplier ? (s.credit - s.debit) : (s.debit - s.credit);
      } else {
        balance = parseFloat(c.cus_balance || 0);
      }

      if (balance === 0) return;

      const entry = {
        name:          c.cus_name,
        balance:       Math.abs(balance),
        rawBalance:    balance,
        categoryId:    c.cus_category,
        categoryTitle: c.customer_category?.cus_cat_title || ''
      };

      if (isSupplier) {
        if (!supCatId || c.cus_category === supCatId) supplierList.push(entry);
      } else {
        if (!cusCatId || c.cus_category === cusCatId) customerList.push(entry);
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
