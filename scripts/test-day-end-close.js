require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const API = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const TEST_DATE = '2099-12-31';
const prisma = new PrismaClient();

function log(ok, name, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
  if (!ok) process.exitCode = 1;
}

async function api(path, options = {}) {
  const user = options.user;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
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
  const res = await fetch(`${API}${path}`, { ...options, headers });
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
  if (!user) throw new Error('No branch user found for API auth');
  console.log(`Using user #${user.user_id} ${user.full_name} branch ${user.branch_id}\n`);

  const testBiz = new Date(Date.UTC(2099, 11, 31));
  const existingTest = await prisma.dayEnd.findFirst({
    where: { branch_id: user.branch_id, business_date: testBiz },
  });
  if (existingTest) {
    await prisma.dayEnd.delete({ where: { day_end_id: existingTest.day_end_id } });
  }

  const beforeCount = await prisma.dayEnd.count({
    where: { branch_id: user.branch_id, business_date: testBiz },
  });
  const get1 = await api(`/api/day-end?date=${TEST_DATE}`, { user });
  log(get1.res.ok, 'GET day-end (future date) returns 200', `status ${get1.res.status}`);
  log(get1.json?.dayEnd?.status === 'OPEN', 'GET without existing row stays OPEN');
  log(get1.json?.dayEnd?.day_end_id == null, 'GET does not auto-create a day_ends row');
  const afterGetCount = await prisma.dayEnd.count({
    where: { branch_id: user.branch_id, business_date: testBiz },
  });
  log(beforeCount === afterGetCount, 'Database row count unchanged after GET');

  const close = await api('/api/day-end', {
    method: 'POST',
    user,
    body: JSON.stringify({
      business_date: TEST_DATE,
      notes: 'Automated close test',
      closed_by: user.user_id,
      action: 'CLOSE_DAY',
    }),
  });
  log(close.res.ok, 'POST CLOSE_DAY returns 200', close.json?.error || `id ${close.json?.day_end_id}`);

  const saved = await prisma.dayEnd.findFirst({
    where: { branch_id: user.branch_id, business_date: testBiz },
    include: { day_end_details: true, closed_by_user: { select: { user_id: true, full_name: true } } },
  });
  log(Boolean(saved), 'Close created day_ends row');
  log(saved?.status === 'CLOSED', 'Saved status is CLOSED', saved?.status);
  log(Number(saved?.closed_by) === Number(user.user_id), 'closed_by is the logged-in user', String(saved?.closed_by));
  log(saved?.closed_at != null, 'closed_at is stored');
  log(saved?.cash_in_hand != null, 'cash_in_hand is stored', String(saved?.cash_in_hand));
  log(saved?.bank_balance != null, 'bank_balance is stored', String(saved?.bank_balance));
  const expectedClose = Number(get1.json?.summary?.expectedCashInHand ?? saved?.cash_in_hand);
  log(
    Math.abs(Number(saved?.closing_cash) - expectedClose) < 0.02,
    'closing_cash matches ledger expected',
    String(saved?.closing_cash)
  );
  log(saved?.notes === 'Automated close test', 'notes saved');
  log(Array.isArray(saved?.day_end_details), 'day_end_details persisted', `${saved?.day_end_details?.length || 0} rows`);

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' });
  const [ty, tm, td] = today.split('-').map(Number);
  const todayBiz = new Date(Date.UTC(ty, tm - 1, td));
  const todayRow = await prisma.dayEnd.findFirst({
    where: { branch_id: user.branch_id, business_date: todayBiz },
  });
  const todayBackup = todayRow ? { ...todayRow } : null;
  if (todayRow) {
    await prisma.dayEnd.update({
      where: { day_end_id: todayRow.day_end_id },
      data: { status: 'CLOSED' },
    });
  } else {
    await prisma.dayEnd.create({
      data: {
        branch_id: user.branch_id,
        business_date: todayBiz,
        opening_cash: 0,
        closing_cash: 0,
        status: 'CLOSED',
        notes: 'temp lock test',
      },
    });
  }

  const saleLock = await api('/api/sales', {
    method: 'POST',
    user,
    body: JSON.stringify({ cus_id: 1, total_amount: 1, payment: 0, payment_type: 'CASH', sale_details: [] }),
  });
  log(saleLock.res.status === 409 && saleLock.json?.code === 'DAY_CLOSED', 'Closed day blocks new sales', `${saleLock.res.status} ${saleLock.json?.error || ''}`);

  const payLock = await api('/api/payments', {
    method: 'POST',
    user,
    body: JSON.stringify({ payment_date: today, payment_type: 'RECEIVE', account_id: 1, total_amount: 1, cash_amount: 1 }),
  });
  log(payLock.res.status === 409, 'Closed day blocks new payments', `${payLock.res.status} ${payLock.json?.error || ''}`);

  if (todayBackup) {
    await prisma.dayEnd.update({
      where: { day_end_id: todayBackup.day_end_id },
      data: { status: todayBackup.status },
    });
  } else {
    const temp = await prisma.dayEnd.findFirst({
      where: { branch_id: user.branch_id, business_date: todayBiz, notes: 'temp lock test' },
    });
    if (temp) await prisma.dayEnd.delete({ where: { day_end_id: temp.day_end_id } });
  }

  const reopen = await api('/api/day-end', {
    method: 'POST',
    user,
    body: JSON.stringify({ business_date: TEST_DATE, action: 'REOPEN_DAY' }),
  });
  log(reopen.res.ok, 'POST REOPEN_DAY returns 200');
  const reopened = await prisma.dayEnd.findFirst({
    where: { branch_id: user.branch_id, business_date: testBiz },
  });
  log(reopened?.status === 'OPEN', 'Reopen saved status OPEN');
  log(reopened?.closed_by == null && reopened?.closed_at == null, 'Reopen clears closed_by and closed_at');

  if (reopened) {
    await prisma.dayEnd.delete({ where: { day_end_id: reopened.day_end_id } });
  }
  console.log('\nCleanup complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
