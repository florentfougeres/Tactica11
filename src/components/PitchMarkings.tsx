// Vertical football pitch drawn as a responsive SVG overlay (lines only).
//
// Everything is laid out in real metres (FIFA/IFAB regulation pitch) so the
// geometry is exact: a 105 x 68 m field. The viewBox ratio (68/105) matches the
// container's aspect-ratio, so scaling is uniform and circles stay circular, and
// the lines fill the box exactly — so they stay aligned with the player tokens,
// which are positioned as a percentage of the same box.
//
// Reference dimensions (metres):
//   field 105 x 68 · penalty area 40.32 x 16.5 · goal area 18.32 x 5.5
//   penalty spot 11 from goal line · penalty arc & centre circle r 9.15
//   corner arc r 1
import type { Orient } from "../types";

export default function PitchMarkings({
  orient = "portrait",
}: {
  orient?: Orient;
}) {
  const line = "rgba(255,255,255,0.30)";

  const W = 68;
  const L = 105;
  const cx = W / 2; // 34

  // Penalty area: 16.5 deep, 40.32 wide (16.5 + 7.32 + 16.5 centred on goal).
  const paDepth = 16.5;
  const paHalf = 20.16; // 40.32 / 2
  // Goal area: 5.5 deep, 18.32 wide.
  const gaDepth = 5.5;
  const gaHalf = 9.16; // 18.32 / 2
  const spot = 11; // penalty spot distance from goal line
  const r = 9.15; // penalty arc & centre circle radius
  // Where the penalty arc meets the top of the penalty area.
  const arcDx = Math.sqrt(r * r - (paDepth - spot) ** 2); // ≈ 7.3125
  const arcL = cx - arcDx;
  const arcR = cx + arcDx;

  // Landscape: rotate the portrait drawing 90° clockwise into a W×L → L×W box.
  const land = orient === "landscape";
  return (
    <svg
      className="pitch-svg"
      viewBox={land ? `0 0 ${L} ${W}` : `0 0 ${W} ${L}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke={line}
        strokeWidth="0.3"
        transform={land ? `translate(${L} 0) rotate(90)` : undefined}
      >
        {/* touchlines + goal lines */}
        <rect x="0" y="0" width={W} height={L} />
        {/* halfway line */}
        <line x1="0" y1={L / 2} x2={W} y2={L / 2} />
        {/* centre circle + spot */}
        <circle cx={cx} cy={L / 2} r={r} />
        <circle cx={cx} cy={L / 2} r="0.3" fill={line} stroke="none" />

        {/* top half (opponent goal at y=0) */}
        <rect x={cx - paHalf} y="0" width={paHalf * 2} height={paDepth} />
        <rect x={cx - gaHalf} y="0" width={gaHalf * 2} height={gaDepth} />
        <circle cx={cx} cy={spot} r="0.3" fill={line} stroke="none" />
        <path d={`M ${arcL} ${paDepth} A ${r} ${r} 0 0 0 ${arcR} ${paDepth}`} />

        {/* bottom half (own goal at y=L) */}
        <rect
          x={cx - paHalf}
          y={L - paDepth}
          width={paHalf * 2}
          height={paDepth}
        />
        <rect
          x={cx - gaHalf}
          y={L - gaDepth}
          width={gaHalf * 2}
          height={gaDepth}
        />
        <circle cx={cx} cy={L - spot} r="0.3" fill={line} stroke="none" />
        <path
          d={`M ${arcL} ${L - paDepth} A ${r} ${r} 0 0 1 ${arcR} ${L - paDepth}`}
        />

        {/* corner arcs (r = 1) */}
        <path d="M 1 0 A 1 1 0 0 1 0 1" />
        <path d={`M ${W - 1} 0 A 1 1 0 0 0 ${W} 1`} />
        <path d={`M 0 ${L - 1} A 1 1 0 0 1 1 ${L}`} />
        <path d={`M ${W - 1} ${L} A 1 1 0 0 1 ${W} ${L - 1}`} />
      </g>
    </svg>
  );
}
