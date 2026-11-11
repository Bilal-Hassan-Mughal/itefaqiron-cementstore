/**
 * Smart popup placement near Munshi anchor — prefers above, flips by screen quadrant.
 */
export function computeMunshiPopupPlacement(anchorRect, { width = 400, height = 520, kind = 'whatsapp' } = {}) {
  if (!anchorRect || typeof window === 'undefined') {
    return { position: 'fixed', left: 12, top: 12, width, maxHeight: height, visibility: 'hidden' };
  }
  const pad = 12;
  const gap = 14;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const maxH = Math.min(height, vh - pad * 2);

  const cx = anchorRect.left + anchorRect.width / 2;
  const cy = anchorRect.top + anchorRect.height / 2;
  const preferRight = cx > vw * 0.55;
  const preferBottom = cy > vh * 0.55;

  const candidates = [];

  const push = (left, top, priority) => {
    let l = left;
    let t = top;
    l = Math.max(pad, Math.min(l, vw - width - pad));
    t = Math.max(pad, Math.min(t, vh - maxH - pad));
    const overlapAnchor =
      l < anchorRect.right &&
      l + width > anchorRect.left &&
      t < anchorRect.bottom &&
      t + maxH > anchorRect.top;
    candidates.push({ left: l, top: t, priority: priority + (overlapAnchor ? 50 : 0) });
  };

  if (preferBottom) {
    push(anchorRect.right - width, anchorRect.top - maxH - gap, 1);
    push(anchorRect.left, anchorRect.top - maxH - gap, 2);
    push(anchorRect.right - width, anchorRect.bottom + gap, 3);
    push(anchorRect.left - width - gap, anchorRect.top - maxH, 4);
  } else {
    push(anchorRect.left, anchorRect.bottom + gap, 1);
    push(anchorRect.right - width, anchorRect.bottom + gap, 2);
    push(anchorRect.right - width, anchorRect.top - maxH - gap, 3);
    push(anchorRect.right + gap, anchorRect.top, 4);
  }

  if (preferRight) {
    candidates.sort((a, b) => a.priority - b.priority);
  } else {
    candidates.sort((a, b) => a.priority - b.priority || a.left - b.left);
  }

  const best = candidates[0] || { left: pad, top: pad };

  return {
    position: 'fixed',
    left: Math.round(best.left),
    top: Math.round(best.top),
    width,
    maxHeight: maxH,
    visibility: 'visible',
    zIndex: kind === 'whatsapp' ? 118 : 117,
  };
}
