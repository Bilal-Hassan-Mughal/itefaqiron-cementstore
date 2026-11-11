'use client';

import { ListTodo, MessageCircle, X } from 'lucide-react';
import MunshiChatPanel from './MunshiChatPanel';

const TABS = [
  { id: 'accounts', label: 'Yaad dahani', icon: ListTodo },
  { id: 'baat', label: 'Baat (ikhtiyari)', icon: MessageCircle },
];

export default function MunshiDockPanel({
  name,
  dockTab,
  onTab,
  onClose,
  readyCount,
  summaryText,
  fehristOpen,
  onOpenFehrist,
  fehristSlot,
  chatProps,
}) {
  return (
    <div
      className="munshi-chat-safe w-[min(400px,calc(100vw-88px))] rounded-2xl border border-slate-200/90 bg-white shadow-[0_20px_60px_rgba(15,42,107,0.22)] overflow-hidden munshi-chat-in"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2.5 bg-gradient-to-r from-[#0f172a] via-[#1e3a5f] to-[#1A55E3] flex items-center justify-between gap-2">
        <div>
          <p className="text-[13px] font-black text-white tracking-tight">{name}</p>
          <p className="text-[9px] font-semibold text-[#ffe08a]/90">Aaj ki WhatsApp fehrist · system data</p>
        </div>
        <button
          type="button"
          onPointerDown={onClose}
          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
          aria-label="Band"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex border-b border-slate-100 bg-slate-50/80 px-1 pt-1 gap-0.5">
        {TABS.map((t) => {
          const Icon = t.icon;
          const on = dockTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onTab(t.id);
              }}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-t-lg text-[10px] font-bold transition-colors ${
                on
                  ? 'bg-white text-[#1A55E3] shadow-sm border border-b-white border-slate-200/80 -mb-px'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {dockTab === 'accounts' && (
        <div className="flex flex-col bg-white max-h-[min(72vh,560px)]">
          <div className="p-3 space-y-2 shrink-0 border-b border-slate-100">
            <p className="text-[11px] font-semibold text-slate-600 whitespace-pre-wrap leading-relaxed">{summaryText}</p>
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation();
                onOpenFehrist();
              }}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#1A55E3] to-[#0f766e] hover:opacity-95 text-white text-xs font-black shadow-sm"
            >
              {fehristOpen ? 'Fehrist band karo' : `WhatsApp fehrist kholo (${readyCount})`}
            </button>
            {!fehristOpen && (
              <p className="text-[9px] text-slate-500 text-center font-medium">
                Neeche button dabain — customer ko WhatsApp bhejein
              </p>
            )}
          </div>
          {fehristOpen && fehristSlot ? (
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{fehristSlot}</div>
          ) : null}
        </div>
      )}

      {dockTab === 'baat' && <MunshiChatPanel {...chatProps} name={name} hideHeader />}
    </div>
  );
}
