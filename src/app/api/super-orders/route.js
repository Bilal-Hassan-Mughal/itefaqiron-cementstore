import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { initBranchScope, resolveUpdatedByUserId, mergeBranchWhere, withBranchData } from '@/lib/branch-server';

function errorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function getNextOrderNo(branchId, orderDateStr) {
  const datePart = (orderDateStr || new Date().toISOString().slice(0, 10)).replace(/-/g, '');
  const prefix = `SO-${datePart}-`;

  const last = await prisma.superOrder.findFirst({
    where: {
      branch_id: branchId,
      order_no: { startsWith: prefix },
    },
    orderBy: { super_order_id: 'desc' },
    select: { order_no: true },
  });

  if (!last) return `${prefix}001`;

  const tail = parseInt(last.order_no.slice(prefix.length), 10);
  const next = Number.isNaN(tail) ? 1 : tail + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}

export async function GET(request) {
  const scope = await initBranchScope(request);
  if (scope.error) return scope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const order = await prisma.superOrder.findFirst({
        where: mergeBranchWhere(scope.branchId, { super_order_id: parseInt(id, 10), is_active: true }),
        include: {
          created_by_user: { select: { user_id: true, full_name: true } },
        },
      });
      if (!order) return errorResponse('Super order not found', 404);

      let payload = {};
      try {
        payload = JSON.parse(order.payload_json || '{}');
      } catch {
        payload = {};
      }

      return NextResponse.json({ ...order, payload });
    }

    const orders = await prisma.superOrder.findMany({
      where: mergeBranchWhere(scope.branchId, { is_active: true }),
      select: {
        super_order_id: true,
        order_no: true,
        order_date: true,
        supplier_name: true,
        notes: true,
        store_id: true,
        total_lines: true,
        total_qty: true,
        created_at: true,
        updated_at: true,
        created_by_user: { select: { user_id: true, full_name: true } },
      },
      orderBy: { updated_at: 'desc' },
    });

    return NextResponse.json({ orders });
  } catch (err) {
    console.error('GET /api/super-orders', err);
    return errorResponse(err.message || 'Failed to load super orders', 500);
  }
}

export async function POST(request) {
  const scope = await initBranchScope(request);
  if (scope.error) return scope.error;

  try {
    const body = await request.json();
    const {
      super_order_id,
      order_date,
      supplier_name,
      notes,
      store_id,
      payload,
      total_lines,
      total_qty,
      updated_by,
    } = body;

    if (!payload) return errorResponse('payload is required');
    if (!order_date) return errorResponse('order_date is required');

    const lines = payload?.lines || [];
    if (lines.length === 0) return errorResponse('Add at least one product quantity before saving');

    const payloadJson = typeof payload === 'string' ? payload : JSON.stringify(payload);
    const createdBy = await resolveUpdatedByUserId(request, updated_by, prisma);
    const orderDate = new Date(`${order_date}T12:00:00.000Z`);

    if (super_order_id) {
      const existing = await prisma.superOrder.findFirst({
        where: mergeBranchWhere(scope.branchId, { super_order_id: parseInt(super_order_id, 10), is_active: true }),
      });
      if (!existing) return errorResponse('Super order not found', 404);

      const updated = await prisma.superOrder.update({
        where: { super_order_id: existing.super_order_id },
        data: {
          order_date: orderDate,
          supplier_name: supplier_name?.trim() || null,
          notes: notes?.trim() || null,
          store_id: store_id ? parseInt(store_id, 10) : null,
          payload_json: payloadJson,
          total_lines: parseInt(total_lines, 10) || lines.length,
          total_qty: parseFloat(total_qty) || 0,
          created_by: createdBy,
        },
        include: {
          created_by_user: { select: { user_id: true, full_name: true } },
        },
      });

      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(updated.payload_json || '{}');
      } catch {
        parsedPayload = {};
      }

      return NextResponse.json({ ...updated, payload: parsedPayload });
    }

    const orderNo = await getNextOrderNo(scope.branchId, order_date);

    const created = await prisma.superOrder.create({
      data: withBranchData(scope.branchId, {
        order_no: orderNo,
        order_date: orderDate,
        supplier_name: supplier_name?.trim() || null,
        notes: notes?.trim() || null,
        store_id: store_id ? parseInt(store_id, 10) : null,
        payload_json: payloadJson,
        total_lines: parseInt(total_lines, 10) || lines.length,
        total_qty: parseFloat(total_qty) || 0,
        is_active: true,
        created_by: createdBy,
      }),
      include: {
        created_by_user: { select: { user_id: true, full_name: true } },
      },
    });

    let parsedPayload = {};
    try {
      parsedPayload = JSON.parse(created.payload_json || '{}');
    } catch {
      parsedPayload = {};
    }

    return NextResponse.json({ ...created, payload: parsedPayload }, { status: 201 });
  } catch (err) {
    console.error('POST /api/super-orders', err);
    return errorResponse(err.message || 'Failed to save super order', 500);
  }
}

export async function DELETE(request) {
  const scope = await initBranchScope(request);
  if (scope.error) return scope.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return errorResponse('id is required');

    const existing = await prisma.superOrder.findFirst({
      where: mergeBranchWhere(scope.branchId, { super_order_id: parseInt(id, 10), is_active: true }),
    });
    if (!existing) return errorResponse('Super order not found', 404);

    await prisma.superOrder.update({
      where: { super_order_id: existing.super_order_id },
      data: { is_active: false },
    });

    return NextResponse.json({ success: true, message: `Order ${existing.order_no} deleted` });
  } catch (err) {
    console.error('DELETE /api/super-orders', err);
    return errorResponse(err.message || 'Failed to delete super order', 500);
  }
}
