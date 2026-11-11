'use client';

/**
 * Munshi Ji — sirf count + WhatsApp bhejne ka popup (no voice / no chat).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useId } from 'react';
import { X } from 'lucide-react';
import MunshiBadgeRobot from '@/app/dashboard/components/munshi/MunshiBadgeRobot';
import MunshiSendStatsBar from '@/app/dashboard/components/munshi/MunshiSendStatsBar';
import { useMunshiPopupPlacement } from '@/app/dashboard/components/munshi/useMunshiPopupPlacement';

export const PROMISE_MASCOT_NAME = 'Munshi Ji';

export default function PromiseReminderBot({
  name = PROMISE_MASCOT_NAME,
  readyCount = 0,
  sent = 0,
  dueToday = 0,
  carryOver = 0,
  totalAmount = 0,
  todayLabel = '',
  open = false,
  onToggle,
  onClose,
  children,
}) {
  const uid = useId().replace(/:/g, '');
  const anchorRef = useRef(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const popHeight = useMemo(
    () => (typeof window !== 'undefined' ? Math.min(560, window.innerHeight - 40) : 520),
    [],
  );
  const popStyle = useMunshiPopupPlacement(anchorRef, open, {
    width: typeof window !== 'undefined' ? Math.min(400, window.innerWidth - 24) : 400,
    height: popHeight,
    kind: 'whatsapp',
  });

  const handleClose = (e) => {
    e?.stopPropagation?.();
    onClose?.();
  };

  return (
    <>
      <style>{`
        @keyframes munshi-red-float-k { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
        @keyframes munshi-red-leds-k { 0%, 100% { opacity: 0.45; } 50% { opacity: 1; } }
        @keyframes munshi-blink { 0%, 92%, 100% { opacity: 1; } 96% { opacity: 0.15; } }
        .munshi-red-float { animation: munshi-red-float-k 2.8s ease-in-out infinite; transform-origin: center bottom; }
        .munshi-red-leds { animation: munshi-red-leds-k 1.4s ease-in-out infinite; }
        .munshi-blink-eyes { animation: munshi-blink 4.5s infinite; }
      `}</style>
      {mounted &&
        open &&
        createPortal(
          <div
            className="munshi-popup-root flex flex-col rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(15,42,107,0.32)] overflow-hidden"
            style={{ ...popStyle, pointerEvents: 'auto' }}
            onPointerDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="WhatsApp yaad dahani"
          >
            <div className="shrink-0 px-3 py-2.5 bg-gradient-to-r from-[#0f2a6b] via-[#1A55E3] to-[#128C7E] text-white flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <MunshiBadgeRobot uid={`pop-${uid}`} size={40} animated={false} />
                <div className="min-w-0">
                  <p className="text-sm font-black tracking-tight">{name}</p>
                  <p className="text-[10px] font-semibold text-white/90 truncate">
                    {readyCount} baqi · {sent} bhej chuke · Urdu WhatsApp
                  </p>
                </div>
              </div>
              <button
                type="button"
                onPointerDown={handleClose}
                className="p-1.5 rounded-lg bg-black/15 hover:bg-black/25 shrink-0"
                aria-label="Band"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <MunshiSendStatsBar
              pending={readyCount}
              sent={sent}
              dueToday={dueToday}
              carryOver={carryOver}
              totalAmount={totalAmount}
              todayLabel={todayLabel}
            />
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
          </div>,
          document.body,
        )}

      <div
        className="munshi-ji-dock fixed z-[1300] print:hidden bottom-14 sm:bottom-16 md:bottom-[4.5rem]"
        title="WhatsApp yaad dahani"
      >
        <button
          type="button"
          onClick={() => onToggle?.()}
          className="munshi-robot-hit flex flex-col items-center w-[76px] cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
          aria-expanded={open}
          aria-label={`${name} — ${readyCount} WhatsApp bhejne hain`}
        >
          <p ref={anchorRef} className="relative pointer-events-none w-full flex flex-col items-center">
            <MunshiBadgeRobot uid={`badge-${uid}`} size={68} animated />
            <span className="absolute top-0 right-0 min-w-[1.35rem] h-6 px-1 rounded-full bg-gradient-to-br from-red-600 to-red-800 text-white text-xs font-black flex items-center justify-center border-2 border-white tabular-nums shadow-md">
              {readyCount > 99 ? '99+' : readyCount}
            </span>
            <span className="text-[10px] font-black text-red-900 mt-0.5 leading-none">Munshi Ji</span>
            <span className="text-[8px] font-bold text-red-600 leading-tight text-center">
              {readyCount} bhejne hain
            </span>
          </p>
        </button>
      </div>
    </>
  );
}
