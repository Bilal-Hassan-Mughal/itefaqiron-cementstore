import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';

// GET - Fetch all loaders
export async function GET() {
  try {
    const loaders = await prisma.loader.findMany({
      include: {
        updated_by_user: {
          select: {
            user_id: true,
            full_name: true,
            role: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return NextResponse.json(loaders);
  } catch (error) {
    console.error('Error fetching loaders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch loaders' },
      { status: 500 }
    );
  }
}

// POST - Create new loader
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { loader_name, loader_number, loader_phone, loader_balance, updated_by } = body;

    if (!loader_name) {
      return NextResponse.json(
        { error: 'Loader name is required' },
        { status: 400 }
      );
    }

    if (!loader_number) {
      return NextResponse.json(
        { error: 'Loader number is required' },
        { status: 400 }
      );
    }

    // Check if loader number already exists
    const existingLoader = await prisma.loader.findUnique({
      where: { loader_number }
    });

    if (existingLoader) {
      return NextResponse.json(
        { error: 'Loader number already exists' },
        { status: 409 }
      );
    }

    const loader = await prisma.loader.create({
      data: {
        loader_name,
        loader_number,
        loader_phone: loader_phone || null,
        loader_balance: loader_balance ? parseFloat(loader_balance) : 0,
        updated_by
      },
      include: {
        updated_by_user: {
          select: {
            user_id: true,
            full_name: true,
            role: true
          }
        }
      }
    });

    return NextResponse.json(loader, { status: 201 });
  } catch (error) {
    console.error('Error creating loader:', error);
    return NextResponse.json(
      { error: 'Failed to create loader' },
      { status: 500 }
    );
  }
}

// PUT - Update loader
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { id, loader_name, loader_number, loader_phone, loader_balance, updated_by } = body;

    if (!id || !loader_name || !loader_number) {
      return NextResponse.json(
        { error: 'ID, loader name and loader number are required' },
        { status: 400 }
      );
    }

    // Check if loader exists
    const existingLoader = await prisma.loader.findUnique({
      where: { loader_id: id }
    });

    if (!existingLoader) {
      return NextResponse.json(
        { error: 'Loader not found' },
        { status: 404 }
      );
    }

    // Check if new loader number conflicts with another loader
    if (loader_number !== existingLoader.loader_number) {
      const duplicateLoader = await prisma.loader.findUnique({
        where: { loader_number }
      });

      if (duplicateLoader) {
        return NextResponse.json(
          { error: 'Loader number already exists' },
          { status: 409 }
        );
      }
    }

    const loader = await prisma.loader.update({
      where: { loader_id: id },
      data: {
        loader_name,
        loader_number,
        loader_phone: loader_phone || null,
        loader_balance: loader_balance ? parseFloat(loader_balance) : existingLoader.loader_balance,
        updated_by
      },
      include: {
        updated_by_user: {
          select: {
            user_id: true,
            full_name: true,
            role: true
          }
        }
      }
    });

    return NextResponse.json(loader);
  } catch (error) {
    console.error('Error updating loader:', error);
    return NextResponse.json(
      { error: 'Failed to update loader' },
      { status: 500 }
    );
  }
}

// DELETE - Delete loader
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (!id) {
      return NextResponse.json(
        { error: 'Loader ID is required' },
        { status: 400 }
      );
    }

    await prisma.loader.delete({
      where: { loader_id: id }
    });

    return NextResponse.json({ message: 'Loader deleted successfully' });
  } catch (error) {
    console.error('Error deleting loader:', error);
    return NextResponse.json(
      { error: 'Failed to delete loader' },
      { status: 500 }
    );
  }
}

