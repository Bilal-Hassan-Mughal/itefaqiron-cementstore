'use client';

const fmt = (n) => {
  const v = Math.abs(parseFloat(n || 0));
  if (v % 1 === 0) return v.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function MunshiSendStatsBar({
  pending = 0,
  sent = 0,
  dueToday = 0,
  carryOver = 0,
  totalAmount = 0,
  todayLabel = '',
}) {
  const donePct =
    pending + sent > 0 ? Math.round((sent / (pending + sent)) * 100) : sent > 0 ? 100 : 0;

  return (
    <div className="shrink-0 border-b border-slate-200 bg-white px-3 py-2.5 space-y-2">
      {todayLabel ? (
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{todayLabel}</p>
      ) : null}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {[
          { label: 'Bhejne', value: pending, tone: 'text-[#1A55E3]' },
          { label: 'Bhej chuke', value: sent, tone: 'text-[#128C7E]' },
          { label: 'Aaj wada', value: dueToday, tone: 'text-slate-700' },
          { label: 'Purane', value: carryOver, tone: 'text-slate-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-slate-50 border border-slate-100 py-1.5 px-0.5">
            <p className={`text-base font-black tabular-nums leading-none ${s.tone}`}>{s.value}</p>
            <p className="text-[8px] font-bold text-slate-500 uppercase mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-600">
        <span>
          Kul bqaya (bhejne walon ka):{' '}
          <span className="font-black text-rose-700 tabular-nums">Rs. {fmt(totalAmount)}</span>
        </span>
        {sent > 0 ? (
          <span className="text-[#128C7E] font-bold tabular-nums">{donePct}% ho gaya</span>
        ) : null}
      </div>
      {sent > 0 && pending > 0 ? (
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-[#128C7E] rounded-full transition-all duration-500"
            style={{ width: `${donePct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
