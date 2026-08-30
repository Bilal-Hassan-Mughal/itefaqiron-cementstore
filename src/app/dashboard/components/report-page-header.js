'use client';

/**
 * Branded letterhead for dashboard reports (screen + print).
 *
 * @param {string} reportTitle   Main report name shown in the black bar (e.g. "STOCK REPORT")
 * @param {string[]} [metaLines] Optional lines under the title (period, filters, tab, generated time)
 * @param {string} [className]  Extra classes on the wrapper
 */
export default function ReportPageHeader({ reportTitle, metaLines = [], className = '' }) {
  const lines = (metaLines || []).filter(Boolean);
  return (
    <div className={`text-center border-b-2 border-slate-800 pb-3 mb-4 print:border-black print:mb-3 ${className}`}>
      <h1 className="text-2xl font-bold tracking-wider text-slate-900">ITTEFAQ IRON STORE</h1>
      <p className="text-sm text-slate-600">Parianwali, Pakistan | Tel: +92 346 7560306</p>
      <div className="mt-2 py-1.5 bg-slate-900 text-white print:bg-black">
        <h2 className="text-sm sm:text-base font-bold tracking-widest uppercase px-1">{reportTitle}</h2>
      </div>
      {lines.length > 0 && (
        <div className="mt-2 text-xs text-slate-500 space-y-0.5">
          {lines.map((line, i) => (
            <p key={i}>{line}</p>
          ))}
        </div>
      )}
    </div>
  );
}
