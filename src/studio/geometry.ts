// Geometry of the Studio poster: the pitch as polylines in metres, and the
// camera that projects it — straight from above ("à plat") or tilted into a
// real perspective, where far things shrink and the pitch becomes a
// trapezoid. Everything drawn on the poster goes through `project`, so
// lines, players and shadows always agree.
import type { Orient, Pos } from "../types";
import { posToPercent } from "../types";

export type P2 = { x: number; y: number };

// Field of play, metres (FIFA): 68 wide, 105 long.
export const FIELD_W = 68;
export const FIELD_L = 105;
// Grass beyond the lines: 5% of the field each way (same as the boards'
// PitchTurf apron), so the lines never hug the edge.
export const APRON = 0.05;

// The pitch plane as it lies on the poster: `w` across the screen, `h` from
// the far edge (top) to the near edge (bottom), in metres.
export function plane(orient: Orient) {
  return orient === "portrait" ? { w: FIELD_W, h: FIELD_L } : { w: FIELD_L, h: FIELD_W };
}

// A player position (pitch %) → plane metres.
export function posToPlane(pos: Pos, orient: Orient): P2 {
  const { left, top } = posToPercent(pos, orient);
  const pl = plane(orient);
  return { x: (left / 100) * pl.w, y: (top / 100) * pl.h };
}

// Portrait metres (x across, y from the opponent goal) → plane metres.
const fromPortrait = (orient: Orient) => (x: number, y: number): P2 =>
  orient === "portrait" ? { x, y } : { x: FIELD_L - y, y: x };

const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 40) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });

// Line markings as polylines (portrait metres, then mapped to the plane).
export function markings(orient: Orient): { lines: P2[][]; spots: P2[] } {
  const W = FIELD_W;
  const L = FIELD_L;
  const cx = W / 2;
  const pa = { d: 16.5, h: 20.16 };
  const ga = { d: 5.5, h: 9.16 };
  const spot = 11;
  const r = 9.15;
  const arcA = Math.acos((pa.d - spot) / r); // where the penalty arc leaves the box
  const rect = (x0: number, y0: number, x1: number, y1: number): [number, number][] => [
    [x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0],
  ];
  const raw: [number, number][][] = [
    rect(0, 0, W, L),
    [[0, L / 2], [W, L / 2]],
    arc(cx, L / 2, r, 0, Math.PI * 2, 72),
    rect(cx - pa.h, 0, cx + pa.h, pa.d),
    rect(cx - ga.h, 0, cx + ga.h, ga.d),
    arc(cx, spot, r, Math.PI / 2 - arcA, Math.PI / 2 + arcA, 24),
    rect(cx - pa.h, L - pa.d, cx + pa.h, L),
    rect(cx - ga.h, L - ga.d, cx + ga.h, L),
    arc(cx, L - spot, r, -Math.PI / 2 - arcA, -Math.PI / 2 + arcA, 24),
    arc(0, 0, 1, 0, Math.PI / 2, 8),
    arc(W, 0, 1, Math.PI / 2, Math.PI, 8),
    arc(0, L, 1, -Math.PI / 2, 0, 8),
    arc(W, L, 1, Math.PI, Math.PI * 1.5, 8),
  ];
  const m = fromPortrait(orient);
  return {
    lines: raw.map((pl) => pl.map(([x, y]) => m(x, y))),
    spots: [m(cx, L / 2), m(cx, spot), m(cx, L - spot)],
  };
}

// Goals (7.32 m wide, 2.44 m high, net 2 m deep) behind each goal line: the
// posts on the line (a, b) and the back of the net (a2, b2), plane metres.
export const GOAL_H = 2.44;
export function goals(orient: Orient) {
  const m = fromPortrait(orient);
  const cx = FIELD_W / 2;
  const half = 7.32 / 2;
  const depth = 2;
  return [
    { a: m(cx - half, 0), b: m(cx + half, 0), a2: m(cx - half, -depth), b2: m(cx + half, -depth) },
    { a: m(cx - half, FIELD_L), b: m(cx + half, FIELD_L), a2: m(cx - half, FIELD_L + depth), b2: m(cx + half, FIELD_L + depth) },
  ];
}

// The camera. `tilt` 0 = seen from straight above; larger = lower, more
// raking view, from behind the near edge. Points are plane metres plus a
// height `h` above the grass; the result is in camera units (metres at the
// plane's centre) with the depth scale `s` (1 at the centre, < 1 farther
// away, > 1 closer).
export function makeCamera(orient: Orient, tiltDeg: number) {
  const pl = plane(orient);
  const t = (tiltDeg * Math.PI) / 180;
  const sin = Math.sin(t);
  const cos = Math.cos(t);
  const D = Math.max(pl.w, pl.h) * 1.35; // camera distance: marked but natural perspective
  const project = (p: P2, h = 0) => {
    const x = p.x - pl.w / 2;
    const d = p.y - pl.h / 2; // < 0 toward the far edge
    const y = d * cos - h * sin; // a height shows as "up" once the view tilts
    const z = d * sin + h * cos; // toward the camera
    const s = D / (D - z);
    return { x: x * s, y: y * s, s };
  };
  return { project, cos, sin, plane: pl };
}
export type Camera = ReturnType<typeof makeCamera>;
