'use client';

import { ListTodo, MessageCircle, Volume2, VolumeX } from 'lucide-react';

const BTN =
  'flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 py-2 px-1 rounded-xl border text-[9px] font-black uppercase tracking-wide transition-all';

export default function MunshiControlDock({
  voiceOn,
  activePop,
  readyCount,
  onOpenPop,
}) {
  return (
    <div
      className="w-full mt-1 rounded-2xl border border-slate-200/90 bg-white/95 backdrop-blur-sm shadow-lg p-1 flex gap-1"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onPointerDown={(e) => onOpenPop('voice', e)}
        className={`${BTN} ${
          activePop === 'voice'
            ? 'bg-amber-100 border-amber-300 text-amber-950'
            : voiceOn
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-slate-50 border-slate-200 text-slate-600'
        }`}
      >
        {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        Awaz
      </button>
      <button
        type="button"
        onPointerDown={(e) => onOpenPop('whatsapp', e)}
        className={`${BTN} relative ${
          activePop === 'whatsapp'
            ? 'bg-[#128C7E] border-emerald-400 text-white shadow-md'
            : 'bg-[#ecfdf5] border-[#128C7E]/35 text-[#0d7368]'
        }`}
      >
        <ListTodo className="w-4 h-4" />
        WhatsApp
        {readyCount > 0 ? (
          <span className="absolute -top-1.5 right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#1A55E3] text-white text-[8px] font-black flex items-center justify-center">
            {readyCount > 99 ? '99+' : readyCount}
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onPointerDown={(e) => onOpenPop('baat', e)}
        className={`${BTN} ${
          activePop === 'baat'
            ? 'bg-[#1A55E3] border-blue-300 text-white shadow-md'
            : 'bg-blue-50 border-[#1A55E3]/25 text-[#1A55E3]'
        }`}
      >
        <MessageCircle className="w-4 h-4" />
        Baat
      </button>
    </div>
  );
}
