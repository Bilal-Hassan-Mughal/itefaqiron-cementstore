const LEDGER_TABS_STORAGE_PREFIX = 'finance_open_ledger_tabs';

export function getLedgerTabsStorageKey() {
  if (typeof window === 'undefined') return `${LEDGER_TABS_STORAGE_PREFIX}_default`;
  try {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;
    const branchId = user?.branch_id ?? localStorage.getItem('active_branch_id') ?? 'default';
    return `${LEDGER_TABS_STORAGE_PREFIX}_${branchId}`;
  } catch {
    return `${LEDGER_TABS_STORAGE_PREFIX}_default`;
  }
}

export function loadPersistedLedgerTabs() {
  if (typeof window === 'undefined') return { openLedgers: [], activeLedgerId: null };
  try {
    const raw = localStorage.getItem(getLedgerTabsStorageKey());
    if (!raw) return { openLedgers: [], activeLedgerId: null };
    const parsed = JSON.parse(raw);
    const openLedgers = Array.isArray(parsed?.openLedgers)
      ? parsed.openLedgers
          .filter((t) => t && Number(t.id) > 0)
          .map((t) => ({
            id: Number(t.id),
            name: String(t.name || `Account #${t.id}`),
            minimized: Boolean(t.minimized),
          }))
      : [];
    const activeLedgerId =
      parsed?.activeLedgerId != null && parsed.activeLedgerId !== ''
        ? Number(parsed.activeLedgerId)
        : null;
    return { openLedgers, activeLedgerId };
  } catch {
    return { openLedgers: [], activeLedgerId: null };
  }
}

export function savePersistedLedgerTabs(openLedgers, activeLedgerId) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      getLedgerTabsStorageKey(),
      JSON.stringify({ openLedgers, activeLedgerId })
    );
  } catch {
    // ignore storage errors
  }
}

/** Open (or focus) an account ledger tab on the Finance page. */
export function openAccountLedgerTab(cusId, cusName) {
  const id = Number(cusId);
  if (!id) return false;
  const name = String(cusName || `Account #${id}`).trim();
  const { openLedgers } = loadPersistedLedgerTabs();
  const exists = openLedgers.find((l) => l.id === id);
  const updated = exists
    ? openLedgers.map((l) => (l.id === id ? { ...l, minimized: false, name } : l))
    : [...openLedgers, { id, name, minimized: false }];
  savePersistedLedgerTabs(updated, id);
  return true;
}

export const FINANCE_LEDGER_PATH = '/dashboard/finance';

export const LEDGER_DATA_CHANGED_EVENT = 'ledger-data-changed';
const LEDGER_CHANGED_STORAGE_KEY = 'ledger_data_changed_at';

/** Notify open Finance/ledger views to reload (same tab, other tabs, or after sales/payments). */
export function notifyLedgerDataChanged(source = 'unknown') {
  if (typeof window === 'undefined') return;
  const at = Date.now();
  window.dispatchEvent(
    new CustomEvent(LEDGER_DATA_CHANGED_EVENT, { detail: { source, at } })
  );
  try {
    localStorage.setItem(LEDGER_CHANGED_STORAGE_KEY, String(at));
  } catch {
    // ignore storage errors
  }
}

/** Subscribe to ledger refresh signals. Returns unsubscribe function. */
export function subscribeLedgerDataChanged(callback) {
  if (typeof window === 'undefined') return () => {};

  const onEvent = () => callback();
  const onStorage = (e) => {
    if (e.key === LEDGER_CHANGED_STORAGE_KEY) callback();
  };

  window.addEventListener(LEDGER_DATA_CHANGED_EVENT, onEvent);
  window.addEventListener('storage', onStorage);

  return () => {
    window.removeEventListener(LEDGER_DATA_CHANGED_EVENT, onEvent);
    window.removeEventListener('storage', onStorage);
  };
}
