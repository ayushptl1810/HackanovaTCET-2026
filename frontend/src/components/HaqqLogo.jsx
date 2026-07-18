// Haqq brand mark — a scales-of-justice/rights emblem in a navy roundel.
// Deliberately NOT the national emblem: Haqq is the project's own brand.
export default function HaqqLogo({ size = 44 }) {
  return (
    <div className="flex items-center gap-3">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="31" fill="var(--gov-navy)" />
        <circle cx="32" cy="32" r="31" fill="none" stroke="var(--saffron)" strokeWidth="2" />
        <g stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round">
          <line x1="32" y1="16" x2="32" y2="46" />
          <line x1="20" y1="22" x2="44" y2="22" />
          <path d="M20 22 L15 33 h10 z" fill="#fff" fillOpacity="0.15" />
          <path d="M44 22 L39 33 h10 z" fill="#fff" fillOpacity="0.15" />
        </g>
        <circle cx="32" cy="48" r="3" fill="#fff" />
      </svg>
      <div className="leading-tight">
        <div className="text-[1.35rem] font-extrabold text-[var(--gov-navy)] tracking-tight">
          Haqq<span className="text-[var(--saffron)]">.</span>
        </div>
        <div className="text-[0.7rem] text-[var(--muted)] font-medium">
          Your Right to Welfare
        </div>
      </div>
    </div>
  );
}
