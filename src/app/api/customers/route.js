import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getNextId } from '@/lib/id-helper';
import { resolveBranchId, mergeBranchWhere, withBranchData } from '@/lib/branch-server';
import { initBranchScope } from '@/lib/branch-server';

// Helper for JSON errors
function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// No helper needed - customer balance is maintained directly in customer table
// It gets updated incrementally with each ledger entry (add debit, subtract credit)

// ========================================
// GET — Get all or one customer
// ========================================
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  const { searchParams } = new URL(request.url);
  const branchId = resolveBranchId(request);
  const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null; // optional: ?id=1

  try {
    if (id) {
      // Get single customer with category details
      const customer = await prisma.customer.findFirst({
        where: { cus_id: id, branch_id: branchId },
        include: {
          customer_category: {
            select: {
              cus_cat_id: true,
              cus_cat_title: true
            }
          },
          customer_type: {
            select: {
              cus_type_id: true,
              cus_type_title: true
            }
          },
          city: {
            select: {
              city_id: true,
              city_name: true
            }
          }
        },
      });

      if (!customer)
        return errorResponse('Customer not found', 404);

      return NextResponse.json(customer);
    }

    const paginate = searchParams.get('paginate') === 'true';

    if (paginate) {
      const page = parseInt(searchParams.get('page')) || 1;
      const limitVal = searchParams.get('limit');
      const all = searchParams.get('all') === 'true';
      const limit = all || limitVal === 'all' ? null : (parseInt(limitVal) || 50);
      const search = searchParams.get('search') || '';
      const typeFilter = searchParams.get('typeFilter') || 'all';
      const categoryFilter = searchParams.get('categoryFilter') || 'all';
      const balanceFilter = searchParams.get('balanceFilter') || 'all';
      const minAmount = searchParams.get('minAmount') || '';
      const activityFilter = searchParams.get('activityFilter') || 'all';
      const sortBy = searchParams.get('sortBy') || 'cus_name';
      const sortOrder = searchParams.get('sortOrder') || 'asc';

      const where = mergeBranchWhere(branchId, {});

      // 1. Search filter (name, phone, address, reference, city, balance)
      if (search && search.trim() !== '') {
        const s = search.trim();
        const orConditions = [
          { cus_name: { contains: s } },
          { cus_phone_no: { contains: s } },
          { cus_phone_no2: { contains: s } },
          { cus_address: { contains: s } },
          { cus_reference: { contains: s } },
          { city: { city_name: { contains: s } } },
        ];

        const numericStr = s.replace(/,/g, '');
        if (/^-?\d+\.?\d*$/.test(numericStr)) {
          const num = parseFloat(numericStr);
          if (!Number.isNaN(num)) {
            orConditions.push({ cus_balance: num });
            orConditions.push({ cus_balance: -num });

            const absNum = Math.abs(num);
            if (absNum >= 1) {
              for (let exp = 0; exp <= 4; exp++) {
                const mult = Math.pow(10, exp);
                const lo = absNum * mult;
                const hi = (absNum + 1) * mult - 0.005;
                orConditions.push({ cus_balance: { gte: lo, lt: hi } });
                orConditions.push({ cus_balance: { gt: -hi, lte: -lo } });
              }
            }
          }
        }

        where.OR = orConditions;
      }

      // 2. Type filter
      if (typeFilter && typeFilter !== 'all') {
        where.cus_type = parseInt(typeFilter);
      }

      // 3. Category filter
      if (categoryFilter && categoryFilter !== 'all') {
        where.customer_category = {
          cus_cat_title: categoryFilter
        };
      }

      // 4. Balance filter
      if (balanceFilter && balanceFilter !== 'all') {
        if (balanceFilter === 'positive') {
          where.cus_balance = { gt: 0 };
        } else if (balanceFilter === 'negative') {
          where.cus_balance = { lt: 0 };
        } else if (balanceFilter === 'zero') {
          where.cus_balance = { equals: 0 };
        } else if (balanceFilter === 'non-zero') {
          where.cus_balance = { not: 0 };
        }
      }

      // 4b. Min Amount Filter (Balance > Amount)
      if (minAmount && !isNaN(parseFloat(minAmount))) {
        const minVal = parseFloat(minAmount);
        if (!where.cus_balance) {
          where.cus_balance = { gt: minVal };
        } else if (typeof where.cus_balance === 'object') {
          where.cus_balance = { ...where.cus_balance, gt: minVal };
        }
      }

      // 5. Activity filter
      if (activityFilter && activityFilter !== 'all') {
        // Activity filter requires balance > 0
        if (!where.cus_balance) {
          where.cus_balance = { gt: 0 };
        } else if (where.cus_balance.gt !== undefined) {
          // already gt 0, do nothing
        } else {
          where.cus_balance = { gt: 0 };
        }

        const now = new Date();
        if (activityFilter === '1month') {
          const date30DaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          where.updated_at = { gte: date30DaysAgo };
        } else if (activityFilter === '1to3months') {
          const date30DaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          const date90DaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          where.updated_at = { gte: date90DaysAgo, lt: date30DaysAgo };
        } else if (activityFilter === '3to6months') {
          const date90DaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          const date180DaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          where.updated_at = { gte: date180DaysAgo, lt: date90DaysAgo };
        } else if (activityFilter === 'over6months') {
          const date180DaysAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
          where.updated_at = { lt: date180DaysAgo };
        }
      }

      const skip = limit ? (page - 1) * limit : undefined;
      const take = limit || undefined;

      const orderBy = {};
      if (sortBy === 'cus_name') {
        orderBy.cus_name = sortOrder;
      } else if (sortBy === 'cus_balance') {
        orderBy.cus_balance = sortOrder;
      } else {
        orderBy.created_at = sortOrder;
      }

      const [customers, aggregateResult] = await Promise.all([
        prisma.customer.findMany({
          where,
          include: {
            customer_category: {
              select: {
                cus_cat_id: true,
                cus_cat_title: true
              }
            },
            customer_type: {
              select: {
                cus_type_id: true,
                cus_type_title: true
              }
            },
            city: {
              select: {
                city_id: true,
                city_name: true
              }
            }
          },
          orderBy,
          skip,
          take,
        }),
        prisma.customer.aggregate({
          where,
          _count: { cus_id: true },
          _sum: { cus_balance: true }
        })
      ]);

      // Calculate stats using Prisma aggregates over the filtered set
      const statsWhere = { ...where };
      
      let receivablesWhere = { ...statsWhere };
      if (balanceFilter === 'all' || balanceFilter === 'non-zero') {
        receivablesWhere.cus_balance = { gt: 0 };
      } else if (balanceFilter === 'positive') {
        receivablesWhere.cus_balance = { gt: 0 };
      } else {
        receivablesWhere = null;
      }

      let payablesWhere = { ...statsWhere };
      if (balanceFilter === 'all' || balanceFilter === 'non-zero') {
        payablesWhere.cus_balance = { lt: 0 };
      } else if (balanceFilter === 'negative') {
        payablesWhere.cus_balance = { lt: 0 };
      } else {
        payablesWhere = null;
      }

      const [receivablesResult, payablesResult] = await Promise.all([
        receivablesWhere ? prisma.customer.aggregate({
          where: receivablesWhere,
          _sum: { cus_balance: true }
        }) : Promise.resolve(null),
        payablesWhere ? prisma.customer.aggregate({
          where: payablesWhere,
          _sum: { cus_balance: true }
        }) : Promise.resolve(null),
      ]);

      const totalCustomers = aggregateResult._count.cus_id || 0;
      const netBalance = aggregateResult._sum.cus_balance || 0;
      const totalReceivables = receivablesResult?._sum?.cus_balance || 0;
      const totalPayables = payablesResult?._sum?.cus_balance || 0;

      return NextResponse.json({
        customers,
        pagination: limit ? {
          page,
          limit,
          total: totalCustomers,
          pages: Math.ceil(totalCustomers / limit)
        } : null,
        stats: {
          totalCustomers,
          totalReceivables,
          totalPayables: Math.abs(totalPayables),
          netBalance
        }
      });
    }

    // Get all customers with category details
    const isDropdown = searchParams.get('dropdown') === 'true' || searchParams.get('minimal') === 'true';
    if (isDropdown) {
      const categoryParam = searchParams.get('category');
      const where = mergeBranchWhere(branchId, {});
      if (categoryParam && categoryParam !== 'all') {
        if (!isNaN(categoryParam)) {
          where.cus_category = parseInt(categoryParam);
        } else {
          where.customer_category = {
            cus_cat_title: categoryParam
          };
        }
      }

      const typeParam = searchParams.get('type') || searchParams.get('typeFilter');
      if (typeParam && typeParam !== 'all') {
        where.cus_type = parseInt(typeParam);
      }

      const isLite = searchParams.get('lite') === 'true';
      const customers = await prisma.customer.findMany({
        where,
        select: isLite
          ? {
              cus_id: true,
              cus_name: true,
              cus_balance: true,
              cus_phone_no: true,
              customer_category: {
                select: {
                  cus_cat_id: true,
                  cus_cat_title: true
                }
              }
            }
          : {
              cus_id: true,
              cus_name: true,
              cus_balance: true,
              cus_phone_no: true,
              cus_phone_no2: true,
              cus_address: true,
              cus_reference: true,
              cus_category: true,
              cus_type: true,
              CNIC: true,
              NTN_NO: true,
              name_urdu: true,
              other: true,
              cus_account_info: true,
              city_id: true,
              customer_category: {
                select: {
                  cus_cat_id: true,
                  cus_cat_title: true
                }
              },
              customer_type: {
                select: {
                  cus_type_id: true,
                  cus_type_title: true
                }
              },
              city: {
                select: {
                  city_id: true,
                  city_name: true
                }
              }
            },
        orderBy: { created_at: 'desc' },
      });
      return NextResponse.json(customers);
    }

    const customers = await prisma.customer.findMany({
      where: mergeBranchWhere(branchId, {}),
      include: {
        customer_category: {
          select: {
            cus_cat_id: true,
            cus_cat_title: true
          }
        },
        customer_type: {
          select: {
            cus_type_id: true,
            cus_type_title: true
          }
        },
        city: {
          select: {
            city_id: true,
            city_name: true
          }
        }
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(customers);
  } catch (err) {
    console.error('❌ Error fetching customers:', err);
    
    // Handle database connection errors
    if (err.code === 'P1001' || err.message?.includes('Can\'t reach database server')) {
      return NextResponse.json(
        { error: 'Database connection failed. Please check if the database server is running.' },
        { status: 503 }
      );
    }
    
    return errorResponse('Failed to fetch customers', 500);
  }
}

// ========================================
// POST — Create a new customer
// ========================================
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const branchId = resolveBranchId(request);
    const body = await request.json();
    const {
      cus_category,
      cus_type,
      cus_name,
      cus_phone_no,
      cus_phone_no2,
      cus_address,
      cus_reference,
      cus_account_info,
      other,
      cus_balance,
      CNIC,
      NTN_NO,
      name_urdu,
      city_id
    } = body;

    // Validation for required fields
    if (!cus_category)
      return errorResponse('Customer category is required');
    
    if (!cus_type)
      return errorResponse('Customer type is required');
    
    if (!cus_name || cus_name.trim() === '')
      return errorResponse('Customer name is required');
    
    if (!cus_phone_no || cus_phone_no.trim() === '')
      return errorResponse('Primary phone number is required');
    
    if (!cus_address || cus_address.trim() === '')
      return errorResponse('Customer address is required');

    // Check if customer type exists
    if (cus_type) {
      const typeExists = await prisma.customerType.findUnique({
        where: { cus_type_id: parseInt(cus_type) }
      });
      if (!typeExists)
        return errorResponse('Customer type not found', 404);
    }

    // Check if city exists
    if (city_id) {
      const cityExists = await prisma.city.findUnique({
        where: { city_id: parseInt(city_id) }
      });
      if (!cityExists)
        return errorResponse('City not found', 404);
    }

    // Check if customer category exists
    const categoryExists = await prisma.customerCategory.findUnique({
      where: { cus_cat_id: parseInt(cus_category) }
    });

    if (!categoryExists)
      return errorResponse('Customer category not found', 404);

    // Allow duplicate phone numbers — no uniqueness check on phone here (handled by business rules elsewhere if needed).

    const cus_id = body.cus_id || await getNextId('customer', 'cus_id');

    // Create new customer
    const newCustomer = await prisma.customer.create({
      data: withBranchData(branchId, {
        cus_id,
        cus_category: parseInt(cus_category) || null,
        cus_type: parseInt(cus_type) || null,
        cus_name: cus_name.trim(),
        cus_phone_no: cus_phone_no.trim(),
        cus_phone_no2: cus_phone_no2?.trim() || null,
        cus_address: cus_address.trim(),
        cus_reference: cus_reference?.trim() || null,
        cus_account_info: cus_account_info?.trim() || null,
        other: other?.trim() || null,
        cus_balance: cus_balance != null && cus_balance !== '' ? parseFloat(cus_balance) : 0,
        CNIC: CNIC?.trim() || null,
        NTN_NO: NTN_NO?.trim() || null,
        name_urdu: name_urdu?.trim() || null,
        city_id: parseInt(city_id) || null,
      }),
      include: {
        customer_category: {
          select: {
            cus_cat_id: true,
            cus_cat_title: true
          }
        },
        customer_type: {
          select: {
            cus_type_id: true,
            cus_type_title: true
          }
        },
        city: {
          select: {
            city_id: true,
            city_name: true
          }
        }
      }
    });

    return NextResponse.json(newCustomer, { status: 201 });
  } catch (err) {
    console.error('❌ Error creating customer:', err);
    
    // Handle database connection errors
    if (err.code === 'P1001' || err.message?.includes('Can\'t reach database server')) {
      return NextResponse.json(
        { error: 'Database connection failed. Please check if the database server is running.' },
        { status: 503 }
      );
    }
    
    return errorResponse('Failed to create customer', 500);
  }
}

// ========================================
// PUT — Update an existing customer
// ========================================
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const {
      id,
      cus_category,
      cus_type,
      cus_name,
      cus_phone_no,
      cus_phone_no2,
      cus_address,
      cus_reference,
      cus_account_info,
      other,
      cus_balance,
      CNIC,
      NTN_NO,
      name_urdu,
      city_id
    } = body;

    if (!id) return errorResponse('Customer ID is required');

    // Validation for required fields
    if (!cus_category)
      return errorResponse('Customer category is required');
    
    if (!cus_type)
      return errorResponse('Customer type is required');
    
    if (!cus_name || cus_name.trim() === '')
      return errorResponse('Customer name is required');
    
    if (!cus_phone_no || cus_phone_no.trim() === '')
      return errorResponse('Primary phone number is required');
    
    if (!cus_address || cus_address.trim() === '')
      return errorResponse('Customer address is required');

    // Check if customer type exists
    if (cus_type) {
      const typeExists = await prisma.customerType.findUnique({
        where: { cus_type_id: parseInt(cus_type) }
      });
      if (!typeExists)
        return errorResponse('Customer type not found', 404);
    }

    // Check if city exists
    if (city_id) {
      const cityExists = await prisma.city.findUnique({
        where: { city_id: parseInt(city_id) }
      });
      if (!cityExists)
        return errorResponse('City not found', 404);
    }

    // Check if customer exists
    const existing = await prisma.customer.findUnique({
      where: { cus_id: id },
    });

    if (!existing)
      return errorResponse('Customer not found', 404);

    // Check if customer category exists
    const categoryExists = await prisma.customerCategory.findUnique({
      where: { cus_cat_id: parseInt(cus_category) }
    });

    if (!categoryExists)
      return errorResponse('Customer category not found', 404);

    // Allow duplicate phone numbers on update as well — do not block by phone number.

    // Update customer
    const updated = await prisma.customer.update({
      where: { cus_id: id },
      data: {
        cus_category: parseInt(cus_category) || null,
        cus_type: parseInt(cus_type) || null,
        cus_name: cus_name.trim(),
        cus_phone_no: cus_phone_no.trim(),
        cus_phone_no2: cus_phone_no2?.trim() || null,
        cus_address: cus_address.trim(),
        cus_reference: cus_reference?.trim() || null,
        cus_account_info: cus_account_info?.trim() || null,
        other: other?.trim() || null,
        cus_balance: cus_balance != null && cus_balance !== '' ? parseFloat(cus_balance) : existing.cus_balance,
        CNIC: CNIC?.trim() || null,
        NTN_NO: NTN_NO?.trim() || null,
        name_urdu: name_urdu?.trim() || null,
        city_id: parseInt(city_id) || null,
      },
      include: {
        customer_category: {
          select: {
            cus_cat_id: true,
            cus_cat_title: true
          }
        },
        customer_type: {
          select: {
            cus_type_id: true,
            cus_type_title: true
          }
        },
        city: {
          select: {
            city_id: true,
            city_name: true
          }
        }
      }
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('❌ Error updating customer:', err);
    
    // Handle database connection errors
    if (err.code === 'P1001' || err.message?.includes('Can\'t reach database server')) {
      return NextResponse.json(
        { error: 'Database connection failed. Please check if the database server is running.' },
        { status: 503 }
      );
    }
    
    return errorResponse('Failed to update customer', 500);
  }
}

// ========================================
// DELETE — Delete a customer
// ========================================
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null; // /api/customers?id=1

  if (!id)
    return errorResponse('Customer ID is required');

  try {
    // Check if customer exists
    const existing = await prisma.customer.findUnique({
      where: { cus_id: id },
    });

    if (!existing)
      return errorResponse('Customer not found', 404);

    // Check if customer has any related records (sales, purchases, ledger, payments, split-payments, etc.)
    const hasRelatedRecords = await prisma.$transaction(async (tx) => {
      const sales = await tx.sale.count({ where: { cus_id: id } });
      const purchases = await tx.purchase.count({ where: { cus_id: id } });
      const ledger = await tx.ledger.count({ where: { cus_id: id } });
      const payments = await tx.payment.count({ where: { account_id: id } }).catch(() => 0);
      const splitDebit = await tx.splitPayment.count({ where: { debit_account_id: id } }).catch(() => 0);
      const splitCredit = await tx.splitPayment.count({ where: { credit_account_id: id } }).catch(() => 0);

      return (
        sales > 0 ||
        purchases > 0 ||
        ledger > 0 ||
        payments > 0 ||
        splitDebit > 0 ||
        splitCredit > 0
      );
    });

    if (hasRelatedRecords)
      return errorResponse('Cannot delete customer with existing transactions. Please archive instead.', 409);

    // Delete customer
    await prisma.customer.delete({
      where: { cus_id: id },
    });

    return NextResponse.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting customer:', err);
    
    // Handle database connection errors
    if (err.code === 'P1001' || err.message?.includes('Can\'t reach database server')) {
      return NextResponse.json(
        { error: 'Database connection failed. Please check if the database server is running.' },
        { status: 503 }
      );
    }
    
    return errorResponse('Failed to delete customer', 500);
  }
}
