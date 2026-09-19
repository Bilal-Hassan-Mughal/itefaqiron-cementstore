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

function activityCreatedWhere(fromDateStr, beforeDateStr) {
  const before = pkDayRange(beforeDateStr)?.gte;
  if (!before) return null;
  const after = fromDateStr ? pkDayRange(fromDateStr)?.gte : null;
  return after ? { gte: after, lt: before } : { lt: before };
}

/**
 * Earliest Pakistan day with bills in [fromDateStr, beforeDateStr).
 * fromDateStr null = from the first bill on this branch.
 */
export async function findEarliestActivityPkDateBefore(beforeDateStr, fromDateStr = null) {
  const createdWhere = activityCreatedWhere(fromDateStr, beforeDateStr);
  const beforeBiz = pkBusinessDate(beforeDateStr);
  if (!createdWhere || !beforeBiz) return null;

  const journalWhere = {
    status: { not: 'DRAFT' },
    journal_date: fromDateStr
      ? { gte: pkBusinessDate(fromDateStr), lt: beforeBiz }
      : { lt: beforeBiz },
  };

  const rows = await Promise.all([
    prisma.sale.findFirst({ where: { created_at: createdWhere, bill_type: 'BILL' }, orderBy: { created_at: 'asc' }, select: { created_at: true } }),
    prisma.purchase.findFirst({ where: { created_at: createdWhere }, orderBy: { created_at: 'asc' }, select: { created_at: true } }),
    prisma.expense.findFirst({ where: { created_at: createdWhere }, orderBy: { created_at: 'asc' }, select: { created_at: true } }),
    prisma.saleReturn.findFirst({ where: { created_at: createdWhere }, orderBy: { created_at: 'asc' }, select: { created_at: true } }),
    prisma.purchaseReturn.findFirst({ where: { created_at: createdWhere }, orderBy: { created_at: 'asc' }, select: { created_at: true } }),
    prisma.ledger.findFirst({ where: { created_at: createdWhere }, orderBy: { created_at: 'asc' }, select: { created_at: true } }),
    prisma.payment.findFirst({ where: { created_at: createdWhere }, orderBy: { created_at: 'asc' }, select: { created_at: true } }),
    prisma.employeeAdvance.findFirst({ where: { created_at: createdWhere }, orderBy: { created_at: 'asc' }, select: { created_at: true } }),
    prisma.journal.findFirst({ where: journalWhere, orderBy: { journal_date: 'asc' }, select: { journal_date: true } }),
  ]);

  let earliest = null;
  for (const row of rows) {
    const stamp = row?.created_at || row?.journal_date;
    if (stamp && (!earliest || stamp < earliest)) earliest = stamp;
  }
  return earliest ? getPkDateString(earliest) : null;
}

/** Oldest unclosed activity day before dateStr. Empty days after the last close are skipped. */
export async function findRequiredCloseDate(dateStr) {
  const lastClosed = await prisma.dayEnd.findFirst({
    where: { status: 'CLOSED', business_date: { lt: pkBusinessDate(dateStr) } },
    orderBy: { business_date: 'desc' },
    select: { business_date: true },
  });
  const fromDate = lastClosed ? shiftPkDate(getPkDateString(lastClosed.business_date), 1) : null;
  return findEarliestActivityPkDateBefore(dateStr, fromDate);
}

/** Next day that still needs closing after a successful close. */
export async function findNextCloseableDate(afterDateStr) {
  const today = getPkDateString();
  const start = shiftPkDate(afterDateStr, 1);
  if (!start || start > today) return null;
  const tomorrow = shiftPkDate(today, 1);
  return findEarliestActivityPkDateBefore(tomorrow, start) || (start <= today ? today : null);
}

/**
 * Oldest unclosed activity day before dateStr. Used by close-order checks.
 */
export async function findPreviousOpenActivityDay(dateStr) {
  const required = await findRequiredCloseDate(dateStr);
  if (required && required < dateStr) return required;
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
      error: `${previousOpenDate} is the oldest open day with bills. Close that day first, then the next open day.`,
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
