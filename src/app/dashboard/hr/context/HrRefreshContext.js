'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';

/** HR-only cache-bust keys — bumping a key refetches subscribed tabs. */
export const HR_KEYS = {
  summary: 'summary',
  employees: 'employees',
  /** Employee dropdowns (advance/receive) — lighter than full register reload */
  dropdown: 'dropdown',
  payroll: 'payroll',
  advances: 'advances',
  ledger: 'ledger',
  receipts: 'receipts',
  attendance: 'attendance',
};

const ALL_KEYS = Object.values(HR_KEYS);

const HrRefreshContext = createContext(null);

export function HrRefreshProvider({ children }) {
  const [versions, setVersions] = useState(() =>
    Object.fromEntries(ALL_KEYS.map((k) => [k, 0]))
  );

  const invalidate = useCallback((keys) => {
    const list = !keys || keys.length === 0
      ? ALL_KEYS
      : keys.includes('all')
        ? ALL_KEYS
        : keys;
    setVersions((prev) => {
      const next = { ...prev };
      for (const key of list) {
        if (next[key] !== undefined) next[key] += 1;
      }
      return next;
    });
  }, []);

  /** Common cross-page updates after HR mutations */
  const invalidateEmployeeData = useCallback(() => {
    invalidate([
      HR_KEYS.employees,
      HR_KEYS.dropdown,
      HR_KEYS.ledger,
      HR_KEYS.payroll,
      HR_KEYS.summary,
      HR_KEYS.attendance,
      HR_KEYS.advances,
    ]);
  }, [invalidate]);

  /** After register save/delete — keep list cache, refresh dropdowns + payroll inputs */
  const invalidateEmployeeRegisterSave = useCallback(() => {
    invalidate([
      HR_KEYS.dropdown,
      HR_KEYS.attendance,
      HR_KEYS.payroll,
      HR_KEYS.ledger,
    ]);
  }, [invalidate]);

  const invalidatePayrollFlow = useCallback(() => {
    invalidate([
      HR_KEYS.payroll,
      HR_KEYS.advances,
      HR_KEYS.ledger,
      HR_KEYS.summary,
      HR_KEYS.dropdown,
    ]);
  }, [invalidate]);

  const invalidateMoneyFromEmployee = useCallback(() => {
    invalidate([
      HR_KEYS.receipts,
      HR_KEYS.ledger,
      HR_KEYS.summary,
      HR_KEYS.dropdown,
    ]);
  }, [invalidate]);

  const value = useMemo(
    () => ({
      versions,
      invalidate,
      invalidateEmployeeData,
      invalidateEmployeeRegisterSave,
      invalidatePayrollFlow,
      invalidateMoneyFromEmployee,
    }),
    [
      versions,
      invalidate,
      invalidateEmployeeData,
      invalidateEmployeeRegisterSave,
      invalidatePayrollFlow,
      invalidateMoneyFromEmployee,
    ]
  );

  return (
    <HrRefreshContext.Provider value={value}>
      {children}
    </HrRefreshContext.Provider>
  );
}

export function useHrRefresh() {
  const ctx = useContext(HrRefreshContext);
  if (!ctx) {
    throw new Error('useHrRefresh must be used within HrRefreshProvider');
  }
  return ctx;
}

/** Re-run effects when this HR data domain changes (local or remote invalidation). */
export function useHrRefreshVersion(key) {
  const { versions } = useHrRefresh();
  return versions[key] ?? 0;
}
