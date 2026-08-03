import { useEffect, useRef, useState } from "react";
import { animate, motion, useMotionValue } from "framer-motion";
import type { Orient, Player, Pos } from "../types";
import { posToPx, pxToPos } from "../types";

export const MARKER_SIZE = 42;

interface Size {
  w: number;
  h: number;
}

interface CommonProps {
  id: string;
  pos: Pos; // display position in % (interpolated while scrubbing)
  size: Size;
  orient: Orient;
  editable: boolean; // false while scrubbing a mid-transition preview
  instant: boolean; // follow the slider 1:1 instead of springing
  onMove: (id: string, pos: { x: number; y: number }) => void;
}

// "team": bound to a real roster player — shows their number/initials + name,
// not label-editable (removed via the roster mini-list, not from the board).
// "opponent": a free-text disc like the main pitch's OpponentToken, plus a
// delete affordance since set-piece opponents are added/removed one by one
// instead of always being a fixed 11.
type Props =
  | (CommonProps & {
      variant: "team";
      player: Player | null;
      role: string; // this player's poste in the compo (e.g. "DC")
      showNumbers: boolean; // disc shows the shirt number instead of the poste
    })
  | (CommonProps & {
      variant: "opponent";
      label: string;
      onLabel: (id: string, label: string) => void;
      onRemove: (id: string) => void;
    });

const spring = { type: "spring" as const, stiffness: 360, damping: 30, mass: 0.7 };

export default function SetPieceMarker(props: Props) {
  const { id, pos, size, orient, editable, instant, onMove } = props;
  const half = MARKER_SIZE / 2;
  const center = posToPx(pos, size, orient);
  const targetX = center.x - half;
  const targetY = center.y - half;

  const x = useMotionValue(targetX);
  const y = useMotionValue(targetY);
  const dragging = useRef(false);
  const moved = useRef(false);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(props.variant === "opponent" ? props.label : "");

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
    if (props.variant !== "opponent") return;
    setEditing(false);
    const v = val.trim().slice(0, 3);
    if (v) props.onLabel(id, v);
    else setVal(props.label);
  }

  function handleDragEnd() {
    dragging.current = false;
    if (!editable) return;
    const cx = x.get() + half;
    const cy = y.get() + half;
    const insidePitch =
      cx >= -half && cx <= size.w + half && cy >= -half && cy <= size.h + half;
    if (insidePitch) {
      // No inner clamp: set pieces need precise placement right on (or a
      // touch past) the lines — the insidePitch check above is the only
      // bound, same margin as the drop-outside-entirely snap-back below.
      const p = pxToPos(cx, cy, size, orient);
      onMove(id, p);
    } else {
      animate(x, targetX, spring); // dropped outside → snap back
      animate(y, targetY, spring);
    }
  }

  const isTeam = props.variant === "team";
  const label = isTeam
    ? props.showNumbers
      ? (props.player?.number != null ? String(props.player.number) : "")
      : props.role
    : props.label;
  const name = isTeam ? props.player?.name : undefined;

  return (
    <motion.div
      className={`sp-marker sp-marker--${props.variant}`}
      style={{ x, y, width: MARKER_SIZE, height: MARKER_SIZE }}
      drag={editable && !editing}
      dragMomentum={false}
      dragElastic={0.12}
      whileDrag={{ scale: 1.15, zIndex: 50 }}
      onPointerDown={() => {
        moved.current = false;
      }}
      onClick={() => {
        if (moved.current || !editable || props.variant !== "opponent") return;
        setVal(props.label);
        setEditing(true);
      }}
      onDragStart={() => {
        dragging.current = true;
        moved.current = true;
      }}
      onDragEnd={handleDragEnd}
    >
      <div className="sp-marker__disc">
        {editing && props.variant === "opponent" ? (
          <input
            className="sp-marker__input"
            autoFocus
            value={val}
            onChange={(e) => setVal(e.target.value.slice(0, 3))}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") {
                if (props.variant === "opponent") setVal(props.label);
                setEditing(false);
              }
            }}
            aria-label="Étiquette adversaire"
          />
        ) : (
          <span className="sp-marker__label">{label}</span>
        )}
      </div>
      {name && <span className="sp-marker__name">{name}</span>}
      {props.variant === "opponent" && editing && (
        <button
          type="button"
          className="sp-marker__remove"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            props.onRemove(id);
          }}
          aria-label="Retirer ce marqueur"
          title="Retirer"
        >
          ×
        </button>
      )}
    </motion.div>
  );
}
