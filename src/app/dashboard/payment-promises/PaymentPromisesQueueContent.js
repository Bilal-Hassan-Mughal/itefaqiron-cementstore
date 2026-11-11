'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '../components/dashboard-layout';
import AccountPaymentPromiseDialog from '../components/AccountPaymentPromiseDialog';
import { formatDatePK } from '@/lib/date-helper';
import { openAccountLedgerTab } from '@/lib/ledger-tabs';
import {
  buildPendingBalanceWhatsAppMessage,
  customerWhatsAppPhone,
  formatPromiseDate,
  getPromiseBalanceMeta,
  getPromiseUrgency,
  localDateInputValue,
  PROMISE_PAGE_THEME,
} from '@/lib/account-payment-promise';
import { openWhatsAppDesktop } from '@/lib/whatsapp-local';
import {
  CalendarClock,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Printer,
  Download,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';

const THEME = PROMISE_PAGE_THEME;

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function getCurrentUserId() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return u?.user_id ?? null;
  } catch {
    return null;
  }
}

function addDaysToInput(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localDateInputValue(d);
}

export default function PaymentPromisesQueueContent() {
  const searchParams = useSearchParams();
  const today = useMemo(() => localDateInputValue(), []);
  const [mode, setMode] = useState('day');
  const [promiseDate, setPromiseDate] = useState(today);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(addDaysToInput(7));
  const [sendFilter, setSendFilter] = useState('all');
  const [balanceFilter, setBalanceFilter] = useState('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortDir, setSortDir] = useState('asc');

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, pending: 0, noPhone: 0, readyPending: 0 });
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const [editCustomer, setEditCustomer] = useState(null);
  const [sendingId, setSendingId] = useState(null);
  const [previewRow, setPreviewRow] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const send = searchParams.get('send');
    if (send === 'pending' || send === 'sent' || send === 'all') setSendFilter(send);
  }, [searchParams]);

  const buildQuery = useCallback(() => {
    const q = new URLSearchParams();
    if (overdueOnly) {
      q.set('overdue', '1');
    } else if (mode === 'day') {
      q.set('date', promiseDate);
    } else {
      q.set('from', fromDate);
      q.set('to', toDate);
    }
    q.set('send', sendFilter);
    if (debouncedSearch) q.set('search', debouncedSearch);
    return q.toString();
  }, [mode, promiseDate, fromDate, toDate, sendFilter, overdueOnly, debouncedSearch]);

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/customers/payment-promise-queue?${buildQuery()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not load queue');
        setItems([]);
        return;
      }
      setItems(data.items || []);
      setStats(data.stats || { total: 0, sent: 0, pending: 0, noPhone: 0, readyPending: 0, carryOver: 0 });
    } catch {
      setError('Network error loading queue');
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const displayItems = useMemo(() => {
    let list = [...items];
    if (balanceFilter === 'receivable') {
      list = list.filter((r) => parseFloat(r.customer?.cus_balance ?? r.cus_balance ?? 0) > 0);
    } else if (balanceFilter === 'payable') {
      list = list.filter((r) => parseFloat(r.customer?.cus_balance ?? r.cus_balance ?? 0) < 0);
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const balA = parseFloat(a.customer?.cus_balance ?? a.cus_balance ?? 0);
      const balB = parseFloat(b.customer?.cus_balance ?? b.cus_balance ?? 0);
      const nameA = (a.customer?.cus_name || a.cus_name || '').toLowerCase();
      const nameB = (b.customer?.cus_name || b.cus_name || '').toLowerCase();
      const dateA = new Date(a.promised_pay_date).getTime() || 0;
      const dateB = new Date(b.promised_pay_date).getTime() || 0;
      if (sortBy === 'name') return nameA.localeCompare(nameB) * dir;
      if (sortBy === 'balance') return (balA - balB) * dir;
      if (sortBy === 'status') {
        const sA = a.reminder_sent ? 1 : 0;
        const sB = b.reminder_sent ? 1 : 0;
        return (sA - sB) * dir;
      }
      return (dateA - dateB) * dir;
    });
    return list;
  }, [items, balanceFilter, sortBy, sortDir]);

  useEffect(() => {
    if (!displayItems.length) {
      setPreviewRow(null);
      return;
    }
    if (!previewRow || !displayItems.some((r) => r.promise_id === previewRow.promise_id)) {
      setPreviewRow(displayItems[0]);
    }
  }, [displayItems, previewRow]);

  const pageTotals = useMemo(() => {
    let balanceSum = 0;
    let promisedSum = 0;
    displayItems.forEach((r) => {
      balanceSum += parseFloat(r.customer?.cus_balance ?? r.cus_balance ?? 0);
      if (r.promised_amount != null) promisedSum += parseFloat(r.promised_amount) || 0;
    });
    const sendPct = stats.total ? Math.round((stats.sent / stats.total) * 100) : 0;
    return { balanceSum, promisedSum, sendPct };
  }, [displayItems, stats.sent, stats.total]);

  const applySentLocally = (promiseIds, sent) => {
    const idSet = new Set(promiseIds);
    const sentAt = sent ? new Date().toISOString() : null;
    const sentBy = sent ? getCurrentUserId() : null;
    setItems((prev) => {
      const next = prev.map((r) =>
        idSet.has(r.promise_id)
          ? {
              ...r,
              reminder_sent: sent,
              whatsapp_reminder_sent_at: sentAt,
              whatsapp_reminder_sent_by: sentBy,
            }
          : r,
      );
      const sentCount = next.filter((r) => r.reminder_sent).length;
      setStats((s) => ({
        ...s,
        sent: sentCount,
        pending: next.length - sentCount,
        readyPending: next.filter((r) => !r.reminder_sent && r.has_phone).length,
      }));
      return next;
    });
  };

  const postSendAction = async (action, promiseIds) => {
    const res = await fetch('/api/customers/payment-promise-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        promise_ids: promiseIds,
        sent_by: getCurrentUserId(),
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Update failed');
    }
    return res.json();
  };

  const sendOne = async (row) => {
    const phone = customerWhatsAppPhone(row.customer || row);
    if (!phone) {
      setToast('This account has no valid phone number.');
      return;
    }
    const balance = parseFloat(row.customer?.cus_balance ?? row.cus_balance ?? 0);
    const text = buildPendingBalanceWhatsAppMessage({
      customerName: row.customer?.cus_name || row.cus_name,
      balance,
      promisedPayDate: row.promised_pay_date,
      note: row.note,
    });
    setSendingId(row.promise_id);
    const opened = openWhatsAppDesktop(phone, text);
    if (!opened) {
      setSendingId(null);
      setToast('Could not open WhatsApp — check the phone number format.');
      return;
    }
    applySentLocally([row.promise_id], true);
    try {
      await postSendAction('mark_sent', [row.promise_id]);
      window.dispatchEvent(new CustomEvent('payment-promise-reminder-updated'));
      setToast('Marked as sent. Finish sending in WhatsApp.');
    } catch (e) {
      setToast(e.message || 'Sent in WhatsApp but could not save status — refresh.');
      fetchQueue();
    } finally {
      setSendingId(null);
    }
  };

  const markPaid = async (row) => {
    if (!window.confirm(`Mark payment commitment fulfilled for ${row.customer?.cus_name || row.cus_name}?`)) return;
    try {
      const res = await fetch('/api/customers/payment-promise', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promise_id: row.promise_id, action: 'fulfill' }),
      });
      if (!res.ok) throw new Error('Update failed');
      setToast('Marked as paid.');
      fetchQueue();
    } catch {
      setToast('Could not mark as paid.');
    }
  };

  const exportCsv = () => {
    const header = 'Account ID,Name,Phone,Balance,Balance Type,Due Date,Promised Amount,WhatsApp Status,Sent Date,Note';
    const lines = displayItems.map((row) => {
      const bal = parseFloat(row.customer?.cus_balance ?? row.cus_balance ?? 0);
      const meta = getPromiseBalanceMeta(bal);
      const name = (row.customer?.cus_name || row.cus_name || '').replace(/,/g, ' ');
      const phone = customerWhatsAppPhone(row.customer || row);
      return [
        row.cus_id,
        name,
        phone,
        fmtAmt(bal),
        meta.label,
        formatPromiseDate(row.promised_pay_date),
        row.promised_amount != null ? fmtAmt(row.promised_amount) : '',
        row.reminder_sent ? 'Sent' : 'Pending',
        row.whatsapp_reminder_sent_at ? formatDatePK(row.whatsapp_reminder_sent_at) : '',
        (row.note || '').replace(/,/g, ' '),
      ].join(',');
    });
    const blob = new Blob([`${header}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payment-promises-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-full flex flex-col gap-4 p-4 md:p-6 print:p-2" style={{ background: THEME.pageBg }}>
        {/* Top bar */}
        <div className="rounded-2xl border border-[#c5d4f0] bg-white shadow-sm overflow-hidden print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#1A55E3] text-white">
            <div className="flex items-center gap-3 min-w-0">
              <CalendarClock className="w-7 h-7 shrink-0 opacity-95" />
              <div>
                <h1 className="text-lg font-black tracking-tight">Payment promises</h1>
                <p className="text-[11px] opacity-90 font-medium">
                  Unsent WhatsApp stays on each new day until you send and mark sent
                  {stats.carryOver > 0 ? ` · ${stats.carryOver} rolled forward` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard/customers" className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/15 hover:bg-white/25 border border-white/20">
                Accounts
              </Link>
              <button type="button" onClick={() => window.print()} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 inline-flex items-center gap-1">
                <Printer className="w-3.5 h-3.5" /> Print
              </button>
              <button type="button" onClick={exportCsv} disabled={!displayItems.length} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 disabled:opacity-40 inline-flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button type="button" onClick={fetchQueue} className="px-3 py-1.5 text-xs font-bold rounded-lg bg-white text-[#1A55E3] hover:bg-slate-100 inline-flex items-center gap-1">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 divide-x divide-slate-100 border-b border-slate-100 bg-[#fafbfd]">
            {[
              { label: 'Total', value: stats.total },
              { label: 'Sent', value: stats.sent, hi: true },
              { label: 'Pending', value: stats.pending, warn: true },
              { label: 'No phone', value: stats.noPhone },
              { label: 'Promised', value: `Rs. ${fmtAmt(pageTotals.promisedSum)}`, small: true },
            ].map((s) => (
              <div key={s.label} className="px-3 py-2.5 text-center">
                <p className="text-[9px] font-extrabold uppercase text-slate-500">{s.label}</p>
                <p className={`font-black tabular-nums ${s.small ? 'text-xs' : 'text-lg'} ${s.hi ? 'text-emerald-700' : s.warn ? 'text-amber-800' : 'text-[#1347c4]'}`}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 bg-white flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-500 shrink-0">Progress</span>
            <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-[#1A55E3] to-emerald-500" style={{ width: `${pageTotals.sendPct}%` }} />
            </div>
            <span className="text-[10px] font-bold text-[#1347c4] tabular-nums shrink-0">{pageTotals.sendPct}%</span>
          </div>
        </div>

        {/* Filters — one aligned strip */}
        <div className="rounded-xl border border-[#dce3ed] bg-white shadow-sm px-3 py-3 print:hidden">
          <div className="flex flex-wrap gap-2 items-center lg:flex-nowrap">
            <div className="flex rounded-xl border border-slate-200 overflow-hidden text-xs font-bold shadow-sm">
              <button
                type="button"
                onClick={() => { setMode('day'); setOverdueOnly(false); }}
                className={`px-3 py-2 ${mode === 'day' && !overdueOnly ? 'bg-[#1A55E3] text-white' : 'bg-white text-slate-600'}`}
              >
                Single day
              </button>
              <button
                type="button"
                onClick={() => { setMode('range'); setOverdueOnly(false); }}
                className={`px-3 py-2 ${mode === 'range' ? 'bg-[#1A55E3] text-white' : 'bg-white text-slate-600'}`}
              >
                Date range
              </button>
            </div>

            {mode === 'day' && !overdueOnly && (
              <label className="flex flex-col gap-0.5 text-[10px] font-bold uppercase text-slate-500">
                Due date
                <input
                  type="date"
                  value={promiseDate}
                  onChange={(e) => setPromiseDate(e.target.value)}
                  className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-semibold"
                />
              </label>
            )}

            {mode === 'range' && !overdueOnly && (
              <>
                <label className="flex flex-col gap-0.5 text-[10px] font-bold uppercase text-slate-500">
                  From
                  <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                </label>
                <label className="flex flex-col gap-0.5 text-[10px] font-bold uppercase text-slate-500">
                  To
                  <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm" />
                </label>
              </>
            )}

            {[
              { label: 'Today', run: () => { setMode('day'); setOverdueOnly(false); setPromiseDate(today); } },
              { label: 'Tomorrow', run: () => { setMode('day'); setOverdueOnly(false); setPromiseDate(addDaysToInput(1)); } },
              { label: 'This week', run: () => { setMode('range'); setOverdueOnly(false); setFromDate(today); setToDate(addDaysToInput(7)); } },
              { label: 'Overdue', run: () => setOverdueOnly((v) => !v), active: overdueOnly },
            ].map((chip) => (
              <button
                key={chip.label}
                type="button"
                onClick={chip.run}
                className={`px-3 py-2 text-xs font-bold rounded-xl border ${
                  chip.active ? 'bg-rose-100 border-rose-300 text-rose-800' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center w-full mt-2 pt-2 border-t border-slate-100">
            {['all', 'pending', 'sent'].map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => setSendFilter(id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase ${
                  sendFilter === id ? 'bg-[#0f172a] text-white' : 'bg-slate-50 text-slate-600 border border-slate-200'
                }`}
              >
                {id === 'all' ? 'All' : id === 'pending' ? 'Not sent' : 'Sent'}
              </button>
            ))}
            <span className="w-px h-6 bg-slate-200 mx-1" />
            {[
              { id: 'all', label: 'All balances' },
              { id: 'receivable', label: 'Receivable' },
              { id: 'payable', label: 'Payable' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBalanceFilter(opt.id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold uppercase border ${
                  balanceFilter === opt.id ? 'bg-[#1347c4] text-white border-[#1347c4]' : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
            <div className="flex-1 min-w-[200px] relative ml-auto">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search name or phone"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#1A55E3]/25"
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-sm font-semibold px-4 py-3">{error}</div>
        )}
        {toast && (
          <div className="rounded-xl border border-[#c5d4f0] bg-[#e8effd] text-[#1347c4] text-sm font-semibold px-4 py-3 flex justify-between gap-2 print:hidden">
            <span>{toast}</span>
            <button type="button" className="text-xs font-bold underline" onClick={() => setToast('')}>
              Dismiss
            </button>
          </div>
        )}

        <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-4 flex-1 min-h-0 print:block">
          <div id="promise-queue-print" className="rounded-xl border border-[#dce3ed] bg-white shadow-sm overflow-hidden flex flex-col min-h-[320px]">
            <div className="px-3 py-2.5 bg-[#e8effd] border-b border-[#c5d4f0] flex items-center justify-between gap-2">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#1347c4]">
                Commitment list · {displayItems.length} rows
              </span>
              <span className="text-[10px] font-semibold text-slate-600 tabular-nums">
                Balance Σ Rs. {fmtAmt(pageTotals.balanceSum)}
              </span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-20 text-slate-500 gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                Loading…
              </div>
            ) : (
              <div className="overflow-auto max-h-[calc(100vh-16rem)]">
                <table className="w-full text-left min-w-[720px]">
                  <thead className="bg-[#f8fafc] text-[10px] font-extrabold uppercase tracking-wider text-slate-500 sticky top-0 z-10 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2.5 w-8" />
                      <th className="px-3 py-2.5 cursor-pointer hover:text-[#1A55E3]" onClick={() => toggleSort('name')}>
                        Account {sortBy === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="px-3 py-2.5 text-right cursor-pointer hover:text-[#1A55E3] w-28" onClick={() => toggleSort('balance')}>
                        Balance {sortBy === 'balance' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="px-3 py-2.5 w-24 cursor-pointer hover:text-[#1A55E3]" onClick={() => toggleSort('date')}>
                        Due {sortBy === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                      <th className="px-3 py-2.5 w-28 cursor-pointer hover:text-[#1A55E3]" onClick={() => toggleSort('status')}>
                        WhatsApp {sortBy === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {displayItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-16 text-center">
                          <p className="font-bold text-slate-700">No commitments for this filter</p>
                          <p className="text-sm text-slate-500 mt-1">Set a promise from Accounts or widen the date range.</p>
                          <Link href="/dashboard/customers" className="inline-block mt-4 text-sm font-bold text-[#1A55E3] hover:underline">
                            Go to Accounts →
                          </Link>
                        </td>
                      </tr>
                    ) : (
                      displayItems.map((row) => {
                        const name = row.customer?.cus_name || row.cus_name || '—';
                        const phone = customerWhatsAppPhone(row.customer || row) || '—';
                        const bal = parseFloat(row.customer?.cus_balance ?? row.cus_balance ?? 0);
                        const balMeta = getPromiseBalanceMeta(bal);
                        const urgency = getPromiseUrgency(row.promised_pay_date);
                        const isActive = previewRow?.promise_id === row.promise_id;
                        return (
                          <tr
                            key={row.promise_id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setPreviewRow(row)}
                            onKeyDown={(e) => e.key === 'Enter' && setPreviewRow(row)}
                            className={`cursor-pointer transition-colors ${
                              isActive ? 'bg-[#e8effd] border-l-4 border-l-[#1A55E3]' : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                            } ${urgency.id === 'overdue' && !isActive ? 'bg-rose-50/40' : ''}`}
                          >
                            <td className="px-2 py-3 text-center text-slate-300">
                              <ChevronRight className={`w-4 h-4 mx-auto ${isActive ? 'text-[#1A55E3]' : ''}`} />
                            </td>
                            <td className="px-3 py-3">
                              <p className="font-extrabold text-slate-900">{name}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                <span className="font-bold text-[#1347c4]">#{row.cus_id}</span>
                                <span className="mx-1">·</span>
                                <span className="tabular-nums">{phone}</span>
                              </p>
                              <span className={`inline-block mt-1 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${urgency.className}`}>
                                {urgency.label}
                              </span>
                            </td>
                            <td className={`px-3 py-3 text-right tabular-nums ${balMeta.cellClass}`}>
                              <p className={`font-black ${balMeta.amountClass}`}>Rs. {fmtAmt(bal)}</p>
                              <span className={`text-[8px] font-extrabold uppercase ${balMeta.badgeClass} px-1.5 py-0.5 rounded border inline-block mt-0.5`}>
                                {balMeta.label}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-xs font-bold text-slate-800">
                              {formatPromiseDate(row.promised_pay_date)}
                              {row.carried_over && (
                                <span className="block mt-1 text-[8px] font-extrabold uppercase text-violet-900 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 w-fit">
                                  Rolled forward
                                </span>
                              )}
                              {row.promised_amount != null && (
                                <p className="text-[10px] font-semibold text-slate-500 mt-0.5">Prom. Rs. {fmtAmt(row.promised_amount)}</p>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              {row.reminder_sent ? (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Sent
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                                  Pending
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <PromiseActionPanel
            row={previewRow}
            sendingId={sendingId}
            onSend={() => previewRow && sendOne(previewRow)}
            onEdit={(c) => setEditCustomer(c)}
            onLedger={(id, n) => openAccountLedgerTab(id, n)}
            onMarkPaid={(r) => markPaid(r)}
            onMarkSent={async (id) => {
              applySentLocally([id], true);
              try {
                await postSendAction('mark_sent', [id]);
                setToast('Marked as sent.');
              } catch (e) {
                setToast(e.message || 'Failed');
                fetchQueue();
              }
            }}
            onClearSent={async (id) => {
              applySentLocally([id], false);
              try {
                await postSendAction('clear_sent', [id]);
                setToast('Sent flag cleared.');
              } catch (e) {
                setToast(e.message || 'Failed');
                fetchQueue();
              }
            }}
          />
        </div>
      </div>

      <AccountPaymentPromiseDialog
        open={Boolean(editCustomer)}
        customer={editCustomer}
        onClose={() => setEditCustomer(null)}
        onChanged={() => fetchQueue()}
      />

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          #promise-queue-print, #promise-queue-print * { visibility: visible; }
          #promise-queue-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </DashboardLayout>
  );
}

function PromiseActionPanel({
  row,
  sendingId,
  onSend,
  onEdit,
  onLedger,
  onMarkPaid,
  onMarkSent,
  onClearSent,
}) {
  const text = useMemo(() => {
    if (!row) return '';
    const bal = parseFloat(row.customer?.cus_balance ?? row.cus_balance ?? 0);
    return buildPendingBalanceWhatsAppMessage({
      customerName: row.customer?.cus_name || row.cus_name,
      balance: bal,
      promisedPayDate: row.promised_pay_date,
      note: row.note,
    });
  }, [row]);

  if (!row) {
    return (
      <aside className="rounded-xl border border-dashed border-slate-300 bg-white/80 p-6 flex items-center justify-center text-center print:hidden min-h-[320px]">
        <p className="text-sm text-slate-500 font-medium">Select an account from the list to see actions and message.</p>
      </aside>
    );
  }

  const name = row.customer?.cus_name || row.cus_name || '—';
  const phone = customerWhatsAppPhone(row.customer || row) || '—';
  const bal = parseFloat(row.customer?.cus_balance ?? row.cus_balance ?? 0);
  const balMeta = getPromiseBalanceMeta(bal);
  const urgency = getPromiseUrgency(row.promised_pay_date);

  return (
    <aside className="rounded-xl border border-[#c5d4f0] bg-white shadow-md flex flex-col min-h-[320px] print:hidden overflow-hidden sticky top-4">
      <div className="px-4 py-3 bg-gradient-to-r from-[#1A55E3] to-[#1347c4] text-white">
        <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-90">Selected account</p>
        <p className="text-lg font-black mt-0.5 leading-tight">{name}</p>
        <p className="text-xs opacity-95 mt-1 tabular-nums">#{row.cus_id} · {phone}</p>
      </div>

      <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs border-b border-slate-100 bg-[#fafbfd]">
        <div>
          <p className="text-[9px] font-bold uppercase text-slate-400">Balance</p>
          <p className={`font-black tabular-nums ${balMeta.amountClass}`}>Rs. {fmtAmt(bal)}</p>
          <span className={`text-[8px] font-extrabold uppercase border px-1 rounded ${balMeta.badgeClass}`}>{balMeta.label}</span>
        </div>
        <div>
          <p className="text-[9px] font-bold uppercase text-slate-400">Due / urgency</p>
          <p className="font-bold text-slate-800">{formatPromiseDate(row.promised_pay_date)}</p>
          <span className={`text-[8px] font-extrabold uppercase border px-1 rounded ${urgency.className}`}>{urgency.label}</span>
        </div>
      </div>

      <div className="p-3 flex flex-col gap-2 border-b border-slate-100">
        <button
          type="button"
          onClick={onSend}
          disabled={!row.has_phone || sendingId === row.promise_id}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-extrabold shadow-sm disabled:opacity-40 inline-flex items-center justify-center gap-2"
        >
          {sendingId === row.promise_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
          Send WhatsApp
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() =>
              onEdit({
                cus_id: row.cus_id,
                cus_name: name,
                cus_phone_no: row.customer?.cus_phone_no || row.cus_phone_no,
                cus_phone_no2: row.customer?.cus_phone_no2 || row.cus_phone_no2,
                cus_balance: bal,
              })
            }
            className="py-2.5 rounded-xl border border-[#c5d4f0] bg-[#e8effd] text-[#1347c4] text-xs font-bold inline-flex items-center justify-center gap-1"
          >
            <CalendarClock className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={() => onLedger(row.cus_id, name)}
            className="py-2.5 rounded-xl border border-slate-200 text-xs font-bold inline-flex items-center justify-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Ledger
          </button>
        </div>
        <button
          type="button"
          onClick={() => onMarkPaid(row)}
          className="w-full py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-900 text-xs font-bold inline-flex items-center justify-center gap-1"
        >
          <CheckCircle2 className="w-3.5 h-3.5" /> Mark paid (close promise)
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => onMarkSent(row.promise_id)} className="py-2 text-[10px] font-bold rounded-lg border bg-white">
            Mark sent
          </button>
          <button type="button" onClick={() => onClearSent(row.promise_id)} className="py-2 text-[10px] font-bold rounded-lg border bg-white text-slate-600">
            Clear sent
          </button>
        </div>
      </div>

      <div className="p-3 flex-1 flex flex-col min-h-0">
        <p className="text-[10px] font-extrabold uppercase text-slate-500 mb-2">Urdu message preview</p>
        <textarea
          readOnly
          value={text}
          className="flex-1 min-h-[200px] w-full text-[14px] leading-relaxed p-3 rounded-xl border border-slate-200 bg-[#fafbfd] resize-none nastaliq-text rtl text-right whitespace-pre-wrap font-sans"
        />
      </div>
    </aside>
  );
}

