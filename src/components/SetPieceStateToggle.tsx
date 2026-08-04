import { motion } from "framer-motion";
import type { SetPieceState } from "../types";
import { SET_PIECE_STATES } from "../types";

const LABELS: Record<SetPieceState, string> = {
  start: "Début",
  mid: "Intermédiaire",
  end: "Fin",
};

export default function SetPieceStateToggle({
  state,
  onState,
}: {
  state: SetPieceState;
  onState: (state: SetPieceState) => void;
}) {
  return (
    <div
      className="phase-bar phase-bar--sp"
      role="tablist"
      aria-label="État de la phase arrêtée"
    >
      {SET_PIECE_STATES.map((s) => (
        <button
          key={s}
          role="tab"
          aria-selected={state === s}
          className={`phase-bar__btn ${state === s ? "is-active" : ""}`}
          onClick={() => onState(s)}
        >
          {state === s && (
            <motion.span
              layoutId="sp-state-pill"
              className="phase-bar__pill"
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
            />
          )}
          <span className="phase-bar__label">{LABELS[s]}</span>
        </button>
      ))}
    </div>
  );
}
