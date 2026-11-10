'use client';

import { useEffect } from 'react';

const SESSION_KEY = '__next_chunk_reload__';
const COUNT_KEY = '__next_chunk_reload_count__';
const MAX_RELOADS = 2;
const STABLE_MS = 12_000;

/**
 * After deploy, stale HTML may reference old /_next/static/chunks/*.js (404) → ChunkLoadError.
 * Allow at most MAX_RELOADS full page reloads per tab session — never loop forever on VPS/nginx 500s.
 */
export default function ChunkErrorRecovery() {
  useEffect(() => {
    const stableTimer = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(COUNT_KEY);
      } catch { /* ignore */ }
    }, STABLE_MS);
    return () => window.clearTimeout(stableTimer);
  }, []);

  useEffect(() => {
    const tryReload = () => {
      if (typeof window === 'undefined' || !window.sessionStorage) return;

      const countRaw = window.sessionStorage.getItem(COUNT_KEY);
      const count = countRaw ? parseInt(countRaw, 10) : 0;
      if (!Number.isFinite(count) || count >= MAX_RELOADS) return;

      if (window.sessionStorage.getItem(SESSION_KEY) === '1') return;
      window.sessionStorage.setItem(SESSION_KEY, '1');
      window.sessionStorage.setItem(COUNT_KEY, String(count + 1));
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
      if (/ChunkLoadError|Loading chunk|import\(\)/i.test(s)) tryReload();
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
