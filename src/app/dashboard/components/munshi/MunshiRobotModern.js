'use client';

const SIZE = 100;

export default function MunshiRobotModern({ uid, talking }) {
  const g = (name) => `${uid}-${name}`;
  return (
    <svg
      viewBox="0 0 120 118"
      width={SIZE}
      height={SIZE}
      className="select-none shrink-0"
      aria-hidden
    >
      <defs>
        <linearGradient id={g('ring')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f5b301" />
          <stop offset="45%" stopColor="#1A55E3" />
          <stop offset="100%" stopColor="#128C7E" />
        </linearGradient>
        <linearGradient id={g('body')} x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#fff" />
          <stop offset="100%" stopColor="#e8f0ff" />
        </linearGradient>
      </defs>
      <circle
        cx="60"
        cy="58"
        r="52"
        fill="none"
        stroke="url(#ring)"
        strokeWidth={talking ? 3 : 2}
        className={talking ? 'munshi-robot-aura' : ''}
      />
      <rect x="32" y="42" width="56" height="62" rx="18" fill="url(#body)" stroke="#1A55E3" strokeWidth="1.5" />
      <rect x="28" y="34" width="64" height="14" rx="7" fill="#f5b301" />
      <text x="60" y="44" textAnchor="middle" fontSize="8" fontWeight="900" fill="#78350f">
        Munshi Ji
      </text>
      <rect x="38" y="52" width="44" height="22" rx="10" fill="#0f172a" />
      <g className={talking ? 'munshi-robot-eyes-talk' : 'munshi-blink-eyes'}>
        <circle cx="50" cy="62" r="4" fill="#38bdf8" />
        <circle cx="70" cy="62" r="4" fill="#38bdf8" />
      </g>
      <rect x="40" y="78" width="40" height="16" rx="8" fill="#1A55E3" />
      <text x="60" y="89" textAnchor="middle" fontSize="6" fontWeight="800" fill="#fff">
        POS
      </text>
    </svg>
  );
}
