'use client';

import { Volume2, VolumeX } from 'lucide-react';
import MunshiPopupFrame from './MunshiPopupFrame';
import { MUNSHI_VOICE_ROMAN } from '@/lib/munshi-intro-roman';

export default function MunshiVoicePopup({
  style,
  onClose,
  voiceOn,
  isSpeaking,
  summaryText,
  onToggleVoice,
}) {
  return (
    <MunshiPopupFrame
      title="Awaz — Munshi Ji"
      subtitle="Mute / Unmute (optional)"
      accent="gold"
      style={style}
      onClose={onClose}
    >
      <div className="p-4 space-y-3 overflow-y-auto bg-gradient-to-b from-amber-50/80 to-white">
        <p className="text-[11px] font-medium text-slate-700 leading-relaxed whitespace-pre-wrap">
          {MUNSHI_VOICE_ROMAN}
        </p>
        <div
          className={`rounded-xl border px-3 py-2.5 ${
            voiceOn ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Halat</p>
          <p className="text-sm font-black text-slate-900 mt-0.5">
            {voiceOn ? (isSpeaking ? 'Bol raha hai…' : 'Awaz ON') : 'Awaz OFF (muted)'}
          </p>
        </div>
        {voiceOn && summaryText ? (
          <p className="text-[11px] font-semibold text-slate-600 whitespace-pre-wrap leading-relaxed rounded-xl bg-white border border-slate-100 p-3">
            {summaryText}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              if (voiceOn) onToggleVoice(e);
            }}
            className={`py-3 rounded-xl border-2 text-xs font-black flex flex-col items-center gap-1 ${
              voiceOn
                ? 'border-slate-400 bg-slate-800 text-white shadow-md'
                : 'border-slate-200 bg-slate-100 text-slate-400'
            }`}
          >
            <VolumeX className="w-5 h-5" />
            Mute
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
              if (!voiceOn) onToggleVoice(e);
            }}
            className={`py-3 rounded-xl border-2 text-xs font-black flex flex-col items-center gap-1 ${
              !voiceOn
                ? 'border-emerald-300 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md'
                : 'border-emerald-100 bg-emerald-50 text-emerald-300'
            }`}
          >
            <Volume2 className="w-5 h-5" />
            Unmute
          </button>
        </div>
      </div>
    </MunshiPopupFrame>
  );
}
