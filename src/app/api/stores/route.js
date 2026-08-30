import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { resolveBranchId, mergeBranchWhere, withBranchData } from '@/lib/branch-server';
import { initBranchScope } from '@/lib/branch-server';

// GET - Fetch all stores
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const branchId = resolveBranchId(request);
    const stores = await prisma.store.findMany({
      where: mergeBranchWhere(branchId, {}),
      orderBy: {
        created_at: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      data: stores
    });
  } catch (error) {
    console.error('Error fetching stores:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch stores' },
      { status: 500 }
    );
  }
}

// POST - Create a new store
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const branchId = resolveBranchId(request);
    const body = await request.json();
    const { store_name, store_address } = body;

    // Validation
    if (!store_name || store_name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Store name is required' },
        { status: 400 }
      );
    }

    // Check if store name already exists
    const existingStore = await prisma.store.findFirst({
      where: {
        store_name: store_name.trim(),
        branch_id: branchId,
      }
    });

    if (existingStore) {
      return NextResponse.json(
        { success: false, error: 'Store name already exists' },
        { status: 400 }
      );
    }

    // Create new store
    const newStore = await prisma.store.create({
      data: withBranchData(branchId, {
        store_name: store_name.trim(),
        store_address: store_address?.trim() || null,
      })
    });

    return NextResponse.json({
      success: true,
      data: newStore,
      message: 'Store created successfully'
    });
  } catch (error) {
    console.error('Error creating store:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create store' },
      { status: 500 }
    );
  }
}

// PUT - Update a store
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { storeid, store_name, store_address } = body;

    // Validation
    if (!storeid) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      );
    }

    if (!store_name || store_name.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Store name is required' },
        { status: 400 }
      );
    }

    // Check if store exists
    const existingStore = await prisma.store.findUnique({
      where: { storeid: parseInt(storeid) }
    });

    if (!existingStore) {
      return NextResponse.json(
        { success: false, error: 'Store not found' },
        { status: 404 }
      );
    }

    // Check if store name already exists (excluding current store)
    const duplicateStore = await prisma.store.findFirst({
      where: {
        store_name: store_name.trim(),
        storeid: {
          not: parseInt(storeid)
        }
      }
    });

    if (duplicateStore) {
      return NextResponse.json(
        { success: false, error: 'Store name already exists' },
        { status: 400 }
      );
    }

    // Update store
    const updatedStore = await prisma.store.update({
      where: { storeid: parseInt(storeid) },
      data: {
        store_name: store_name.trim(),
        store_address: store_address?.trim() || null
      }
    });

    return NextResponse.json({
      success: true,
      data: updatedStore,
      message: 'Store updated successfully'
    });
  } catch (error) {
    console.error('Error updating store:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update store' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a store
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const storeid = searchParams.get('storeid');

    if (!storeid) {
      return NextResponse.json(
        { success: false, error: 'Store ID is required' },
        { status: 400 }
      );
    }

    // Check if store exists
    const existingStore = await prisma.store.findUnique({
      where: { storeid: parseInt(storeid) }
    });

    if (!existingStore) {
      return NextResponse.json(
        { success: false, error: 'Store not found' },
        { status: 404 }
      );
    }

    // Delete store
    await prisma.store.delete({
      where: { storeid: parseInt(storeid) }
    });

    return NextResponse.json({
      success: true,
      message: 'Store deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting store:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete store' },
      { status: 500 }
    );
  }
}
