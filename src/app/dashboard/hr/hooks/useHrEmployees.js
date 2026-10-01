'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchHrEmployeeRegisterPage,
  fetchHrEmployeeRegisterStats,
  HR_REGISTER_PAGE_SIZE,
} from '../lib/hr-fetch';
import { useHrRefreshVersion, HR_KEYS } from '../context/HrRefreshContext';
import { normalizeEmployeeRow } from '../components/employees/employeeRegisterShared';

const listCache = {
  key: '',
  rows: [],
  total: 0,
  hasMore: false,
  stats: null,
  syncedVersion: -1,
};

function cacheKey(filters) {
  return `${filters.status || 'ALL'}|${(filters.search || '').trim().toLowerCase()}`;
}

function normalizeList(data) {
  return (data || []).map(normalizeEmployeeRow);
}

/**
 * HR employee register — paginated lazy load + stats API (fast first paint).
 */
export function useHrEmployees(filters = {}) {
  const { status = 'ALL', search = '' } = filters;
  const signalVersion = useHrRefreshVersion(HR_KEYS.employees);
  const key = cacheKey({ status, search });

  const [employees, setEmployees] = useState(() => (listCache.key === key ? listCache.rows : []));
  const [stats, setStats] = useState(() => (listCache.key === key ? listCache.stats : null));
  const [total, setTotal] = useState(() => (listCache.key === key ? listCache.total : 0));
  const [hasMore, setHasMore] = useState(() => (listCache.key === key ? listCache.hasMore : true));
  const [loading, setLoading] = useState(() => listCache.key !== key || listCache.rows.length === 0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const mounted = useRef(true);
  const abortRef = useRef(null);
  const inflightRef = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abortRef.current?.abort();
    };
  }, []);

  const applyPage = useCallback((page, append, nextStats, version) => {
    const rows = normalizeList(page.items);
    listCache.key = key;
    listCache.syncedVersion = version;
    listCache.total = page.total;
    listCache.hasMore = page.hasMore;
    listCache.stats = nextStats;
    listCache.rows = append ? [...(listCache.key === key ? listCache.rows : []), ...rows] : rows;
    if (!append) listCache.rows = rows;

    setEmployees(listCache.rows);
    setTotal(page.total);
    setHasMore(page.hasMore);
    setStats(nextStats);
  }, [key]);

  const loadFirstPage = useCallback(async (withRefreshFlag = false) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    if (withRefreshFlag && listCache.rows.length > 0) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [page, nextStats] = await Promise.all([
        fetchHrEmployeeRegisterPage({
          status,
          search,
          offset: 0,
          limit: HR_REGISTER_PAGE_SIZE,
          signal: ac.signal,
        }),
        fetchHrEmployeeRegisterStats({ status, signal: ac.signal }),
      ]);
      if (!mounted.current || ac.signal.aborted) return;
      applyPage(page, false, nextStats, signalVersion);
      setError(null);
    } catch (err) {
      if (ac.signal.aborted || !mounted.current) return;
      setError(err.message || 'Failed to load employees');
      if (!listCache.rows.length) setEmployees([]);
    } finally {
      if (mounted.current && !ac.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [status, search, applyPage, signalVersion]);

  useEffect(() => {
    const stale = listCache.syncedVersion !== signalVersion || listCache.key !== key;
    const hasUsableCache = listCache.key === key && listCache.rows.length > 0 && !stale;

    if (hasUsableCache) {
      setEmployees(listCache.rows);
      setStats(listCache.stats);
      setTotal(listCache.total);
      setHasMore(listCache.hasMore);
      setLoading(false);
      setRefreshing(false);
      return undefined;
    }

    loadFirstPage(stale && listCache.rows.length > 0);
    return () => abortRef.current?.abort();
  }, [key, signalVersion, loadFirstPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      if (!inflightRef.current) {
        inflightRef.current = fetchHrEmployeeRegisterPage({
          status,
          search,
          offset: employees.length,
          limit: HR_REGISTER_PAGE_SIZE,
        }).finally(() => {
          inflightRef.current = null;
        });
      }
      const page = await inflightRef.current;
      if (!mounted.current) return;
      const rows = normalizeList(page.items);
      listCache.rows = [...listCache.rows, ...rows];
      listCache.hasMore = page.hasMore;
      listCache.total = page.total;
      setEmployees(listCache.rows);
      setHasMore(page.hasMore);
      setTotal(page.total);
    } catch (err) {
      if (mounted.current) setError(err.message || 'Failed to load more');
    } finally {
      if (mounted.current) setLoadingMore(false);
    }
  }, [hasMore, loadingMore, loading, status, search, employees.length]);

  const replaceLocal = useCallback((nextRows) => {
    const rows = typeof nextRows === 'function' ? nextRows(listCache.rows ?? []) : nextRows;
    listCache.rows = rows;
    listCache.key = key;
    setEmployees(rows);
  }, [key]);

  const refreshStatsQuiet = useCallback(async () => {
    try {
      const nextStats = await fetchHrEmployeeRegisterStats({ status, search });
      if (mounted.current) {
        listCache.stats = nextStats;
        setStats(nextStats);
      }
    } catch {
      /* keep prior stats */
    }
  }, [status, search]);

  const mergeServerRow = useCallback((row, replaceId = null) => {
    const normalized = normalizeEmployeeRow(row);
    listCache.syncedVersion = signalVersion;
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
    refreshStatsQuiet();
  }, [replaceLocal, signalVersion, refreshStatsQuiet]);

  const removeLocal = useCallback((empId) => {
    replaceLocal((list) => list.filter((e) => e.emp_id !== empId));
    setTotal((t) => Math.max(0, t - 1));
  }, [replaceLocal]);

  const softSync = useCallback(async () => {
    listCache.syncedVersion = -1;
    await loadFirstPage(true);
  }, [loadFirstPage]);

  const bustCache = useCallback(() => {
    listCache.syncedVersion = -1;
    inflightRef.current = null;
  }, []);

  return {
    employees,
    stats,
    total,
    hasMore,
    loading,
    loadingMore,
    refreshing,
    error,
    loadMore,
    replaceLocal,
    mergeServerRow,
    removeLocal,
    softSync,
    bustCache,
  };
}
