require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const API = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const prisma = new PrismaClient();

let failed = 0;
function log(ok, name, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failed += 1;
}

async function api(path, { user, method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (user) {
    headers['x-user-json'] = JSON.stringify({
      user_id: user.user_id,
      id: user.user_id,
      role: user.role,
      branch_id: user.branch_id,
      full_name: user.full_name,
    });
    if (user.branch_id) headers['x-branch-id'] = String(user.branch_id);
  }
  const res = await fetch(`${API}${path}`, { method, headers, body });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  return { res, json };
}

async function main() {
  const user = await prisma.users.findFirst({
    where: { branch_id: { gt: 0 } },
    select: { user_id: true, role: true, branch_id: true, full_name: true },
    orderBy: { user_id: 'asc' },
  });
  if (!user) throw new Error('No branch user');

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  console.log(`User #${user.user_id}  branch ${user.branch_id}  today ${today}\n`);

  const getToday = await api(`/api/day-end?date=${today}`, { user });
  log(getToday.res.ok, 'GET today returns 200');
  log(getToday.json?.meta?.business_date === today, 'Business date is Pakistan today', getToday.json?.meta?.business_date);
  log(typeof getToday.json?.summary?.expectedCashInHand === 'number', 'Expected cash is calculated', String(getToday.json?.summary?.expectedCashInHand));
  log(getToday.json?.dayEnd?.status !== 'CLOSED' || getToday.json?.summary?.frozen === true, 'Open day is live, or closed day is frozen');
  log(Boolean(getToday.json?.closeReadiness), 'GET returns close readiness');

  const future = await api('/api/day-end', {
    method: 'POST',
    user,
    body: JSON.stringify({
      business_date: '2099-12-31',
      closing_cash: 10,
      closed_by: user.user_id,
      action: 'CLOSE_DAY',
    }),
  });
  log(future.res.status === 400 && /future/i.test(future.json?.error || ''), 'Cannot close a future date', future.json?.error);

  const readiness = getToday.json?.closeReadiness || {};
  const previousOpen = readiness.previousOpenDate;

  if (readiness.ok === false && readiness.code === 'PREVIOUS_DAY_OPEN') {
    log(true, 'Today is blocked until previous day is closed', readiness.error);
    const closeToday = await api('/api/day-end', {
      method: 'POST',
      user,
      body: JSON.stringify({
        business_date: today,
        opening_cash: getToday.json?.summary?.openingCash ?? 0,
        closing_cash: Number(getToday.json?.summary?.expectedCashInHand || 0).toFixed(2),
        notes: 'Recheck close',
        closed_by: user.user_id,
        action: 'CLOSE_DAY',
      }),
    });
    log(
      closeToday.res.status === 400 && /close that day first|closed in order/i.test(closeToday.json?.error || ''),
      'API refuses to skip an unclosed previous day',
      closeToday.json?.error
    );

    if (previousOpen) {
      const missingCash = await api('/api/day-end', {
        method: 'POST',
        user,
        body: JSON.stringify({
          business_date: previousOpen,
          closed_by: user.user_id,
          action: 'CLOSE_DAY',
        }),
      });
      log(
        missingCash.res.status === 400 && /physical closing cash/i.test(missingCash.json?.error || ''),
        'Close without physical cash is rejected',
        missingCash.json?.error
      );
    }
  } else if (readiness.ok) {
    const missingCash = await api('/api/day-end', {
      method: 'POST',
      user,
      body: JSON.stringify({
        business_date: today,
        closed_by: user.user_id,
        action: 'CLOSE_DAY',
      }),
    });
    log(
      missingCash.res.status === 400 && /physical closing cash/i.test(missingCash.json?.error || ''),
      'Close without physical cash is rejected',
      missingCash.json?.error
    );

    const [ty, tm, td] = today.split('-').map(Number);
    const todayBiz = new Date(Date.UTC(ty, tm - 1, td));
    const todayRow = await prisma.dayEnd.findFirst({
      where: { branch_id: user.branch_id, business_date: todayBiz },
    });
    const backup = todayRow ? { day_end_id: todayRow.day_end_id, status: todayRow.status } : null;

    const close = await api('/api/day-end', {
      method: 'POST',
      user,
      body: JSON.stringify({
        business_date: today,
        opening_cash: getToday.json?.summary?.openingCash ?? 0,
        closing_cash: Number(getToday.json?.summary?.expectedCashInHand || 0).toFixed(2),
        notes: 'Recheck close',
        closed_by: user.user_id,
        action: 'CLOSE_DAY',
      }),
    });
    log(close.res.ok, 'Close today succeeds when previous days are in order', close.json?.error || `id ${close.json?.day_end_id}`);

    if (close.res.ok) {
      const saved = await prisma.dayEnd.findFirst({
        where: { branch_id: user.branch_id, business_date: todayBiz },
        include: { day_end_details: true },
      });
      log(saved?.status === 'CLOSED', 'DB status CLOSED');
      log(Number(saved?.closed_by) === Number(user.user_id), 'DB closed_by is current user');
      log(saved?.cash_in_hand != null && saved?.bank_balance != null, 'DB saved cash_in_hand and bank_balance');
      log(Array.isArray(saved?.day_end_details) && saved.day_end_details.length > 0, 'DB saved day_end_details', `${saved?.day_end_details?.length || 0} lines`);

      const frozen = await api(`/api/day-end?date=${today}`, { user });
      log(frozen.json?.summary?.frozen === true, 'GET after close returns frozen snapshot');
      log(Number(frozen.json?.summary?.expectedCashInHand) === Number(saved.cash_in_hand), 'Frozen cash matches saved cash_in_hand');

      const saleLock = await api('/api/sales', {
        method: 'POST',
        user,
        body: JSON.stringify({ cus_id: 1, total_amount: 1, payment: 0, payment_type: 'CASH', sale_details: [] }),
      });
      log(saleLock.res.status === 409, 'Closed day blocks sales');

      const expLock = await api('/api/expenses', {
        method: 'POST',
        user,
        body: JSON.stringify({ exp_title: 'x', exp_type: 1, exp_amount: 1, paymentMethod: 'CASH', paid_from_account_id: 1 }),
      });
      log(expLock.res.status === 409, 'Closed day blocks expenses');

      const reopen = await api('/api/day-end', {
        method: 'POST',
        user,
        body: JSON.stringify({ business_date: today, action: 'REOPEN_DAY' }),
      });
      log(reopen.res.ok, 'Reopen today succeeds');
      const after = await prisma.dayEnd.findFirst({
        where: { branch_id: user.branch_id, business_date: todayBiz },
      });
      log(after?.status === 'OPEN', 'DB status OPEN after reopen');
    } else if (backup) {
      await prisma.dayEnd.update({
        where: { day_end_id: backup.day_end_id },
        data: { status: backup.status },
      });
    }
  } else {
    log(false, 'Unexpected close readiness', JSON.stringify(readiness));
  }

  console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`}`);
  process.exitCode = failed === 0 ? 0 : 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
