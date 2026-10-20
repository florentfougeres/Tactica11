import { motion } from "framer-motion";
import type { Orient, Player, Pos } from "../types";
import { OPPONENT_TEXT, discBackground, textHalo } from "../colors";
import { useShortLabel, useTokenMotion } from "../hooks/useTokenMotion";

export const MARKER_SIZE = 42;

interface CommonProps {
  id: string;
  pos: Pos; // display position in % (interpolated while scrubbing)
  size: { w: number; h: number };
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
      color: string; // disc colour for the opposing team, same palette as the main pitch
      color2?: string; // second colour: two-colour disc
      onLabel: (id: string, label: string) => void;
      onRemove: (id: string) => void;
    });

export default function SetPieceMarker(props: Props) {
  const { id, pos, size, orient, editable, instant, onMove } = props;
  const { x, y, moved, endDrag, snapBack, dropPos, dragHandlers } = useTokenMotion({
    pos,
    size,
    orient,
    tokenSize: MARKER_SIZE,
    instant,
  });
  const opp = props.variant === "opponent" ? props : null;
  const edit = useShortLabel(opp?.label ?? "", (v) => opp?.onLabel(id, v));

  function handleDragEnd() {
    endDrag();
    if (!editable) return;
    // No inner clamp: set pieces need precise placement right on (or a
    // touch past) the lines — dropPos's half-token margin is the only bound.
    const p = dropPos();
    if (p) onMove(id, p);
    else snapBack();
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
      drag={editable && !edit.editing}
      dragMomentum={false}
      dragElastic={0.12}
      whileDrag={{ scale: 1.15, zIndex: 50 }}
      {...dragHandlers}
      onClick={() => {
        if (moved.current || !editable || !opp) return;
        edit.start();
      }}
      onDragEnd={handleDragEnd}
    >
      <div
        className="sp-marker__disc"
        style={
          opp
            ? { background: discBackground(opp.color, opp.color2), ...(opp.color2 ? { textShadow: textHalo(OPPONENT_TEXT) } : {}) }
            : undefined
        }
      >
        {edit.editing && opp ? (
          <input
            className="sp-marker__input"
            autoFocus
            value={edit.val}
            onChange={(e) => edit.setVal(e.target.value)}
            onBlur={edit.commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") edit.commit();
              if (e.key === "Escape") edit.cancel();
            }}
            aria-label="Étiquette adversaire"
          />
        ) : (
          <span className="sp-marker__label">{label}</span>
        )}
      </div>
      {name && <span className="sp-marker__name">{name}</span>}
      {opp && edit.editing && (
        <button
          type="button"
          className="sp-marker__remove"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            opp.onRemove(id);
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
