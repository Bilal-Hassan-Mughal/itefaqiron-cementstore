/** HR-only fetch helpers — safe JSON / array parsing for tab components. */

const registerFetchOpts = { cache: 'no-store' };

export function isFetchAborted(err) {
  return err?.name === 'AbortError' || err?.code === 20;
}

function mergeSignal(init, signal) {
  if (!signal) return init;
  return { ...init, signal };
}

/** Employee Register tab — lean API payload + ledger balances (full list, legacy). */
export async function fetchHrEmployeeRegisterList(options = {}) {
  const { status, signal } = options;
  const params = new URLSearchParams({ register: 'true' });
  if (status) params.set('status', status);
  const res = await fetch(`/api/employees?${params.toString()}`, mergeSignal(registerFetchOpts, signal));
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load employees');
  return Array.isArray(data) ? data : [];
}

export const HR_REGISTER_PAGE_SIZE = 40;

/** Paginated register page — { items, total, limit, offset, hasMore }. */
export async function fetchHrEmployeeRegisterPage(options = {}) {
  const {
    status,
    search,
    offset = 0,
    limit = HR_REGISTER_PAGE_SIZE,
    signal,
  } = options;
  const params = new URLSearchParams({
    register: 'true',
    limit: String(limit),
    offset: String(offset),
  });
  if (status && status !== 'ALL') params.set('status', status);
  if (search && String(search).trim()) params.set('q', String(search).trim());
  const res = await fetch(`/api/employees?${params.toString()}`, mergeSignal(registerFetchOpts, signal));
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load employees');
  if (Array.isArray(data)) {
    return { items: data, total: data.length, limit: data.length, offset: 0, hasMore: false };
  }
  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: data.total ?? 0,
    limit: data.limit ?? limit,
    offset: data.offset ?? offset,
    hasMore: !!data.hasMore,
  };
}

/** Register header stats without loading every row. */
export async function fetchHrEmployeeRegisterStats(options = {}) {
  const { status, signal } = options;
  const params = new URLSearchParams({ register: 'true', stats: 'true' });
  if (status && status !== 'ALL') params.set('status', status);
  const res = await fetch(`/api/employees?${params.toString()}`, mergeSignal(registerFetchOpts, signal));
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load stats');
  return data;
}

/** Active employees for dropdowns (minimal payload). */
export async function fetchHrEmployeeDropdown(options = {}) {
  const { signal } = options;
  const res = await fetch('/api/employees?register=true&dropdown=true', mergeSignal(registerFetchOpts, signal));
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load employees');
  return Array.isArray(data) ? data : [];
}

export async function fetchHrEmployeeList(options = {}) {
  const { lite = false, status, signal } = options;
  const params = new URLSearchParams();
  if (lite) params.set('lite', 'true');
  if (status) params.set('status', status);
  const qs = params.toString();
  const res = await fetch(`/api/employees${qs ? `?${qs}` : ''}`, mergeSignal(registerFetchOpts, signal));
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load employees');
  return Array.isArray(data) ? data : [];
}

export const HR_SHEET_EMP_PAGE = 50;

/** Attendance Sheet tab — lean monthly grid payload (paged employees when limit set). */
export async function fetchHrAttendanceSheet(month, year, options = {}) {
  const { offset = 0, limit = HR_SHEET_EMP_PAGE, signal } = options;
  const params = new URLSearchParams({
    sheet: 'true',
    month: String(month),
    year: String(year),
    limit: String(limit),
    offset: String(offset),
  });
  const res = await fetch(`/api/attendance?${params.toString()}`, mergeSignal(registerFetchOpts, signal));
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load attendance sheet');
  return data;
}

/** Batch save attendance sheet cell edits. */
export async function saveHrAttendanceBatch(rows) {
  const res = await fetch('/api/attendance', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rows),
    cache: 'no-store',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to save attendance');
  return data;
}

export async function fetchHrLedgerSummaryPage(options = {}) {
  const {
    offset = 0,
    limit = HR_REGISTER_PAGE_SIZE,
    search,
    signal,
  } = options;
  const params = new URLSearchParams({
    summary: 'true',
    limit: String(limit),
    offset: String(offset),
  });
  if (search && String(search).trim()) params.set('q', String(search).trim());
  const res = await fetch(`/api/employee-ledger?${params.toString()}`, mergeSignal(registerFetchOpts, signal));
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load ledger summary');
  if (Array.isArray(data)) {
    return { items: data, total: data.length, limit: data.length, offset: 0, hasMore: false };
  }
  return {
    items: Array.isArray(data.items) ? data.items : [],
    total: data.total ?? 0,
    limit: data.limit ?? limit,
    offset: data.offset ?? offset,
    hasMore: !!data.hasMore,
  };
}

export async function fetchHrLedgerSummaryStats(options = {}) {
  const { signal, reconcile = false } = options;
  const params = new URLSearchParams({ summary: 'true', stats: 'true' });
  if (reconcile) params.set('reconcile', 'true');
  const res = await fetch(`/api/employee-ledger?${params.toString()}`, mergeSignal(registerFetchOpts, signal));
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load ledger stats');
  return data;
}

export async function fetchHrJsonArray(url, init) {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return Array.isArray(data) ? data : [];
}
