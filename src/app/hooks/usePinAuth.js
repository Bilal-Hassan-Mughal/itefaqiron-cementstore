'use client';

import { useCallback, useRef, useState } from 'react';

export function usePinAuth() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const resolveRef = useRef(null);

  const requireAuth = useCallback(() => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialogOpen(true);
    });
  }, []);

  const handleAuthSuccess = useCallback(() => {
    setDialogOpen(false);
    if (resolveRef.current) {
      resolveRef.current(true);
      resolveRef.current = null;
    }
  }, []);

  const handleAuthCancel = useCallback(() => {
    setDialogOpen(false);
    if (resolveRef.current) {
      resolveRef.current(false);
      resolveRef.current = null;
    }
  }, []);

  return {
    requireAuth,
    authDialogOpen: dialogOpen,
    handleAuthSuccess,
    handleAuthCancel,
  };
}
