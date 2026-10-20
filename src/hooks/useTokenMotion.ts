import { useEffect, useRef, useState } from "react";
import { animate, useMotionValue } from "framer-motion";
import type { Orient, Pos } from "../types";
import { posToPx, pxToPos } from "../types";

export const TOKEN_SPRING = { type: "spring" as const, stiffness: 360, damping: 30, mass: 0.7 };

// Placement of a draggable token (player, opponent, set-piece marker, ball)
// on a board whose field box is `size` px. The token's top-left follows its
// pitch position with a spring — or 1:1 while a slider is scrubbed — except
// while the user drags it. A drag that moved it sets `moved`, so the click
// the browser emits on release can be ignored.
export function useTokenMotion({
  pos,
  size,
  orient,
  tokenSize,
  instant,
}: {
  pos: Pos; // display position in % (interpolated while scrubbing)
  size: { w: number; h: number };
  orient: Orient;
  tokenSize: number; // px
  instant: boolean; // follow the slider 1:1 instead of springing
}) {
  const half = tokenSize / 2;
  const target = posToPx(pos, size, orient);
  const targetX = target.x - half;
  const targetY = target.y - half;

  const x = useMotionValue(targetX);
  const y = useMotionValue(targetY);
  const dragging = useRef(false);
  const moved = useRef(false);

  useEffect(() => {
    if (dragging.current || size.w === 0) return;
    if (instant) {
      x.set(targetX);
      y.set(targetY);
      return;
    }
    const ax = animate(x, targetX, TOKEN_SPRING);
    const ay = animate(y, targetY, TOKEN_SPRING);
    return () => {
      ax.stop();
      ay.stop();
    };
  }, [targetX, targetY, size.w, x, y, instant]);

  // Spring back to where the token belongs (dropped off the pitch, or a
  // move the board refuses).
  const snapBack = () => {
    animate(x, targetX, TOKEN_SPRING);
    animate(y, targetY, TOKEN_SPRING);
  };

  // Where the token's centre was dropped, in pitch %, or null when it ended
  // more than half a token past the field's edge.
  const dropPos = (): Pos | null => {
    const { x: cx, y: cy } = center();
    const inside = cx >= -half && cx <= size.w + half && cy >= -half && cy <= size.h + half;
    return inside ? pxToPos(cx, cy, size, orient) : null;
  };

  // Centre of the token in field px (live while dragging).
  const center = () => ({ x: x.get() + half, y: y.get() + half });

  // Call first thing in onDragEnd: the spring may follow the position again.
  const endDrag = () => {
    dragging.current = false;
  };

  const dragHandlers = {
    onPointerDown: () => {
      moved.current = false;
    },
    onDragStart: () => {
      dragging.current = true;
      moved.current = true;
    },
  };

  return { x, y, moved, center, endDrag, snapBack, dropPos, dragHandlers };
}

// Inline editing of a short disc label (opponents: up to 3 characters).
// Empty input keeps the old label.
export function useShortLabel(label: string, onCommit: (label: string) => void) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(label);
  return {
    editing,
    val,
    setVal: (v: string) => setVal(v.slice(0, 3)),
    start: () => {
      setVal(label);
      setEditing(true);
    },
    commit: () => {
      setEditing(false);
      const v = val.trim().slice(0, 3);
      if (v) onCommit(v);
      else setVal(label);
    },
    cancel: () => {
      setVal(label);
      setEditing(false);
    },
  };
}
