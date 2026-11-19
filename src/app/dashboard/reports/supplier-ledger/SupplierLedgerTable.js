'use client';

import { formatDatePK } from '@/lib/date-helper';
import { fmtLedgerAmt, ledgerRowKey } from '../customer-ledger/customer-ledger-utils';

function txnTone(entry) {
  const debit = parseFloat(entry.debit_amount || 0);
  const credit = parseFloat(entry.credit_amount || 0);
  if (credit > 0) return 'credit';
  if (debit > 0) return 'debit';
  return 'neutral';
}

function TypePill({ type }) {
  const t = String(type || '—');
  const u = t.toUpperCase();
  let bg = 'bg-slate-100 text-slate-600 ring-slate-200/80';
  if (u.includes('SALE') || u.includes('DEBIT') || u === 'PURCHASE') bg = 'bg-rose-50 text-rose-700 ring-rose-100';
  else if (u.includes('PAY') || u.includes('CREDIT') || u === 'CASH') bg = 'bg-teal-50 text-teal-800 ring-teal-100';
  else if (u.includes('BANK')) bg = 'bg-violet-50 text-violet-800 ring-violet-100';
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold ring-1 ring-inset ${bg}`}>
      {t}
    </span>
  );
}

function referenceCell(entry, isFirstBill) {
  if (!entry.bill_no) return <span className="text-slate-300">—</span>;
  if (!isFirstBill) return null;
  const showAmt =
    (entry.trnx_type === 'PURCHASE' && parseFloat(entry.debit_amount || 0) > 0)
    || (/incity \(own\) - (labour|delivery)/i).test(entry.details || '');
  return (
    <div className="text-xs leading-snug">
      <span className="font-semibold text-slate-700">{entry.bill_no}</span>
      {showAmt && (
        <span className="text-indigo-600 font-semibold ml-1 tabular-nums">· {fmtLedgerAmt(entry.debit_amount)}</span>
      )}
    </div>
  );
}

const TH =
  'sticky top-0 z-30 bg-slate-800 text-slate-100 border border-slate-600/80 px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider print:static print:bg-slate-800 print:text-white print:py-1.5 print:px-1';
const TD = 'border border-slate-200 px-2 py-2 align-middle print:px-1 print:py-1 print:text-[9px] print:align-top';
const TD_AMT = `${TD} text-right tabular-nums`;

export default function SupplierLedgerTable({ entries, summary, filteredCount, totalCount }) {
  const list = entries || [];
  const showingFilter = filteredCount != null && totalCount != null && filteredCount < totalCount;

  return (
    <div className="customer-ledger-table-shell flex flex-col min-h-0 flex-1 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-[0_4px_24px_rgba(15,23,42,0.05)] print:rounded-none print:border-slate-400 print:shadow-none print:overflow-visible print:flex-none print:h-auto">
      {showingFilter && (
        <div className="flex-shrink-0 px-3 py-1.5 text-[11px] text-slate-600 bg-amber-50/80 border-b border-amber-100 print:hidden">
          Showing <span className="font-semibold tabular-nums">{filteredCount}</span> of{' '}
          <span className="tabular-nums">{totalCount}</span> lines
        </div>
      )}

      <div className="customer-ledger-table-scroll flex-1 min-h-0 overflow-auto overscroll-contain print:overflow-visible print:h-auto print:min-h-0 print:max-h-none">
        <table
          className="customer-ledger-print-table w-full text-[13px] border-collapse border border-slate-200 print:text-[8.5px] print:table-fixed"
          style={{ minWidth: 1120 }}
        >
          <thead>
            <tr>
              <th className={`${TH} text-left w-[88px]`}>Date</th>
              <th className={`${TH} text-left w-[80px]`}>Type</th>
              <th className={`${TH} text-left w-[72px]`}>Bill</th>
              <th className={`${TH} text-left min-w-[200px]`}>Narration</th>
              <th className={`${TH} text-left w-[92px]`}>Ref</th>
              <th className={`${TH} text-right text-rose-200 w-[88px]`}>Debit</th>
              <th className={`${TH} text-right text-teal-200 w-[88px]`}>Credit</th>
              <th className={`${TH} text-right w-[72px]`}>Cash</th>
              <th className={`${TH} text-right w-[72px]`}>Bank</th>
              <th className={`${TH} text-right text-indigo-200 w-[96px]`}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {list.map((entry, index) => {
              const debit = parseFloat(entry.debit_amount || 0);
              const credit = parseFloat(entry.credit_amount || 0);
              const cash = parseFloat(entry.cash_payment || 0);
              const bank = parseFloat(entry.bank_payment || 0);
              const tone = txnTone(entry);
              const rowBg =
                tone === 'debit'
                  ? 'bg-rose-50/25'
                  : tone === 'credit'
                    ? 'bg-teal-50/20'
                    : index % 2 === 1
                      ? 'bg-slate-50/50'
                      : 'bg-white';

              const firstIndex = list.findIndex(
                (e) =>
                  e.bill_no === entry.bill_no
                  && (e.cus_id || e.customer?.cus_id) === (entry.cus_id || entry.customer?.cus_id)
              );
              const isFirstBill = Boolean(entry.bill_no && firstIndex === index);

              return (
                <tr
                  key={ledgerRowKey(entry, index)}
                  className={`customer-ledger-print-row ${rowBg} hover:bg-indigo-50/35 transition-colors duration-100 print:hover:bg-transparent`}
                >
                  <td className={`${TD} whitespace-nowrap text-slate-800 font-medium tabular-nums text-xs`}>
                    {formatDatePK(entry.created_at)}
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>
                    <TypePill type={entry.trnx_type} />
                  </td>
                  <td className={`${TD} whitespace-nowrap font-mono text-xs text-slate-700`}>
                    {entry.bill_no ? String(entry.bill_no).slice(-12) : '—'}
                  </td>
                  <td className={`${TD} text-slate-700 text-xs leading-relaxed`}>
                    <span className="line-clamp-2 print:line-clamp-none print:whitespace-normal print:overflow-visible" title={entry.details || ''}>
                      {entry.details || '—'}
                    </span>
                  </td>
                  <td className={`${TD} whitespace-nowrap`}>{referenceCell(entry, isFirstBill)}</td>
                  <td className={`${TD_AMT} font-semibold text-rose-600`}>
                    {debit > 0 ? fmtLedgerAmt(debit) : <span className="text-slate-300 font-normal">—</span>}
                  </td>
                  <td className={`${TD_AMT} font-semibold text-teal-600`}>
                    {credit > 0 ? fmtLedgerAmt(credit) : <span className="text-slate-300 font-normal">—</span>}
                  </td>
                  <td className={`${TD_AMT} text-sky-700`}>
                    {cash > 0 ? fmtLedgerAmt(cash) : '—'}
                  </td>
                  <td className={`${TD_AMT} text-violet-700`}>
                    {bank > 0 ? fmtLedgerAmt(bank) : '—'}
                  </td>
                  <td className={`${TD_AMT} font-bold text-indigo-800`}>
                    {fmtLedgerAmt(entry.closing_balance)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {summary && (
            <tfoot>
              <tr className="customer-ledger-print-foot bg-slate-900 text-white text-xs sticky bottom-0 z-20 print:static">
                <td colSpan={5} className="border border-slate-700 px-3 py-2.5 font-semibold uppercase tracking-wide text-slate-300">
                  Period totals
                </td>
                <td className="border border-slate-700 px-2 py-2.5 text-right tabular-nums font-bold text-rose-300">
                  {fmtLedgerAmt(summary.totalDebit)}
                </td>
                <td className="border border-slate-700 px-2 py-2.5 text-right tabular-nums font-bold text-teal-300">
                  {fmtLedgerAmt(summary.totalCredit)}
                </td>
                <td className="border border-slate-700" colSpan={2} />
                <td className="border border-slate-700 px-2 py-2.5 text-right tabular-nums font-bold text-indigo-200 text-sm">
                  {fmtLedgerAmt(summary.closingBalance)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {!list.length && (
        <div className="py-14 text-center text-sm text-slate-500 border-t border-slate-100">
          {totalCount ? 'No lines match your filter.' : 'No transactions in this period.'}
        </div>
      )}
    </div>
  );
}