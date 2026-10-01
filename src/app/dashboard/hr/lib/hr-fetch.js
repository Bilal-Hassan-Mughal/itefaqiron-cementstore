/** HR-only fetch helpers — safe JSON / array parsing for tab components. */

const registerFetchOpts = { cache: 'no-store' };

/** Employee Register tab — lean API payload + ledger balances. */
export async function fetchHrEmployeeRegisterList(options = {}) {
  const { status } = options;
  const params = new URLSearchParams({ register: 'true' });
  if (status) params.set('status', status);
  const res = await fetch(`/api/employees?${params.toString()}`, registerFetchOpts);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load employees');
  return Array.isArray(data) ? data : [];
}

export async function fetchHrEmployeeList(options = {}) {
  const { lite = false, status } = options;
  const params = new URLSearchParams();
  if (lite) params.set('lite', 'true');
  if (status) params.set('status', status);
  const qs = params.toString();
  const res = await fetch(`/api/employees${qs ? `?${qs}` : ''}`, registerFetchOpts);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load employees');
  return Array.isArray(data) ? data : [];
}

/** Attendance Sheet tab — lean monthly grid payload. */
export async function fetchHrAttendanceSheet(month, year) {
  const params = new URLSearchParams({
    sheet: 'true',
    month: String(month),
    year: String(year),
  });
  const res = await fetch(`/api/attendance?${params.toString()}`, registerFetchOpts);
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

export async function fetchHrJsonArray(url, init) {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return Array.isArray(data) ? data : [];
}
