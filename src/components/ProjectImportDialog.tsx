import { useMemo, useState } from "react";
import type { Lineup, Project } from "../types";
import type { LineupPick, ProjectImportOptions } from "../storage";

interface Props {
  source: Project; // the project read from the .json file
  currentProjectName: string;
  onClose: () => void;
  onOpenAsNew: () => void;
  onImport: (options: ProjectImportOptions) => void;
}

type Mode = "new" | "merge";

const plural = (n: number, word: string) => `${n} ${word}${n > 1 ? "s" : ""}`;

// Everything in a compo is picked when the compo is ticked; set pieces and
// sequences can then be unticked one by one.
const fullPick = (l: Lineup): LineupPick => ({
  lineupId: l.id,
  setPieceIds: l.setPieces.map((sp) => sp.id),
  sequenceIds: (l.sequences ?? []).map((q) => q.id),
});

export default function ProjectImportDialog({
  source,
  currentProjectName,
  onClose,
  onOpenAsNew,
  onImport,
}: Props) {
  const [mode, setMode] = useState<Mode>("new");
  // A single-compo file has nothing to choose: pre-tick it.
  const [picks, setPicks] = useState<LineupPick[]>(() =>
    source.lineups.length === 1 ? [fullPick(source.lineups[0])] : [],
  );
  const [matchByName, setMatchByName] = useState(true);
  const [wholeRoster, setWholeRoster] = useState(false);

  const pickOf = (id: string) => picks.find((p) => p.lineupId === id);

  // Picks stay in the file's compo order, so compos land in that order too.
  const order = (id: string) => source.lineups.findIndex((x) => x.id === id);
  const toggleLineup = (l: Lineup) =>
    setPicks((ps) =>
      ps.some((p) => p.lineupId === l.id)
        ? ps.filter((p) => p.lineupId !== l.id)
        : [...ps, fullPick(l)].sort(
            (a, b) => order(a.lineupId) - order(b.lineupId),
          ),
    );

  const toggleItem = (
    lineupId: string,
    key: "setPieceIds" | "sequenceIds",
    id: string,
  ) =>
    setPicks((ps) =>
      ps.map((p) =>
        p.lineupId !== lineupId
          ? p
          : {
              ...p,
              [key]: p[key].includes(id)
                ? p[key].filter((x) => x !== id)
                : [...p[key], id],
            },
      ),
    );

  const allPicked = picks.length === source.lineups.length;
  const toggleAll = () =>
    setPicks(allPicked ? [] : source.lineups.map(fullPick));

  const totals = useMemo(() => {
    let setPieces = 0;
    let sequences = 0;
    source.lineups.forEach((l) => {
      setPieces += l.setPieces.length;
      sequences += l.sequences?.length ?? 0;
    });
    return { setPieces, sequences };
  }, [source]);

  const summary = [
    plural(source.lineups.length, "compo"),
    totals.setPieces ? plural(totals.setPieces, "phase arrêtée") : null,
    totals.sequences ? plural(totals.sequences, "séquence") : null,
    plural(source.players.length, "joueur"),
  ]
    .filter(Boolean)
    .join(" · ");

  const confirm = () => {
    if (mode === "new") onOpenAsNew();
    else onImport({ picks, matchByName, wholeRoster });
    onClose();
  };

  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div
        className="modal modal--wide glass"
        role="dialog"
        aria-label="Ouvrir un projet"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <h2>Ouvrir « {source.name || "Sans nom"} »</h2>
          <button className="modal__close" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>

        <div className="modal__body">
          <p className="modal__hint">{summary}</p>

          <div className="pimport__modes" role="radiogroup">
            <label className={`pimport__mode${mode === "new" ? " is-active" : ""}`}>
              <input
                type="radio"
                name="pimport-mode"
                checked={mode === "new"}
                onChange={() => setMode("new")}
              />
              <span>
                <strong>Nouveau projet</strong>
                <small>Ouvre tout le fichier à côté de tes projets.</small>
              </span>
            </label>
            <label className={`pimport__mode${mode === "merge" ? " is-active" : ""}`}>
              <input
                type="radio"
                name="pimport-mode"
                checked={mode === "merge"}
                onChange={() => setMode("merge")}
              />
              <span>
                <strong>Ajouter au projet en cours</strong>
                <small>
                  Choisis ce que tu récupères dans « {currentProjectName || "Sans nom"} ».
                </small>
              </span>
            </label>
          </div>

          {mode === "merge" && (
            <>
              <div className="modal__preview pimport__list">
                <div className="pimport__list-head">
                  <span className="modal__preview-title">Compos</span>
                  {source.lineups.length > 1 && (
                    <button className="pimport__all" onClick={toggleAll}>
                      {allPicked ? "Tout décocher" : "Tout cocher"}
                    </button>
                  )}
                </div>
                <ul>
                  {source.lineups.map((l) => {
                    const pick = pickOf(l.id);
                    const sequences = l.sequences ?? [];
                    return (
                      <li key={l.id} className="pimport__compo">
                        <label className="modal__check pimport__compo-name">
                          <input
                            type="checkbox"
                            checked={!!pick}
                            onChange={() => toggleLineup(l)}
                          />
                          <span>{l.name || "Sans nom"}</span>
                          <small>{l.formation}</small>
                        </label>
                        {pick && (l.setPieces.length > 0 || sequences.length > 0) && (
                          <ul className="pimport__items">
                            {l.setPieces.map((sp) => (
                              <li key={sp.id}>
                                <label className="modal__check">
                                  <input
                                    type="checkbox"
                                    checked={pick.setPieceIds.includes(sp.id)}
                                    onChange={() =>
                                      toggleItem(l.id, "setPieceIds", sp.id)
                                    }
                                  />
                                  <span className="pimport__tag">Phase arrêtée</span>
                                  {sp.name}
                                </label>
                              </li>
                            ))}
                            {sequences.map((q) => (
                              <li key={q.id}>
                                <label className="modal__check">
                                  <input
                                    type="checkbox"
                                    checked={pick.sequenceIds.includes(q.id)}
                                    onChange={() =>
                                      toggleItem(l.id, "sequenceIds", q.id)
                                    }
                                  />
                                  <span className="pimport__tag">Séquence</span>
                                  {q.name}
                                </label>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <label className="modal__check">
                <input
                  type="checkbox"
                  checked={matchByName}
                  onChange={(e) => setMatchByName(e.target.checked)}
                />
                Réutiliser les joueurs de mon effectif qui portent le même nom
              </label>
              <label className="modal__check">
                <input
                  type="checkbox"
                  checked={wholeRoster}
                  onChange={(e) => setWholeRoster(e.target.checked)}
                />
                Importer aussi le reste de l'effectif du fichier
              </label>
            </>
          )}

          <div className="modal__actions">
            <button className="btn btn--ghost" onClick={onClose}>
              Annuler
            </button>
            <button
              className="btn btn--primary"
              onClick={confirm}
              disabled={mode === "merge" && picks.length === 0}
            >
              {mode === "new"
                ? "Ouvrir"
                : picks.length
                  ? `Ajouter ${plural(picks.length, "compo")}`
                  : "Choisis une compo"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
