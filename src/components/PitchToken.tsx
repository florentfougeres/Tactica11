import { useEffect, useRef } from "react";
import {
  animate,
  motion,
  useMotionValue,
  type PanInfo,
} from "framer-motion";
import type { Orient, Phase, Player, Pos, Slot } from "../types";
import { posToPx, pxToPos } from "../types";

export const TOKEN_SIZE = 54;

interface Size {
  w: number;
  h: number;
}

interface Props {
  slot: Slot;
  starter: Player | null;
  sub: Player | null;
  phase: Phase;
  pos: Pos; // display position in % (interpolated while scrubbing the slider)
  frozen: boolean; // mid-transition preview → no drag / select
  instant: boolean; // follow the slider 1:1 instead of springing
  size: Size;
  orient: Orient;
  selected: boolean;
  onSelect: (slotId: string | null) => void;
  onMove: (slotId: string, pos: { x: number; y: number }) => void;
  onPlayerDrop: (slotId: string, point: { x: number; y: number }) => void;
  onDragActiveChange: (active: boolean) => void;
  onDragMove: (slotId: string, center: { x: number; y: number }) => void;
}

const clampPct = (v: number) => Math.max(4, Math.min(96, v));

export default function PitchToken({
  slot,
  starter,
  sub,
  phase,
  pos,
  frozen,
  instant,
  size,
  orient,
  selected,
  onSelect,
  onMove,
  onPlayerDrop,
  onDragActiveChange,
  onDragMove,
}: Props) {
  const isBase = phase === "base";
  const half = TOKEN_SIZE / 2;
  const center = posToPx(pos, size, orient);
  const targetX = center.x - half;
  const targetY = center.y - half;

  const x = useMotionValue(targetX);
  const y = useMotionValue(targetY);
  const dragging = useRef(false);
  // Set on drag start, checked by onClick to swallow the click a drag emits on
  // release (otherwise it would toggle the selection off right after dropping).
  const moved = useRef(false);

  // Animate to the target position whenever the phase / formation / stored
  // position changes — unless the user is actively dragging this token.
  useEffect(() => {
    if (dragging.current || size.w === 0) return;
    if (instant) {
      // scrubbing the slider → track it in real time (no spring lag)
      x.set(targetX);
      y.set(targetY);
      return;
    }
    const spring = { type: "spring" as const, stiffness: 360, damping: 30, mass: 0.7 };
    const ax = animate(x, targetX, spring);
    const ay = animate(y, targetY, spring);
    return () => {
      ax.stop();
      ay.stop();
    };
  }, [targetX, targetY, size.w, x, y, instant]);

  const empty = !starter;
  // Base phase: drag = move the player to another slot / bench (shape is locked,
  // so the token snaps back). Attack/defense: drag = reposition this token.
  // Mid-transition (frozen) the tokens are a read-only preview.
  const canDrag = !empty && !frozen;

  const label = starter ? starter.name || "Joueur" : slot.role;
  // Main disc is always the position (role); the shirt number, when set, rides
  // as a small secondary disc — and only for the starter (titulaire).
  const number = starter?.number;

  function handleDragEnd(_e: unknown, info: PanInfo) {
    dragging.current = false;
    onDragActiveChange(false);
    if (!canDrag) return;
    if (isBase) {
      // Positions are locked in base: resolve the drop, then animate this token
      // back to its formation spot. (We can't use dragSnapToOrigin — our layout
      // origin is 0,0 since position is driven entirely by the x/y values.)
      onPlayerDrop(slot.id, info.point);
      const spring = { type: "spring" as const, stiffness: 360, damping: 30, mass: 0.7 };
      animate(x, targetX, spring);
      animate(y, targetY, spring);
      return;
    }
    const cx = x.get() + half;
    const cy = y.get() + half;
    const insidePitch =
      cx >= -half && cx <= size.w + half && cy >= -half && cy <= size.h + half;
    if (insidePitch) {
      const p = pxToPos(cx, cy, size, orient);
      onMove(slot.id, { x: clampPct(p.x), y: clampPct(p.y) });
    }
  }

  return (
    <motion.div
      className={`token ${empty ? "token--empty" : "token--filled"} ${
        selected ? "token--selected" : ""
      } role-${slot.role.toLowerCase()}`}
      style={{ x, y, width: TOKEN_SIZE, height: TOKEN_SIZE }}
      drag={canDrag}
      dragMomentum={false}
      dragElastic={0.12}
      whileDrag={{ scale: 1.18, zIndex: 50 }}
      onPointerDown={() => {
        moved.current = false;
      }}
      onClick={() => {
        // A drag emits a click on release — ignore it so the selection (and its
        // heatmap) survives the drop instead of toggling off.
        if (moved.current || frozen) return;
        // Click selects (any phase) to reveal the influence heatmap; click the
        // selected token again to clear it. The roster popover stays base-only.
        if (!empty) onSelect(selected ? null : slot.id);
      }}
      onDragStart={() => {
        dragging.current = true;
        moved.current = true;
        onDragActiveChange(true);
        // Outside base, dragging a player reveals/keeps its influence zone.
        if (!isBase) onSelect(slot.id);
      }}
      onDrag={() => {
        if (!isBase) onDragMove(slot.id, { x: x.get() + half, y: y.get() + half });
      }}
      onDragEnd={handleDragEnd}
    >
      <div className="token__disc">
        <span className="token__badge">{slot.role}</span>
        {number != null && <span className="token__number">{number}</span>}
      </div>
      <div className="token__names">
        <span className="token__name">{label}</span>
        {sub && <span className="token__subname">{sub.name}</span>}
      </div>
    </motion.div>
  );
}
