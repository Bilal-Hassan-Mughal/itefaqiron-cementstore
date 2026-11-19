'use client';

import { fmtLedgerAmt, balanceToneClass } from './customer-ledger-utils';

const ROWS = [
  { key: 'openingBalance', label: 'Opening' },
  { key: 'totalDebit', label: 'Total debit' },
  { key: 'totalCredit', label: 'Total credit' },
  { key: 'closingBalance', label: 'Closing' },
];

export default function CustomerLedgerPrintSummary({ summary, customerLabel, periodLabel, lineCount, filterNote }) {
  if (!summary) return null;

  return (
    <div className="hidden print:block mb-2 border border-slate-300 text-[9px]">
      <div className="px-2 py-1 border-b border-slate-300 bg-slate-50 font-semibold text-slate-800">
        {customerLabel}
        {periodLabel ? <span className="font-normal text-slate-600"> · {periodLabel}</span> : null}
        {lineCount != null ? (
          <span className="font-normal text-slate-600"> · {lineCount} lines</span>
        ) : null}
        {filterNote ? <span className="font-normal text-amber-800"> · {filterNote}</span> : null}
      </div>
      <div className="grid grid-cols-4 divide-x divide-slate-300">
        {ROWS.map((r) => {
          const val = summary[r.key];
          return (
            <div key={r.key} className="px-2 py-1 text-center">
              <p className="text-[8px] uppercase tracking-wide text-slate-500 font-semibold">{r.label}</p>
              <p className={`font-bold tabular-nums ${
                r.key === 'totalDebit' ? 'text-red-700' : r.key === 'totalCredit' ? 'text-teal-700' : balanceToneClass(val)
              }`}>
                {fmtLedgerAmt(val)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}