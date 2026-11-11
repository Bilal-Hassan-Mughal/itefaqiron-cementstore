import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { initBranchScope, resolveBranchId, mergeBranchWhere } from '@/lib/branch-server';
import {
  cancelActiveForCustomer,
  createActivePromise,
  findActiveForCustomer,
  findActivePromisesForBranch,
  findHistoryForCustomer,
  findPromiseById,
  patchPromiseStatus,
} from '@/lib/customer-payment-promise-db';

function parsePayDate(value) {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// GET ?cus_id= — one account; GET ?summary=active — all active promises for branch
export async function GET(request) {
  const scope = await initBranchScope(request);
  if (scope.error) return scope.error;
  const branchId = resolveBranchId(request);
  const { searchParams } = new URL(request.url);
  const cusId = searchParams.get('cus_id');
  const summary = searchParams.get('summary');

  try {
    if (summary === 'active') {
      const rows = await findActivePromisesForBranch(branchId);
      const byCusId = {};
      rows.forEach((r) => {
        byCusId[r.cus_id] = r;
      });
      return NextResponse.json({ promises: rows, byCusId });
    }

    if (!cusId) {
      return NextResponse.json({ error: 'cus_id or summary=active required' }, { status: 400 });
    }

    const parsedCusId = parseInt(cusId, 10);
    const active = await findActiveForCustomer(branchId, parsedCusId);
    const history = await findHistoryForCustomer(branchId, parsedCusId, 8);

    return NextResponse.json({ active, history });
  } catch (err) {
    console.error('payment-promise GET', err);
    const message = err?.message?.includes("doesn't exist")
      ? 'Run DB migration: prisma/migrations/add_customer_payment_promises/migration.sql'
      : 'Failed to load payment promise';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST — set / replace active promise
export async function POST(request) {
  const scope = await initBranchScope(request);
  if (scope.error) return scope.error;
  const branchId = resolveBranchId(request);

  try {
    const body = await request.json();
    const cusId = parseInt(body.cus_id, 10);
    const promisedPayDate = parsePayDate(body.promised_pay_date);
    const promisedAmount = body.promised_amount != null && body.promised_amount !== ''
      ? parseFloat(body.promised_amount)
      : null;
    const note = body.note?.trim() || null;
    const createdBy = body.created_by != null ? parseInt(body.created_by, 10) : null;

    if (!cusId || !promisedPayDate) {
      return NextResponse.json({ error: 'cus_id and promised_pay_date are required' }, { status: 400 });
    }

    const customer = await prisma.customer.findFirst({
      where: mergeBranchWhere(branchId, { cus_id: cusId }),
    });
    if (!customer) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }

    await cancelActiveForCustomer(branchId, cusId);

    const created = await createActivePromise({
      branchId,
      cusId,
      promisedPayDate,
      promisedAmount,
      note,
      createdBy,
    });

    return NextResponse.json({ success: true, promise: created });
  } catch (err) {
    console.error('payment-promise POST', err);
    const message = err?.message?.includes("doesn't exist")
      ? 'Run DB migration: prisma/migrations/add_customer_payment_promises/migration.sql'
      : 'Failed to save payment promise';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH — fulfill (paid) or cancel
export async function PATCH(request) {
  const scope = await initBranchScope(request);
  if (scope.error) return scope.error;
  const branchId = resolveBranchId(request);

  try {
    const body = await request.json();
    const promiseId = parseInt(body.promise_id, 10);
    const action = body.action;

    if (!promiseId || !['fulfill', 'cancel'].includes(action)) {
      return NextResponse.json({ error: 'promise_id and action (fulfill|cancel) required' }, { status: 400 });
    }

    const existing = await findPromiseById(branchId, promiseId);
    if (!existing) {
      return NextResponse.json({ error: 'Promise not found' }, { status: 404 });
    }

    const updated = await patchPromiseStatus(branchId, promiseId, action);

    return NextResponse.json({ success: true, promise: updated });
  } catch (err) {
    console.error('payment-promise PATCH', err);
    return NextResponse.json({ error: 'Failed to update payment promise' }, { status: 500 });
  }
}
