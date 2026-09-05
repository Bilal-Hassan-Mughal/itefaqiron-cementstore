import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope, resolveUpdatedByUserId } from '@/lib/branch-server';

const buildVehicleSummary = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    totalRecords: list.length,
    withDrivers: list.filter((v) => (v.v_driver_name || '').trim()).length,
    withPhone: list.filter((v) => (v.v_driver_no || '').trim()).length,
    thisMonth: list.filter((v) => v.created_at && new Date(v.created_at) >= monthStart).length,
  };
};

// GET - Fetch vehicles (list with pagination or single by id)
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (id) {
      const vehicle = await prisma.vehicle.findUnique({
        where: { v_id: id },
        include: {
          updated_by_user: {
            select: {
              user_id: true,
              full_name: true,
              role: true,
            },
          },
        },
      });

      if (!vehicle) {
        return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
      }

      return NextResponse.json(vehicle);
    }

    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const search = (searchParams.get('search') || '').trim();
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const skip = (page - 1) * limit;

    const allowedSort = ['created_at', 'v_vehicle_no', 'v_driver_name', 'updated_at'];
    const orderField = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';

    const where = search
      ? {
          OR: [
            { v_vehicle_no: { contains: search } },
            { v_driver_name: { contains: search } },
            { v_driver_no: { contains: search } },
          ],
        }
      : {};

    const [vehicles, total, summaryRows] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: {
          updated_by_user: {
            select: {
              user_id: true,
              full_name: true,
              role: true,
            },
          },
        },
        orderBy: { [orderField]: orderDir },
        skip,
        take: limit,
      }),
      prisma.vehicle.count({ where }),
      prisma.vehicle.findMany({
        where,
        select: {
          v_driver_name: true,
          v_driver_no: true,
          created_at: true,
        },
      }),
    ]);

    return NextResponse.json({
      vehicles,
      summary: buildVehicleSummary(summaryRows),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return NextResponse.json({ error: 'Failed to fetch vehicles' }, { status: 500 });
  }
}

// POST - Create new vehicle
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { v_vehicle_no, v_driver_no, v_driver_name, updated_by } = body;

    if (!v_vehicle_no || !String(v_vehicle_no).trim()) {
      return NextResponse.json({ error: 'Vehicle number is required' }, { status: 400 });
    }

    const vehicleNo = String(v_vehicle_no).trim().toUpperCase();

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { v_vehicle_no: vehicleNo },
    });

    if (existingVehicle) {
      return NextResponse.json({ error: 'Vehicle number already exists' }, { status: 409 });
    }

    const validatedUpdatedBy = await resolveUpdatedByUserId(request, updated_by, prisma);

    const vehicle = await prisma.vehicle.create({
      data: {
        v_vehicle_no: vehicleNo,
        v_driver_no: v_driver_no ? String(v_driver_no).trim() : null,
        v_driver_name: v_driver_name ? String(v_driver_name).trim() : null,
        updated_by: validatedUpdatedBy,
      },
      include: {
        updated_by_user: {
          select: {
            user_id: true,
            full_name: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    console.error('Error creating vehicle:', error);
    return NextResponse.json({ error: 'Failed to create vehicle' }, { status: 500 });
  }
}

// PUT - Update vehicle
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { id, v_vehicle_no, v_driver_no, v_driver_name, updated_by } = body;

    if (!id || !v_vehicle_no || !String(v_vehicle_no).trim()) {
      return NextResponse.json({ error: 'ID and vehicle number are required' }, { status: 400 });
    }

    const vehicleNo = String(v_vehicle_no).trim().toUpperCase();

    const existingVehicle = await prisma.vehicle.findUnique({
      where: { v_id: id },
    });

    if (!existingVehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    if (vehicleNo !== existingVehicle.v_vehicle_no) {
      const duplicateVehicle = await prisma.vehicle.findUnique({
        where: { v_vehicle_no: vehicleNo },
      });

      if (duplicateVehicle) {
        return NextResponse.json({ error: 'Vehicle number already exists' }, { status: 409 });
      }
    }

    const validatedUpdatedBy = await resolveUpdatedByUserId(request, updated_by, prisma);

    const vehicle = await prisma.vehicle.update({
      where: { v_id: id },
      data: {
        v_vehicle_no: vehicleNo,
        v_driver_no: v_driver_no ? String(v_driver_no).trim() : null,
        v_driver_name: v_driver_name ? String(v_driver_name).trim() : null,
        updated_by: validatedUpdatedBy,
      },
      include: {
        updated_by_user: {
          select: {
            user_id: true,
            full_name: true,
            role: true,
          },
        },
      },
    });

    return NextResponse.json(vehicle);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    return NextResponse.json({ error: 'Failed to update vehicle' }, { status: 500 });
  }
}

// DELETE - Delete vehicle
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (!id) {
      return NextResponse.json({ error: 'Vehicle ID is required' }, { status: 400 });
    }

    await prisma.vehicle.delete({
      where: { v_id: id },
    });

    return NextResponse.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    return NextResponse.json({ error: 'Failed to delete vehicle' }, { status: 500 });
  }
}
