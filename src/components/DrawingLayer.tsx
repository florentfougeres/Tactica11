import { useCallback, useEffect, useRef, useState } from "react";
import type { Drawing, Orient, Pos } from "../types";
import { posToPx, pxToPos } from "../types";
import { uid } from "../storage";
import type { DrawTool } from "../types";

interface Props {
  size: { w: number; h: number };
  orient: Orient;
  drawings: Drawing[];
  active: boolean; // drawing mode on → capture pointers, sit above the tokens
  tool: DrawTool;
  color: string;
  onCommit: (d: Drawing) => void;
}

type Pt = { x: number; y: number };

// Small arrowhead built from the last segment's angle (no SVG marker, so it
// works the same in every browser and inherits the stroke colour directly).
function arrowHead(a: Pt, b: Pt, color: string, w: number) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const len = 13;
  const spread = 0.42;
  const p1 = {
    x: b.x - len * Math.cos(ang - spread),
    y: b.y - len * Math.sin(ang - spread),
  };
  const p2 = {
    x: b.x - len * Math.cos(ang + spread),
    y: b.y - len * Math.sin(ang + spread),
  };
  return (
    <path
      d={`M${p1.x.toFixed(1)},${p1.y.toFixed(1)} L${b.x.toFixed(1)},${b.y.toFixed(1)} L${p2.x.toFixed(1)},${p2.y.toFixed(1)}`}
      fill="none"
      stroke={color}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

function DrawShape({
  d,
  size,
  orient,
}: {
  d: Drawing;
  size: { w: number; h: number };
  orient: Orient;
}) {
  const pts = d.points.map((p) => posToPx(p, size, orient));
  if (pts.length < 2) return null;
  const W = 3;

  if (d.tool === "zone") {
    const poly = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
    return (
      <polygon
        points={poly}
        fill={d.color}
        fillOpacity={0.16}
        stroke={d.color}
        strokeWidth={W}
        strokeOpacity={0.9}
        strokeLinejoin="round"
      />
    );
  }

  if (d.tool === "free") {
    const path = "M" + pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L");
    return (
      <path
        d={path}
        fill="none"
        stroke={d.color}
        strokeWidth={W}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  // arrow / dashed → straight line from first to last point + arrowhead
  const a = pts[0];
  const b = pts[pts.length - 1];
  return (
    <g>
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={d.color}
        strokeWidth={W}
        strokeLinecap="round"
        strokeDasharray={d.tool === "dashed" ? "2 9" : undefined}
      />
      {arrowHead(a, b, d.color, W)}
    </g>
  );
}

// A transparent SVG covering the field of play. Persistent drawings always show
// (below the tokens); when `active` it rises above them and captures pointers.
//  - arrow / dashed / free : one press-drag-release gesture.
//  - zone : click to drop each polygon node; click the first node (or Enter) to
//    close it, Escape to cancel.
export default function DrawingLayer({
  size,
  orient,
  drawings,
  active,
  tool,
  color,
  onCommit,
}: Props) {
  const ref = useRef<SVGSVGElement>(null);
  // Drag-based tools (arrow/dashed/free). Kept in a ref (source of truth) and
  // mirrored to state for re-render, so the commit never lives inside a state
  // updater (those get double-invoked in dev StrictMode → duplicate drawings).
  const dragRef = useRef<Pos[] | null>(null);
  const [drag, setDrag] = useState<Pos[] | null>(null);
  // Click-to-place polygon (zone): the nodes dropped so far + the live cursor.
  const zoneRef = useRef<Pos[]>([]);
  const [zone, setZone] = useState<Pos[]>([]);
  const [cursor, setCursor] = useState<Pos | null>(null);

  const isZone = tool === "zone";

  const toPos = (e: React.PointerEvent): Pos => {
    const r = ref.current!.getBoundingClientRect();
    return pxToPos(
      e.clientX - r.left,
      e.clientY - r.top,
      { w: r.width, h: r.height },
      orient,
    );
  };

  // Drop the in-progress polygon as a finished zone (dropping near-coincident
  // nodes, e.g. the double click that some users use to finish).
  const finishZone = useCallback(() => {
    const raw = zoneRef.current;
    const clean: Pos[] = [];
    for (const p of raw) {
      const last = clean[clean.length - 1];
      if (last) {
        const A = posToPx(p, size, orient);
        const B = posToPx(last, size, orient);
        if (Math.hypot(A.x - B.x, A.y - B.y) < 8) continue;
      }
      clean.push(p);
    }
    if (clean.length >= 3)
      onCommit({ id: uid("draw"), tool: "zone", color, points: clean });
    zoneRef.current = [];
    setZone([]);
    setCursor(null);
  }, [size, orient, color, onCommit]);

  const cancelZone = useCallback(() => {
    zoneRef.current = [];
    setZone([]);
    setCursor(null);
  }, []);

  // Drop any in-progress stroke when the tool changes or drawing turns off.
  useEffect(() => {
    dragRef.current = null;
    setDrag(null);
    cancelZone();
  }, [tool, active, cancelZone]);

  // Zone keyboard shortcuts: Enter closes, Escape cancels.
  useEffect(() => {
    if (!active || !isZone) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") finishZone();
      else if (e.key === "Escape") cancelZone();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, isZone, finishZone, cancelZone]);

  const onDown = (e: React.PointerEvent) => {
    if (!active) return;
    e.preventDefault();
    try {
      ref.current?.setPointerCapture(e.pointerId);
    } catch {
      // synthetic / already-released pointers can't be captured — ignore
    }
    if (isZone) return; // zone reacts on click (pointer-up)
    const p = toPos(e);
    dragRef.current = [p, p];
    setDrag(dragRef.current);
  };

  const onMove = (e: React.PointerEvent) => {
    const p = toPos(e);
    if (isZone) {
      if (zoneRef.current.length) setCursor(p); // rubber-band toward the cursor
      return;
    }
    if (!dragRef.current) return;
    const cur = dragRef.current;
    dragRef.current = tool === "free" ? [...cur, p] : [cur[0], p];
    setDrag(dragRef.current);
  };

  const onUp = (e: React.PointerEvent) => {
    if (isZone) {
      if (!active) return;
      const p = toPos(e);
      const pts = zoneRef.current;
      if (pts.length >= 3) {
        const A = posToPx(p, size, orient);
        const B = posToPx(pts[0], size, orient);
        if (Math.hypot(A.x - B.x, A.y - B.y) < 14) {
          finishZone();
          return;
        }
      }
      zoneRef.current = [...pts, p];
      setZone(zoneRef.current);
      setCursor(p);
      return;
    }
    const cur = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!cur) return;
    const a = cur[0];
    const b = cur[cur.length - 1];
    const moved = Math.hypot(b.x - a.x, b.y - a.y) > 1.5 || cur.length > 2;
    if (moved) onCommit({ id: uid("draw"), tool, color, points: cur });
  };

  if (!size.w) return null;

  // Live preview of the polygon being placed.
  const zonePx = zone.map((p) => posToPx(p, size, orient));
  const cursorPx = cursor ? posToPx(cursor, size, orient) : null;
  const previewPts = [...zonePx, ...(cursorPx ? [cursorPx] : [])];
  const previewPath =
    previewPts.length >= 2
      ? "M" + previewPts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" L")
      : null;

  return (
    <svg
      ref={ref}
      className={`draw-layer ${active ? "draw-layer--active" : ""}`}
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onDoubleClick={isZone ? finishZone : undefined}
      aria-hidden="true"
    >
      {drawings.map((d) => (
        <DrawShape key={d.id} d={d} size={size} orient={orient} />
      ))}

      {drag && (
        <DrawShape
          d={{ id: "draft", tool, color, points: drag }}
          size={size}
          orient={orient}
        />
      )}

      {isZone && zonePx.length > 0 && (
        <g>
          {previewPath && (
            <path
              d={previewPath}
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeDasharray="4 6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {cursorPx && zonePx.length >= 2 && (
            <line
              x1={cursorPx.x}
              y1={cursorPx.y}
              x2={zonePx[0].x}
              y2={zonePx[0].y}
              stroke={color}
              strokeWidth={1.5}
              strokeDasharray="2 6"
              opacity={0.5}
            />
          )}
          {zonePx.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={i === 0 ? 6 : 4}
              fill={i === 0 ? color : "#fff"}
              stroke={color}
              strokeWidth={2}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
