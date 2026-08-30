import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope } from '@/lib/branch-server';

// Helper for JSON errors
function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

// ========================================
// GET — Get all or one customer category
// ========================================
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null; // optional: ?id=1

  try {
    if (id) {
      const category = await prisma.customerCategory.findUnique({
        where: { cus_cat_id: id },
      });

      if (!category)
        return errorResponse('Customer category not found', 404);

      return NextResponse.json(category);
    }

    const categories = await prisma.customerCategory.findMany({
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json(categories);
  } catch (err) {
    console.error('❌ Error fetching customer categories:', err);
    
    // Handle database connection errors
    if (err.code === 'P1001' || err.message?.includes('Can\'t reach database server')) {
      return NextResponse.json(
        { error: 'Database connection failed. Please check if the database server is running.' },
        { status: 503 }
      );
    }
    
    return errorResponse('Failed to fetch customer categories', 500);
  }
}

// ========================================
// POST — Create a new customer category
// ========================================
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { cus_cat_title, updated_by } = body;

    if (!cus_cat_title || cus_cat_title.trim() === '')
      return errorResponse('Customer category title is required');

    // Check if exists
    const existing = await prisma.customerCategory.findFirst({
      where: {
        cus_cat_title: {
          equals: cus_cat_title.trim(),
        },
      },
    });

    if (existing)
      return errorResponse('Customer category already exists', 409);

    const cus_cat_id = body.cus_cat_id || await getNextId('customerCategory', 'cus_cat_id');

    const newCategory = await prisma.customerCategory.create({
      data: { 
        cus_cat_id,
        cus_cat_title: cus_cat_title.trim(),
        updated_by: updated_by || null
      },
    });

    return NextResponse.json(newCategory, { status: 201 });
  } catch (err) {
    console.error('❌ Error creating customer category:', err);
    
    if (err.code === 'P1001' || err.message?.includes('Can\'t reach database server')) {
      return NextResponse.json(
        { error: 'Database connection failed. Please check if the database server is running.' },
        { status: 503 }
      );
    }
    
    return errorResponse('Failed to create customer category', 500);
  }
}

// ========================================
// PUT — Update an existing customer category
// ========================================
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { id, cus_cat_title, updated_by } = body;

    if (!id) return errorResponse('Customer category ID is required');
    if (!cus_cat_title || cus_cat_title.trim() === '')
      return errorResponse('Category title is required');

    const existing = await prisma.customerCategory.findUnique({
      where: { cus_cat_id: id },
    });

    if (!existing)
      return errorResponse('Customer category not found', 404);

    const duplicate = await prisma.customerCategory.findFirst({
      where: {
        cus_cat_title: {
          equals: cus_cat_title.trim(),
        },
        NOT: { cus_cat_id: id },
      },
    });

    if (duplicate)
      return errorResponse('Category with this title already exists', 409);

    const updated = await prisma.customerCategory.update({
      where: { cus_cat_id: id },
      data: { 
        cus_cat_title: cus_cat_title.trim(),
        updated_by: updated_by || existing.updated_by
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error('❌ Error updating customer category:', err);
    
    if (err.code === 'P1001' || err.message?.includes('Can\'t reach database server')) {
      return NextResponse.json(
        { error: 'Database connection failed. Please check if the database server is running.' },
        { status: 503 }
      );
    }
    
    return errorResponse('Failed to update customer category', 500);
  }
}

// ========================================
// DELETE — Delete a customer category
// ========================================
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null; // /api/customer-category?id=1

  if (!id)
    return errorResponse('Customer category ID is required');

  try {
    const existing = await prisma.customerCategory.findUnique({
      where: { cus_cat_id: id },
    });

    if (!existing)
      return errorResponse('Customer category not found', 404);

    await prisma.customerCategory.delete({
      where: { cus_cat_id: id },
    });

    return NextResponse.json({ message: 'Customer category deleted successfully' });
  } catch (err) {
    console.error('❌ Error deleting customer category:', err);
    
    if (err.code === 'P1001' || err.message?.includes('Can\'t reach database server')) {
      return NextResponse.json(
        { error: 'Database connection failed. Please check if the database server is running.' },
        { status: 503 }
      );
    }
    
    return errorResponse('Failed to delete customer category', 500);
  }
}
