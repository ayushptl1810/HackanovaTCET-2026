// State Emblem of India — a clean, stylized rendering of the Lion Capital of
// Ashoka: three lions, the abacus with the Dharma Chakra, the bell lotus base,
// and the motto "सत्यमेव जयते" (Truth Alone Triumphs).
export default function NationalEmblem({ size = 52, motto = true, color = "#0b2a5b" }) {
  const w = size;
  const h = motto ? size * 1.24 : size;
  return (
    <svg
      width={w} height={h} viewBox="0 0 100 124"
      aria-label="State Emblem of India — Satyameva Jayate" role="img"
    >
      <g fill={color}>
        {/* --- Three lions (heads + manes) --- */}
        {/* centre lion, facing forward */}
        <path d="M50 6c-6 0-9 4-9 9 0 3 1 5 3 7-3 1-5 3-5 6 3-1 5-1 7 0-2 2-3 4-3 7 3-2 5-3 7-3s4 1 7 3c0-3-1-5-3-7 2-1 4-1 7 0 0-3-2-5-5-6 2-2 3-4 3-7 0-5-3-9-9-9z" />
        <circle cx="46" cy="15" r="1.4" fill="#fff" />
        <circle cx="54" cy="15" r="1.4" fill="#fff" />
        {/* left lion (profile) */}
        <path d="M33 16c-5 1-8 4-9 9-1 4 0 7 2 9 2-2 3-4 3-7 1 2 3 4 5 5-1-3-1-6 0-9-2-2-2-5-1-7z" />
        {/* right lion (profile) */}
        <path d="M67 16c5 1 8 4 9 9 1 4 0 7-2 9-2-2-3-4-3-7-1 2-3 4-5 5 1-3 1-6 0-9 2-2 2-5 1-7z" />

        {/* --- Abacus (platform) --- */}
        <rect x="26" y="44" width="48" height="5" rx="1" />
        {/* horses / bulls suggested as small forms flanking the chakra */}
        <path d="M30 50h10l-2 8h-6z" />
        <path d="M60 50h10l-2 8h-6z" />
        {/* central Dharma Chakra on the abacus band */}
        <g transform="translate(50 55)">
          <circle r="6.5" fill="none" stroke={color} strokeWidth="1.6" />
          <circle r="1.4" />
          {Array.from({ length: 12 }, (_, i) => i * 30).map((d) => (
            <line key={d} x1="0" y1="0" x2="0" y2="-6" stroke={color} strokeWidth="0.9" transform={`rotate(${d})`} />
          ))}
        </g>

        {/* --- Bell-shaped lotus base --- */}
        <path d="M38 60c-2 6-3 12-3 18h30c0-6-1-12-3-18-4 3-8 4-12 4s-8-1-12-4z" />
        <path d="M33 78h34c1 3 1 6 0 8H33c-1-2-1-5 0-8z" />
      </g>

      {motto && (
        <text
          x="50" y="118" textAnchor="middle"
          fontSize="12" fontWeight="700" fill={color}
          fontFamily="'Noto Sans Devanagari', sans-serif"
        >
          सत्यमेव जयते
        </text>
      )}
    </svg>
  );
}
