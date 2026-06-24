import { motion } from "framer-motion";
import { useMemo } from "react";

interface Props {
  cx: number; // player centre, in px (relative to the pitch)
  cy: number;
  size: { w: number; h: number };
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

// Honeycomb "zone of influence": tightly-packed hexes around the player, fading
// out with a gaussian falloff (slightly taller than wide). The whole mesh is a
// single <g> translated to the player, so it springs along while dragging.
export default function HeatmapOverlay({ cx, cy, size }: Props) {
  const { w, h } = size;

  const { hexes, poly } = useMemo(() => {
    const R = w / 17; // small cells
    const poly = hexPoints(R);
    const stepX = Math.sqrt(3) * R; // pointy-top column spacing (cells touch)
    const stepY = 1.5 * R;
    const inf = w * 0.24; // falloff radius (tight)
    const k = 2.1;
    const vf = 0.82; // vertical factor < 1 → zone a bit taller
    const thr = 0.08;
    const reach = inf * 1.5;
    const rows = Math.ceil(reach / stepY) + 1;
    const cols = Math.ceil(reach / stepX) + 1;
    const out: { id: string; x: number; y: number; o: number }[] = [];
    for (let r = -rows; r <= rows; r++) {
      for (let c = -cols; c <= cols; c++) {
        const x = c * stepX + (r & 1 ? stepX / 2 : 0);
        const y = r * stepY;
        const d = Math.hypot(x, y * vf);
        const o = Math.exp(-((d / inf) ** 2) * k);
        if (o < thr) continue;
        out.push({ id: `${r}.${c}`, x, y, o });
      }
    }
    return { hexes: out, poly };
  }, [w]);

  if (!w || !h) return null;

  return (
    <svg
      className="heatmap"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      <motion.g
        initial={false}
        animate={{ x: cx, y: cy }}
        transition={{ type: "spring", stiffness: 520, damping: 34, mass: 0.6 }}
      >
        {hexes.map((hx) => (
          <polygon
            key={hx.id}
            points={poly}
            transform={`translate(${hx.x.toFixed(2)} ${hx.y.toFixed(2)})`}
            fill={hx.o > 0.55 ? "#86ffbf" : "#2bd87c"}
            fillOpacity={(hx.o * 0.72).toFixed(3)}
            stroke="#06140d"
            strokeOpacity={(hx.o * 0.4).toFixed(3)}
            strokeWidth={0.6}
          />
        ))}
      </motion.g>
    </svg>
  );
}
