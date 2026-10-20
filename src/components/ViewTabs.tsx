import { motion } from "framer-motion";

export type View = "pitch" | "roster" | "setpiece" | "sequence";

const LABELS: Record<View, string> = {
  pitch: "Compo",
  roster: "Effectif",
  setpiece: "Phase arrêtée",
  sequence: "Séquence",
};

export default function ViewTabs({
  view,
  onView,
}: {
  view: View;
  onView: (view: View) => void;
}) {
  return (
    <div className="view-tabs" role="tablist" aria-label="Vue">
      {(["pitch", "roster", "setpiece", "sequence"] as View[]).map((v) => (
        <button
          key={v}
          role="tab"
          aria-selected={view === v}
          className={`view-tabs__btn ${view === v ? "is-active" : ""}`}
          onClick={() => onView(v)}
        >
          {view === v && (
            <motion.span
              layoutId="view-tabs-pill"
              className="view-tabs__pill"
              transition={{ type: "spring", stiffness: 400, damping: 32 }}
            />
          )}
          <span className="view-tabs__label">{LABELS[v]}</span>
        </button>
      ))}
    </div>
  );
}
