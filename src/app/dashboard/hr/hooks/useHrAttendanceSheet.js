'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHrAttendanceSheet, HR_SHEET_EMP_PAGE } from '../lib/hr-fetch';
import { useHrRefreshVersion, HR_KEYS } from '../context/HrRefreshContext';

const cacheByKey = new Map();

function cacheEntry(key) {
  if (!cacheByKey.has(key)) {
    cacheByKey.set(key, { data: null, syncedVersion: -1, inflight: null });
  }
  return cacheByKey.get(key);
}

function sheetCacheKey(month, year) {
  return `${year}-${month}`;
}

function mergeSheetPages(prev, next) {
  if (!prev) return next;
  const offDays = [...new Set([...(prev.offDays || []), ...(next.offDays || [])])].sort((a, b) => a - b);
  return {
    ...next,
    employees: [...(prev.employees || []), ...(next.employees || [])],
    grid: { ...(prev.grid || {}), ...(next.grid || {}) },
    offDays,
    totalEmployees: next.totalEmployees ?? prev.totalEmployees,
    hasMoreEmployees: next.hasMoreEmployees,
    employeeOffset: (next.employees || []).length + (prev.employees || []).length,
  };
}

function shiftMonthYear(month, year, delta) {
  let m = month + delta;
  let y = year;
  if (m < 1) {
    m = 12;
    y -= 1;
  } else if (m > 12) {
    m = 1;
    y += 1;
  }
  return { month: m, year: y };
}

function prefetchAdjacentSheets(month, year) {
  const prev = shiftMonthYear(month, year, -1);
  const next = shiftMonthYear(month, year, 1);
  loadSheetPage(prev.month, prev.year, 0).catch(() => {});
  loadSheetPage(next.month, next.year, 0).catch(() => {});
}

async function loadSheetPage(month, year, offset = 0) {
  const key = sheetCacheKey(month, year);
  const entry = cacheEntry(key);
  const inflightKey = `${key}@${offset}`;
  if (!entry.inflightMap) entry.inflightMap = new Map();
  if (!entry.inflightMap.has(inflightKey)) {
    entry.inflightMap.set(
      inflightKey,
      fetchHrAttendanceSheet(month, year, { offset, limit: HR_SHEET_EMP_PAGE }).finally(() => {
        entry.inflightMap.delete(inflightKey);
      })
    );
  }
  return entry.inflightMap.get(inflightKey);
}

/**
 * Monthly attendance sheet — first page fast, load more employees, per-month cache.
 */
export function useHrAttendanceSheet(monthYear) {
  const { month, year } = monthYear;
  const key = sheetCacheKey(month, year);
  const entry = cacheEntry(key);
  const signalVersion = useHrRefreshVersion(HR_KEYS.attendance);

  const [sheetData, setSheetData] = useState(() => entry.data);
  const [loading, setLoading] = useState(() => entry.data == null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const applySheet = useCallback((data, version) => {
    const e = cacheEntry(key);
    e.data = data;
    e.syncedVersion = version;
    setSheetData(data);
  }, [key]);

  useEffect(() => {
    const e = cacheEntry(key);
    const stale = e.syncedVersion !== signalVersion;
    const hasCache = e.data != null;

    if (hasCache && !stale) {
      setSheetData(e.data);
      setLoading(false);
      setRefreshing(false);
      return undefined;
    }

    if (hasCache && stale) {
      setRefreshing(true);
      setLoading(false);
      setSheetData(e.data);
    } else {
      setLoading(true);
      setSheetData(null);
    }

    let cancelled = false;

    loadSheetPage(month, year, 0)
      .then((data) => {
        if (cancelled || !mounted.current) return;
        applySheet(data, signalVersion);
        setError(null);
        prefetchAdjacentSheets(month, year);
      })
      .catch((err) => {
        if (cancelled || !mounted.current) return;
        setError(err.message || 'Failed to load attendance sheet');
        if (!hasCache) setSheetData(null);
      })
      .finally(() => {
        if (cancelled || !mounted.current) return;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month, year, key, signalVersion, applySheet]);

  const loadMoreEmployees = useCallback(async () => {
    const current = cacheEntry(key).data;
    if (!current?.hasMoreEmployees || loadingMore || loading) return;
    setLoadingMore(true);
    try {
      const offset = (current.employees || []).length;
      const page = await loadSheetPage(month, year, offset);
      if (!mounted.current) return;
      const merged = mergeSheetPages(current, page);
      applySheet(merged, signalVersion);
    } catch (err) {
      if (mounted.current) setError(err.message || 'Failed to load more');
    } finally {
      if (mounted.current) setLoadingMore(false);
    }
  }, [key, month, year, loadingMore, loading, applySheet, signalVersion]);

  const replaceLocalSheet = useCallback((next, options = {}) => {
    const { markSynced = false } = options;
    const e = cacheEntry(key);
    const data = typeof next === 'function' ? next(e.data) : next;
    e.data = data;
    if (markSynced) e.syncedVersion = signalVersion;
    setSheetData(data);
  }, [key, signalVersion]);

  const softSync = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await loadSheetPage(month, year, 0);
      if (mounted.current) {
        applySheet(data, signalVersion);
        setError(null);
      }
    } catch (err) {
      if (mounted.current) setError(err.message || 'Refresh failed');
    } finally {
      if (mounted.current) setRefreshing(false);
    }
  }, [month, year, applySheet, signalVersion]);

  return {
    sheetData,
    loading,
    loadingMore,
    refreshing,
    error,
    loadMoreEmployees,
    replaceLocalSheet,
    softSync,
  };
}
