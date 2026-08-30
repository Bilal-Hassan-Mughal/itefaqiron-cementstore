import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';

// GET - Fetch dashboard analytics data
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  const branchId = __branchScope.branchId;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    lastMonth.setHours(0, 0, 0, 0);

    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastMonthStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);

    // Use raw SQL to avoid datetime parsing issues
    // Get current month sales
    const currentMonthSalesRaw = await prisma.$queryRaw`
      SELECT total_amount
      FROM sales
      WHERE branch_id = ${branchId}
        AND created_at >= ${currentMonthStart}
        AND created_at < ${new Date(today.getFullYear(), today.getMonth() + 1, 1)}
        AND bill_type != 'QUOTATION'
    `;

    // Get last month sales
    const lastMonthSalesRaw = await prisma.$queryRaw`
      SELECT total_amount
      FROM sales
      WHERE branch_id = ${branchId}
        AND created_at >= ${lastMonthStart}
        AND created_at < ${currentMonthStart}
        AND bill_type != 'QUOTATION'
    `;

    const currentMonthSales = Array.isArray(currentMonthSalesRaw) ? currentMonthSalesRaw : [];
    const lastMonthSales = Array.isArray(lastMonthSalesRaw) ? lastMonthSalesRaw : [];

    // Calculate total sales
    const totalSalesCurrent = currentMonthSales.reduce(
      (sum, sale) => sum + parseFloat(sale.total_amount || 0),
      0
    );
    const totalSalesLastMonth = lastMonthSales.reduce(
      (sum, sale) => sum + parseFloat(sale.total_amount || 0),
      0
    );

    // Calculate sales change percentage
    const salesChange = totalSalesLastMonth > 0
      ? ((totalSalesCurrent - totalSalesLastMonth) / totalSalesLastMonth * 100).toFixed(1)
      : totalSalesCurrent > 0 ? '100.0' : '0.0';

    // Get total orders (sales count)
    const currentMonthOrders = currentMonthSales.length;
    const lastMonthOrders = lastMonthSales.length;
    const ordersChange = lastMonthOrders > 0
      ? ((currentMonthOrders - lastMonthOrders) / lastMonthOrders * 100).toFixed(1)
      : currentMonthOrders > 0 ? '100.0' : '0.0';

    // Get active customers using raw SQL
    const activeCustomersCurrentRaw = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT cus_id) as count
      FROM sales
      WHERE branch_id = ${branchId}
        AND created_at >= ${currentMonthStart}
        AND created_at < ${new Date(today.getFullYear(), today.getMonth() + 1, 1)}
        AND bill_type != 'QUOTATION'
    `;

    const activeCustomersLastMonthRaw = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT cus_id) as count
      FROM sales
      WHERE branch_id = ${branchId}
        AND created_at >= ${lastMonthStart}
        AND created_at < ${currentMonthStart}
        AND bill_type != 'QUOTATION'
    `;

    const activeCustomersCurrent = Number(activeCustomersCurrentRaw?.[0]?.count || 0);
    const activeCustomersLastMonth = Number(activeCustomersLastMonthRaw?.[0]?.count || 0);

    const customersChange = activeCustomersLastMonth > 0
      ? ((activeCustomersCurrent - activeCustomersLastMonth) / activeCustomersLastMonth * 100).toFixed(1)
      : activeCustomersCurrent > 0 ? '100.0' : '0.0';

    // Get total products count using raw SQL
    const totalProductsRaw = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM products
      WHERE branch_id = ${branchId}
    `;

    // Get total products from last month (for comparison)
    const lastMonthProductsRaw = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM products
      WHERE branch_id = ${branchId}
        AND created_at < ${currentMonthStart}
    `;

    const totalProducts = Number(totalProductsRaw?.[0]?.count || 0);
    const lastMonthProducts = Number(lastMonthProductsRaw?.[0]?.count || 0);

    const productsChange = lastMonthProducts > 0
      ? ((totalProducts - lastMonthProducts) / lastMonthProducts * 100).toFixed(1)
      : totalProducts > 0 ? '100.0' : '0.0';

    return NextResponse.json({
      success: true,
      data: {
        totalSales: {
          value: totalSalesCurrent.toFixed(2),
          change: salesChange,
          changeType: parseFloat(salesChange) >= 0 ? 'positive' : 'negative'
        },
        totalOrders: {
          value: currentMonthOrders.toString(),
          change: ordersChange,
          changeType: parseFloat(ordersChange) >= 0 ? 'positive' : 'negative'
        },
        activeCustomers: {
          value: activeCustomersCurrent.toString(),
          change: customersChange,
          changeType: parseFloat(customersChange) >= 0 ? 'positive' : 'negative'
        },
        totalProducts: {
          value: totalProducts.toString(),
          change: productsChange,
          changeType: parseFloat(productsChange) >= 0 ? 'positive' : 'negative'
        }
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

