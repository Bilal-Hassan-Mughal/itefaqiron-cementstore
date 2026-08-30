import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope } from '@/lib/branch-server';

// GET - Fetch all customer types
export async function GET() {
  try {
    const customerTypes = await prisma.customerType.findMany({
      orderBy: {
        created_at: 'desc'
      }
    });

    return NextResponse.json(customerTypes);
  } catch (error) {
    console.error('Error fetching customer types:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch customer types' },
      { status: 500 }
    );
  }
}

// POST - Create new customer type
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { cus_type_title, updated_by } = body;

    if (!cus_type_title) {
      return NextResponse.json(
        { error: 'Customer type title is required' },
        { status: 400 }
      );
    }

    const cus_type_id = body.cus_type_id || await getNextId('customerType', 'cus_type_id');

    const customerType = await prisma.customerType.create({
      data: {
        cus_type_id,
        cus_type_title,
        updated_by
      }
    });

    return NextResponse.json(customerType, { status: 201 });
  } catch (error) {
    console.error('Error creating customer type:', error);
    return NextResponse.json(
      { error: 'Failed to create customer type' },
      { status: 500 }
    );
  }
}

// PUT - Update customer type
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { id, cus_type_title, updated_by } = body;

    if (!id || !cus_type_title) {
      return NextResponse.json(
        { error: 'ID and customer type title are required' },
        { status: 400 }
      );
    }

    const customerType = await prisma.customerType.update({
      where: { cus_type_id: id },
      data: {
        cus_type_title,
        updated_by
      }
    });

    return NextResponse.json(customerType);
  } catch (error) {
    console.error('Error updating customer type:', error);
    return NextResponse.json(
      { error: 'Failed to update customer type' },
      { status: 500 }
    );
  }
}

// DELETE - Delete customer type
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (!id) {
      return NextResponse.json(
        { error: 'Customer type ID is required' },
        { status: 400 }
      );
    }

    // Check if customer type is being used by any customers
    const customersUsingType = await prisma.customer.count({
      where: { cus_type: id }
    });

    if (customersUsingType > 0) {
      return NextResponse.json(
        { error: 'Cannot delete customer type that is being used by customers' },
        { status: 400 }
      );
    }

    await prisma.customerType.delete({
      where: { cus_type_id: id }
    });

    return NextResponse.json({ message: 'Customer type deleted successfully' });
  } catch (error) {
    console.error('Error deleting customer type:', error);
    return NextResponse.json(
      { error: 'Failed to delete customer type' },
      { status: 500 }
    );
  }
}


