'use client';

import { useCallback, useEffect, useState } from 'react';
import { computeMunshiPopupPlacement } from '@/lib/munshi-popup-placement';

export function useMunshiPopupPlacement(anchorRef, open, { width, height, kind }, bump = 0) {
  const [style, setStyle] = useState({ visibility: 'hidden', width });

  const update = useCallback(() => {
    const el = anchorRef?.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setStyle(computeMunshiPopupPlacement(rect, { width, height, kind }));
  }, [anchorRef, width, height, kind]);

  useEffect(() => {
    if (!open) {
      setStyle((s) => ({ ...s, visibility: 'hidden' }));
      return undefined;
    }
    update();
    const t = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      cancelAnimationFrame(t);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, update, bump]);

  return style;
}
