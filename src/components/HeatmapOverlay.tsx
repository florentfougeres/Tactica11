import { useMemo } from "react";

interface Props {
  center: { x: number; y: number }; // player position, in pitch %
  size: { w: number; h: number }; // pitch size, in px
}

// Pointy-top hexagon vertices around (cx, cy) with circumradius R.
function hexPoints(cx: number, cy: number, R: number): string {
  let pts = "";
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    pts += `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)} `;
  }
  return pts.trim();
}

// A honeycomb "zone of influence" centred on the selected player: hexes fade
// out with distance (gaussian falloff), slightly elongated vertically.
export default function HeatmapOverlay({ center, size }: Props) {
  const { w, h } = size;

  const hexes = useMemo(() => {
    if (w === 0 || h === 0) return [];
    const R = w / 11; // hex circumradius (px)
    const stepX = Math.sqrt(3) * R; // pointy-top column spacing
    const stepY = 1.5 * R; // row spacing
    const cx = (center.x / 100) * w;
    const cy = (center.y / 100) * h;
    const influence = w * 0.4; // falloff radius

    const rows = Math.ceil(h / stepY) + 2;
    const cols = Math.ceil(w / stepX) + 2;
    const out: { id: string; pts: string; o: number }[] = [];

    for (let r = -1; r < rows; r++) {
      for (let c = -1; c < cols; c++) {
        const hx = c * stepX + (r & 1 ? stepX / 2 : 0);
        const hy = r * stepY;
        const dx = hx - cx;
        const dy = (hy - cy) * 0.8; // taller zone
        const d = Math.hypot(dx, dy);
        const o = Math.exp(-((d / influence) ** 2) * 1.5);
        if (o < 0.06) continue;
        out.push({ id: `${r}.${c}`, pts: hexPoints(hx, hy, R * 0.86), o });
      }
    }
    return out;
  }, [center.x, center.y, w, h]);

  return (
    <svg
      className="heatmap"
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden="true"
    >
      {hexes.map((hx) => (
        <polygon
          key={hx.id}
          points={hx.pts}
          // brighter, more saturated near the core; cooler/dim at the edges
          fill={hx.o > 0.55 ? "#7bffb4" : "#28d97a"}
          fillOpacity={(hx.o * 0.72).toFixed(3)}
          stroke="#9dffc8"
          strokeOpacity={(hx.o * 0.55).toFixed(3)}
          strokeWidth={1}
        />
      ))}
    </svg>
  );
}
