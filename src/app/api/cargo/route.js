import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';


export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (id) {
      // Get single cargo by ID
      const cargo = await prisma.cargo.findUnique({
        where: { cargo_id: id },
        include: {
          updated_by_user: {
            select: {
              full_name: true,
              email: true
            }
          }
        }
      });

      if (!cargo) {
        return NextResponse.json({ error: 'Cargo not found' }, { status: 404 });
      }

      return NextResponse.json(cargo);
    } else {
      // Get all cargo with pagination and search
      const page = parseInt(searchParams.get('page')) || 1;
      const limit = parseInt(searchParams.get('limit')) || 50;
      const search = searchParams.get('search') || '';
      const sortBy = searchParams.get('sortBy') || 'created_at';
      const sortOrder = searchParams.get('sortOrder') || 'desc';

      const skip = (page - 1) * limit;

      const where = search ? {
        OR: [
          { vehicle_no: { contains: search } }
        ]
      } : {}; 

      const [cargo, total] = await Promise.all([
        prisma.cargo.findMany({
          where,
          include: {
            updated_by_user: {
              select: {
                full_name: true,
                email: true
              }
            }
          },
          orderBy: { [sortBy]: sortOrder },
          skip,
          take: limit
        }),
        prisma.cargo.count({ where })
      ]);

      return NextResponse.json({
        cargo,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    }
  } catch (error) {
    console.error('Error fetching cargo:', error);
    return NextResponse.json({ error: 'Failed to fetch cargo' }, { status: 500 });
  }
}

export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const {
      vehicle_no,
      total_cargo_fare,
      exp1,
      exp2,
      exp3,
      exp4,
      exp5,
      exp6,
      others,
      updated_by
    } = body;

    // Validation
    if (!vehicle_no) {
      return NextResponse.json({ error: 'Vehicle number is required' }, { status: 400 });
    }

    const cargo = await prisma.cargo.create({
      data: {
        vehicle_no,
        total_cargo_fare: parseFloat(total_cargo_fare) || 0,
        exp1: parseFloat(exp1) || 0,
        exp2: parseFloat(exp2) || 0,
        exp3: parseFloat(exp3) || 0,
        exp4: parseFloat(exp4) || 0,
        exp5: parseFloat(exp5) || 0,
        exp6: parseFloat(exp6) || 0,
        others: parseFloat(others) || 0,
        updated_by
      },
      include: {
        updated_by_user: {
          select: {
            full_name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(cargo, { status: 201 });
  } catch (error) {
    console.error('Error creating cargo:', error);
    return NextResponse.json({ error: 'Failed to create cargo' }, { status: 500 });
  }
}

export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const {
      id,
      vehicle_no,
      total_cargo_fare,
      exp1,
      exp2,
      exp3,
      exp4,
      exp5,
      exp6,
      others,
      updated_by
    } = body;

    // Validation
    if (!id) {
      return NextResponse.json({ error: 'Cargo ID is required' }, { status: 400 });
    }

    if (!vehicle_no) {
      return NextResponse.json({ error: 'Vehicle number is required' }, { status: 400 });
    }

    const cargo = await prisma.cargo.update({
      where: { cargo_id: id },
      data: {
        vehicle_no,
        total_cargo_fare: parseFloat(total_cargo_fare) || 0,
        exp1: parseFloat(exp1) || 0,
        exp2: parseFloat(exp2) || 0,
        exp3: parseFloat(exp3) || 0,
        exp4: parseFloat(exp4) || 0,
        exp5: parseFloat(exp5) || 0,
        exp6: parseFloat(exp6) || 0,
        others: parseFloat(others) || 0,
        updated_by
      },
      include: {
        updated_by_user: {
          select: {
            full_name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(cargo);
  } catch (error) {
    console.error('Error updating cargo:', error);
    return NextResponse.json({ error: 'Failed to update cargo' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (!id) {
      return NextResponse.json({ error: 'Cargo ID is required' }, { status: 400 });
    }

    await prisma.cargo.delete({
      where: { cargo_id: id }
    });

    return NextResponse.json({ message: 'Cargo deleted successfully' });
  } catch (error) {
    console.error('Error deleting cargo:', error);
    return NextResponse.json({ error: 'Failed to delete cargo' }, { status: 500 });
  }
}
