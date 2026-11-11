'use client';

import { ListTodo, MessageCircle, Volume2, VolumeX } from 'lucide-react';

export default function MunshiAvatarChrome({
  voiceOn,
  isSpeaking,
  listening,
  activePop,
  readyCount,
  onOpenPop,
}) {
  return (
    <>
      {(isSpeaking || listening) && (
        <span
          className={`absolute inset-0 rounded-full border-2 pointer-events-none ${
            listening ? 'border-rose-400 animate-pulse' : 'border-emerald-400 munshi-speak-ring'
          }`}
          aria-hidden
        />
      )}
      <div className="absolute -left-1 top-2 flex flex-col gap-1.5 z-10">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onOpenPop('voice', e);
          }}
          className={`w-9 h-9 rounded-full shadow-lg border-2 flex items-center justify-center transition-colors ${
            activePop === 'voice'
              ? 'bg-amber-400 border-amber-600 text-amber-950 ring-2 ring-amber-200'
              : voiceOn
                ? 'bg-white border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                : 'bg-slate-800 border-slate-500 text-white hover:bg-slate-700'
          }`}
          title="Awaz panel"
          aria-label="Awaz"
        >
          {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>
      <div className="absolute -right-1 bottom-2 flex flex-col gap-1.5 z-10">
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onOpenPop('whatsapp', e);
          }}
          className={`w-10 h-10 rounded-full shadow-lg border-2 flex items-center justify-center relative ${
            activePop === 'whatsapp'
              ? 'bg-[#128C7E] border-emerald-200 text-white ring-2 ring-emerald-300/50'
              : 'bg-white border-[#128C7E]/40 text-[#0d7368] hover:bg-emerald-50'
          }`}
          title="WhatsApp bhejna"
        >
          <ListTodo className="w-4 h-4" />
          {readyCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[15px] h-[15px] px-0.5 rounded-full bg-[#1A55E3] text-white text-[8px] font-black flex items-center justify-center border border-white">
              {readyCount > 9 ? '9+' : readyCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onPointerDown={(e) => {
            e.stopPropagation();
            onOpenPop('baat', e);
          }}
          className={`w-9 h-9 rounded-full shadow-md border-2 flex items-center justify-center ${
            activePop === 'baat'
              ? 'bg-[#1A55E3] border-blue-200 text-white ring-2 ring-blue-200/60'
              : 'bg-white border-[#1A55E3]/30 text-[#1A55E3] hover:bg-blue-50'
          }`}
          title="Baat — likh kar pooch lein"
        >
          <MessageCircle className="w-4 h-4" />
        </button>
      </div>
    </>
  );
}
