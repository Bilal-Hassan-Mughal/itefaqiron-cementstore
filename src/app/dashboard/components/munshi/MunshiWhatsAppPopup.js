'use client';

import { useState } from 'react';
import MunshiPopupFrame from './MunshiPopupFrame';

export default function MunshiWhatsAppPopup({
  style,
  onClose,
  readyCount,
  summaryText,
  fehristOpen,
  onOpenFehrist,
  fehristSlot,
  introRoman,
}) {
  const [showHelp, setShowHelp] = useState(Boolean(introRoman));

  return (
    <MunshiPopupFrame
      title="WhatsApp yaad dahani"
      subtitle={`${readyCount} customer · Urdu paigham tayyar`}
      accent="green"
      style={style}
      onClose={onClose}
      connector="right"
    >
      <div className="flex flex-col min-h-0 flex-1 bg-white">
        {introRoman && showHelp ? (
          <IntroBanner introRoman={introRoman} onDismiss={() => setShowHelp(false)} />
        ) : null}
        <div className="shrink-0 px-3 py-2 border-b border-slate-100 bg-slate-50/80">
          <p className="text-[11px] font-semibold text-slate-700 whitespace-pre-wrap leading-relaxed">{summaryText}</p>
          {!fehristOpen ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFehrist();
              }}
              className="mt-2 w-full py-2.5 rounded-xl bg-[#128C7E] hover:bg-[#0d7368] text-white text-xs font-black"
            >
              Fehrist kholo — WhatsApp bhejein ({readyCount})
            </button>
          ) : null}
        </div>
        {fehristOpen && fehristSlot ? (
          <div className="flex-1 min-h-0 overflow-y-auto flex flex-col overscroll-contain">{fehristSlot}</div>
        ) : (
          <p className="p-4 text-center text-[10px] text-slate-400 font-medium">
            Fehrist kholo, phir customer card par &quot;WhatsApp bhejo&quot; dabain.
          </p>
        )}
      </div>
    </MunshiPopupFrame>
  );
}

function IntroBanner({ introRoman, onDismiss }) {
  return (
    <div className="shrink-0 p-2.5 border-b border-amber-100 bg-amber-50">
      <p className="text-[10px] font-medium text-slate-700 leading-relaxed whitespace-pre-wrap max-h-24 overflow-y-auto">
        {introRoman}
      </p>
      <button type="button" onClick={onDismiss} className="mt-1 text-[10px] font-bold text-[#1A55E3] hover:underline">
        Samajh gaya — band
      </button>
    </div>
  );
}
