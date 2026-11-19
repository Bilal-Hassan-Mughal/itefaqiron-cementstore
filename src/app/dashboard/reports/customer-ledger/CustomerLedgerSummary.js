'use client';

import { fmtLedgerAmt, balanceToneClass } from './customer-ledger-utils';

const STATS = [
  { key: 'openingBalance', label: 'Opening', dot: 'bg-slate-400' },
  { key: 'totalDebit', label: 'Debit', dot: 'bg-rose-500', fixedTone: 'text-rose-600' },
  { key: 'totalCredit', label: 'Credit', dot: 'bg-teal-500', fixedTone: 'text-teal-600' },
  { key: 'closingBalance', label: 'Closing', dot: 'bg-indigo-500' },
];

export default function CustomerLedgerSummary({ summary, rowCount, customerLabel, periodLabel, filteredHint }) {
  if (!summary) return null;

  return (
    <div className="flex-shrink-0 print:hidden">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_1px_3px_rgba(15,23,42,0.04)]">
        {(customerLabel || periodLabel) && (
          <div className="px-3 py-1.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
            <span className="font-semibold text-slate-800 truncate">{customerLabel}</span>
            <span className="tabular-nums text-slate-500">{periodLabel}</span>
            {rowCount != null && (
              <span className="ml-auto text-slate-400 tabular-nums">
                {filteredHint || `${rowCount} lines`}
              </span>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
          {STATS.map((s) => {
            const raw = summary[s.key];
            const tone = s.fixedTone || balanceToneClass(raw);
            return (
              <div key={s.key} className="px-3 py-2.5 flex items-center gap-3">
                <span className={`w-1.5 h-8 rounded-full ${s.dot} shrink-0 opacity-90`} aria-hidden />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{s.label}</p>
                  <p className={`text-lg font-bold tabular-nums leading-tight ${tone}`}>{fmtLedgerAmt(raw)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}