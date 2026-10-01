'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchHrAttendanceSheet } from '../lib/hr-fetch';
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
  loadSheet(prev.month, prev.year).catch(() => {});
  loadSheet(next.month, next.year).catch(() => {});
}

async function loadSheet(month, year) {
  const key = sheetCacheKey(month, year);
  const entry = cacheEntry(key);
  if (!entry.inflight) {
    entry.inflight = fetchHrAttendanceSheet(month, year)
      .finally(() => {
        entry.inflight = null;
      });
  }
  return entry.inflight;
}

/**
 * Monthly attendance sheet — per-month cache, background refresh on HR signal.
 */
export function useHrAttendanceSheet(monthYear) {
  const { month, year } = monthYear;
  const key = sheetCacheKey(month, year);
  const entry = cacheEntry(key);
  const signalVersion = useHrRefreshVersion(HR_KEYS.attendance);

  const [sheetData, setSheetData] = useState(() => entry.data);
  const [loading, setLoading] = useState(() => entry.data == null);
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

    loadSheet(month, year)
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
      const data = await loadSheet(month, year);
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
    refreshing,
    error,
    replaceLocalSheet,
    softSync,
  };
}
