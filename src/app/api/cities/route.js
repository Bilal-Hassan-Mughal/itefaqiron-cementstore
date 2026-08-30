import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getNextId } from '@/lib/id-helper';
import { initBranchScope } from '@/lib/branch-server';

// GET - Fetch all cities
export async function GET() {
  try {
    const cities = await prisma.city.findMany({
      orderBy: {
        created_at: 'desc'
      }
    });

    return NextResponse.json(cities);
  } catch (error) {
    console.error('Error fetching cities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cities' },
      { status: 500 }
    );
  }
}

// POST - Create new city
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { city_name, updated_by } = body;

    if (!city_name) {
      return NextResponse.json(
        { error: 'City name is required' },
        { status: 400 }
      );
    }

    // Prevent duplicate city names (exact match)
    const existing = await prisma.city.findFirst({ where: { city_name: city_name.trim() } });
    if (existing) {
      return NextResponse.json({ error: 'City with this name already exists' }, { status: 409 });
    }

    const city_id = body.city_id || await getNextId('city', 'city_id');

    const city = await prisma.city.create({
      data: {
        city_id,
        city_name: city_name.trim(),
        updated_by
      }
    });

    return NextResponse.json(city, { status: 201 });
  } catch (error) {
    console.error('Error creating city:', error);
    return NextResponse.json(
      { error: 'Failed to create city' },
      { status: 500 }
    );
  }
}

// PUT - Update city
export async function PUT(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { id, city_name, updated_by } = body;

    if (!id || !city_name) {
      return NextResponse.json(
        { error: 'ID and city name are required' },
        { status: 400 }
      );
    }

    // Prevent duplicate city names on update (exclude current city)
    const existing = await prisma.city.findFirst({ where: { city_name: city_name.trim(), NOT: { city_id: id } } });
    if (existing) {
      return NextResponse.json({ error: 'City with this name already exists' }, { status: 409 });
    }

    const city = await prisma.city.update({
      where: { city_id: id },
      data: {
        city_name: city_name.trim(),
        updated_by
      }
    });

    return NextResponse.json(city);
  } catch (error) {
    console.error('Error updating city:', error);
    return NextResponse.json(
      { error: 'Failed to update city' },
      { status: 500 }
    );
  }
}

// DELETE - Delete city
export async function DELETE(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (!id) {
      return NextResponse.json(
        { error: 'City ID is required' },
        { status: 400 }
      );
    }

    // Check if city is being used by any customers
    const customersUsingCity = await prisma.customer.count({
      where: { city_id: id }
    });

    if (customersUsingCity > 0) {
      return NextResponse.json(
        { error: 'Cannot delete city that is being used by customers' },
        { status: 400 }
      );
    }

    await prisma.city.delete({
      where: { city_id: id }
    });

    return NextResponse.json({ message: 'City deleted successfully' });
  } catch (error) {
    console.error('Error deleting city:', error);
    return NextResponse.json(
      { error: 'Failed to delete city' },
      { status: 500 }
    );
  }
}


