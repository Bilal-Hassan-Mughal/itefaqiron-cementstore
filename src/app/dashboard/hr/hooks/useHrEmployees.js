'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHrEmployeeRegisterList } from '../lib/hr-fetch';
import { useHrRefreshVersion, HR_KEYS } from '../context/HrRefreshContext';
import { normalizeEmployeeRow } from '../components/employees/employeeRegisterShared';

const cache = {
  rows: null,
  syncedVersion: -1,
  inflight: null,
};

function normalizeList(data) {
  return (data || []).map(normalizeEmployeeRow);
}

async function loadEmployeesFromApi() {
  if (!cache.inflight) {
    cache.inflight = fetchHrEmployeeRegisterList()
      .then(normalizeList)
      .finally(() => {
        cache.inflight = null;
      });
  }
  return cache.inflight;
}

/**
 * HR employee register data — cached list, background refresh on HR signal (no empty flash).
 */
export function useHrEmployees() {
  const signalVersion = useHrRefreshVersion(HR_KEYS.employees);
  const [employees, setEmployees] = useState(() => cache.rows ?? []);
  const [loading, setLoading] = useState(() => cache.rows == null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applyRows = useCallback((rows, version) => {
    cache.rows = rows;
    cache.syncedVersion = version;
    setEmployees(rows);
  }, []);

  useEffect(() => {
    const stale = cache.syncedVersion !== signalVersion;
    const hasCache = cache.rows != null;

    if (hasCache && !stale) {
      setEmployees(cache.rows);
      setLoading(false);
      setRefreshing(false);
      return undefined;
    }

    if (hasCache && stale) {
      setRefreshing(true);
      setLoading(false);
    } else {
      setLoading(true);
    }

    let cancelled = false;

    loadEmployeesFromApi()
      .then((rows) => {
        if (cancelled || !mounted.current) return;
        applyRows(rows, signalVersion);
        setError(null);
      })
      .catch((err) => {
        if (cancelled || !mounted.current) return;
        setError(err.message || 'Failed to load employees');
        if (!hasCache) setEmployees([]);
      })
      .finally(() => {
        if (cancelled || !mounted.current) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [signalVersion, applyRows]);

  const replaceLocal = useCallback((nextRows) => {
    const rows = typeof nextRows === 'function' ? nextRows(cache.rows ?? []) : nextRows;
    cache.rows = rows;
    setEmployees(rows);
  }, []);

  const mergeServerRow = useCallback((row, replaceId = null) => {
    const normalized = normalizeEmployeeRow(row);
    replaceLocal((list) => {
      const idx = list.findIndex((e) => {
        if (replaceId != null && (e.emp_id === replaceId || e.emp_id === normalized.emp_id)) return true;
        return e.emp_id === normalized.emp_id;
      });
      if (idx === -1) return [...list, normalized].sort((a, b) => a.emp_name.localeCompare(b.emp_name));
      const next = [...list];
      next[idx] = { ...next[idx], ...normalized };
      return next.sort((a, b) => a.emp_name.localeCompare(b.emp_name));
    });
  }, [replaceLocal]);

  const removeLocal = useCallback((empId) => {
    replaceLocal((list) => list.filter((e) => e.emp_id !== empId));
  }, [replaceLocal]);

  const softSync = useCallback(async () => {
    setRefreshing(true);
    try {
      const rows = await loadEmployeesFromApi();
      if (mounted.current) {
        applyRows(rows, signalVersion);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) setError(err.message || 'Refresh failed');
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [applyRows, signalVersion]);

  return {
    employees,
    loading,
    refreshing,
    error,
    replaceLocal,
    mergeServerRow,
    removeLocal,
    softSync,
  };
}
