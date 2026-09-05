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
