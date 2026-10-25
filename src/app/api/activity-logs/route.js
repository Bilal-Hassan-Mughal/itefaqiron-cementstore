import { NextResponse } from 'next/server';
import { prisma, centralPrisma } from '@/lib/prisma';
import { initBranchScope } from '@/lib/branch-server';
import { pkDayRange } from '@/lib/date-helper';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const scope = await initBranchScope(request);
    if (scope.error) return scope.error;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '25', 10)));
    const skip = (page - 1) * limit;

    const action = searchParams.get('action') || '';
    const moduleName = searchParams.get('module') || '';
    const userIdRaw = searchParams.get('userId') || '';
    const search = (searchParams.get('search') || '').trim();
    const fromDate = searchParams.get('fromDate') || '';
    const toDate = searchParams.get('toDate') || '';

    // Build where conditions
    const where = {};

    // Branch filter
    if (scope.branchId) {
      where.branch_id = scope.branchId;
    }

    if (action) {
      where.action = action;
    }

    if (moduleName) {
      where.module = moduleName;
    }

    if (userIdRaw) {
      const uid = parseInt(userIdRaw, 10);
      if (Number.isFinite(uid)) {
        where.user_id = uid;
      }
    }

    // Date range filter
    if (fromDate || toDate) {
      const dateFilter = {};
      if (fromDate) {
        const fromRange = pkDayRange(fromDate);
        if (fromRange?.gte) dateFilter.gte = fromRange.gte;
      }
      if (toDate) {
        const toRange = pkDayRange(toDate);
        if (toRange?.lte) dateFilter.lte = toRange.lte;
      }
      if (Object.keys(dateFilter).length > 0) {
        where.created_at = dateFilter;
      }
    }

    // Search query across description, entity_id, or user_name
    if (search) {
      where.OR = [
        { description: { contains: search } },
        { entity_id: { contains: search } },
        { user_name: { contains: search } },
      ];
    }

    // Attempt retrieval via prisma.activityLog, fallback to raw SQL if table exists
    let logs = [];
    let total = 0;

    try {
      if (prisma?.activityLog) {
        [logs, total] = await Promise.all([
          prisma.activityLog.findMany({
            where,
            orderBy: { created_at: 'desc' },
            skip,
            take: limit,
          }),
          prisma.activityLog.count({ where }),
        ]);
      } else {
        logs = await prisma.$queryRaw`
          SELECT * FROM activity_logs 
          ORDER BY created_at DESC 
          LIMIT ${limit} OFFSET ${skip}
        `;
        const countRes = await prisma.$queryRaw`SELECT COUNT(*) as c FROM activity_logs`;
        total = Number(countRes?.[0]?.c || 0);
      }
    } catch (dbErr) {
      // If table doesn't exist yet on DB, return empty list gracefully
      console.warn('Notice: activity_logs table query failed (might need migration):', dbErr.message);
      return NextResponse.json({
        success: true,
        data: [],
        pagination: {
          page,
          limit,
          total: 0,
          totalPages: 1,
        },
        warning: 'activity_logs table is initializing.',
      });
    }

    // Distinct list of users and modules for easy filtering on frontend
    const usersList = await centralPrisma.users.findMany({
      select: { user_id: true, full_name: true, role: true },
      orderBy: { full_name: 'asc' },
    }).catch(() => []);

    // Summary statistics for KPI cards
    let stats = {
      totalLogs: total,
      todayCount: 0,
      uniqueUsers: 0,
      deletionsCount: 0,
    };

    try {
      const todayRange = pkDayRange();
      const todayFilter = todayRange?.gte ? { created_at: { gte: todayRange.gte } } : {};
      
      const [todayCount, delCount] = await Promise.all([
        prisma.activityLog ? prisma.activityLog.count({ where: { ...(scope.branchId ? { branch_id: scope.branchId } : {}), ...todayFilter } }).catch(() => 0) : 0,
        prisma.activityLog ? prisma.activityLog.count({ where: { ...(scope.branchId ? { branch_id: scope.branchId } : {}), action: 'DELETE' } }).catch(() => 0) : 0,
      ]);

      stats.todayCount = todayCount || 0;
      stats.deletionsCount = delCount || 0;
      stats.uniqueUsers = usersList.length;
    } catch {
      // Non-blocking stats calculation
    }

    return NextResponse.json({
      success: true,
      data: logs,
      users: usersList,
      stats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
