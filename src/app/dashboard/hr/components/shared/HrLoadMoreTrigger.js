'use client';

import { useEffect, useRef } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

/**
 * Fires onLoadMore when the sentinel enters the scroll root (lazy / infinite list).
 */
export default function HrLoadMoreTrigger({
  onLoadMore,
  hasMore,
  loading,
  rootRef,
  label = 'Load more',
}) {
  const sentinelRef = useRef(null);

  useEffect(() => {
    if (!hasMore || loading) return undefined;
    const root = rootRef?.current ?? null;
    const el = sentinelRef.current;
    if (!el) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onLoadMore();
      },
      { root, rootMargin: '120px', threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore, rootRef]);

  if (!hasMore) return null;

  return (
    <Box ref={sentinelRef} sx={{ py: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
      {loading ? (
        <CircularProgress size={22} />
      ) : (
        <Typography sx={{ fontSize: '0.8125rem', color: '#94a3b8' }}>{label}</Typography>
      )}
    </Box>
  );
}
