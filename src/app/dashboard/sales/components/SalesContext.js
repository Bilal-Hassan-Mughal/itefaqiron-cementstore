'use client';

import { createContext, useContext } from 'react';

const SalesContext = createContext(null);

export function SalesProvider({ value, children }) {
  return <SalesContext.Provider value={value}>{children}</SalesContext.Provider>;
}

export function useSalesContext() {
  const context = useContext(SalesContext);
  if (!context) {
    throw new Error('useSalesContext must be used within a SalesProvider');
  }
  return context;
}

export default SalesContext;
