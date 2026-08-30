import { NextResponse } from 'next/server';
import { centralPrisma, parseUserFromRequest } from '@/lib/branch-server';
import { isHqUser } from '@/lib/branch-roles';

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseDateRange(fromDate, toDate) {
  if (!fromDate && !toDate) return null;
  const tz = '+05:00';
  const range = {};
  if (fromDate) range.gte = new Date(`${fromDate}T00:00:00.000${tz}`);
  if (toDate) range.lte = new Date(`${toDate}T23:59:59.999${tz}`);
  return range;
}

function num(v) {
  if (v == null) return 0;
  return typeof v === 'object' && v.toNumber ? v.toNumber() : Number(v) || 0;
}

function fmtSaleRow(s) {
  return {
    id: s.sale_id,
    branch_id: s.branch_id,
    branch_code: s.branch?.branch_code || '—',
    branch_name: s.branch?.branch_name || '—',
    date: s.created_at,
    customer: s.customer?.cus_name || '—',
    amount: num(s.total_amount),
    net: num(s.total_amount) - num(s.discount),
    discount: num(s.discount),
    payment: num(s.payment),
    bill_type: s.bill_type,
    bill_number: s.bill_number,
    payment_type: s.payment_type,
  };
}

function fmtPurchaseRow(p) {
  return {
    id: p.pur_id,
    branch_id: p.branch_id,
    branch_code: p.branch?.branch_code || '—',
    branch_name: p.branch?.branch_name || '—',
    date: p.created_at,
    supplier: p.customer?.cus_name || '—',
    amount: num(p.total_amount),
    net_total: num(p.net_total),
    discount: num(p.discount),
    payment: num(p.payment),
    payment_type: p.payment_type,
    invoice_number: p.invoice_number || '—',
    vehicle_no: p.vehicle_no || '—',
  };
}

function fmtStockRow(st) {
  const qty = num(st.stock_quantity);
  const min = num(st.min_stock);
  let status = 'OK';
  if (qty <= 0) status = 'OUT';
  else if (min > 0 && qty <= min) status = 'LOW';

  return {
    id: st.store_stock_id,
    branch_id: st.store?.branch_id,
    branch_code: st.store?.branch?.branch_code || '—',
    branch_name: st.store?.branch?.branch_name || '—',
    store_name: st.store?.store_name || '—',
    product_id: st.pro_id,
    product_name: st.product?.pro_title || '—',
    unit: st.product?.pro_unit || '—',
    quantity: qty,
    min_stock: min,
    max_stock: num(st.max_stock),
    status,
    updated_at: st.updated_at,
  };
}

/** GET — HQ cross-branch sales, purchase, stock reports */
export async function GET(request) {
  const user = parseUserFromRequest(request);
  if (!user || !isHqUser(user)) {
    return errorResponse('Head Office access required', 403);
  }

  try {
    const { searchParams } = new URL(request.url);
    const branchIdParam = searchParams.get('branch_id');
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';
    const branchId =
      branchIdParam && branchIdParam !== 'ALL' ? parseInt(branchIdParam, 10) : null;

    const dateRange = parseDateRange(fromDate, toDate);

    const branchWhere = branchId ? { branch_id: branchId } : {};
    const saleWhere = { ...branchWhere };
    const purchaseWhere = { ...branchWhere };
    if (dateRange) {
      saleWhere.created_at = dateRange;
      purchaseWhere.created_at = dateRange;
    }

    const storeFilter = branchId ? { branch_id: branchId } : {};

    const [branches, sales, purchases, stockRows, salesAgg, purchaseAgg] = await Promise.all([
      centralPrisma.branch.findMany({
        where: branchId ? { branch_id: branchId } : undefined,
        orderBy: { branch_id: 'asc' },
        select: {
          branch_id: true,
          branch_code: true,
          branch_name: true,
          status: true,
        },
      }),
      centralPrisma.sale.findMany({
        where: saleWhere,
        include: {
          branch: { select: { branch_code: true, branch_name: true } },
          customer: { select: { cus_name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 500,
      }),
      centralPrisma.purchase.findMany({
        where: purchaseWhere,
        include: {
          branch: { select: { branch_code: true, branch_name: true } },
          customer: { select: { cus_name: true } },
        },
        orderBy: { created_at: 'desc' },
        take: 500,
      }),
      centralPrisma.storeStock.findMany({
        where: { store: storeFilter },
        include: {
          product: { select: { pro_title: true, pro_unit: true } },
          store: {
            select: {
              store_name: true,
              branch_id: true,
              branch: { select: { branch_code: true, branch_name: true } },
            },
          },
        },
        orderBy: { stock_quantity: 'desc' },
        take: 500,
      }),
      centralPrisma.sale.groupBy({
        by: ['branch_id'],
        where: saleWhere,
        _count: { sale_id: true },
        _sum: { total_amount: true },
      }),
      centralPrisma.purchase.groupBy({
        by: ['branch_id'],
        where: purchaseWhere,
        _count: { pur_id: true },
        _sum: { net_total: true },
      }),
    ]);

    const salesList = sales.map(fmtSaleRow);
    const purchasesList = purchases.map(fmtPurchaseRow);
    const stockList = stockRows.map(fmtStockRow);

    const byBranch = branches.map((b) => {
      const sAgg = salesAgg.find((a) => a.branch_id === b.branch_id);
      const pAgg = purchaseAgg.find((a) => a.branch_id === b.branch_id);
      const branchStock = stockList.filter((s) => s.branch_id === b.branch_id);
      const stockQty = branchStock.reduce((sum, s) => sum + s.quantity, 0);
      return {
        branch_id: b.branch_id,
        branch_code: b.branch_code,
        branch_name: b.branch_name,
        status: b.status,
        sales_count: sAgg?._count?.sale_id ?? 0,
        sales_amount: num(sAgg?._sum?.total_amount),
        purchase_count: pAgg?._count?.pur_id ?? 0,
        purchase_amount: num(pAgg?._sum?.net_total),
        stock_items: branchStock.length,
        stock_qty: stockQty,
        low_stock: branchStock.filter((s) => s.status === 'LOW' || s.status === 'OUT').length,
      };
    });

    const summary = {
      sales_count: salesList.length,
      sales_amount: salesList.reduce((s, r) => s + r.amount, 0),
      sales_total_records: salesAgg.reduce((s, a) => s + (a._count?.sale_id || 0), 0),
      purchase_count: purchasesList.length,
      purchase_amount: purchasesList.reduce((s, r) => s + r.net_total, 0),
      purchase_total_records: purchaseAgg.reduce((s, a) => s + (a._count?.pur_id || 0), 0),
      stock_items: stockList.length,
      stock_qty: stockList.reduce((s, r) => s + r.quantity, 0),
      low_stock_items: stockList.filter((s) => s.status === 'LOW' || s.status === 'OUT').length,
      branches: branches.length,
    };

    return NextResponse.json({
      summary,
      by_branch: byBranch,
      sales: salesList,
      purchases: purchasesList,
      stock: stockList,
      filters: { branch_id: branchId, fromDate, toDate },
      branch_options: branches,
    });
  } catch (err) {
    console.error('GET /api/branches/hq-reports', err);
    return errorResponse('Failed to load HQ reports', 500);
  }
}
