import { useId } from "react";
import { motion } from "framer-motion";
import type { Orient, Pos } from "../types";
import { useTokenMotion } from "../hooks/useTokenMotion";
import Ball from "./Ball";

export const BALL_SIZE = 24;

interface Props {
  pos: Pos; // display position in % (interpolated while scrubbing)
  size: { w: number; h: number };
  orient: Orient;
  editable: boolean;
  instant: boolean; // follow the slider 1:1 instead of springing
  onMove: (pos: { x: number; y: number }) => void;
}

// The ball marker on the set-piece board: same spring/instant drag behaviour
// as the other tokens (useTokenMotion), nothing to type on a ball.
export default function BallToken({ pos, size, orient, editable, instant, onMove }: Props) {
  const ballId = `ball${useId().replace(/:/g, "")}`;
  const { x, y, endDrag, snapBack, dropPos, dragHandlers } = useTokenMotion({
    pos,
    size,
    orient,
    tokenSize: BALL_SIZE,
    instant,
  });

  function handleDragEnd() {
    endDrag();
    if (!editable) return;
    // No inner clamp: the ball needs to sit exactly on the goal/corner
    // lines, or a touch past them.
    const p = dropPos();
    if (p) onMove(p);
    else snapBack();
  }

  return (
    <motion.div
      className="ball-token"
      style={{ x, y, width: BALL_SIZE, height: BALL_SIZE }}
      drag={editable}
      dragMomentum={false}
      dragElastic={0.12}
      whileDrag={{ scale: 1.25, zIndex: 60 }}
      {...dragHandlers}
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
