'use client';

/** Munshi Ji — red-dressed robot mascot (transparent, no badge plate) */
export default function MunshiBadgeRobot({ uid, size = 76, animated = true }) {
  const g = (id) => `${uid}-${id}`;
  return (
    <svg
      width={size}
      height={size * (108 / 84)}
      viewBox="0 0 84 108"
      className={`shrink-0 overflow-visible ${animated ? 'munshi-red-float' : ''}`}
      aria-hidden
    >
      <defs>
        <linearGradient id={g('metal')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fecaca" />
          <stop offset="100%" stopColor="#991b1b" />
        </linearGradient>
        <linearGradient id={g('kurta')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="55%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#7f1d1d" />
        </linearGradient>
        <linearGradient id={g('collar')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fca5a5" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
        <filter id={g('shadow')} x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#7f1d1d" floodOpacity="0.45" />
        </filter>
      </defs>

      <g filter={`url(#${g('shadow')})`}>
        {/* Antenna */}
        <line x1="42" y1="6" x2="42" y2="14" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        <circle cx="42" cy="5" r="3" fill="#dc2626" className={animated ? 'munshi-red-leds' : ''} />

        {/* Head */}
        <rect x="24" y="14" width="36" height="28" rx="10" fill="#f1f5f9" stroke="#64748b" strokeWidth="1.2" />
        <rect x="28" y="22" width="28" height="12" rx="6" fill="#0f172a" />
        <g className={animated ? 'munshi-blink-eyes' : ''}>
          <circle cx="35" cy="28" r="2.8" fill="#fbbf24" />
          <circle cx="49" cy="28" r="2.8" fill="#fbbf24" />
          <circle cx="35.6" cy="27.4" r="0.9" fill="#fff" opacity="0.85" />
          <circle cx="49.6" cy="27.4" r="0.9" fill="#fff" opacity="0.85" />
        </g>
        <rect x="36" y="36" width="12" height="3" rx="1.5" fill="#cbd5e1" />

        {/* Turban / cap — red dressing */}
        <path
          d="M26 18 Q42 8 58 18 L56 22 Q42 14 28 22 Z"
          fill={`url(#${g('metal')})`}
          stroke="#b91c1c"
          strokeWidth="0.8"
        />

        {/* Arms */}
        <rect x="12" y="48" width="10" height="22" rx="5" fill="#e2e8f0" stroke="#64748b" strokeWidth="1" />
        <rect x="62" y="48" width="10" height="22" rx="5" fill="#e2e8f0" stroke="#64748b" strokeWidth="1" />
        <circle cx="17" cy="72" r="5" fill="#dc2626" stroke="#991b1b" strokeWidth="0.8" />
        <circle cx="67" cy="72" r="5" fill="#dc2626" stroke="#991b1b" strokeWidth="0.8" />

        {/* Red kurta body */}
        <path
          d="M22 44 h40 l4 52 H18 Z"
          fill={`url(#${g('kurta')})`}
          stroke="#991b1b"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M30 44 Q42 52 54 44"
          fill="none"
          stroke={`url(#${g('collar')})`}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <rect x="34" y="58" width="16" height="14" rx="4" fill="#450a0a" opacity="0.35" />
        <text
          x="42"
          y="69"
          textAnchor="middle"
          fontSize="6"
          fontWeight="900"
          fill="#fff"
          fontFamily="system-ui,sans-serif"
        >
          Ji
        </text>

        {/* Belt / panel */}
        <rect x="26" y="78" width="32" height="6" rx="2" fill="#7f1d1d" stroke="#450a0a" strokeWidth="0.6" />
        {animated ? (
          <g className="munshi-red-leds">
            <circle cx="32" cy="81" r="1.2" fill="#fca5a5" />
            <circle cx="42" cy="81" r="1.2" fill="#fff" />
            <circle cx="52" cy="81" r="1.2" fill="#fca5a5" />
          </g>
        ) : null}

        {/* Legs */}
        <rect x="28" y="96" width="11" height="10" rx="4" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.8" />
        <rect x="45" y="96" width="11" height="10" rx="4" fill="#cbd5e1" stroke="#64748b" strokeWidth="0.8" />
        <rect x="26" y="104" width="15" height="4" rx="2" fill="#991b1b" />
        <rect x="43" y="104" width="15" height="4" rx="2" fill="#991b1b" />
      </g>
    </svg>
  );
}
