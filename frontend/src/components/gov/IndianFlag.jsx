import AshokaChakra from "./AshokaChakra";

// The National Flag of India — Tiranga. Saffron / white (with Chakra) / green.
export default function IndianFlag({ width = 46, wave = true }) {
  const height = width * 0.667; // 3:2 ratio
  return (
    <span
      className={`inline-block overflow-hidden rounded-[3px] ${wave ? "flag-wave" : ""}`}
      style={{ width, height, boxShadow: "0 1px 3px rgba(0,0,0,.18)" }}
      aria-label="Flag of India"
      role="img"
    >
      <svg width={width} height={height} viewBox={`0 0 90 60`}>
        <rect x="0" y="0"  width="90" height="20" fill="#ff9933" />
        <rect x="0" y="20" width="90" height="20" fill="#ffffff" />
        <rect x="0" y="40" width="90" height="20" fill="#138808" />
        <g transform="translate(45 30) scale(0.19)">
          <AshokaChakraInline />
        </g>
      </svg>
    </span>
  );
}

// Chakra drawn centered on (0,0) for placement inside the flag.
function AshokaChakraInline() {
  const spokes = Array.from({ length: 24 }, (_, i) => i * 15);
  const c = "#0a3a8f";
  return (
    <g>
      <circle r="47" fill="none" stroke={c} strokeWidth="5" />
      <circle r="6" fill={c} />
      {spokes.map((deg) => (
        <line key={deg} x1="0" y1="0" x2="0" y2="-45"
          stroke={c} strokeWidth="2.4" transform={`rotate(${deg})`} />
      ))}
    </g>
  );
}
