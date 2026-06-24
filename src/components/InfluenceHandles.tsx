import type { RefObject } from "react";
import type { ZoneRadii } from "../types";

interface Props {
  cx: number; // player centre in px (relative to the pitch)
  cy: number;
  size: { w: number; h: number };
  radii: ZoneRadii;
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
  pitchRef,
  onChange,
}: Props) {
  const { w } = size;

  const startDrag = (dir: Dir) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const r = pitchRef.current?.getBoundingClientRect();
      if (!r) return;
      const px = ev.clientX - r.left;
      const py = ev.clientY - r.top;
      const next = { ...radii };
      if (dir === "right") next.right = clamp((px - cx) / w);
      else if (dir === "left") next.left = clamp((cx - px) / w);
      else if (dir === "up") next.up = clamp((cy - py) / w);
      else next.down = clamp((py - cy) / w);
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
      {knob("right", cx + radii.right * w, cy)}
      {knob("left", cx - radii.left * w, cy)}
      {knob("up", cx, cy - radii.up * w)}
      {knob("down", cx, cy + radii.down * w)}
    </div>
  );
}
