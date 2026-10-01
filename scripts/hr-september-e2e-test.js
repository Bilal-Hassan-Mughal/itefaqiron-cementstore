#!/usr/bin/env node
/**
 * HR end-to-end test: wipe employees, one September fixture, API + math checks.
 *
 * Usage:
 *   node scripts/hr-september-e2e-test.js --check     # read-only counts
 *   node scripts/hr-september-e2e-test.js --force     # DELETE all employees + run tests
 *
 * Requires: dev server on BASE_URL (default http://127.0.0.1:3000)
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

const prisma = new PrismaClient();
const BASE = process.env.HR_TEST_BASE_URL || 'http://127.0.0.1:3000';
const BRANCH = 1;
const SEPT = { month: 9, year: 2025 };
const OCT = { month: 10, year: 2025 };

const force = process.argv.includes('--force');
const checkOnly = process.argv.includes('--check');

const results = [];
const pass = (name, detail) => results.push({ ok: true, name, detail });
const fail = (name, detail) => results.push({ ok: false, name, detail });

async function api(pathname, opts = {}) {
  const url = `${BASE}${pathname}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      'x-branch-id': String(BRANCH),
      ...(opts.headers || {}),
    },
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { ok: res.ok, status: res.status, data };
}

function num(v) {
  return Math.round(parseFloat(v || 0) * 100) / 100;
}

function approx(a, b, tol = 0.02) {
  return Math.abs(num(a) - num(b)) <= tol;
}

async function deleteAllEmployees() {
  const emps = await prisma.employee.findMany({ where: { branch_id: BRANCH }, select: { emp_id: true } });
  const ids = emps.map((e) => e.emp_id);
  if (ids.length === 0) return 0;
  try {
    await prisma.$executeRawUnsafe(`DELETE FROM employee_receipts WHERE emp_id IN (${ids.join(',')})`);
  } catch {
    /* table optional */
  }
  await prisma.employee.deleteMany({ where: { branch_id: BRANCH } });
  return ids.length;
}

async function createFixtureEmployee() {
  const res = await api('/api/employees', {
    method: 'POST',
    body: JSON.stringify({
      emp_name: 'HR Test Worker (Sep)',
      emp_cnic: `35201-${Date.now().toString().slice(-7)}-1`,
      designation: 'Tester',
      department: 'HR QA',
      join_date: '2025-08-01',
      basic_salary: 30000,
      opening_balance: 5000,
      allowed_leaves_per_month: 2,
      allowed_absents_per_month: 0,
    }),
  });
  if (!res.ok) throw new Error(res.data?.error || `Create employee failed (${res.status})`);
  return res.data;
}

function buildSeptemberAttendanceRows(empId) {
  const rows = [];
  const y = SEPT.year;
  const m = String(SEPT.month).padStart(2, '0');
  for (let d = 1; d <= 22; d += 1) {
    rows.push({ emp_id: empId, att_date: `${y}-${m}-${String(d).padStart(2, '0')}`, status: 'PRESENT' });
  }
  rows.push({ emp_id: empId, att_date: `${y}-${m}-23`, status: 'LEAVE' });
  rows.push({ emp_id: empId, att_date: `${y}-${m}-24`, status: 'LEAVE' });
  rows.push({ emp_id: empId, att_date: `${y}-${m}-25`, status: 'ABSENT' });
  return rows;
}

async function main() {
  console.log('\n=== HR September E2E Test ===');
  console.log(`DB: ${(process.env.DATABASE_URL || '').replace(/:[^:@/]+@/, ':***@')}`);
  console.log(`API: ${BASE}\n`);

  const empCount = await prisma.employee.count({ where: { branch_id: BRANCH } });
  console.log(`Employees in branch ${BRANCH}: ${empCount}`);

  if (checkOnly) {
    await prisma.$disconnect();
    return;
  }

  if (!force) {
    console.error('Refusing to delete employees without --force');
    process.exit(1);
  }

  const deleted = await deleteAllEmployees();
  console.log(`Deleted ${deleted} employee(s).`);

  const emp = await createFixtureEmployee();
  console.log(`Created emp_id=${emp.emp_id} basic=30000 opening=5000`);

  const attRows = buildSeptemberAttendanceRows(emp.emp_id);
  const attSave = await api('/api/attendance', { method: 'POST', body: JSON.stringify(attRows) });
  if (!attSave.ok) {
    fail('Save September attendance', attSave.data?.error || attSave.status);
  } else {
    pass('Save September attendance', `${attRows.length} marks (22P + 2L + 1A, 5 unmarked)`);
  }

  const attCount = await prisma.attendance.count({ where: { emp_id: emp.emp_id } });
  if (attCount === attRows.length) pass('Attendance row count', String(attCount));
  else fail('Attendance row count', `expected ${attRows.length}, got ${attCount}`);

  const ledgerRes = await api(`/api/employee-ledger?emp_id=${emp.emp_id}`);
  const closing = num(ledgerRes.data?.closing_balance);
  if (approx(closing, 5000)) pass('Ledger opening after register', `closing=${closing}`);
  else fail('Ledger opening after register', `expected ~5000, got ${closing}`);

  const paySept = await api(`/api/payroll?calculate=true&month=${SEPT.month}&year=${SEPT.year}`);
  if (!paySept.ok) {
    fail('Payroll calculate September', paySept.data?.error || paySept.status);
  } else {
    const row = (paySept.data || []).find((r) => r.emp_id === emp.emp_id);
    if (!row) {
      fail('Payroll row September', 'employee missing from calculate response');
    } else {
      const perDay = 30000 / 30;
      const expectedGross = 24 * perDay;
      const expectedRecovery = Math.min(5000, expectedGross);
      const expectedNet = expectedGross - expectedRecovery;

      if (approx(row.gross_earned ?? row.month_gross_earned, expectedGross)) {
        pass('September gross (24 paid days)', `Rs ${num(row.gross_earned ?? row.month_gross_earned)}`);
      } else {
        fail('September gross', `expected ${expectedGross}, got ${row.gross_earned}`);
      }

      if (num(row.unmarked_days) === 5) pass('September unmarked days', '5');
      else fail('September unmarked days', `expected 5, got ${row.unmarked_days}`);

      if (approx(row.net_salary, expectedNet)) {
        pass('September net after opening recovery', `Rs ${num(row.net_salary)} (recovery ~${expectedRecovery})`);
      } else {
        fail('September net', `expected ~${expectedNet}, got ${row.net_salary}`);
      }

      if (num(row.excess_absents) === 1) pass('September excess absent', '1 marked absent');
      else fail('September excess absent', `expected 1, got ${row.excess_absents}`);

      const attDed = num(row.total_deduction);
      if (attDed < 0.01) pass('No fake unpaid-month deduction', `att ded=${attDed}`);
      else fail('No fake unpaid-month deduction', `total_deduction=${attDed}`);
    }
  }

  const payOct = await api(`/api/payroll?calculate=true&month=${OCT.month}&year=${OCT.year}`);
  const rowOct = (payOct.data || []).find((r) => r.emp_id === emp.emp_id);
  if (!rowOct) {
    fail('Payroll October row', 'missing');
  } else {
    if (approx(rowOct.net_salary, 0) && approx(rowOct.gross_earned ?? 0, 0)) {
      pass('October unmarked → zero pay', `net=${num(rowOct.net_salary)}`);
    } else {
      fail('October unmarked pay', `gross=${rowOct.gross_earned} net=${rowOct.net_salary}`);
    }
    const octUnmarked = num(rowOct.unmarked_days);
    if (octUnmarked >= 28) pass('October mostly unmarked', `${octUnmarked} unmarked days`);
    else fail('October unmarked count', String(octUnmarked));
  }

  if (rowOct && paySept.data) {
    const rowSept = paySept.data.find((r) => r.emp_id === emp.emp_id);
    const prev = num(rowOct.previous_balance);
    const septNet = num(rowSept?.net_salary);
    if (rowSept?.status !== 'PAID' && approx(prev, septNet)) {
      pass('October carries September pending', `previous_balance=${prev}`);
    } else if (rowSept?.status === 'PAID') {
      pass('October prev balance (paid Sept)', `previous_balance=${prev}`);
    } else {
      fail('October previous balance', `expected ~${septNet} if Sept pending, got ${prev}`);
    }
  }

  const reg = await api('/api/employees?register=true&limit=10');
  const regItem = (reg.data?.items || reg.data || []).find((e) => e.emp_id === emp.emp_id);
  if (reg.ok && regItem) pass('Register API lists test employee', regItem.emp_name);
  else fail('Register API', reg.status);

  const tx = await api(`/api/employee-ledger?transactions=true&emp_id=${emp.emp_id}&limit=50`);
  if (tx.ok && Array.isArray(tx.data?.entries) && tx.data.entries.length >= 1) {
    pass('Ledger transactions API', `${tx.data.entries.length} entries`);
  } else fail('Ledger transactions API', String(tx.status));

  const cust = await api('/api/customers?dropdown=true');
  const accounts = Array.isArray(cust.data) ? cust.data : [];
  const cashAcc = accounts.find((a) => {
    const t = a.customer_type?.cus_type_title?.toLowerCase() || '';
    const c = a.customer_category?.cus_cat_title?.toLowerCase() || '';
    return t.includes('cash') && c.includes('cash');
  });

  if (cashAcc) {
    const adv = await api('/api/employee-advances', {
      method: 'POST',
      body: JSON.stringify({
        emp_id: emp.emp_id,
        amount: 8000,
        advance_date: '2025-09-15',
        payment_mode: 'CASH',
        account_id: cashAcc.cus_id,
        reason: 'HR test advance mid-September',
      }),
    });
    if (adv.ok) {
      pass('Salary advance mid-September', 'Rs 8000');
      const led = await api(`/api/employee-ledger?emp_id=${emp.emp_id}`);
      const afterAdv = num(led.data?.closing_balance);
      if (approx(afterAdv, 13000)) pass('Ledger after advance', `closing=${afterAdv} (5000+8000)`);
      else fail('Ledger after advance', `expected 13000, got ${afterAdv}`);

      const paySept2 = await api(`/api/payroll?calculate=true&month=${SEPT.month}&year=${SEPT.year}`);
      const row2 = (paySept2.data || []).find((r) => r.emp_id === emp.emp_id);
      if (row2 && approx(row2.net_salary, 11000)) {
        pass('September net after advance+opening recovery', `Rs ${num(row2.net_salary)} (24000-13000)`);
      } else {
        fail('September net after advance', `expected 11000, got ${row2?.net_salary}`);
      }

      const rcv = await api('/api/employee-receipts', {
        method: 'POST',
        body: JSON.stringify({
          emp_id: emp.emp_id,
          amount: 2000,
          receipt_date: '2025-09-20',
          payment_mode: 'CASH',
          account_id: cashAcc.cus_id,
          reference: 'HR-TEST-RCV',
        }),
      });
      if (rcv.ok) {
        pass('Receive payment from employee', 'Rs 2000');
        const led2 = await api(`/api/employee-ledger?emp_id=${emp.emp_id}`);
        const afterRcv = num(led2.data?.closing_balance);
        if (approx(afterRcv, 11000)) pass('Ledger after receive', `closing=${afterRcv}`);
        else fail('Ledger after receive', `expected 11000, got ${afterRcv}`);
      } else fail('Receive payment', rcv.data?.error || rcv.status);
    } else fail('Salary advance', adv.data?.error || adv.status);
  } else {
    fail('Cash account for advance/receive', 'none in dropdown');
  }

  const paySeptFinal = await api(`/api/payroll?calculate=true&month=${SEPT.month}&year=${SEPT.year}`);
  const septFinal = (paySeptFinal.data || []).find((r) => r.emp_id === emp.emp_id);
  const payOct2 = await api(`/api/payroll?calculate=true&month=${OCT.month}&year=${OCT.year}`);
  const oct2 = (payOct2.data || []).find((r) => r.emp_id === emp.emp_id);
  const expectedPrev = num(septFinal?.net_salary);
  if (oct2 && approx(oct2.previous_balance, expectedPrev)) {
    pass('October previous balance matches live September net', `prev=${num(oct2.previous_balance)}`);
  } else if (oct2) {
    fail('October previous balance (after money flows)', `expected ${expectedPrev}, got ${oct2.previous_balance}`);
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  console.log('\n--- Results ---');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
  }
  console.log(`\nTotal: ${passed} passed, ${failed} failed`);
  console.log(`\nManual UI check: HR → Attendance (Sep 2025), Pay Salary (Sep/Oct), Employee Ledger (emp_id=${emp.emp_id})`);

  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});
