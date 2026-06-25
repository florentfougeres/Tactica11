import { motion } from "framer-motion";
import { useMemo } from "react";
import type { ZoneRadii } from "../types";

interface Props {
  cx: number; // player centre, in px (relative to the pitch)
  cy: number;
  size: { w: number; h: number };
  radii: ZoneRadii; // zone extent in each direction (fraction of pitch width)
  intensity?: number; // opacity multiplier (lower for additive team coverage)
  animated?: boolean; // spring-follow the centre (single player) vs static (team)
}

// Pointy-top hexagon outline around (0,0), circumradius R.
function hexPoints(R: number): string {
  let p = "";
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    p += `${(R * Math.cos(a)).toFixed(2)},${(R * Math.sin(a)).toFixed(2)} `;
  }
  return p.trim();
}

// Honeycomb "zone of influence": tightly-packed hexes inside an ellipse defined
// by the four directional radii (so the zone can be lopsided). Opacity fades
// with normalised distance; the ellipse edge (where the handles sit) is the
// cutoff. The whole mesh is one <g> translated to the player, so it springs
// along while dragging.
export default function HeatmapOverlay({
  cx,
  cy,
  size,
  radii,
  intensity = 1,
  animated = true,
}: Props) {
  const { w, h } = size;
  const { up, down, left, right } = radii;

  const { hexes, poly } = useMemo(() => {
    const R = w / 17; // small cells
    const poly = hexPoints(R);
    const stepX = Math.sqrt(3) * R; // pointy-top column spacing (cells touch)
    const stepY = 1.5 * R;
    const k = 2.3; // falloff steepness (edge opacity ≈ 0.10)
    const rL = left * w;
    const rR = right * w;
    const rU = up * w;
    const rD = down * w;
    const maxX = Math.max(rL, rR);
    const maxY = Math.max(rU, rD);
    const cols = Math.ceil(maxX / stepX) + 1;
    const rows = Math.ceil(maxY / stepY) + 1;
    const out: { id: string; x: number; y: number; o: number }[] = [];
    for (let r = -rows; r <= rows; r++) {
      for (let c = -cols; c <= cols; c++) {
        const x = c * stepX + (r & 1 ? stepX / 2 : 0);
        const y = r * stepY;
        const rx = x >= 0 ? rR : rL;
        const ry = y <= 0 ? rU : rD;
        const nd2 = (x / rx) ** 2 + (y / ry) ** 2;
        if (nd2 > 1) continue; // outside the ellipse → not part of the zone
        out.push({ id: `${r}.${c}`, x, y, o: Math.exp(-nd2 * k) });
      }
    }
    return { hexes: out, poly };
  }, [w, up, down, left, right]);

  if (!w || !h) return null;

  const cells = hexes.map((hx) => (
    <polygon
      key={hx.id}
      points={poly}
      transform={`translate(${hx.x.toFixed(2)} ${hx.y.toFixed(2)})`}
      fill={hx.o > 0.55 ? "#7bffb4" : "#2bd87c"}
      fillOpacity={(hx.o * 0.72 * intensity).toFixed(3)}
      stroke="#9dffc8"
      strokeOpacity={(hx.o * 0.4 * intensity).toFixed(3)}
      strokeWidth={0.6}
    />
  ));

  return (
    <svg
      className={`heatmap ${animated ? "" : "heatmap--flat"}`}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      {animated ? (
        <motion.g
          initial={false}
          animate={{ x: cx, y: cy }}
          transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.6 }}
        >
          {cells}
        </motion.g>
      ) : (
        <g transform={`translate(${cx} ${cy})`}>{cells}</g>
      )}
    </svg>
  );
}
