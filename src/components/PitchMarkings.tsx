// Vertical football pitch drawn as a responsive SVG overlay (lines only).
// Uses a 100x150 viewBox stretched to fill the pitch container.
export default function PitchMarkings() {
  const line = "rgba(255,255,255,0.30)";
  return (
    <svg
      className="pitch-svg"
      viewBox="0 0 100 150"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g fill="none" stroke={line} strokeWidth="0.5">
        {/* outer boundary */}
        <rect x="2" y="2" width="96" height="146" rx="1.5" />
        {/* halfway line */}
        <line x1="2" y1="75" x2="98" y2="75" />
        {/* center circle + spot */}
        <circle cx="50" cy="75" r="11" />
        <circle cx="50" cy="75" r="0.8" fill={line} stroke="none" />
        {/* top penalty area (opponent goal) */}
        <rect x="22" y="2" width="56" height="20" />
        <rect x="36" y="2" width="28" height="8" />
        <circle cx="50" cy="14" r="0.8" fill={line} stroke="none" />
        <path d="M 38 22 A 11 11 0 0 0 62 22" />
        {/* bottom penalty area (own goal) */}
        <rect x="22" y="128" width="56" height="20" />
        <rect x="36" y="140" width="28" height="8" />
        <circle cx="50" cy="136" r="0.8" fill={line} stroke="none" />
        <path d="M 38 128 A 11 11 0 0 1 62 128" />
      </g>
    </svg>
  );
}
