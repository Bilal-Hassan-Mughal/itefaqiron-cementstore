import { AsyncLocalStorage } from 'async_hooks';

export const branchContext = new AsyncLocalStorage();

export function getBranchContext() {
  return branchContext.getStore() ?? null;
}

export function getActiveBranchId() {
  return getBranchContext()?.branchId ?? null;
}

export function getActiveTablePrefix() {
  return getBranchContext()?.tablePrefix ?? null;
}

export function getActiveIsolationMode() {
  return getBranchContext()?.isolationMode ?? 'SHARED';
}

export function usesDedicatedStorage() {
  const ctx = getBranchContext();
  return ctx?.isolationMode === 'DEDICATED' || ctx?.isolationMode === 'PREFIXED';
}

export function getActiveBranchPrisma() {
  return getBranchContext()?.branchPrisma ?? null;
}

export function runWithBranchContext(context, fn) {
  return branchContext.run(context, fn);
}
