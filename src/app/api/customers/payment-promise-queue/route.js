import { NextResponse } from 'next/server';
import {
  clearWhatsappReminderSent,
  listPaymentPromiseQueue,
  markWhatsappReminderSent,
  summarizePaymentPromiseQueue,
} from '@/lib/customer-payment-promise-db';
import { initBranchScope, resolveBranchId } from '@/lib/branch-server';

export async function GET(request) {
  const scope = await initBranchScope(request);
  if (scope.error) return scope.error;
  const branchId = resolveBranchId(request);
  const { searchParams } = new URL(request.url);

  try {
    const items = await listPaymentPromiseQueue(branchId, {
      date: searchParams.get('date') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      send: searchParams.get('send') || 'all',
      overdue: searchParams.get('overdue') || undefined,
      search: searchParams.get('search') || undefined,
    });

    const viewDate = searchParams.get('date') || searchParams.get('from') || null;
    const stats = summarizePaymentPromiseQueue(items, viewDate);
    return NextResponse.json({
      items,
      stats: {
        ...stats,
        readyPending: stats.readyToSend,
      },
    });
  } catch (err) {
    console.error('payment-promise-queue GET', err);
    const msg = String(err?.message || '');
    if (msg.includes('whatsapp_reminder_sent_at')) {
      return NextResponse.json(
        {
          error:
            'Database needs migration add_payment_promise_whatsapp_sent (whatsapp_reminder_sent_at column).',
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'Failed to load payment promise queue' }, { status: 500 });
  }
}

export async function POST(request) {
  const scope = await initBranchScope(request);
  if (scope.error) return scope.error;
  const branchId = resolveBranchId(request);

  try {
    const body = await request.json();
    const action = body.action;
    const promiseIds = Array.isArray(body.promise_ids) ? body.promise_ids : [];
    const sentBy = body.sent_by != null ? parseInt(body.sent_by, 10) : null;

    if (!promiseIds.length) {
      return NextResponse.json({ error: 'promise_ids required' }, { status: 400 });
    }

    if (action === 'mark_sent') {
      const result = await markWhatsappReminderSent(branchId, promiseIds, sentBy);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'clear_sent') {
      const result = await clearWhatsappReminderSent(branchId, promiseIds);
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: 'action must be mark_sent or clear_sent' }, { status: 400 });
  } catch (err) {
    console.error('payment-promise-queue POST', err);
    return NextResponse.json({ error: 'Failed to update send status' }, { status: 500 });
  }
}
