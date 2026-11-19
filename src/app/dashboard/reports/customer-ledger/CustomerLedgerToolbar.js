'use client';

import { TailwindDateInput } from '../../components/date-filter-input';
import { ArrowLeft, Download, Printer, Loader2, Search, X } from 'lucide-react';
import CustomerLedgerCustomerSelect from './CustomerLedgerCustomerSelect';

const CTL =
  'h-9 w-full min-w-0 px-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:border-slate-300 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-500/15 transition-all duration-150';

export default function CustomerLedgerToolbar({
  title = 'Customer Ledger',
  backPath = '/dashboard/reports',
  router,
  customerOptions,
  selectedCustomer,
  onCustomerChange,
  startDate,
  endDate,
  onStartDate,
  onEndDate,
  ledgerSearch,
  onLedgerSearchChange,
  showLedgerSearch,
  ledgerSearchDisabled,
  onExport,
  onPrint,
  loading,
  hasReport,
  accountPlaceholder,
  accountNoOptionsText,
}) {
  return (
    <div className="print:hidden flex-shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={() => router.push(backPath)}
          className="h-9 w-9 flex shrink-0 items-center justify-center rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white border border-slate-200/80 hover:border-slate-250 transition-colors"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-[15px] font-bold text-slate-900 tracking-tight truncate min-w-0 flex-1">
          {title}
        </h1>
        <div className="flex items-center gap-1.5 shrink-0">
          {loading && (
            <span className="h-8 px-2 hidden sm:inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-600">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading
            </span>
          )}
          {hasReport && (
            <>
              <button
                type="button"
                onClick={onExport}
                className="h-8 px-2.5 inline-flex items-center gap-1 rounded-lg text-[11px] font-semibold text-emerald-800 bg-emerald-50/90 border border-emerald-200/70 hover:bg-emerald-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                type="button"
                onClick={onPrint}
                className="h-8 px-2.5 inline-flex items-center gap-1 rounded-lg text-[11px] font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Print</span>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:flex-nowrap gap-1.5 p-1.5 lg:gap-1 lg:p-1.5">
          <div className="lg:flex-[1.15] min-w-0 lg:min-w-[200px] lg:max-w-[38%]">
            <CustomerLedgerCustomerSelect
              options={customerOptions}
              value={selectedCustomer}
              onChange={onCustomerChange}
              compact
              placeholder={accountPlaceholder}
              noOptionsText={accountNoOptionsText}
            />
          </div>

          <div className="hidden lg:block w-px self-stretch bg-slate-200 mx-0.5 shrink-0" aria-hidden />

          <div className="flex gap-1.5 lg:contents">
            <div className="flex-1 lg:flex-none lg:w-[104px] shrink-0">
              <TailwindDateInput value={startDate} onChange={onStartDate} inputClassName={CTL} />
            </div>
            <div className="flex-1 lg:flex-none lg:w-[104px] shrink-0">
              <TailwindDateInput value={endDate} onChange={onEndDate} inputClassName={CTL} />
            </div>
          </div>

          {showLedgerSearch && (
            <>
              <div className="hidden lg:block w-px self-stretch bg-slate-200 mx-0.5 shrink-0" aria-hidden />
              <div className="relative lg:flex-1 min-w-0 lg:min-w-[160px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="search"
                  value={ledgerSearch}
                  disabled={ledgerSearchDisabled}
                  onChange={(e) => onLedgerSearchChange(e.target.value)}
                  placeholder="Filter lines: bill, amount, ID, reference…"
                  className={`${CTL} pl-8 pr-8 text-[13px] placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed`}
                />
                {ledgerSearch ? (
                  <button
                    type="button"
                    onClick={() => onLedgerSearchChange('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    aria-label="Clear filter"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}