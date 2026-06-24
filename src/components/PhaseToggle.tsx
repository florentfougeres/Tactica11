import { motion } from "framer-motion";
import type { Phase } from "../types";

const LABELS: Record<Phase, string> = {
  base: "Base",
  attack: "Attaque",
  defense: "Défense",
};

export default function PhaseToggle({
  phase,
  onPhase,
}: {
  phase: Phase;
  onPhase: (phase: Phase) => void;
}) {
  return (
    <div className="phase-bar" role="tablist" aria-label="Phase de jeu">
      {(["base", "attack", "defense"] as Phase[]).map((p) => (
        <button
          key={p}
          role="tab"
          aria-selected={phase === p}
          className={`phase-bar__btn ${phase === p ? "is-active" : ""}`}
          onClick={() => onPhase(p)}
        >
          {phase === p && (
            <motion.span
              layoutId="phase-pill"
              className="phase-bar__pill"
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
            />
          )}
          <span className="phase-bar__label">{LABELS[p]}</span>
        </button>
      ))}
    </div>
  );
}
