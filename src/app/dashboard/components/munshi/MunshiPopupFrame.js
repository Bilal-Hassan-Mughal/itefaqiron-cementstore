'use client';

import { X } from 'lucide-react';

export default function MunshiPopupFrame({
  title,
  subtitle,
  accent = 'blue',
  onClose,
  style,
  children,
  connector = 'left',
}) {
  const header =
    accent === 'green'
      ? 'from-[#0d7368] via-[#128C7E] to-[#0f5a52]'
      : accent === 'gold'
        ? 'from-[#b45309] via-[#d97706] to-[#1A55E3]'
        : accent === 'slate'
          ? 'from-slate-800 via-slate-700 to-[#1A55E3]'
          : 'from-[#0f2a6b] via-[#1A55E3] to-[#2563eb]';

  return (
    <div
      className="munshi-popup-root munshi-chat-safe flex flex-col rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_70px_rgba(15,42,107,0.35)] overflow-hidden munshi-chat-in"
      style={{ ...style, pointerEvents: 'auto' }}
      onPointerDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={title}
    >
      <div
        className={`relative px-3.5 py-3 bg-gradient-to-r ${header} text-white shrink-0`}
      >
        <div className="pr-8">
          <p className="text-sm font-black tracking-tight">{title}</p>
          {subtitle ? (
            <p className="text-[10px] font-semibold text-white/85 mt-0.5 leading-snug">{subtitle}</p>
          ) : null}
        </div>
        <button
          type="button"
          onPointerDown={onClose}
          className="absolute top-2.5 right-2 p-1.5 rounded-lg bg-black/20 hover:bg-black/30 text-white"
          aria-label="Band"
        >
          <X className="w-4 h-4" />
        </button>
        <span
          className={`absolute -bottom-2 w-4 h-4 rotate-45 bg-gradient-to-br ${
            accent === 'green'
              ? 'from-[#128C7E]'
              : accent === 'gold'
                ? 'from-[#d97706]'
                : accent === 'slate'
                  ? 'from-slate-700'
                  : 'from-[#1A55E3]'
          } border-r border-b border-white/10 ${
            connector === 'right' ? 'right-8' : 'left-8'
          }`}
          aria-hidden
        />
      </div>
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
    </div>
  );
}
