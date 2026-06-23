import { useRef } from "react";
import { motion } from "framer-motion";
import type { Phase } from "../types";
import { FORMATIONS } from "../formations";

interface Props {
  name: string;
  formation: string;
  phase: Phase;
  onName: (name: string) => void;
  onFormation: (formation: string) => void;
  onPhase: (phase: Phase) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
}

export default function Sidebar({
  name,
  formation,
  phase,
  onName,
  onFormation,
  onPhase,
  onExport,
  onImport,
  onReset,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="sidebar glass">
      <header className="panel__header">
        <h2>Réglages</h2>
      </header>

      <label className="field">
        <span>Nom de la compo</span>
        <input value={name} onChange={(e) => onName(e.target.value)} />
      </label>

      <div className="field">
        <span>Phase de jeu</span>
        <div className="phase-toggle phase-toggle--three" role="tablist">
          {(["base", "attack", "defense"] as Phase[]).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={phase === p}
              className={`phase-toggle__btn ${phase === p ? "is-active" : ""}`}
              onClick={() => onPhase(p)}
            >
              {phase === p && (
                <motion.span
                  layoutId="phase-pill"
                  className="phase-toggle__pill"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="phase-toggle__label">
                {p === "base" ? "Base" : p === "attack" ? "Attaque" : "Défense"}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span>Formation</span>
        <div className="formation-grid">
          {FORMATIONS.map((f) => (
            <button
              key={f}
              className={`formation-chip ${f === formation ? "is-active" : ""}`}
              onClick={() => onFormation(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="sidebar__spacer" />

      <div className="sidebar__actions">
        <button className="btn btn--primary" onClick={onExport}>
          Exporter (.json)
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Importer…
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = "";
          }}
        />
        <button className="btn btn--ghost" onClick={onReset}>
          Nouvelle compo
        </button>
      </div>
    </aside>
  );
}
