import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue, type PanInfo } from "framer-motion";
import type { Opponent, Orient, Pos } from "../types";
import { posToPx, pxToPos } from "../types";
import { TOKEN_SIZE } from "./PitchToken";

interface Size {
  w: number;
  h: number;
}

interface Props {
  opponent: Opponent;
  pos: Pos; // display position in % (interpolated while scrubbing)
  size: Size;
  orient: Orient;
  color: string; // disc colour for the opposing team
  editable: boolean; // false while scrubbing a mid-transition preview
  instant: boolean; // follow the slider 1:1 instead of springing
  onMove: (id: string, pos: { x: number; y: number }) => void;
  onLabel: (id: string, label: string) => void;
}

const clampPct = (v: number) => Math.max(4, Math.min(96, v));
const spring = { type: "spring" as const, stiffness: 360, damping: 30, mass: 0.7 };

export default function OpponentToken({
  opponent,
  pos,
  size,
  orient,
  color,
  editable,
  instant,
  onMove,
  onLabel,
}: Props) {
  const half = TOKEN_SIZE / 2;
  const center = posToPx(pos, size, orient);
  const targetX = center.x - half;
  const targetY = center.y - half;

  const x = useMotionValue(targetX);
  const y = useMotionValue(targetY);
  const dragging = useRef(false);
  const moved = useRef(false);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(opponent.label);

  useEffect(() => {
    if (dragging.current || size.w === 0) return;
    if (instant) {
      x.set(targetX);
      y.set(targetY);
      return;
    }
    const ax = animate(x, targetX, spring);
    const ay = animate(y, targetY, spring);
    return () => {
      ax.stop();
      ay.stop();
    };
  }, [targetX, targetY, size.w, x, y, instant]);

  function commit() {
    setEditing(false);
    const v = val.trim().slice(0, 3);
    if (v) onLabel(opponent.id, v);
    else setVal(opponent.label);
  }

  function handleDragEnd(_e: unknown, _info: PanInfo) {
    dragging.current = false;
    if (!editable) return;
    const cx = x.get() + half;
    const cy = y.get() + half;
    const insidePitch =
      cx >= -half && cx <= size.w + half && cy >= -half && cy <= size.h + half;
    if (insidePitch) {
      const p = pxToPos(cx, cy, size, orient);
      onMove(opponent.id, { x: clampPct(p.x), y: clampPct(p.y) });
    } else {
      animate(x, targetX, spring); // dropped outside → snap back
      animate(y, targetY, spring);
    }
  }

  return (
    <motion.div
      className="opp-token"
      style={{ x, y, width: TOKEN_SIZE, height: TOKEN_SIZE }}
      drag={editable && !editing}
      dragMomentum={false}
      dragElastic={0.12}
      whileDrag={{ scale: 1.15, zIndex: 50 }}
      onPointerDown={() => {
        moved.current = false;
      }}
      onClick={() => {
        if (moved.current || !editable) return;
        setVal(opponent.label);
        setEditing(true);
      }}
      onDragStart={() => {
        dragging.current = true;
        moved.current = true;
      }}
      onDragEnd={handleDragEnd}
    >
      <div className="opp-token__disc" style={{ background: color }}>
        {editing ? (
          <input
            className="opp-token__input"
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value.slice(0, 3))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                setVal(opponent.label);
                setEditing(false);
              }
            }}
            aria-label="Étiquette adversaire"
          />
        ) : (
          <span className="opp-token__label">{opponent.label}</span>
        )}
      </div>
    </motion.div>
  );
}
