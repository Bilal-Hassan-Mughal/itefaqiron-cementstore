'use client';

import { BarChart3 } from 'lucide-react';

export function fmtMoney(n) {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (v % 1 === 0) return `${sign}${abs.toLocaleString('en-US')}`;
  return `${sign}${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function fmtPkr(n) {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}PKR ${(abs / 1_000_000).toFixed(2)}M`;
  return `${sign}PKR ${abs.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function fmtK(v) {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function HqBarChart({
  data,
  getValue = (d) => d.value || 0,
  getLabel = (d) => d.label || d.branch_name || '',
  color = '#4338ca',
  series,
  preserveOrder = false,
  unit = 'PKR',
  height = 280,
  emptyText = 'No ledger data for selected filters',
}) {
  if (series?.length) {
    return (
      <GroupedBarChart
        data={data}
        series={series}
        getLabel={getLabel}
        unit={unit}
        height={height}
        emptyText={emptyText}
        preserveOrder={preserveOrder}
      />
    );
  }

  let rows = (data || []).map((item) => ({
    item,
    value: getValue(item),
    label: String(getLabel(item) || '—'),
  }));
  if (!preserveOrder) {
    rows = rows.filter((r) => r.value !== 0);
    rows.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }

  if (!rows.length) {
    return (
      <div className="h-[260px] flex flex-col items-center justify-center text-slate-400 bg-white">
        <BarChart3 className="w-8 h-8 text-slate-300 mb-2" strokeWidth={1.75} />
        <p className="text-sm font-semibold text-slate-500">{emptyText}</p>
      </div>
    );
  }

  const n = rows.length;
  const hideLabels = n > 24;
  const pL = 56;
  const pR = 18;
  const pT = 28;
  const pB = hideLabels ? 28 : 72;
  const W = 1100;
  const H = 300;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const grpW = cW / n;
  const barW = Math.min(Math.max(grpW * (n > 40 ? 0.9 : 0.55), n > 40 ? 1.2 : 8), 68);
  const maxV = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const rotateLabels = !hideLabels && (n > 5 || rows.some((r) => r.label.length > 10));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} className="block" preserveAspectRatio="xMidYMid meet">
      {[0, 0.25, 0.5, 0.75, 1].map((f) => {
        const y = pT + cH * (1 - f);
        return (
          <g key={f}>
            <line
              x1={pL}
              y1={y}
              x2={W - pR}
              y2={y}
              stroke={f === 0 ? '#cbd5e1' : '#e2e8f0'}
              strokeWidth="1"
            />
            <text x={pL - 8} y={y + 4} fontSize="11" fill="#64748b" textAnchor="end">
              {fmtK(maxV * f)}
            </text>
          </g>
        );
      })}
      {rows.map((row, i) => {
        const cx = pL + grpW * i + grpW / 2;
        const bx = cx - barW / 2;
        const bH = row.value === 0 ? 0 : Math.max((Math.abs(row.value) / maxV) * cH, 6);
        const y = row.value >= 0 ? pT + cH - bH : pT + cH;
        const short = row.label.length > 16 ? `${row.label.slice(0, 15)}…` : row.label;
        return (
          <g key={`${row.label}-${i}`}>
            {bH > 0 && (
              <rect x={bx} y={y} width={barW} height={bH} rx="3" fill={color}>
                <title>{`${row.label}: ${unit} ${fmtMoney(row.value)}`}</title>
              </rect>
            )}
            {row.value !== 0 && n <= 18 && (
              <text x={cx} y={y - 8} fontSize="11" fill="#0f172a" textAnchor="middle" fontWeight="700">
                {fmtK(row.value)}
              </text>
            )}
            {!hideLabels && (
              <text
                x={cx}
                y={pT + cH + (rotateLabels ? 16 : 20)}
                fontSize="11"
                fill="#334155"
                textAnchor={rotateLabels ? 'end' : 'middle'}
                fontWeight="600"
                transform={rotateLabels ? `rotate(-32,${cx},${pT + cH + 16})` : undefined}
              >
                {short}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function GroupedBarChart({ data, series, getLabel, unit, height, emptyText, preserveOrder = false }) {
  let rows = (data || []).map((item) => ({
    item,
    label: String(getLabel(item) || '—'),
    values: series.map((s) => Number(item[s.key] || 0)),
  }));
  if (!preserveOrder) {
    rows = rows.filter((r) => r.values.some((v) => v !== 0));
  }

  if (!rows.length) {
    return (
      <div className="h-[260px] flex flex-col items-center justify-center text-slate-400 bg-white">
        <BarChart3 className="w-8 h-8 text-slate-300 mb-2" strokeWidth={1.75} />
        <p className="text-sm font-semibold text-slate-500">{emptyText}</p>
      </div>
    );
  }

  const pL = 56;
  const pR = 18;
  const pT = 28;
  const pB = 86;
  const W = 1100;
  const H = 320;
  const cW = W - pL - pR;
  const cH = H - pT - pB;
  const n = rows.length;
  const grpW = cW / n;
  const barW = Math.min(Math.max((grpW * 0.7) / series.length, 16), 48);
  const gap = 4;
  const maxV = Math.max(...rows.flatMap((r) => r.values.map((v) => Math.abs(v))), 1);
  const rotateLabels = n > 5 || rows.some((r) => r.label.length > 10);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} className="block" preserveAspectRatio="xMidYMid meet">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = pT + cH * (1 - f);
          return (
            <g key={f}>
              <line x1={pL} y1={y} x2={W - pR} y2={y} stroke={f === 0 ? '#cbd5e1' : '#e2e8f0'} strokeWidth="1" />
              <text x={pL - 8} y={y + 4} fontSize="11" fill="#64748b" textAnchor="end">{fmtK(maxV * f)}</text>
            </g>
          );
        })}
        {rows.map((row, i) => {
          const cx = pL + grpW * i + grpW / 2;
          const totalW = series.length * barW + (series.length - 1) * gap;
          const start = cx - totalW / 2;
          const short = row.label.length > 16 ? `${row.label.slice(0, 15)}…` : row.label;
          return (
            <g key={`${row.label}-${i}`}>
              {series.map((s, si) => {
                const val = row.values[si];
                const bx = start + si * (barW + gap);
                const bH = Math.max((Math.abs(val) / maxV) * cH, val ? 5 : 0);
                const y = pT + cH - bH;
                return (
                  <g key={s.key}>
                    <rect x={bx} y={y} width={barW} height={bH} rx="2" fill={s.color}>
                      <title>{`${row.label} ${s.label}: ${unit} ${fmtMoney(val)}`}</title>
                    </rect>
                    {val !== 0 && n <= 14 && (
                      <text x={bx + barW / 2} y={y - 6} fontSize="9" fill="#0f172a" textAnchor="middle" fontWeight="700">
                        {fmtK(val)}
                      </text>
                    )}
                  </g>
                );
              })}
              <text
                x={cx}
                y={pT + cH + (rotateLabels ? 16 : 20)}
                fontSize="11"
                fill="#334155"
                textAnchor={rotateLabels ? 'end' : 'middle'}
                fontWeight="600"
                transform={rotateLabels ? `rotate(-32,${cx},${pT + cH + 16})` : undefined}
              >
                {short}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-center gap-5 pb-2">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
            <span className="w-3 h-3" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
