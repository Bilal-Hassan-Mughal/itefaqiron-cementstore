import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';


// GET - Fetch all hold bills with related data
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;
    const status = searchParams.get('status');

    if (id) {
      // Fetch single hold bill
      const holdBill = await prisma.holdBill.findUnique({
        where: { hold_bill_id: id },
        include: {
          customer: {
            include: {
              customer_category: true
            }
          },
          hold_bill_details: {
            include: {
              product: {
                include: {
                  category: true,
                  sub_category: true
                }
              }
            }
          },
          debit_account: {
            select: {
              cus_id: true,
              cus_name: true,
              cus_phone_no: true
            }
          },
          credit_account: {
            select: {
              cus_id: true,
              cus_name: true,
              cus_phone_no: true
            }
          },
          loader: {
            select: {
              loader_id: true,
              loader_name: true,
              loader_number: true,
              loader_phone: true
            }
          },
          updated_by_user: {
            select: {
              full_name: true,
              role: true
            }
          }
        }
      });

      if (!holdBill) {
        return NextResponse.json({ error: 'Hold bill not found' }, { status: 404 });
      }

      return NextResponse.json(holdBill);
    } else {
      // Fetch all hold bills with optional status filter
      const whereClause = status ? { status } : {};
      
      const holdBills = await prisma.holdBill.findMany({
        where: whereClause,
        include: {
          customer: {
            include: {
              customer_category: true
            }
          },
          hold_bill_details: {
            include: {
              product: {
                include: {
                  category: true,
                  sub_category: true
                }
              }
            }
          },
          debit_account: {
            select: {
              cus_id: true,
              cus_name: true,
              cus_phone_no: true
            }
          },
          credit_account: {
            select: {
              cus_id: true,
              cus_name: true,
              cus_phone_no: true
            }
          },
          loader: {
            select: {
              loader_id: true,
              loader_name: true,
              loader_number: true,
              loader_phone: true
            }
          },
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
      });

      return NextResponse.json(holdBills);
    }
  } catch (error) {
    console.error('Error fetching hold bills:', error);
    return NextResponse.json({ error: 'Failed to fetch hold bills' }, { status: 500 });
  }
}

// POST - Create new hold bill
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const {
      cus_id,
      total_amount,
      discount,
      payment,
      payment_type,
      debit_account_id,
      credit_account_id,
      loader_id,
      shipping_amount,
      bill_type,
      status,
      reference,
      notes,
      hold_bill_details,
      updated_by
    } = body;

    // Validate required fields
    if (!cus_id || !total_amount || !hold_bill_details || hold_bill_details.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get customer
      const customer = await tx.customer.findUnique({
        where: { cus_id }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      // Create hold bill
      const holdBill = await tx.holdBill.create({
        data: {
          cus_id,
          total_amount: parseFloat(total_amount),
          discount: parseFloat(discount || 0),
          payment: parseFloat(payment || 0),
          payment_type: payment_type || 'CASH',
          debit_account_id: debit_account_id || null,
          credit_account_id: credit_account_id || null,
          loader_id: loader_id || null,
          shipping_amount: parseFloat(shipping_amount || 0),
          bill_type: bill_type || 'BILL',
          status: status || 'DRAFT',
          reference: reference || null,
          notes: notes || null,
          updated_by
        }
      });

      // Create hold bill details
      const holdBillDetailPromises = hold_bill_details.map(detail => 
        tx.holdBillDetail.create({
          data: {
            hold_bill_id: holdBill.hold_bill_id,
            pro_id: detail.pro_id,
            vehicle_no: detail.vehicle_no || null,
            qnty: parseInt(detail.qnty),
            unit: detail.unit,
            unit_rate: parseFloat(detail.unit_rate),
            total_amount: parseFloat(detail.total_amount),
            discount: parseFloat(detail.discount || 0),
            net_total: parseFloat(detail.total_amount) - parseFloat(detail.discount || 0),
            cus_id,
            updated_by
          }
        })
      );

      await Promise.all(holdBillDetailPromises);

      return holdBill;
    }, {
      timeout: 15000 // 15 seconds timeout for complex transactions
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Error creating hold bill:', error);
    return NextResponse.json({ error: 'Failed to create hold bill' }, { status: 500 });
  }
}

// PUT - Update hold bill
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const {
      id,
      cus_id,
      total_amount,
      discount,
      payment,
      payment_type,
      debit_account_id,
      credit_account_id,
      loader_id,
      shipping_amount,
      bill_type,
      status,
      reference,
      notes,
      hold_bill_details,
      updated_by
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Hold bill ID is required' }, { status: 400 });
    }

    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // Get existing hold bill
      const existingHoldBill = await tx.holdBill.findUnique({
        where: { hold_bill_id: id },
        include: {
          hold_bill_details: true
        }
      });

      if (!existingHoldBill) {
        throw new Error('Hold bill not found');
      }

      // Get customer
      const customer = await tx.customer.findUnique({
        where: { cus_id }
      });

      if (!customer) {
        throw new Error('Customer not found');
      }

      // Delete existing hold bill details
      await tx.holdBillDetail.deleteMany({
        where: { hold_bill_id: id }
      });

      // Update hold bill
      const holdBill = await tx.holdBill.update({
        where: { hold_bill_id: id },
        data: {
          cus_id,
          total_amount: parseFloat(total_amount),
          discount: parseFloat(discount || 0),
          payment: parseFloat(payment || 0),
          payment_type: payment_type || 'CASH',
          debit_account_id: debit_account_id || null,
          credit_account_id: credit_account_id || null,
          loader_id: loader_id || null,
          shipping_amount: parseFloat(shipping_amount || 0),
          bill_type: bill_type || 'BILL',
          status: status || 'DRAFT',
          reference: reference || null,
          notes: notes || null,
          updated_by
        }
      });

      // Create new hold bill details
      const holdBillDetailPromises = hold_bill_details.map(detail => 
        tx.holdBillDetail.create({
          data: {
            hold_bill_id: holdBill.hold_bill_id,
            pro_id: detail.pro_id,
            vehicle_no: detail.vehicle_no || null,
            qnty: parseInt(detail.qnty),
            unit: detail.unit,
            unit_rate: parseFloat(detail.unit_rate),
            total_amount: parseFloat(detail.total_amount),
            discount: parseFloat(detail.discount || 0),
            net_total: parseFloat(detail.total_amount) - parseFloat(detail.discount || 0),
            cus_id,
            updated_by
          }
        })
      );

      await Promise.all(holdBillDetailPromises);

      return holdBill;
    }, {
      timeout: 15000 // 15 seconds timeout for complex transactions
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error updating hold bill:', error);
    return NextResponse.json({ error: 'Failed to update hold bill' }, { status: 500 });
  }
}

// DELETE - Delete hold bill
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (!id) {
      return NextResponse.json({ error: 'Hold bill ID is required' }, { status: 400 });
    }

    // Use transaction to ensure data consistency
    await prisma.$transaction(async (tx) => {
      // Get existing hold bill with details
      const existingHoldBill = await tx.holdBill.findUnique({
        where: { hold_bill_id: id },
        include: {
          hold_bill_details: true
        }
      });

      if (!existingHoldBill) {
        throw new Error('Hold bill not found');
      }

      // Delete hold bill details (cascade should handle this, but being explicit)
      await tx.holdBillDetail.deleteMany({
        where: { hold_bill_id: id }
      });

      // Delete hold bill
      await tx.holdBill.delete({
        where: { hold_bill_id: id }
      });
    }, {
      timeout: 15000 // 15 seconds timeout for complex transactions
    });

    return NextResponse.json({ message: 'Hold bill deleted successfully' });
  } catch (error) {
    console.error('Error deleting hold bill:', error);
    return NextResponse.json({ error: 'Failed to delete hold bill' }, { status: 500 });
  }
}


