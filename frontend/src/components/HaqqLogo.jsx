// Haqq brand mark — a scales-of-justice "rights" emblem in a navy roundel.
// This is the project's own brand and is intentionally distinct from the
// State Emblem of India (which appears separately in the government header).
export default function HaqqLogo({ size = 42, showText = true }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="haqq-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1553a8" />
            <stop offset="1" stopColor="#0b2a5b" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="60" height="60" rx="16" fill="url(#haqq-g)" />
        <g stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1="32" y1="15" x2="32" y2="47" />
          <line x1="19" y1="21" x2="45" y2="21" />
          <path d="M19 21 L13.5 33 h11 z" fill="#ff7722" fillOpacity="0.9" stroke="none" />
          <path d="M45 21 L39.5 33 h11 z" fill="#ff7722" fillOpacity="0.9" stroke="none" />
          <path d="M13.5 33 a5.5 5.5 0 0 0 11 0" />
          <path d="M39.5 33 a5.5 5.5 0 0 0 11 0" />
          <line x1="24" y1="49" x2="40" y2="49" />
        </g>
        <circle cx="32" cy="15" r="3" fill="#ff7722" />
      </svg>
      {showText && (
        <div className="leading-none">
          <div className="text-[1.35rem] font-extrabold tracking-tight text-[var(--navy)]">
            Haqq
          </div>
          <div className="text-[0.66rem] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] mt-0.5">
            Your Right to Welfare
          </div>
        </div>
      )}
    </div>
  );
}
