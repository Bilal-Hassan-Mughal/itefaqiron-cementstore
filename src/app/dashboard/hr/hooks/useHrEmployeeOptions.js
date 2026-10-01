'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHrEmployeeDropdown } from '../lib/hr-fetch';
import { useHrRefreshVersion, HR_KEYS } from '../context/HrRefreshContext';
import { normalizeEmployeeRow } from '../components/employees/employeeRegisterShared';

const cache = { rows: null, version: -1, inflight: null };

function isAbortError(err) {
  return err?.name === 'AbortError' || err?.code === 20;
}

async function loadDropdown() {
  if (!cache.inflight) {
    cache.inflight = fetchHrEmployeeDropdown()
      .then((data) => data.map(normalizeEmployeeRow))
      .finally(() => {
        cache.inflight = null;
      });
  }
  return cache.inflight;
}

/** Employee dropdowns — minimal `/api/employees?register&dropdown` (fast). */
export function useHrEmployeeOptions() {
  const dropdownVersion = useHrRefreshVersion(HR_KEYS.dropdown);
  const employeesVersion = useHrRefreshVersion(HR_KEYS.employees);
  const version = Math.max(dropdownVersion, employeesVersion);

  const [employees, setEmployees] = useState(() => cache.rows ?? []);
  const [loading, setLoading] = useState(() => cache.rows == null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const refresh = useCallback(async () => {
    cache.inflight = null;
    const rows = await fetchHrEmployeeDropdown().then((data) => data.map(normalizeEmployeeRow));
    cache.rows = rows;
    cache.version = version;
    if (mounted.current) setEmployees(rows);
    return rows;
  }, [version]);

  useEffect(() => {
    if (cache.rows != null && cache.version === version) {
      setEmployees(cache.rows);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    let cancelled = false;

    loadDropdown()
      .then((rows) => {
        if (cancelled || !mounted.current) return;
        cache.rows = rows;
        cache.version = version;
        setEmployees(rows);
      })
      .catch((err) => {
        if (cancelled || isAbortError(err)) return;
        console.error('Employee dropdown load failed', err);
        if (mounted.current) setEmployees([]);
      })
      .finally(() => {
        if (!cancelled && mounted.current) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [version]);

  /** Dropdown API already returns ACTIVE only; tolerate missing/variant status. */
  const activeEmployees = employees.filter((e) => {
    const s = String(e?.status ?? 'ACTIVE').toUpperCase();
    return s === 'ACTIVE';
  });

  return { employees, activeEmployees, loading, refresh };
}
