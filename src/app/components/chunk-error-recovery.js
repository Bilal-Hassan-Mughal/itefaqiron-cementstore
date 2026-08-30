'use client';

import { useEffect } from 'react';

const SESSION_KEY = '__next_chunk_reload__';

/**
 * After a new deploy, cached HTML can still point at old /_next/static/chunks/*.js (404) → ChunkLoadError.
 * One automatic reload fetches a fresh document with current chunk names.
 */
export default function ChunkErrorRecovery() {
  useEffect(() => {
    try {
      window.sessionStorage?.removeItem(SESSION_KEY);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const tryReload = () => {
      if (typeof window === 'undefined' || !window.sessionStorage) return;
      if (window.sessionStorage.getItem(SESSION_KEY) === '1') return;
      window.sessionStorage.setItem(SESSION_KEY, '1');
      window.location.reload();
    };

    const isChunkLike = (url) => typeof url === 'string' && url.includes('/_next/static/');

    const onError = (e) => {
      const t = e?.target;
      if (t?.nodeName === 'SCRIPT' && isChunkLike(t?.src)) {
        tryReload();
        return;
      }
      if (e?.message && /ChunkLoadError|Loading chunk|Failed to fetch.*chunk/i.test(String(e.message))) {
        tryReload();
      }
    };

    const onRejection = (e) => {
      const m = (e?.reason && (e.reason.message || e.reason)) || e?.message || '';
      const s = String(m);
      if (/ChunkLoadError|Loading chunk|import\(\)/i.test(s) || isChunkLike(s)) tryReload();
    };

    window.addEventListener('error', onError, true);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError, true);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
