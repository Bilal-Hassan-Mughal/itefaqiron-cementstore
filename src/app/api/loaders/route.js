import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope, resolveUpdatedByUserId } from '@/lib/branch-server';

const buildLoaderSummary = (rows) => {
  const list = Array.isArray(rows) ? rows : [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const totalBalance = list.reduce((sum, row) => sum + parseFloat(row.loader_balance || 0), 0);

  return {
    totalRecords: list.length,
    positiveBalance: list.filter((l) => parseFloat(l.loader_balance || 0) > 0).length,
    negativeBalance: list.filter((l) => parseFloat(l.loader_balance || 0) < 0).length,
    zeroBalance: list.filter((l) => parseFloat(l.loader_balance || 0) === 0).length,
    totalBalance: Number(totalBalance.toFixed(2)),
    thisMonth: list.filter((l) => l.created_at && new Date(l.created_at) >= monthStart).length,
  };
};

const applyBalanceFilter = (balanceFilter) => {
  if (balanceFilter === 'positive') return { loader_balance: { gt: 0 } };
  if (balanceFilter === 'negative') return { loader_balance: { lt: 0 } };
  if (balanceFilter === 'zero') return { loader_balance: 0 };
  return {};
};

// GET - Fetch loaders (list with pagination or single by id)
export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') ? parseInt(searchParams.get('id')) : null;

    if (id) {
      const loader = await prisma.loader.findUnique({
        where: { loader_id: id },
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

      if (!loader) {
        return NextResponse.json({ error: 'Loader not found' }, { status: 404 });
      }

      return NextResponse.json(loader);
    }

    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const search = (searchParams.get('search') || '').trim();
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const balanceFilter = searchParams.get('balanceFilter') || 'all';
    const skip = (page - 1) * limit;

    const allowedSort = ['created_at', 'loader_name', 'loader_number', 'loader_balance', 'updated_at'];
    const orderField = allowedSort.includes(sortBy) ? sortBy : 'created_at';
    const orderDir = sortOrder === 'asc' ? 'asc' : 'desc';

    const searchWhere = search
      ? {
          OR: [
            { loader_name: { contains: search } },
            { loader_number: { contains: search } },
            { loader_phone: { contains: search } },
          ],
        }
      : {};

    const where = {
      ...searchWhere,
      ...applyBalanceFilter(balanceFilter),
    };

    const [loaders, total, summaryRows] = await Promise.all([
      prisma.loader.findMany({
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
      prisma.loader.count({ where }),
      prisma.loader.findMany({
        where,
        select: {
          loader_balance: true,
          created_at: true,
        },
      }),
    ]);

    return NextResponse.json({
      loaders,
      summary: buildLoaderSummary(summaryRows),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching loaders:', error);
    return NextResponse.json({ error: 'Failed to fetch loaders' }, { status: 500 });
  }
}

// POST - Create new loader
export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;

  try {
    const body = await request.json();
    const { loader_name, loader_number, loader_phone, loader_balance, updated_by } = body;

    if (!loader_name || !String(loader_name).trim()) {
      return NextResponse.json({ error: 'Loader name is required' }, { status: 400 });
    }

    if (!loader_number || !String(loader_number).trim()) {
      return NextResponse.json({ error: 'Loader number is required' }, { status: 400 });
    }

    const loaderNumber = String(loader_number).trim();

    const existingLoader = await prisma.loader.findUnique({
      where: { loader_number: loaderNumber },
    });

    if (existingLoader) {
      return NextResponse.json({ error: 'Loader number already exists' }, { status: 409 });
    }

    const validatedUpdatedBy = await resolveUpdatedByUserId(request, updated_by, prisma);

    const loader = await prisma.loader.create({
      data: {
        loader_name: String(loader_name).trim(),
        loader_number: loaderNumber,
        loader_phone: loader_phone ? String(loader_phone).trim() : null,
        loader_balance: loader_balance != null ? parseFloat(loader_balance) || 0 : 0,
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

    return NextResponse.json(loader, { status: 201 });
  } catch (error) {
    console.error('Error creating loader:', error);
    return NextResponse.json({ error: 'Failed to create loader' }, { status: 500 });
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
      return NextResponse.json({ error: 'ID, loader name and loader number are required' }, { status: 400 });
    }

    const loaderNumber = String(loader_number).trim();

    const existingLoader = await prisma.loader.findUnique({
      where: { loader_id: id },
    });

    if (!existingLoader) {
      return NextResponse.json({ error: 'Loader not found' }, { status: 404 });
    }

    if (loaderNumber !== existingLoader.loader_number) {
      const duplicateLoader = await prisma.loader.findUnique({
        where: { loader_number: loaderNumber },
      });

      if (duplicateLoader) {
        return NextResponse.json({ error: 'Loader number already exists' }, { status: 409 });
      }
    }

    const validatedUpdatedBy = await resolveUpdatedByUserId(request, updated_by, prisma);

    const loader = await prisma.loader.update({
      where: { loader_id: id },
      data: {
        loader_name: String(loader_name).trim(),
        loader_number: loaderNumber,
        loader_phone: loader_phone ? String(loader_phone).trim() : null,
        loader_balance: loader_balance != null ? parseFloat(loader_balance) || 0 : existingLoader.loader_balance,
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

    return NextResponse.json(loader);
  } catch (error) {
    console.error('Error updating loader:', error);
    return NextResponse.json({ error: 'Failed to update loader' }, { status: 500 });
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
      return NextResponse.json({ error: 'Loader ID is required' }, { status: 400 });
    }

    await prisma.loader.delete({
      where: { loader_id: id },
    });

    return NextResponse.json({ message: 'Loader deleted successfully' });
  } catch (error) {
    console.error('Error deleting loader:', error);
    return NextResponse.json({ error: 'Failed to delete loader' }, { status: 500 });
  }
}
