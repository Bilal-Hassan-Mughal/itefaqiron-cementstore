'use client';

import { Send } from 'lucide-react';
import { MUNSHI_QUICK_PROMPTS } from '@/lib/munshi-ji-local-chat';

const OPTIONAL_PROMPTS = MUNSHI_QUICK_PROMPTS.filter((p) =>
  ['Khulasa', 'Kitne baqi', 'Agla', 'Madad'].includes(p.label),
);

function BotMessageBody({ text }) {
  const blocks = String(text || '').split('\n');
  const isList = blocks.length > 2 && blocks.some((l) => /^\d+\./.test(l.trim()));
  if (!isList) {
    return (
      <p className="text-[12px] font-medium leading-[1.55] text-slate-800 whitespace-pre-wrap">{text}</p>
    );
  }
  const [head, ...rest] = blocks;
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[#1A55E3]/90">{head}</p>
      <ul className="rounded-lg bg-slate-50/90 border border-slate-100 divide-y divide-slate-100">
        {rest
          .filter((l) => l.trim())
          .map((line) => (
            <li
              key={line.slice(0, 48)}
              className="px-2 py-1.5 text-[11px] font-semibold text-slate-800 tabular-nums leading-snug"
            >
              {line}
            </li>
          ))}
      </ul>
    </div>
  );
}

export default function MunshiChatPanel({
  name,
  chatMessages,
  chatTyping,
  chatInput,
  listening,
  voiceOn,
  isSpeaking,
  onExit,
  onToggleVoice,
  onToggleListen,
  onInputChange,
  onSend,
  chatScrollRef,
  hideHeader = false,
}) {
  return (
    <div className="flex flex-col max-h-[min(48vh,360px)] bg-[#f8fafc]">
      {!hideHeader && (
        <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">
            Local fehrist · trained phrases
          </span>
          <button
            type="button"
            onPointerDown={onExit}
            className="text-[10px] font-bold text-[#1A55E3] hover:underline"
          >
            Band
          </button>
        </div>
      )}

      <div
        ref={chatScrollRef}
        className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-[140px] max-h-[220px] scroll-smooth"
      >
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={`flex munshi-chat-in ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'bot' && (
              <div
                className="w-6 h-6 rounded-full bg-gradient-to-br from-[#1A55E3] to-[#6366f1] text-[8px] font-black text-white flex items-center justify-center shrink-0 mr-1.5 mt-1 shadow-sm"
                aria-hidden
              >
                MJ
              </div>
            )}
            <div
              className={`max-w-[88%] rounded-2xl px-3 py-2 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-slate-800 text-white rounded-br-sm'
                  : 'bg-white border border-slate-200/90 rounded-bl-sm ring-1 ring-black/[0.03]'
              }`}
            >
              {msg.role === 'user' ? (
                <p className="text-[12px] font-semibold leading-relaxed">{msg.text}</p>
              ) : (
                <BotMessageBody text={msg.text} />
              )}
            </div>
          </div>
        ))}
        {chatTyping && (
          <div className="flex justify-start items-center gap-1.5 munshi-chat-in pl-7">
            <MotionDots name={name} />
          </div>
        )}
      </div>

      <div className="px-2.5 pb-2.5 pt-1.5 border-t border-slate-200/80 bg-white space-y-2">
        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Ikhtiyari · fehrist se jawab</p>
        <div className="flex flex-wrap gap-1 pr-0.5">
          {OPTIONAL_PROMPTS.map((p) => (
            <button
              key={p.label}
              type="button"
              disabled={chatTyping}
              onPointerDown={(e) => {
                e.stopPropagation();
                onSend(p.send);
              }}
              className="text-[9px] font-bold px-2.5 py-1 rounded-full bg-[#eef2ff] text-[#3730a3] border border-[#c7d2fe] hover:bg-[#e0e7ff] disabled:opacity-45 transition-colors"
            >
              {p.label}
            </button>
          ))}
        </div>
        <p className="text-[9px] text-slate-400 font-medium leading-snug">
          Sirf likh kar pooch lein — awaz robot par speaker button se (optional).
        </p>
        <form
          className="flex gap-1.5 items-center"
          onSubmit={(e) => {
            e.preventDefault();
            onSend(chatInput);
          }}
        >
          <input
            value={chatInput}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Roman Urdu mein sawaal…"
            className="flex-1 min-w-0 text-[12px] font-medium px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-[#1A55E3]/25 focus:bg-white"
            disabled={chatTyping}
            lang="ur-Latn"
            dir="ltr"
          />
          <button
            type="submit"
            disabled={chatTyping || !chatInput.trim()}
            className="shrink-0 p-2.5 rounded-xl bg-[#128C7E] text-white disabled:opacity-40 hover:bg-[#0d7368] shadow-sm"
            aria-label="Bhejein"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

function MotionDots({ name }) {
  return (
    <div className="rounded-2xl rounded-bl-sm bg-white border border-slate-200 px-3 py-2 flex items-center gap-2">
      <span className="text-[10px] font-semibold text-slate-500">{name} soch raha hai</span>
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-bounce"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
      </span>
    </div>
  );
}

