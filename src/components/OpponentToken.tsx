import { motion } from "framer-motion";
import type { Opponent, Orient, Pos } from "../types";
import { OPPONENT_TEXT, discBackground, textHalo } from "../colors";
import { useShortLabel, useTokenMotion } from "../hooks/useTokenMotion";
import { TOKEN_SIZE } from "./PitchToken";

interface Props {
  opponent: Opponent;
  pos: Pos; // display position in % (interpolated while scrubbing)
  size: { w: number; h: number };
  orient: Orient;
  color: string; // disc colour for the opposing team
  color2?: string; // second colour: two-colour disc
  editable: boolean; // false while scrubbing a mid-transition preview
  instant: boolean; // follow the slider 1:1 instead of springing
  onMove: (id: string, pos: { x: number; y: number }) => void;
  onLabel: (id: string, label: string) => void;
}

const clampPct = (v: number) => Math.max(4, Math.min(96, v));

export default function OpponentToken({
  opponent,
  pos,
  size,
  orient,
  color,
  color2,
  editable,
  instant,
  onMove,
  onLabel,
}: Props) {
  const { x, y, moved, endDrag, snapBack, dropPos, dragHandlers } = useTokenMotion({
    pos,
    size,
    orient,
    tokenSize: TOKEN_SIZE,
    instant,
  });
  const label = useShortLabel(opponent.label, (v) => onLabel(opponent.id, v));

  function handleDragEnd() {
    endDrag();
    if (!editable) return;
    const p = dropPos();
    if (p) onMove(opponent.id, { x: clampPct(p.x), y: clampPct(p.y) });
    else snapBack();
  }

  return (
    <motion.div
      className="opp-token"
      style={{ x, y, width: TOKEN_SIZE, height: TOKEN_SIZE }}
      drag={editable && !label.editing}
      dragMomentum={false}
      dragElastic={0.12}
      whileDrag={{ scale: 1.15, zIndex: 50 }}
      {...dragHandlers}
      onClick={() => {
        if (moved.current || !editable) return;
        label.start();
      }}
      onDragEnd={handleDragEnd}
    >
      <div
        className="opp-token__disc"
        style={{ background: discBackground(color, color2), ...(color2 ? { textShadow: textHalo(OPPONENT_TEXT) } : {}) }}
      >
        {label.editing ? (
          <input
            className="opp-token__input"
            autoFocus
            value={label.val}
            onChange={(e) => label.setVal(e.target.value)}
            onBlur={label.commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") label.commit();
              if (e.key === "Escape") label.cancel();
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
