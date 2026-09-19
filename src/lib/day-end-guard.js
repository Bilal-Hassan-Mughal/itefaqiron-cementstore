import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPkDateString, pkBusinessDate, pkDayRange, shiftPkDate } from '@/lib/date-helper';

export function dayClosedResponse(dateStr) {
  return NextResponse.json(
    {
      error: `Day End is closed for ${dateStr}. Re-open Day End before posting transactions.`,
      code: 'DAY_CLOSED',
      business_date: dateStr,
    },
    { status: 409 }
  );
}

export async function findClosedDayEnd(dateStr) {
  const businessDate = pkBusinessDate(dateStr);
  if (!businessDate) return null;
  return prisma.dayEnd.findFirst({
    where: { business_date: businessDate, status: 'CLOSED' },
    select: { day_end_id: true, status: true, business_date: true },
  });
}

/** Call after initBranchScope so branch isolation is active. */
export async function rejectIfDayClosed(dateStr) {
  const businessDateStr = dateStr || getPkDateString();
  const closed = await findClosedDayEnd(businessDateStr);
  if (!closed) return null;
  return dayClosedResponse(businessDateStr);
}

export async function dayHasPostingActivity(dateStr) {
  const range = pkDayRange(dateStr);
  const journalDate = pkBusinessDate(dateStr);
  if (!range || !journalDate) return false;

  const [sales, purchases, expenses, saleReturns, purchaseReturns, ledgers, payments, journals, advances] =
    await Promise.all([
      prisma.sale.count({ where: { created_at: range, bill_type: 'BILL' } }),
      prisma.purchase.count({ where: { created_at: range } }),
      prisma.expense.count({ where: { created_at: range } }),
      prisma.saleReturn.count({ where: { created_at: range } }),
      prisma.purchaseReturn.count({ where: { created_at: range } }),
      prisma.ledger.count({ where: { created_at: range } }),
      prisma.payment.count({ where: { created_at: range } }),
      prisma.journal.count({ where: { journal_date: journalDate, status: { not: 'DRAFT' } } }),
      prisma.employeeAdvance.count({ where: { created_at: range } }),
    ]);

  return (
    sales +
      purchases +
      expenses +
      saleReturns +
      purchaseReturns +
      ledgers +
      payments +
      journals +
      advances >
    0
  );
}

/**
 * Today cannot close while yesterday still has unclosed bills.
 * A past date can be closed as catch-up without forcing older imported history.
 */
export async function findPreviousOpenActivityDay(dateStr) {
  const today = getPkDateString();
  if (dateStr < today) return null;

  const yesterday = shiftPkDate(dateStr, -1);
  if (!yesterday || yesterday >= dateStr) return null;

  const alreadyClosed = await prisma.dayEnd.findFirst({
    where: { business_date: pkBusinessDate(yesterday), status: 'CLOSED' },
    select: { day_end_id: true },
  });
  if (alreadyClosed) return null;
  if (await dayHasPostingActivity(yesterday)) return yesterday;
  return null;
}

export async function inspectCloseReadiness(dateStr) {
  const today = getPkDateString();
  if (dateStr > today) {
    return {
      ok: false,
      code: 'FUTURE_DATE',
      error: `Cannot close a future date (${dateStr}).`,
      previousOpenDate: null,
    };
  }

  const businessDate = pkBusinessDate(dateStr);
  if (!businessDate) {
    return { ok: false, code: 'INVALID_DATE', error: 'Invalid business date.', previousOpenDate: null };
  }

  const laterClosed = await prisma.dayEnd.findFirst({
    where: { status: 'CLOSED', business_date: { gt: businessDate } },
    orderBy: { business_date: 'asc' },
    select: { business_date: true },
  });
  if (laterClosed) {
    const later = getPkDateString(laterClosed.business_date);
    return {
      ok: false,
      code: 'LATER_DAY_CLOSED',
      error: `Re-open ${later} first. A later day is already closed.`,
      previousOpenDate: later,
    };
  }

  const prevIncomplete = await prisma.dayEnd.findFirst({
    where: {
      business_date: { lt: businessDate },
      OR: [
        { status: 'CLOSED' },
        { closed_at: { not: null } },
        { closing_cash: { not: null } },
      ],
    },
    orderBy: { business_date: 'desc' },
    select: { status: true, business_date: true },
  });
  if (prevIncomplete && prevIncomplete.status !== 'CLOSED') {
    const prev = getPkDateString(prevIncomplete.business_date);
    return {
      ok: false,
      code: 'PREVIOUS_DAY_OPEN',
      error: `Close ${prev} first. Days must be closed in order.`,
      previousOpenDate: prev,
    };
  }

  const previousOpenDate = await findPreviousOpenActivityDay(dateStr);
  if (previousOpenDate) {
    return {
      ok: false,
      code: 'PREVIOUS_DAY_OPEN',
      error: `${previousOpenDate} still has unclosed bills. Close that day first.`,
      previousOpenDate,
    };
  }

  return { ok: true, code: null, error: null, previousOpenDate: null };
}

/** Industry close order: no future date, previous open day must be closed first. */
export async function assertCanCloseBusinessDay(dateStr) {
  const readiness = await inspectCloseReadiness(dateStr);
  if (readiness.ok) return null;
  return NextResponse.json(
    {
      error: readiness.error,
      code: readiness.code,
      previous_open_date: readiness.previousOpenDate,
    },
    { status: 400 }
  );
}
