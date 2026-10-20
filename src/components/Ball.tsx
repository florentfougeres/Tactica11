// The match ball, drawn as an SVG group centred on (x, y) with radius r —
// shared by the Séquence stage and the set-piece board's ball token.
// `id` must be unique in the document (gradient / clip ids).
const f = (v: number) => v.toFixed(2);

// Classic black-and-white football: central pentagon, five clipped side
// patches and seams, with a soft shading and drop shadow.
export default function Ball({ x, y, r, id, editable }: { x: number; y: number; r: number; id: string; editable?: boolean }) {
  const pent = (cx: number, cy: number, rad: number, rot: number) =>
    Array.from({ length: 5 }, (_, k) => {
      const a = ((rot + k * 72 - 90) * Math.PI) / 180;
      return `${f(cx + rad * Math.cos(a))},${f(cy + rad * Math.sin(a))}`;
    }).join(" ");
  const core = r * 0.36;
  const patches = Array.from({ length: 5 }, (_, k) => {
    const a = ((k * 72 - 90 + 36) * Math.PI) / 180;
    return { cx: x + r * 0.98 * Math.cos(a), cy: y + r * 0.98 * Math.sin(a), rot: k * 72 + 36 };
  });
  const seams = Array.from({ length: 5 }, (_, k) => {
    const a = ((k * 72 - 90) * Math.PI) / 180;
    return {
      x1: x + core * Math.cos(a),
      y1: y + core * Math.sin(a),
      x2: x + r * 0.78 * Math.cos(a),
      y2: y + r * 0.78 * Math.sin(a),
    };
  });
  return (
    <g data-ball="1" style={editable ? { cursor: "grab" } : undefined}>
      <defs>
        <radialGradient id={`${id}-shade`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="70%" stopColor="#e9ecef" />
          <stop offset="100%" stopColor="#b9c0c8" />
        </radialGradient>
        <clipPath id={`${id}-clip`}>
          <circle cx={x} cy={y} r={r} />
        </clipPath>
      </defs>
      <ellipse cx={x + r * 0.15} cy={y + r * 0.95} rx={r * 0.9} ry={r * 0.32} fill="#000" fillOpacity={0.35} />
      <circle cx={x} cy={y} r={r} fill={`url(#${id}-shade)`} />
      <g clipPath={`url(#${id}-clip)`} fill="#14181d">
        <polygon points={pent(x, y, core, 0)} />
        {patches.map((p, k) => (
          <polygon key={k} points={pent(p.cx, p.cy, core * 0.95, p.rot)} />
        ))}
        {seams.map((sm, k) => (
          <line key={k} x1={sm.x1} y1={sm.y1} x2={sm.x2} y2={sm.y2} stroke="#14181d" strokeWidth={r * 0.075} />
        ))}
      </g>
      <circle cx={x} cy={y} r={r} fill="none" stroke="#0b0f14" strokeWidth={r * 0.1} />
      <ellipse cx={x - r * 0.35} cy={y - r * 0.42} rx={r * 0.22} ry={r * 0.13} fill="#ffffff" fillOpacity={0.55} transform={`rotate(-30 ${f(x - r * 0.35)} ${f(y - r * 0.42)})`} />
    </g>
  );
}
