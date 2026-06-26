import type { RefObject } from "react";
import type { Orient, ZoneRadii } from "../types";

interface Props {
  cx: number; // player centre in px (relative to the pitch)
  cy: number;
  size: { w: number; h: number };
  radii: ZoneRadii;
  orient: Orient;
  pitchRef: RefObject<HTMLDivElement | null>;
  onChange: (radii: ZoneRadii) => void;
}

type Dir = "up" | "down" | "left" | "right";

const clamp = (v: number) => Math.max(0.06, Math.min(0.62, v));

// Four draggable knobs on the zone's ellipse edge. Dragging one stretches the
// zone in that direction (independently, so the blob can be lopsided).
export default function InfluenceHandles({
  cx,
  cy,
  size,
  radii,
  orient,
  pitchRef,
  onChange,
}: Props) {
  // Radii are a fraction of the pitch WIDTH = short screen axis (w portrait,
  // h landscape). In landscape the directions are rotated 90° clockwise on
  // screen: up→+x, down→−x, right→+y, left→−y.
  const ref = orient === "landscape" ? size.h : size.w;
  const land = orient === "landscape";

  const startDrag = (dir: Dir) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const r = pitchRef.current?.getBoundingClientRect();
      if (!r) return;
      const px = ev.clientX - r.left;
      const py = ev.clientY - r.top;
      const next = { ...radii };
      if (dir === "right") next.right = clamp((land ? py - cy : px - cx) / ref);
      else if (dir === "left") next.left = clamp((land ? cy - py : cx - px) / ref);
      else if (dir === "up") next.up = clamp((land ? px - cx : cy - py) / ref);
      else next.down = clamp((land ? cx - px : py - cy) / ref);
      onChange(next);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const knob = (dir: Dir, x: number, y: number) => (
    <div
      key={dir}
      className="zone-handle"
      style={{ left: x, top: y }}
      onPointerDown={startDrag(dir)}
      role="slider"
      aria-label={`Étendre la zone vers ${
        { up: "le haut", down: "le bas", left: "la gauche", right: "la droite" }[dir]
      }`}
    />
  );

  return (
    <div className="zone-handles">
      {land
        ? [
            knob("right", cx, cy + radii.right * ref),
            knob("left", cx, cy - radii.left * ref),
            knob("up", cx + radii.up * ref, cy),
            knob("down", cx - radii.down * ref, cy),
          ]
        : [
            knob("right", cx + radii.right * ref, cy),
            knob("left", cx - radii.left * ref, cy),
            knob("up", cx, cy - radii.up * ref),
            knob("down", cx, cy + radii.down * ref),
          ]}
    </div>
  );
}
