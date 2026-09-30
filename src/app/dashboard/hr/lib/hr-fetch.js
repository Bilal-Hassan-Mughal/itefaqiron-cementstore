/** HR-only fetch helpers — safe JSON / array parsing for tab components. */

export async function fetchHrEmployeeList(options = {}) {
  const { lite = false, status } = options;
  const params = new URLSearchParams();
  if (lite) params.set('lite', 'true');
  if (status) params.set('status', status);
  const qs = params.toString();
  const res = await fetch(`/api/employees${qs ? `?${qs}` : ''}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Failed to load employees');
  return Array.isArray(data) ? data : [];
}

export async function fetchHrJsonArray(url, init) {
  const res = await fetch(url, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return Array.isArray(data) ? data : [];
}
