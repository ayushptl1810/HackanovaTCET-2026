// The Ashoka Chakra — 24-spoke Dharma wheel, as on the Indian flag.
export default function AshokaChakra({ size = 26, color = "#0b2a5b", spin = false }) {
  const spokes = Array.from({ length: 24 }, (_, i) => i * 15);
  return (
    <svg
      width={size} height={size} viewBox="0 0 100 100"
      className={spin ? "chakra-spin" : ""} aria-hidden="true"
    >
      <circle cx="50" cy="50" r="47" fill="none" stroke={color} strokeWidth="4" />
      <circle cx="50" cy="50" r="7" fill={color} />
      {spokes.map((deg) => (
        <line
          key={deg}
          x1="50" y1="50" x2="50" y2="6"
          stroke={color} strokeWidth="2"
          transform={`rotate(${deg} 50 50)`}
        />
      ))}
    </svg>
  );
}
