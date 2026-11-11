import { NextResponse } from 'next/server';
import { listPaymentPromiseQueue, summarizePaymentPromiseQueue } from '@/lib/customer-payment-promise-db';
import { initBranchScope, resolveBranchId } from '@/lib/branch-server';
import { BUSINESS_TZ } from '@/lib/account-payment-promise';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const scope = await initBranchScope(request);
  if (scope.error) return scope.error;
  const branchId = resolveBranchId(request);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: BUSINESS_TZ });

  try {
    const items = await listPaymentPromiseQueue(branchId, { date: today, send: 'all' });
    const stats = summarizePaymentPromiseQueue(items, today);

    return NextResponse.json({
      date: today,
      ...stats,
    });
  } catch (err) {
    console.error('payment-promise-summary', err);
    return NextResponse.json({ error: 'Failed to load summary' }, { status: 500 });
  }
}
