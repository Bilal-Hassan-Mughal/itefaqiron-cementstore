import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';

// GET - Fetch all vehicles
export async function GET() {
  try {
    const vehicles = await prisma.vehicle.findMany({
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

    return NextResponse.json(vehicles);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vehicles' },
      { status: 500 }
    );
  }
}

// POST - Create new vehicle
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { v_vehicle_no, v_driver_no, v_driver_name, updated_by } = body;

    if (!v_vehicle_no) {
      return NextResponse.json(
        { error: 'Vehicle number is required' },
        { status: 400 }
      );
    }

    // Check if vehicle number already exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { v_vehicle_no }
    });

    if (existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle number already exists' },
        { status: 409 }
      );
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        v_vehicle_no,
        v_driver_no: v_driver_no || null,
        v_driver_name: v_driver_name || null,
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

    return NextResponse.json(vehicle, { status: 201 });
  } catch (error) {
    console.error('Error creating vehicle:', error);
    return NextResponse.json(
      { error: 'Failed to create vehicle' },
      { status: 500 }
    );
  }
}

// PUT - Update vehicle
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { id, v_vehicle_no, v_driver_no, v_driver_name, updated_by } = body;

    if (!id || !v_vehicle_no) {
      return NextResponse.json(
        { error: 'ID and vehicle number are required' },
        { status: 400 }
      );
    }

    // Check if vehicle exists
    const existingVehicle = await prisma.vehicle.findUnique({
      where: { v_id: id }
    });

    if (!existingVehicle) {
      return NextResponse.json(
        { error: 'Vehicle not found' },
        { status: 404 }
      );
    }

    // Check if new vehicle number conflicts with another vehicle
    if (v_vehicle_no !== existingVehicle.v_vehicle_no) {
      const duplicateVehicle = await prisma.vehicle.findUnique({
        where: { v_vehicle_no }
      });

      if (duplicateVehicle) {
        return NextResponse.json(
          { error: 'Vehicle number already exists' },
          { status: 409 }
        );
      }
    }

    const vehicle = await prisma.vehicle.update({
      where: { v_id: id },
      data: {
        v_vehicle_no,
        v_driver_no: v_driver_no || null,
        v_driver_name: v_driver_name || null,
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

    return NextResponse.json(vehicle);
  } catch (error) {
    console.error('Error updating vehicle:', error);
    return NextResponse.json(
      { error: 'Failed to update vehicle' },
      { status: 500 }
    );
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
      return NextResponse.json(
        { error: 'Vehicle ID is required' },
        { status: 400 }
      );
    }

    await prisma.vehicle.delete({
      where: { v_id: id }
    });

    return NextResponse.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Error deleting vehicle:', error);
    return NextResponse.json(
      { error: 'Failed to delete vehicle' },
      { status: 500 }
    );
  }
}

