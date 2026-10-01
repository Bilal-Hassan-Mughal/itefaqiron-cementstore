import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { initBranchScope, resolveUpdatedByUserId } from '@/lib/branch-server';
import { getPkDateString, pkBusinessDate } from '@/lib/date-helper';
import { assertCanCloseBusinessDay, findNextCloseableDate, inspectCloseReadiness } from '@/lib/day-end-guard';
import { buildDayEndDetails, loadDayEndSnapshot } from '@/lib/day-end-snapshot';

function n(val) {
  const num = parseFloat(val);
  return Number.isFinite(num) ? num : 0;
}

function money(val) {
  const num = parseFloat(val);
  return Math.round((Number.isFinite(num) ? num : 0) * 100) / 100;
}

function freezeClosedSummary(summary, dayEnd) {
  if (!dayEnd || dayEnd.status !== 'CLOSED') return summary;
  const expected = money(summary.expectedCashInHand);
  const actual = dayEnd.closing_cash != null ? money(dayEnd.closing_cash) : null;
  const bank = money(summary.expectedClosingBank);
  return {
    ...summary,
    totalSales: money(dayEnd.total_sales),
    totalPurchases: money(dayEnd.total_purchases),
    totalExpenses: money(dayEnd.total_expenses),
    totalReceipts: money(dayEnd.total_receipts),
    totalPayments: money(dayEnd.total_payments),
    expectedCashInHand: expected,
    actualClosingCash: actual,
    variance: actual != null ? money(actual - expected) : summary.variance,
    savedClosingBank: dayEnd.bank_balance != null ? money(dayEnd.bank_balance) : summary.savedClosingBank,
    expectedClosingBank: bank,
    closingBalance: expected,
    closingCashBalance: expected,
    closingCombinedBalance: money(expected + bank),
    frozen: true,
  };
}

function dayEndUniqueWhere(branchId, businessDate) {
  return {
    branch_id_business_date: {
      branch_id: branchId,
      business_date: businessDate,
    },
  };
}

function parseDateParam(raw) {
  const dateStr = raw || getPkDateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return dateStr;
}

export async function GET(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    const { searchParams } = new URL(request.url);
    const dateStr = parseDateParam(searchParams.get('date'));
    if (!dateStr) {
      return NextResponse.json({ error: 'Invalid date. Use YYYY-MM-DD.' }, { status: 400 });
    }

    const businessDate = pkBusinessDate(dateStr);
    const dayEnd = await prisma.dayEnd.findUnique({
      where: dayEndUniqueWhere(branchId, businessDate),
      include: {
        day_end_details: true,
        closed_by_user: { select: { full_name: true, role: true } },
      },
    });

    const snapshot = await loadDayEndSnapshot(prisma, {
      dateStr,
      dayEndRecord: dayEnd,
      branchId,
    });
    const summary = freezeClosedSummary(snapshot.summary, dayEnd);
    const closeReadiness = dayEnd?.status === 'CLOSED'
      ? {
          ok: false,
          code: 'ALREADY_CLOSED',
          error: 'Day is already closed.',
          previousOpenDate: null,
          nextRequiredDate: await findNextCloseableDate(dateStr),
        }
      : await inspectCloseReadiness(dateStr);

    const checklistStatus = (snapshot.checklistStatus || []).map((item) => {
      if (item.id !== 12) return item;
      const previousOk = dayEnd?.status === 'CLOSED' || closeReadiness.ok || closeReadiness.code !== 'PREVIOUS_DAY_OPEN';
      return {
        ...item,
        title: closeReadiness.previousOpenDate && closeReadiness.code === 'PREVIOUS_DAY_OPEN'
          ? `Oldest open day must be closed first (${closeReadiness.previousOpenDate})`
          : 'Previous business days with bills are closed',
        status: previousOk ? 'Completed' : 'Pending',
      };
    });

    return NextResponse.json({
      dayEnd: dayEnd
        ? {
            ...dayEnd,
            opening_cash: summary.openingCash,
            total_sales: summary.totalSales,
            total_purchases: summary.totalPurchases,
            total_expenses: summary.totalExpenses,
            total_receipts: summary.totalReceipts,
            total_payments: summary.totalPayments,
            cash_in_hand: summary.expectedCashInHand,
            actual_closing_cash: summary.actualClosingCash,
            variance: summary.variance,
            total_cash_accounts_balance: summary.totalCashAccountsBalance,
            total_bank_accounts_balance: summary.totalBankAccountsBalance,
          }
        : {
            day_end_id: null,
            branch_id: branchId,
            business_date: businessDate,
            opening_cash: summary.openingCash,
            closing_cash: null,
            bank_balance: null,
            status: 'OPEN',
            notes: null,
            closed_by: null,
            closed_at: null,
            closed_by_user: null,
            day_end_details: [],
            cash_in_hand: summary.expectedCashInHand,
            actual_closing_cash: null,
            variance: 0,
            total_sales: summary.totalSales,
            total_purchases: summary.totalPurchases,
            total_expenses: summary.totalExpenses,
            total_receipts: summary.totalReceipts,
            total_payments: summary.totalPayments,
            total_cash_accounts_balance: summary.totalCashAccountsBalance,
            total_bank_accounts_balance: summary.totalBankAccountsBalance,
          },
      transactions: {
        sales: snapshot.sales,
        purchases: snapshot.purchases,
        expenses: snapshot.expenses,
        ledgerEntries: snapshot.ledgerEntries,
        saleReturns: snapshot.saleReturns,
        purchaseReturns: snapshot.purchaseReturns,
      },
      accountBalances: {
        totalCashAccountsBalance: summary.totalCashAccountsBalance,
        totalBankAccountsBalance: summary.totalBankAccountsBalance,
        cashAccounts: snapshot.cashAccounts,
        bankAccounts: snapshot.bankAccounts,
      },
      summary,
      last7DaysTrend: snapshot.last7DaysTrend,
      topSellingItems: snapshot.topSellingItems,
      stockSummary: snapshot.stockSummary,
      checklistStatus,
      closeReadiness,
      meta: {
        business_date: dateStr,
        today: snapshot.todayPk,
        persisted: Boolean(dayEnd),
      },
    });
  } catch (error) {
    console.error('Error fetching day end data:', error);
    return NextResponse.json({ error: 'Failed to fetch day end data: ' + error.message, stack: error.stack }, { status: 500 });
  }
}

export async function POST(request) {
  const __branchScope = await initBranchScope(request);
  if (__branchScope.error) return __branchScope.error;
  const branchId = __branchScope.branchId;

  try {
    const body = await request.json();
    const {
      business_date,
      notes,
      closed_by,
      action,
    } = body;

    const dateStr = parseDateParam(business_date);
    if (!dateStr) {
      return NextResponse.json({ error: 'Business date is required (YYYY-MM-DD).' }, { status: 400 });
    }

    const businessDate = pkBusinessDate(dateStr);
    const existingDayEnd = await prisma.dayEnd.findUnique({
      where: dayEndUniqueWhere(branchId, businessDate),
    });

    if (action === 'REOPEN_DAY') {
      if (!existingDayEnd) {
        return NextResponse.json({ error: 'Day end record not found' }, { status: 404 });
      }
      if (existingDayEnd.status !== 'CLOSED') {
        return NextResponse.json({ error: 'This day is already open.' }, { status: 400 });
      }
      const laterClosed = await prisma.dayEnd.findFirst({
        where: {
          branch_id: branchId,
          status: 'CLOSED',
          business_date: { gt: businessDate },
        },
        orderBy: { business_date: 'asc' },
        select: { business_date: true },
      });
      if (laterClosed) {
        const later = getPkDateString(laterClosed.business_date);
        return NextResponse.json(
          { error: `Re-open ${later} first. A later day is already closed.` },
          { status: 400 }
        );
      }
      const reopened = await prisma.dayEnd.update({
        where: { day_end_id: existingDayEnd.day_end_id },
        data: {
          status: 'OPEN',
          notes: notes
            ? `${existingDayEnd.notes || ''} [Reopened: ${notes}]`.trim()
            : existingDayEnd.notes,
          closed_at: null,
          closed_by: null,
        },
      });
      return NextResponse.json({ message: 'Day reopened successfully', dayEnd: reopened });
    }

    if (existingDayEnd?.status === 'CLOSED') {
      return NextResponse.json(
        { error: 'Day is already closed. Re-open first if changes are needed.' },
        { status: 400 }
      );
    }

    const isClosing = action === 'CLOSE_DAY';
    if (isClosing) {
      const closeBlocked = await assertCanCloseBusinessDay(dateStr);
      if (closeBlocked) return closeBlocked;
    }
    const snapshot = await loadDayEndSnapshot(prisma, {
      dateStr,
      dayEndRecord: existingDayEnd,
      branchId,
    });
    const { summary } = snapshot;

    let validClosedBy = null;
    if (isClosing) {
      validClosedBy = await resolveUpdatedByUserId(request, closed_by, prisma);
      if (!validClosedBy) {
        return NextResponse.json(
          { error: 'Invalid user session. Please log in again and retry.' },
          { status: 400 }
        );
      }
    }

    // Closing cash = Cash Report ledger expected (variance always zero).
    const finalClosingCash = isClosing
      ? summary.expectedCashInHand
      : (existingDayEnd?.closing_cash != null ? parseFloat(existingDayEnd.closing_cash) : null);

    const result = await prisma.$transaction(async (tx) => {
      const dayData = {
        opening_cash: summary.openingCash,
        closing_cash: finalClosingCash,
        bank_balance: isClosing ? summary.expectedClosingBank : (existingDayEnd?.bank_balance ?? null),
        total_sales: summary.totalSales,
        total_purchases: summary.totalPurchases,
        total_expenses: summary.totalExpenses,
        total_receipts: summary.totalReceipts,
        total_payments: summary.totalPayments,
        cash_in_hand: summary.expectedCashInHand,
        status: isClosing ? 'CLOSED' : 'OPEN',
        notes: notes || null,
        closed_by: validClosedBy,
        closed_at: isClosing ? new Date() : null,
      };

      let dayEnd;
      if (existingDayEnd) {
        dayEnd = await tx.dayEnd.update({
          where: { day_end_id: existingDayEnd.day_end_id },
          data: dayData,
        });
        await tx.dayEndDetail.deleteMany({ where: { day_end_id: existingDayEnd.day_end_id } });
      } else {
        dayEnd = await tx.dayEnd.create({
          data: {
            branch_id: branchId,
            business_date: businessDate,
            ...dayData,
          },
        });
      }

      const details = buildDayEndDetails(dayEnd.day_end_id, snapshot);
      if (details.length > 0) {
        await tx.dayEndDetail.createMany({ data: details });
      }
      return { dayEnd, detailsCount: details.length };
    });

    const nextRequiredDate = isClosing ? await findNextCloseableDate(dateStr) : null;

    return NextResponse.json({
      ...result.dayEnd,
      details_count: result.detailsCount,
      expected_cash_in_hand: summary.expectedCashInHand,
      expected_closing_bank: summary.expectedClosingBank,
      variance: isClosing ? 0 : summary.variance,
      nextRequiredDate,
    });
  } catch (error) {
    console.error('Error creating/updating day end:', error);
    return NextResponse.json({ error: 'Failed to save day end: ' + error.message }, { status: 500 });
  }
}
