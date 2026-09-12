import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope, mergeBranchWhere } from '@/lib/branch-server';

export const dynamic = 'force-dynamic';

function parseQty(val) {
  const n = parseFloat(String(val ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function normalizeThreshold(val) {
  const n = parseFloat(String(val ?? 10));
  if (!Number.isFinite(n) || n <= 0) return 10;
  return n;
}

function normalizeUnit(unit) {
  if (!unit) return '—';
  const s = String(unit).trim();
  if (!s || s.toUpperCase() === 'NULL') return '—';
  return s;
}

export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  const branchId = __branchScope.branchId;

  try {
    const products = await prisma.product.findMany({
      where: mergeBranchWhere(branchId, {}),
      select: {
        pro_id: true,
        pro_title: true,
        pro_unit: true,
        low_stock_quantity: true,
        category: { select: { cat_name: true } },
        store_stocks: {
          select: {
            store_id: true,
            stock_quantity: true,
            store: { select: { store_name: true } },
          },
        },
      },
      orderBy: { pro_title: 'asc' },
    });

    const items = [];

    for (const product of products) {
      const threshold = normalizeThreshold(product.low_stock_quantity);
      const storeLines = (product.store_stocks || []).map((ss) => ({
        store_id: ss.store_id,
        store_name: ss.store?.store_name || `Store #${ss.store_id}`,
        quantity: parseQty(ss.stock_quantity),
      }));

      const totalQty = storeLines.reduce((sum, s) => sum + s.quantity, 0);

      if (totalQty < 0) continue;

      let status;
      if (totalQty === 0) status = 'OUT';
      else if (totalQty <= threshold) status = 'LOW';
      else continue;

      const storeBreakdown = storeLines
        .map((s) => `${s.store_name}: ${s.quantity}`)
        .join(' | ');

      items.push({
        pro_id: product.pro_id,
        pro_title: product.pro_title || '—',
        category: product.category?.cat_name || '—',
        pro_unit: normalizeUnit(product.pro_unit),
        total_qty: totalQty,
        threshold,
        status,
        store_breakdown: storeBreakdown || '—',
        stores: storeLines,
      });
    }

    items.sort((a, b) => {
      if (a.status === 'OUT' && b.status !== 'OUT') return -1;
      if (b.status === 'OUT' && a.status !== 'OUT') return 1;
      return a.total_qty - b.total_qty;
    });

    return NextResponse.json({
      success: true,
      count: items.length,
      out_of_stock: items.filter((i) => i.status === 'OUT').length,
      low_stock: items.filter((i) => i.status === 'LOW').length,
      items,
    });
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch low stock items' },
      { status: 500 }
    );
  }
}
