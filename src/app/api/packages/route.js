import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';

// GET - Fetch all packages
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;
    const activeOnly = searchParams.get('active') === 'true';

    if (id) {
      const packageData = await prisma.package.findUnique({
        where: { package_id: id },
        include: {
          subscriptions: {
            include: {
              customer: true
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

      if (!packageData) {
        return NextResponse.json({ error: 'Package not found' }, { status: 404 });
      }

      return NextResponse.json(packageData);
    } else {
      const where = activeOnly ? { is_active: true } : {};
      
      const packages = await prisma.package.findMany({
        where,
        include: {
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

      return NextResponse.json(packages);
    }
  } catch (error) {
    console.error('Error fetching packages:', error);
    return NextResponse.json({ error: 'Failed to fetch packages' }, { status: 500 });
  }
}

// POST - Create new package
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const {
      package_name,
      package_description,
      price,
      duration_days,
      features,
      is_active,
      updated_by
    } = body;

    if (!package_name || !price || !duration_days) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const packageData = await prisma.package.create({
      data: {
        package_name,
        package_description: package_description || null,
        price: parseFloat(price),
        duration_days: parseInt(duration_days),
        features: features || null,
        is_active: is_active !== undefined ? is_active : true,
        updated_by: updated_by || null
      },
      include: {
        updated_by_user: {
          select: {
            full_name: true,
            role: true
          }
        }
      }
    });

    return NextResponse.json(packageData, { status: 201 });
  } catch (error) {
    console.error('Error creating package:', error);
    return NextResponse.json({ error: 'Failed to create package' }, { status: 500 });
  }
}

// PUT - Update package
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const {
      package_id,
      package_name,
      package_description,
      price,
      duration_days,
      features,
      is_active,
      updated_by
    } = body;

    if (!package_id) {
      return NextResponse.json({ error: 'Package ID is required' }, { status: 400 });
    }

    const packageData = await prisma.package.update({
      where: { package_id },
      data: {
        package_name,
        package_description,
        price: price ? parseFloat(price) : undefined,
        duration_days: duration_days ? parseInt(duration_days) : undefined,
        features,
        is_active,
        updated_by
      },
      include: {
        updated_by_user: {
          select: {
            full_name: true,
            role: true
          }
        }
      }
    });

    return NextResponse.json(packageData);
  } catch (error) {
    console.error('Error updating package:', error);
    return NextResponse.json({ error: 'Failed to update package' }, { status: 500 });
  }
}

// DELETE - Delete package
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (!id) {
      return NextResponse.json({ error: 'Package ID is required' }, { status: 400 });
    }

    await prisma.package.delete({
      where: { package_id: id }
    });

    return NextResponse.json({ message: 'Package deleted successfully' });
  } catch (error) {
    console.error('Error deleting package:', error);
    return NextResponse.json({ error: 'Failed to delete package' }, { status: 500 });
  }
}

