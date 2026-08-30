// Offline POS Sales Helper & Auto-Sync Engine
const STORAGE_KEY = 'OFFLINE_POS_SALES_QUEUE';

/**
 * Get all pending offline sales from localStorage
 */
export function getOfflineSalesQueue() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading offline sales queue:', e);
    return [];
  }
}

/**
 * Save a sale payload locally to localStorage when network is unavailable
 */
export function saveOfflineSale(payload) {
  if (typeof window === 'undefined') return null;
  try {
    const queue = getOfflineSalesQueue();
    const offlineId = `OFFLINE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const offlineItem = {
      offlineId,
      timestamp: new Date().toISOString(),
      payload,
    };

    queue.push(offlineItem);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    console.log('📦 Sale saved offline:', offlineItem);
    return offlineId;
  } catch (e) {
    console.error('Error saving sale offline:', e);
    return null;
  }
}

/**
 * Remove a specific offline sale by offlineId after successful server sync
 */
export function removeOfflineSale(offlineId) {
  if (typeof window === 'undefined') return;
  try {
    const queue = getOfflineSalesQueue();
    const updated = queue.filter((item) => item.offlineId !== offlineId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Error removing offline sale:', e);
  }
}

/**
 * Sync all pending offline sales to the server API
 * Returns { syncedCount, failedCount, errors }
 */
export async function syncOfflineSalesQueue(onItemSynced) {
  if (typeof window === 'undefined') return { syncedCount: 0, failedCount: 0, remainingCount: 0 };

  const queue = getOfflineSalesQueue();
  if (!queue || queue.length === 0) {
    return { syncedCount: 0, failedCount: 0, remainingCount: 0 };
  }

  console.log(`🔄 Attempting to sync ${queue.length} pending offline bill(s)...`);

  let syncedCount = 0;
  let failedCount = 0;

  for (const item of queue) {
    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
      });

      if (response.ok) {
        const result = await response.json();
        removeOfflineSale(item.offlineId);
        syncedCount++;
        if (onItemSynced) onItemSynced(result, item);
      } else {
        console.warn(`Server rejected offline bill ${item.offlineId}:`, response.status);
        failedCount++;
      }
    } catch (err) {
      console.warn(`Failed to sync offline bill ${item.offlineId}:`, err);
      failedCount++;
      // Stop loop on network error to avoid hammering if still offline
      break;
    }
  }

  return {
    syncedCount,
    failedCount,
    remainingCount: getOfflineSalesQueue().length,
  };
}
