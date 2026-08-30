/**
 * Test script for Day End API
 * Run with: node test-day-end.js
 * 
 * Tests:
 *  1. GET - Fetch day end data for today
 *  2. GET - Fetch day end data for a specific date
 *  3. GET - Response structure validation
 *  4. POST - Close Day action
 *  5. POST - Verify status after close
 *  6. POST - Validation errors (missing date, non-existent reopen, double-close)
 *  7. POST - Re-open Day action
 *  8. Cleanup: Reopen to leave app in usable state
 *  9. Summary: pass/fail/warn report
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.API_URL || 'http://localhost:3000';

// ─── Console Colors ─────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bright: '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m'
};

function log(msg, color = 'reset') { console.log(`${c[color]}${msg}${c.reset}`); }
function logSection(title) {
  console.log(`\n${c.cyan}${'─'.repeat(65)}${c.reset}`);
  console.log(`${c.bright}${c.cyan}  ${title}${c.reset}`);
  console.log(`${c.cyan}${'─'.repeat(65)}${c.reset}`);
}

// ─── Test Tracker ────────────────────────────────────────────────────────────
const results = { passed: 0, failed: 0, warnings: 0, tests: [] };

function pass(name, detail = '') {
  results.passed++;
  results.tests.push({ status: 'PASS', name, detail });
  log(`  ✅ ${name}${detail ? ` — ${detail}` : ''}`, 'green');
}

function fail(name, detail = '') {
  results.failed++;
  results.tests.push({ status: 'FAIL', name, detail });
  log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`, 'red');
}

function warn(name, detail = '') {
  results.warnings++;
  results.tests.push({ status: 'WARN', name, detail });
  log(`  ⚠️  ${name}${detail ? ` — ${detail}` : ''}`, 'yellow');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().split('T')[0]; }

function formatCurrency(val) {
  const n = parseFloat(val || 0);
  return `Rs. ${n.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── TEST 1: GET - Today's Day End Data ─────────────────────────────────────
async function testGetToday() {
  logSection('TEST 1: GET Day End Data — Today');
  const date = today();
  log(`  📅 Fetching /api/day-end?date=${date}`, 'blue');

  try {
    const res = await fetch(`${API_BASE_URL}/api/day-end?date=${date}`);
    log(`  Status: ${res.status} ${res.statusText}`, res.ok ? 'green' : 'red');

    if (!res.ok) {
      const err = await res.json();
      fail('GET today returns 200', `HTTP ${res.status}: ${JSON.stringify(err)}`);
      return null;
    }

    const data = await res.json();
    pass('GET today returns 200', `date=${date}`);
    return data;
  } catch (e) {
    fail('GET today — network error', e.message);
    return null;
  }
}

// ─── TEST 2: GET - Specific Past Date ────────────────────────────────────────
async function testGetSpecificDate() {
  logSection('TEST 2: GET Day End Data — Specific Past Date');
  const d = new Date();
  d.setDate(d.getDate() - 3);
  const date = d.toISOString().split('T')[0];
  log(`  📅 Fetching /api/day-end?date=${date}`, 'blue');

  try {
    const res = await fetch(`${API_BASE_URL}/api/day-end?date=${date}`);
    log(`  Status: ${res.status} ${res.statusText}`, res.ok ? 'green' : 'red');

    if (!res.ok) {
      fail('GET specific past date returns 200', `HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    pass('GET specific past date returns 200', `date=${date}`);

    // Verify the returned date matches
    const returnedDate = data?.dayEnd?.business_date?.split('T')[0];
    if (returnedDate === date) {
      pass('Returned business_date matches requested date', returnedDate);
    } else {
      warn('Returned business_date differs from requested', `expected=${date} got=${returnedDate}`);
    }

    return data;
  } catch (e) {
    fail('GET specific date — network error', e.message);
    return null;
  }
}

// ─── TEST 3: Response Structure Validation ───────────────────────────────────
async function testResponseStructure(data, label = 'today') {
  logSection(`TEST 3: Response Structure Validation — ${label}`);
  if (!data) { warn('Skipped — no data available'); return; }

  // ── Top-level keys ──
  log('\n  🔍 Top-level keys:', 'blue');
  const topKeys = ['dayEnd', 'transactions', 'accountBalances', 'summary', 'last7DaysTrend', 'topSellingItems', 'stockSummary', 'checklistStatus'];
  topKeys.forEach(k => {
    if (k in data) pass(`Top-level key "${k}" present`);
    else fail(`Top-level key "${k}" missing`);
  });

  // ── dayEnd object ──
  log('\n  🔍 dayEnd fields:', 'blue');
  const dayEndFields = ['day_end_id', 'business_date', 'opening_cash', 'status',
    'total_sales', 'total_purchases', 'total_expenses', 'total_receipts', 'total_payments', 'cash_in_hand'];
  dayEndFields.forEach(f => {
    if (data.dayEnd && f in data.dayEnd) pass(`dayEnd.${f} present`, `= ${data.dayEnd[f]}`);
    else fail(`dayEnd.${f} missing`);
  });

  // ── status value ──
  if (data.dayEnd?.status) {
    const validStatuses = ['OPEN', 'CLOSED'];
    if (validStatuses.includes(data.dayEnd.status)) pass('dayEnd.status is valid', data.dayEnd.status);
    else fail('dayEnd.status is invalid', data.dayEnd.status);
  }

  // ── summary object ──
  log('\n  🔍 summary fields:', 'blue');
  const summaryFields = [
    'openingCash', 'totalSales', 'totalPurchases', 'totalExpenses',
    'totalReceipts', 'totalPayments', 'totalCashInflow', 'totalCashOutflow',
    'expectedCashInHand', 'grossProfit', 'netProfit', 'profitMargin',
    'closingBalance', 'invoicesCount', 'receiptsCount', 'billsCount', 'paymentsCount'
  ];
  summaryFields.forEach(f => {
    if (data.summary && f in data.summary) pass(`summary.${f} present`, `= ${data.summary[f]}`);
    else fail(`summary.${f} missing`);
  });

  // ── Numeric sanity checks ──
  log('\n  🔍 Numeric sanity checks:', 'blue');
  if (data.summary) {
    const s = data.summary;
    const gp  = parseFloat(s.grossProfit || 0);
    const ts  = parseFloat(s.totalSales || 0);
    const tp  = parseFloat(s.totalPurchases || 0);

    if (!isNaN(gp)) pass('summary.grossProfit is a number', formatCurrency(gp));
    else fail('summary.grossProfit is not a number');

    if (!isNaN(ts) && ts >= 0) pass('summary.totalSales >= 0', formatCurrency(ts));
    else fail('summary.totalSales is negative or NaN', String(ts));

    if (!isNaN(tp) && tp >= 0) pass('summary.totalPurchases >= 0', formatCurrency(tp));
    else fail('summary.totalPurchases is negative or NaN', String(tp));

    // Cash formula: openingCash + inflow - outflow = expectedCashInHand
    const openCash  = parseFloat(s.openingCash || 0);
    const inflow    = parseFloat(s.totalCashInflow || 0);
    const outflow   = parseFloat(s.totalCashOutflow || 0);
    const expected  = parseFloat(s.expectedCashInHand || 0);
    const calc      = openCash + inflow - outflow;

    if (Math.abs(calc - expected) < 0.01) {
      pass('Cash formula: openingCash + inflow - outflow = expectedCashInHand',
        `${openCash.toFixed(2)} + ${inflow.toFixed(2)} - ${outflow.toFixed(2)} = ${expected.toFixed(2)}`);
    } else {
      warn('Cash formula mismatch',
        `Calculated ${calc.toFixed(2)} vs expectedCashInHand ${expected.toFixed(2)}`);
    }
  }

  // ── transactions object ──
  log('\n  🔍 transactions structure:', 'blue');
  const txKeys = ['sales', 'purchases', 'expenses', 'ledgerEntries'];
  txKeys.forEach(k => {
    if (data.transactions && Array.isArray(data.transactions[k])) {
      pass(`transactions.${k} is an array`, `${data.transactions[k].length} items`);
    } else {
      fail(`transactions.${k} is not an array`);
    }
  });

  // ── accountBalances ──
  log('\n  🔍 accountBalances structure:', 'blue');
  if (data.accountBalances) {
    if (typeof data.accountBalances.totalCashAccountsBalance === 'number') {
      pass('accountBalances.totalCashAccountsBalance is a number', formatCurrency(data.accountBalances.totalCashAccountsBalance));
    } else {
      warn('accountBalances.totalCashAccountsBalance is not a number');
    }
    if (Array.isArray(data.accountBalances.cashAccounts)) {
      pass('accountBalances.cashAccounts is array', `${data.accountBalances.cashAccounts.length} accounts`);
    } else {
      fail('accountBalances.cashAccounts is not array');
    }
    if (Array.isArray(data.accountBalances.bankAccounts)) {
      pass('accountBalances.bankAccounts is array', `${data.accountBalances.bankAccounts.length} accounts`);
    } else {
      fail('accountBalances.bankAccounts is not array');
    }
  } else {
    fail('accountBalances object missing');
  }

  // ── last7DaysTrend ──
  log('\n  🔍 last7DaysTrend:', 'blue');
  if (Array.isArray(data.last7DaysTrend)) {
    pass('last7DaysTrend is an array', `${data.last7DaysTrend.length} days`);
    if (data.last7DaysTrend.length === 7) {
      pass('last7DaysTrend has exactly 7 entries');
    } else {
      warn('last7DaysTrend does not have 7 entries', `found ${data.last7DaysTrend.length}`);
    }
    if (data.last7DaysTrend.length > 0) {
      const first = data.last7DaysTrend[0];
      ['date', 'label', 'sales', 'purchases'].forEach(k => {
        if (k in first) pass(`last7DaysTrend[0].${k} present`, `= ${first[k]}`);
        else fail(`last7DaysTrend[0].${k} missing`);
      });
    }
  } else {
    fail('last7DaysTrend is not an array');
  }

  // ── stockSummary ──
  log('\n  🔍 stockSummary:', 'blue');
  if (data.stockSummary) {
    const stockKeys = ['openingStockValue', 'inwardValue', 'outwardValue', 'closingStockValue'];
    stockKeys.forEach(k => {
      if (k in data.stockSummary) pass(`stockSummary.${k} present`, formatCurrency(data.stockSummary[k]));
      else fail(`stockSummary.${k} missing`);
    });
  } else {
    fail('stockSummary object missing');
  }

  // ── checklistStatus ──
  log('\n  🔍 checklistStatus:', 'blue');
  if (Array.isArray(data.checklistStatus)) {
    pass('checklistStatus is an array', `${data.checklistStatus.length} items`);
    if (data.checklistStatus.length === 9) {
      pass('checklistStatus has 9 items (expected)');
    } else {
      warn('checklistStatus item count unexpected', `found ${data.checklistStatus.length}`);
    }

    const validStatuses = ['Completed', 'Pending'];
    let allValid = true;
    data.checklistStatus.forEach((item, i) => {
      if (!validStatuses.includes(item.status)) {
        fail(`checklistStatus[${i}] "${item.title}" has invalid status`, item.status);
        allValid = false;
      }
    });
    if (allValid) pass('All checklistStatus items have valid status values');
  } else {
    fail('checklistStatus is not an array');
  }

  // ── topSellingItems ──
  log('\n  🔍 topSellingItems:', 'blue');
  if (Array.isArray(data.topSellingItems)) {
    pass('topSellingItems is an array', `${data.topSellingItems.length} items`);
    if (data.topSellingItems.length > 0) {
      const item = data.topSellingItems[0];
      if ('name' in item && 'amount' in item && 'qty' in item) {
        pass('topSellingItems[0] has name, amount, qty');
      } else {
        warn('topSellingItems[0] missing expected fields', JSON.stringify(item));
      }
    }
  } else {
    fail('topSellingItems is not an array');
  }
}

// ─── TEST 4: POST - Close Day ─────────────────────────────────────────────────
async function testCloseDay(data) {
  logSection('TEST 4: POST — Close Day (CLOSE_DAY action)');

  const date = today();
  const currentStatus = data?.dayEnd?.status;
  log(`  📋 Current day status: ${currentStatus || 'unknown'}`, 'blue');

  if (currentStatus === 'CLOSED') {
    warn('Day is already CLOSED — skipping (will reopen first)');
    // Try to reopen first
    await fetch(`${API_BASE_URL}/api/day-end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_date: date, action: 'REOPEN_DAY' })
    });
  }

  const openingCash = data?.summary?.openingCash || 0;
  const closingCash = (parseFloat(openingCash) + 5000).toFixed(2); // simulate physical count

  log(`  📤 Posting CLOSE_DAY with closing_cash=${closingCash}`, 'blue');

  try {
    const res = await fetch(`${API_BASE_URL}/api/day-end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_date: date,
        opening_cash: openingCash,
        closing_cash: closingCash,
        notes: '[TEST] Day closed by automated test script',
        action: 'CLOSE_DAY'
      })
    });

    log(`  Status: ${res.status} ${res.statusText}`, res.ok ? 'green' : 'red');
    const responseData = await res.json();

    if (!res.ok) {
      fail('POST CLOSE_DAY returns 200', `HTTP ${res.status}: ${JSON.stringify(responseData)}`);
      return false;
    }

    pass('POST CLOSE_DAY returns 200');

    // Cash discrepancy warning
    if (responseData.warning) {
      warn('Cash discrepancy warning returned (expected — we added Rs.5000 intentionally)', responseData.warning);
    } else {
      pass('No cash discrepancy warning');
    }

    // day_end_id present
    if (responseData.day_end_id !== undefined) {
      pass('Response has day_end_id', String(responseData.day_end_id));
    } else {
      warn('day_end_id not directly in response (may be nested)');
    }

    return true;
  } catch (e) {
    fail('POST CLOSE_DAY — network error', e.message);
    return false;
  }
}

// ─── TEST 5: GET - Verify Status After Close ─────────────────────────────────
async function testVerifyAfterClose() {
  logSection('TEST 5: GET — Verify Day Status After Closing');
  const date = today();
  log(`  📅 Re-fetching /api/day-end?date=${date}`, 'blue');

  try {
    const res = await fetch(`${API_BASE_URL}/api/day-end?date=${date}`);
    if (!res.ok) { fail('Fetch after close failed', `HTTP ${res.status}`); return null; }

    const data = await res.json();
    const status = data?.dayEnd?.status;
    log(`  📋 Status: ${status}`, status === 'CLOSED' ? 'green' : 'yellow');

    if (status === 'CLOSED') pass('Day status is CLOSED after CLOSE_DAY action');
    else warn('Day status is not CLOSED', status);

    const closingCash = data?.dayEnd?.closing_cash;
    if (closingCash !== null && closingCash !== undefined) {
      pass('closing_cash is recorded', formatCurrency(closingCash));
    } else {
      warn('closing_cash is null after close action');
    }

    const closedAt = data?.dayEnd?.closed_at;
    if (closedAt) pass('closed_at timestamp present', closedAt);
    else warn('closed_at timestamp missing');

    return data;
  } catch (e) {
    fail('Fetch after close — network error', e.message);
    return null;
  }
}

// ─── TEST 6: POST - Validation Errors ────────────────────────────────────────
async function testValidationErrors() {
  logSection('TEST 6: POST — Validation Error Handling');

  // 6a: Missing business_date
  log('\n  6a: POST with missing business_date', 'blue');
  try {
    const res = await fetch(`${API_BASE_URL}/api/day-end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ closing_cash: 1000, action: 'CLOSE_DAY' })
    });
    if (res.status === 400) {
      const err = await res.json();
      pass('Missing business_date → returns 400', err.error || 'error message present');
    } else {
      fail('Missing business_date should return 400', `Got ${res.status}`);
    }
  } catch (e) {
    fail('Validation test 6a — network error', e.message);
  }

  // 6b: REOPEN_DAY for a non-existent far-future date
  log('\n  6b: REOPEN_DAY for non-existent far-future date (2099-12-31)', 'blue');
  try {
    const res = await fetch(`${API_BASE_URL}/api/day-end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_date: '2099-12-31', action: 'REOPEN_DAY' })
    });
    if (res.status === 404) {
      const err = await res.json();
      pass('REOPEN non-existent date → returns 404', err.error || '');
    } else {
      warn('REOPEN non-existent date unexpected status', `Got ${res.status}`);
    }
  } catch (e) {
    fail('Validation test 6b — network error', e.message);
  }

  // 6c: CLOSE_DAY when already CLOSED
  log('\n  6c: Double CLOSE_DAY on same date', 'blue');
  const date = today();
  try {
    // Try to close (may already be closed from test 4)
    await fetch(`${API_BASE_URL}/api/day-end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_date: date, closing_cash: 1000, action: 'CLOSE_DAY' })
    });
    // Try to close AGAIN
    const res2 = await fetch(`${API_BASE_URL}/api/day-end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ business_date: date, closing_cash: 2000, action: 'CLOSE_DAY' })
    });
    if (res2.status === 400) {
      const err = await res2.json();
      pass('Double CLOSE_DAY → returns 400', err.error || '');
    } else {
      warn('Double CLOSE_DAY did not return 400', `Got ${res2.status}`);
    }
  } catch (e) {
    fail('Validation test 6c — network error', e.message);
  }
}

// ─── TEST 7: POST - Re-open Day ───────────────────────────────────────────────
async function testReopenDay() {
  logSection('TEST 7: POST — Re-open Day (REOPEN_DAY action)');
  const date = today();
  log(`  📤 Posting REOPEN_DAY for ${date}`, 'blue');

  try {
    const res = await fetch(`${API_BASE_URL}/api/day-end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_date: date,
        notes: '[TEST] Reopened by automated test script',
        action: 'REOPEN_DAY'
      })
    });

    log(`  Status: ${res.status} ${res.statusText}`, res.ok ? 'green' : 'red');
    const responseData = await res.json();

    if (!res.ok) {
      fail('POST REOPEN_DAY returns 200', `HTTP ${res.status}: ${JSON.stringify(responseData)}`);
      return false;
    }

    pass('POST REOPEN_DAY returns 200');

    if (responseData.status === 'OPEN') {
      pass('Response status is OPEN after reopen');
    } else {
      warn('Unexpected status after reopen', responseData.status || JSON.stringify(responseData).slice(0, 100));
    }

    if (responseData.message) pass('Response has message', responseData.message);

    // closed_at and closed_by should be null after reopen
    if (responseData.closed_at === null) pass('closed_at is null after reopen');
    else warn('closed_at is not null after reopen', String(responseData.closed_at));

    return true;
  } catch (e) {
    fail('POST REOPEN_DAY — network error', e.message);
    return false;
  }
}

// ─── TEST 8: Cleanup ─────────────────────────────────────────────────────────
async function testCleanup() {
  logSection('TEST 8: Cleanup — Re-open Day to Restore State');
  log('  Ensuring day is OPEN so application is left in a usable state...', 'blue');
  const date = today();

  try {
    // Re-fetch current state
    const getRes = await fetch(`${API_BASE_URL}/api/day-end?date=${date}`);
    if (!getRes.ok) { warn('Cleanup: could not fetch current state'); return; }

    const current = await getRes.json();
    if (current?.dayEnd?.status === 'OPEN') {
      pass('Cleanup: Day is already OPEN — no action needed');
      return;
    }

    // Reopen
    const res = await fetch(`${API_BASE_URL}/api/day-end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_date: date,
        notes: '[TEST CLEANUP] Restored to OPEN by test script',
        action: 'REOPEN_DAY'
      })
    });

    const data = await res.json();
    if (res.ok) {
      pass('Cleanup: Day successfully re-opened', `status=${data.status}`);
    } else {
      warn('Cleanup reopen failed', JSON.stringify(data).slice(0, 100));
    }
  } catch (e) {
    warn('Cleanup — network error', e.message);
  }
}

// ─── SUMMARY ──────────────────────────────────────────────────────────────────
function printSummary() {
  logSection('TEST SUMMARY');
  const total = results.tests.length;

  console.log('');
  log(`  Total Tests : ${total}`, 'bright');
  log(`  ✅ Passed   : ${results.passed}`, 'green');
  log(`  ❌ Failed   : ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`  ⚠️  Warnings : ${results.warnings}`, results.warnings > 0 ? 'yellow' : 'green');

  if (results.failed > 0) {
    log('\n  Failed Tests:', 'red');
    results.tests
      .filter(t => t.status === 'FAIL')
      .forEach(t => log(`    ❌ ${t.name}${t.detail ? ` — ${t.detail}` : ''}`, 'red'));
  }

  if (results.warnings > 0) {
    log('\n  Warnings:', 'yellow');
    results.tests
      .filter(t => t.status === 'WARN')
      .forEach(t => log(`    ⚠️  ${t.name}${t.detail ? ` — ${t.detail}` : ''}`, 'yellow'));
  }

  const overallPass = results.failed === 0;
  console.log('');
  log(`  Overall Result: ${overallPass ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`, overallPass ? 'green' : 'red');
  console.log('');
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function runAllTests() {
  log('\n' + '═'.repeat(65), 'bright');
  log('  DAY END API — FULL TEST SUITE', 'bright');
  log('═'.repeat(65), 'bright');
  log(`  API Base URL : ${API_BASE_URL}`, 'blue');
  log(`  Run Date     : ${new Date().toISOString()}`, 'blue');
  log(`  Business Date: ${today()}`, 'blue');
  console.log('');

  // 1. Fetch today's data
  const todayData = await testGetToday();

  // 2. Fetch a specific past date
  await testGetSpecificDate();

  // 3. Validate response structure of today's data
  await testResponseStructure(todayData, 'today');

  // 4. Close the day
  const wasClosed = await testCloseDay(todayData);

  // 5. Verify status after close
  if (wasClosed) {
    await testVerifyAfterClose();
  } else {
    warn('TEST 5 Skipped', 'CLOSE_DAY test did not succeed');
  }

  // 6. Validation error handling
  await testValidationErrors();

  // 7. Re-open day
  await testReopenDay();

  // 8. Cleanup: ensure day is OPEN at the end
  await testCleanup();

  // Final summary
  printSummary();

  process.exit(results.failed > 0 ? 1 : 0);
}

// ─── Entry Point ──────────────────────────────────────────────────────────────
runAllTests().catch(err => {
  log(`\n❌ Fatal error: ${err.message}`, 'red');
  log(err.stack, 'red');
  process.exit(1);
});
