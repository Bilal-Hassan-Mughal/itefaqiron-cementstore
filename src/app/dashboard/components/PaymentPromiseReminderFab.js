'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  buildPendingBalanceWhatsAppMessage,
  buildPendingBalanceWhatsAppPreview,
  customerWhatsAppPhone,
  formatPromiseDate,
  getPromiseBalanceMeta,
  getPromiseUrgency,
  localDateInputValue,
} from '@/lib/account-payment-promise';
import { openWhatsAppDesktop } from '@/lib/whatsapp-local';
import { canStaffAccessPath } from '@/lib/staff-access';
import {
  CalendarDays,
  ChevronRight,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
} from 'lucide-react';
import PromiseReminderBot from './PromiseReminderBot';

function getCurrentUserId() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || 'null');
    return u?.user_id ?? null;
  } catch {
    return null;
  }
}

const fmtAmt = (val) => {
  const n = parseFloat(val || 0);
  if (n % 1 === 0) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function dispatchReminderUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('payment-promise-reminder-updated'));
  }
}

export default function PaymentPromiseReminderFab({ user }) {
  const canUse = useMemo(
    () => Boolean(user && canStaffAccessPath(user, '/dashboard/payment-promises')),
    [user],
  );

  const [bootstrapped, setBootstrapped] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [sentItems, setSentItems] = useState([]);
  const [readyCount, setReadyCount] = useState(0);
  const [queueMeta, setQueueMeta] = useState({ dueToday: 0, carryOver: 0, total: 0, sent: 0 });
  const [sendingId, setSendingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [toast, setToast] = useState('');

  const today = useMemo(() => localDateInputValue(), []);
  const todayLabel = useMemo(() => formatPromiseDate(new Date(`${today}T12:00:00`)), [today]);

  const load = useCallback(async () => {
    if (!canUse) return;
    try {
      const summaryRes = await fetch('/api/dashboard/payment-promise-summary', { cache: 'no-store' });
      const summary = summaryRes.ok ? await summaryRes.json() : null;
      const toSend = summary?.readyToSend || 0;

      if (summary && !summary.error) {
        setReadyCount(toSend);
        setQueueMeta((m) => ({
          ...m,
          dueToday: summary.dueToday || 0,
          carryOver: summary.carryOver || 0,
          total: summary.total || 0,
        }));
      }

      if (toSend > 0) {
        if (open) setLoading(true);
        const q = new URLSearchParams({ date: today, send: 'all' });
        const res = await fetch(`/api/customers/payment-promise-queue?${q}`, { cache: 'no-store' });
        const data = res.ok ? await res.json() : { items: [], stats: {} };
        const all = data.items || [];
        const rows = all.filter((r) => !r.reminder_sent && r.has_phone);
        const sent = all.filter((r) => r.reminder_sent);
        setItems(rows);
        setSentItems(sent);
        setReadyCount(rows.length);
        setQueueMeta({
          dueToday: data.stats?.dueToday ?? summary?.dueToday ?? 0,
          carryOver: data.stats?.carryOver ?? summary?.carryOver ?? 0,
          total: data.stats?.total ?? summary?.total ?? rows.length,
          sent: data.stats?.sent ?? 0,
        });
        setExpandedId((prev) => {
          if (!rows.length) return null;
          if (open) {
            if (prev != null && rows.some((r) => r.promise_id === prev)) return prev;
            return rows[0].promise_id;
          }
          return prev && rows.some((r) => r.promise_id === prev) ? prev : rows[0].promise_id;
        });
      } else {
        setItems([]);
        setSentItems([]);
        setReadyCount(0);
        setOpen(false);
      }
    } catch (e) {
      console.error('PaymentPromiseReminderFab load', e);
    } finally {
      setLoading(false);
      setBootstrapped(true);
    }
  }, [canUse, open, today]);

  useEffect(() => {
    if (!canUse) return;
    load();
    const id = setInterval(load, 60000);
    const onUpdate = () => load();
    window.addEventListener('payment-promise-reminder-updated', onUpdate);
    window.addEventListener('branch-changed', onUpdate);
    return () => {
      clearInterval(id);
      window.removeEventListener('payment-promise-reminder-updated', onUpdate);
      window.removeEventListener('branch-changed', onUpdate);
    };
  }, [canUse, load]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const handleBotToggle = useCallback(() => {
    setOpen((wasOpen) => {
      const opening = !wasOpen;
      if (opening) {
        setExpandedId(items[0]?.promise_id ?? null);
      }
      return opening;
    });
  }, [items]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const sendOne = async (row) => {
    const phone = customerWhatsAppPhone(row.customer || row);
    if (!phone) {
      setToast('Is khate mein phone number nahi hai.');
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
      setToast('WhatsApp nahi khul saka.');
      return;
    }
    setItems((prev) => {
      const next = prev.filter((r) => r.promise_id !== row.promise_id);
      setExpandedId(next[0]?.promise_id ?? null);
      return next;
    });
    setReadyCount((c) => Math.max(0, c - 1));
    try {
      await fetch('/api/customers/payment-promise-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_sent',
          promise_ids: [row.promise_id],
          sent_by: getCurrentUserId(),
        }),
      });
      setToast('WhatsApp khul gaya — Munshi Ji ne bahi mein likh liya ✅');
      dispatchReminderUpdated();
      load();
    } catch {
      setToast('WhatsApp khul gaya magar save nahi hua — taaza karo.');
      load();
    } finally {
      setSendingId(null);
    }
  };

  const nextRow = items[0];
  const totalPendingBalance = useMemo(
    () => items.reduce((sum, r) => sum + Math.abs(parseFloat(r.customer?.cus_balance ?? r.cus_balance ?? 0)), 0),
    [items],
  );

  if (!canUse || !bootstrapped) return null;

  return (
    <>
      {toast && (
        <div
          className="fixed bottom-[7.5rem] sm:bottom-32 z-[1301] max-w-sm px-4 py-2.5 rounded-xl bg-[#0f172a] text-white text-xs font-semibold shadow-2xl border border-white/10 print:hidden munshi-ji-dock"
          role="status"
        >
          {toast}
        </div>
      )}

      <PromiseReminderBot
        open={open}
        readyCount={readyCount}
        sent={queueMeta.sent}
        dueToday={queueMeta.dueToday}
        carryOver={queueMeta.carryOver}
        totalAmount={totalPendingBalance}
        todayLabel={todayLabel}
        onToggle={handleBotToggle}
        onClose={() => setOpen(false)}
      >
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden cursor-default" role="region">
            <p className="shrink-0 px-3 py-1.5 text-[10px] font-semibold text-slate-500 bg-[#f5f8ff] border-b border-slate-100">
              Card kholo → Urdu paigham dekho → WhatsApp bhejo
            </p>
            <div className="flex-1 overflow-y-auto bg-[#f5f8ff] p-2.5 space-y-2 min-h-[200px]">
              {loading && items.length === 0 ? (
                <div className="py-16 flex flex-col items-center gap-2 text-slate-500">
                  <Loader2 className="w-6 h-6 animate-spin text-[#1A55E3]" />
                  <p className="text-xs font-semibold">Munshi Ji bahi khol rahe hain…</p>
                </div>
              ) : items.length === 0 ? (
                <div className="py-14 px-4 text-center text-slate-500">
                  <p className="text-sm font-bold text-slate-700">Aaj koi WhatsApp baqi nahin</p>
                  <p className="text-[11px] font-semibold mt-1">Sab bhej chuke — ya payment promises page check karein.</p>
                </div>
              ) : (
                items.map((row, index) => {
                  const name = row.customer?.cus_name || row.cus_name || '—';
                  const phone = customerWhatsAppPhone(row.customer || row) || '—';
                  const bal = parseFloat(row.customer?.cus_balance ?? row.cus_balance ?? 0);
                  const balMeta = getPromiseBalanceMeta(bal);
                  const urgency = getPromiseUrgency(row.promised_pay_date);
                  const busy = sendingId === row.promise_id;
                  const expanded = expandedId === row.promise_id;
                  const preview = buildPendingBalanceWhatsAppPreview({
                    customerName: name,
                    balance: bal,
                    promisedPayDate: row.promised_pay_date,
                  });
                  return (
                    <article
                      key={row.promise_id}
                      className={`rounded-xl border bg-white overflow-hidden transition-all ${
                        expanded ? 'border-[#1A55E3]/35 shadow-md ring-1 ring-[#1A55E3]/10' : 'border-slate-200/90 shadow-sm'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : row.promise_id)}
                        className="w-full text-left px-3 py-2.5 flex items-center gap-2.5"
                      >
                        <span
                          className={`shrink-0 w-7 h-7 rounded-lg text-[10px] font-black flex items-center justify-center tabular-nums ${
                            index === 0 ? 'bg-[#1A55E3] text-white' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-extrabold text-slate-900 truncate">{name}</p>
                          <p className="text-[10px] text-slate-500 font-semibold flex flex-wrap items-center gap-x-1.5 mt-0.5">
                            <span>Wada: {formatPromiseDate(row.promised_pay_date)}</span>
                            {row.carried_over && <span className="text-violet-700">Rolled</span>}
                            <span className={`text-[8px] font-extrabold uppercase px-1 py-0.5 rounded border ${urgency.className}`}>
                              {urgency.label}
                            </span>
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className={`text-xs font-black tabular-nums ${balMeta.amountClass}`}>Rs. {fmtAmt(Math.abs(bal))}</p>
                          <ChevronRight className={`w-4 h-4 text-slate-400 ml-auto mt-0.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
                        </div>
                      </button>

                      {expanded && (
                        <div className="px-3 pb-3 pt-0 border-t border-slate-100/80">
                          <p className="text-[10px] text-slate-500 font-semibold flex items-center gap-1 py-2">
                            <Phone className="w-3 h-3" />
                            {phone}
                          </p>
                          <div className="rounded-xl bg-[#dcf8c6] border border-[#b7e1a1] px-3 py-2.5 relative">
                            <p className="text-[9px] font-extrabold uppercase tracking-wide text-[#128C7E] mb-1.5 flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              Urdu paigham (WhatsApp)
                            </p>
                            <p className="text-[11px] leading-relaxed text-slate-900 whitespace-pre-wrap rtl text-right nastaliq-text">
                              {preview}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => sendOne(row)}
                            className="mt-2.5 w-full py-2.5 rounded-xl bg-[#128C7E] hover:bg-[#0d7368] text-white text-xs font-black uppercase tracking-wide inline-flex items-center justify-center gap-2 disabled:opacity-55 transition-colors shadow-sm"
                          >
                            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            WhatsApp bhejo
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>

            <div className="shrink-0 border-t border-[#dce6fb] bg-white p-3 space-y-2">
              {nextRow && (
                <button
                  type="button"
                  disabled={Boolean(sendingId)}
                  onClick={() => {
                    setExpandedId(nextRow.promise_id);
                    sendOne(nextRow);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#1A55E3] hover:bg-[#1347c4] text-white text-xs font-black uppercase tracking-wide inline-flex items-center justify-center gap-2 disabled:opacity-55"
                >
                  <Send className="w-4 h-4" />
                  Agla bhejo — Munshi Ji ka kehna hai!
                </button>
              )}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => load()}
                  className="text-[11px] font-bold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
                >
                  <RefreshCw className="w-3 h-3" /> Taaza karo
                </button>
                <Link
                  href="/dashboard/payment-promises?send=pending"
                  onClick={() => setOpen(false)}
                  className="text-[11px] font-bold text-[#1A55E3] hover:underline"
                >
                  Poori fehrist →
                </Link>
                <button type="button" onClick={() => setOpen(false)} className="text-[11px] font-bold text-slate-500 hover:text-slate-800">
                  Band
                </button>
              </div>
            </div>
          </div>
      </PromiseReminderBot>
    </>
  );
}
