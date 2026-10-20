// Side panel of the Séquence editor: sequence picker + Étape / Sélection /
// Réglages tabs (one file each in ./inspector).
import { useState } from "react";
import type { Phase } from "../../types";
import FmSelect from "../FmSelect";

import { type Props } from "./inspector/shared";
import StepTab from "./inspector/StepTab";
import SelectionTab from "./inspector/SelectionTab";
import SettingsTab from "./inspector/SettingsTab";

type Tab = "step" | "selection" | "settings";

export default function SequenceInspector(props: Props) {
  const { seq, sequences, selActors, selAnn, actions, onSeqId, onCreated, autoRename, onRenameDone } = props;
  const [tab, setTab] = useState<Tab>("step");
  const [renaming, setRenaming] = useState(autoRename);
  const stopRenaming = () => {
    setRenaming(false);
    onRenameDone();
  };
  const [newOpen, setNewOpen] = useState(false);

  // Jump to the selection tab whenever something gets selected.
  const selKey = `${[...selActors].join(",")}|${selAnn ?? ""}`;
  const [prevSelKey, setPrevSelKey] = useState(selKey);
  if (selKey !== prevSelKey) {
    setPrevSelKey(selKey);
    if (selActors.size || selAnn) setTab("selection");
  }

  const create = (phase: Phase) => {
    setNewOpen(false);
    onCreated(actions.createSeq(phase));
  };

  return (
    <aside className="bench glass seq-panel">
      <header className="panel__header">
        <h2>Séquence</h2>
        <span className="chip">{sequences.length}</span>
      </header>

      <div className="seq-panel__picker">
        {renaming ? (
          <input
            className="seq-input seq-panel__rename"
            autoFocus
            value={seq.name}
            placeholder="Nom de la séquence"
            aria-label="Nom de la séquence"
            onFocus={(e) => e.target.select()}
            onChange={(e) => actions.patchSeq(seq.id, { name: e.target.value })}
            onBlur={stopRenaming}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
            }}
          />
        ) : (
          <div className="seq-panel__picker-row">
            <FmSelect
              value={seq.id}
              options={sequences.map((q) => ({ value: q.id, label: q.name || "Sans nom" }))}
              onChange={(id) => onSeqId(id)}
              ariaLabel="Séquence affichée"
            />
            <button type="button" className="seq-tbtn" onClick={() => setRenaming(true)} title="Renommer la séquence" aria-label="Renommer la séquence">
              ✎
            </button>
          </div>
        )}
        <div className="seq-panel__picker-actions">
          <button type="button" className="pitch-ctl__btn" onClick={() => setNewOpen((o) => !o)} aria-expanded={newOpen}>
            + Nouvelle
          </button>
          <button
            type="button"
            className="pitch-ctl__btn"
            onClick={() => {
              const id = actions.duplicateSeq(seq.id);
              if (id) onCreated(id);
            }}
          >
            Dupliquer
          </button>
          <button
            type="button"
            className="pitch-ctl__btn seq-danger"
            onClick={() => {
              if (!confirm(`Supprimer « ${seq.name} » ?`)) return;
              const rest = sequences.filter((q) => q.id !== seq.id);
              actions.deleteSeq(seq.id);
              onSeqId(rest[0]?.id ?? null);
            }}
          >
            Supprimer
          </button>
        </div>
        {newOpen && (
          <div className="seq-panel__new">
            <span>À partir de :</span>
            <button type="button" className="pitch-ctl__btn" onClick={() => create("base")}>Base</button>
            <button type="button" className="pitch-ctl__btn" onClick={() => create("attack")}>Attaque</button>
            <button type="button" className="pitch-ctl__btn" onClick={() => create("defense")}>Défense</button>
          </div>
        )}
      </div>

      <div className="seg seq-panel__tabs" role="tablist">
        {(
          [
            ["step", "Étape"],
            ["selection", "Sélection"],
            ["settings", "Réglages"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`seg__btn ${tab === t ? "is-active" : ""}`} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      <div className="seq-panel__body">
        {tab === "step" && <StepTab {...props} />}
        {tab === "selection" && <SelectionTab {...props} />}
        {tab === "settings" && <SettingsTab {...props} />}
      </div>
    </aside>
  );
}
