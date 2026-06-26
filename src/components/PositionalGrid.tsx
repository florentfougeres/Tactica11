// Juego de posición overlay (Guardiola): the 5 vertical corridors.
//
// The two half-spaces — the "interior" lanes between wing and centre — are
// tinted, since they're the whole point of the concept. Lane boundaries align
// with real pitch features: the penalty-area width (wings start) and the
// goal-area width (centre). Horizontal lines extend the front of each penalty
// area across the full width — the "18-yard band". Same 68x105 metric viewBox as
// the line markings, so the uniform scaling keeps everything aligned.
const W = 68;
const L = 105;
// Lane boundaries in metres: penalty-area edges (13.84 / 54.16) and goal-area
// edges (24.84 / 43.16), centred on x = 34.
const bounds = [13.84, 24.84, 43.16, 54.16];
// Horizontal zone lines (metres from the top goal line), giving 6 bands top to
// bottom: the 18-yard line of each box (16.5 / 88.5), plus one line midway
// between each box and the halfway line (34.5 / 70.5). The halfway line itself
// (52.5) is already drawn by the pitch markings.
const rows = [16.5, 34.5, 70.5, 88.5];
// Vertical corridors run only between the two 18-yard lines, so each penalty
// area stays a single zone instead of being cut into three.
const top = 16.5;
const bot = L - 16.5; // 88.5

import type { Orient } from "../types";

export default function PositionalGrid({
  orient = "portrait",
}: {
  orient?: Orient;
}) {
  const line = "rgba(255,255,255,0.34)";
  const faint = "rgba(255,255,255,0.16)";
  const tint = "rgba(33,208,122,0.11)";
  // Landscape: rotate the portrait drawing 90° clockwise into an L×W box.
  const land = orient === "landscape";
  return (
    <svg
      className="pitch-grid"
      viewBox={land ? `0 0 ${L} ${W}` : `0 0 ${W} ${L}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g transform={land ? `translate(${L} 0) rotate(90)` : undefined}>
      {/* half-space (interior) tints — between the 18-yard lines only */}
      <rect x={bounds[0]} y={top} width={bounds[1] - bounds[0]} height={bot - top} fill={tint} />
      <rect x={bounds[2]} y={top} width={bounds[3] - bounds[2]} height={bot - top} fill={tint} />
      <g fill="none">
        {/* horizontal zone lines → 6 bands top to bottom */}
        {rows.map((y) => (
          <line key={`r${y}`} x1="0" y1={y} x2={W} y2={y} stroke={faint} strokeWidth="0.2" strokeDasharray="1.6 1.6" />
        ))}
        {/* 5 vertical corridors */}
        {bounds.map((x) => (
          <line key={x} x1={x} y1={top} x2={x} y2={bot} stroke={line} strokeWidth="0.3" strokeDasharray="2 1.4" />
        ))}
      </g>
      </g>
    </svg>
  );
}
