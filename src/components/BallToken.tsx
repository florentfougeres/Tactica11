import { useEffect, useId, useRef } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import type { Orient, Pos } from "../types";
import { posToPx, pxToPos } from "../types";
import Ball from "./Ball";

export const BALL_SIZE = 24;

interface Size {
  w: number;
  h: number;
}

interface Props {
  pos: Pos; // display position in % (interpolated while scrubbing)
  size: Size;
  orient: Orient;
  editable: boolean;
  instant: boolean; // follow the slider 1:1 instead of springing
  onMove: (pos: { x: number; y: number }) => void;
}

const spring = { type: "spring" as const, stiffness: 360, damping: 30, mass: 0.7 };

// The ball marker on the set-piece board: same spring/instant drag behaviour
// as OpponentToken, minus the label editing (nothing to type on a ball).
export default function BallToken({
  pos,
  size,
  orient,
  editable,
  instant,
  onMove,
}: Props) {
  const half = BALL_SIZE / 2;
  const ballId = `ball${useId().replace(/:/g, "")}`;
  const center = posToPx(pos, size, orient);
  const targetX = center.x - half;
  const targetY = center.y - half;

  const x = useMotionValue(targetX);
  const y = useMotionValue(targetY);
  const dragging = useRef(false);

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

  function handleDragEnd() {
    dragging.current = false;
    if (!editable) return;
    const cx = x.get() + half;
    const cy = y.get() + half;
    const insidePitch =
      cx >= -half && cx <= size.w + half && cy >= -half && cy <= size.h + half;
    if (insidePitch) {
      // No inner clamp: the ball needs to sit exactly on the goal/corner
      // lines, or a touch past them — insidePitch above is the only bound.
      const p = pxToPos(cx, cy, size, orient);
      onMove(p);
    } else {
      animate(x, targetX, spring); // dropped outside → snap back
      animate(y, targetY, spring);
    }
  }

  return (
    <motion.div
      className="ball-token"
      style={{ x, y, width: BALL_SIZE, height: BALL_SIZE }}
      drag={editable}
      dragMomentum={false}
      dragElastic={0.12}
      whileDrag={{ scale: 1.25, zIndex: 60 }}
      onDragStart={() => {
        dragging.current = true;
      }}
      onDragEnd={handleDragEnd}
      aria-label="Ballon"
      role="img"
    >
      {/* Same ball as the Séquence stage; its own shadow spills under it. */}
      <svg viewBox="0 0 24 24" width="100%" height="100%" overflow="visible" aria-hidden="true">
        <Ball x={12} y={12} r={11} id={ballId} />
      </svg>
    </motion.div>
  );
}
