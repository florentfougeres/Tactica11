import { useState } from "react";
import type { AttrType, AttributeDef, Player } from "../types";

interface Props {
  players: Player[];
  attributeDefs: AttributeDef[];
  onAddPlayer: (name: string, number?: number) => void;
  onRenamePlayer: (id: string, name: string) => void;
  onSetNumber: (id: string, number: number | null) => void;
  onSetAttribute: (
    id: string,
    attrId: string,
    value: string | number | null,
  ) => void;
  onRemovePlayer: (id: string) => void;
  onAddColumn: (name: string, type: AttrType) => void;
  onRenameColumn: (attrId: string, name: string) => void;
  onRemoveColumn: (attrId: string) => void;
  onImportCsv: () => void;
}

// A spreadsheet-like editor for a project's shared player roster: built-in
// number/name columns plus any number of free-form custom attribute columns.
// Every edit here is immediately visible in every compo of the project.
export default function RosterTable({
  players,
  attributeDefs,
  onAddPlayer,
  onRenamePlayer,
  onSetNumber,
  onSetAttribute,
  onRemovePlayer,
  onAddColumn,
  onRenameColumn,
  onRemoveColumn,
  onImportCsv,
}: Props) {
  const [newName, setNewName] = useState("");
  const [newNum, setNewNum] = useState("");
  const [addingCol, setAddingCol] = useState(false);
  const [colName, setColName] = useState("");
  const [colType, setColType] = useState<AttrType>("text");

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    const v = newName.trim();
    if (!v) return;
    const n = parseInt(newNum.trim(), 10);
    onAddPlayer(v, Number.isNaN(n) ? undefined : n);
    setNewName("");
    setNewNum("");
  }

  function submitColumn(e: React.FormEvent) {
    e.preventDefault();
    const v = colName.trim();
    if (!v) return;
    onAddColumn(v, colType);
    setColName("");
    setColType("text");
    setAddingCol(false);
  }

  return (
    <section className="roster-page glass" aria-label="Base de joueurs">
      <header className="panel__header roster-page__header">
        <h2>Base de joueurs</h2>
        <span className="chip">{players.length}</span>
      </header>

      <div className="roster-page__body">
        <p className="modal__hint">
          Cette base est partagée par toutes les compos du projet : modifier
          un joueur ici l'actualise partout.
        </p>

        <div className="roster-table__scroll">
          <table className="roster-table">
            <thead>
              <tr>
                <th className="roster-table__num">#</th>
                <th>Nom</th>
                {attributeDefs.map((attr) => (
                  <th key={attr.id} className="roster-table__attr">
                    <input
                      className="roster-table__colname"
                      value={attr.name}
                      onChange={(e) => onRenameColumn(attr.id, e.target.value)}
                      aria-label={`Renommer la colonne ${attr.name}`}
                    />
                    <button
                      type="button"
                      className="roster-table__col-remove"
                      onClick={() => onRemoveColumn(attr.id)}
                      aria-label={`Supprimer la colonne ${attr.name}`}
                      title="Supprimer la colonne"
                    >
                      ×
                    </button>
                  </th>
                ))}
                <th className="roster-table__addcol">
                  {addingCol ? (
                    <form
                      className="roster-table__addcol-form"
                      onSubmit={submitColumn}
                    >
                      <input
                        autoFocus
                        value={colName}
                        onChange={(e) => setColName(e.target.value)}
                        placeholder="Nom"
                        aria-label="Nom de la colonne"
                      />
                      <select
                        value={colType}
                        onChange={(e) => setColType(e.target.value as AttrType)}
                        aria-label="Type de la colonne"
                      >
                        <option value="text">Texte</option>
                        <option value="number">Nombre</option>
                      </select>
                      <button type="submit" aria-label="Ajouter la colonne">
                        ✓
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddingCol(false)}
                        aria-label="Annuler"
                      >
                        ×
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="roster-table__addcol-btn"
                      onClick={() => setAddingCol(true)}
                      title="Ajouter une colonne"
                      aria-label="Ajouter une colonne"
                    >
                      + Colonne
                    </button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id}>
                  <td>
                    <input
                      className="roster-table__num-input"
                      value={p.number ?? ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, "").slice(0, 2);
                        const n = parseInt(v, 10);
                        onSetNumber(p.id, Number.isNaN(n) ? null : n);
                      }}
                      inputMode="numeric"
                      aria-label="Numéro"
                    />
                  </td>
                  <td>
                    <input
                      value={p.name}
                      onChange={(e) => onRenamePlayer(p.id, e.target.value)}
                      aria-label="Nom"
                    />
                  </td>
                  {attributeDefs.map((attr) => (
                    <td key={attr.id}>
                      <input
                        type={attr.type === "number" ? "number" : "text"}
                        value={p.attributes?.[attr.id] ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          if (attr.type === "number") {
                            onSetAttribute(
                              p.id,
                              attr.id,
                              raw === "" ? null : Number(raw),
                            );
                          } else {
                            onSetAttribute(
                              p.id,
                              attr.id,
                              raw === "" ? null : raw,
                            );
                          }
                        }}
                        aria-label={attr.name}
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      type="button"
                      className="roster-table__remove"
                      onClick={() => onRemovePlayer(p.id)}
                      aria-label={`Retirer ${p.name}`}
                      title="Retirer ce joueur"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
              {players.length === 0 && (
                <tr>
                  <td
                    colSpan={attributeDefs.length + 3}
                    className="roster-table__empty"
                  >
                    Aucun joueur pour l'instant.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <form className="roster-table__add" onSubmit={submitAdd}>
          <input
            className="bench__num"
            value={newNum}
            onChange={(e) =>
              setNewNum(e.target.value.replace(/\D/g, "").slice(0, 2))
            }
            inputMode="numeric"
            placeholder="N°"
            aria-label="Numéro (optionnel)"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ajouter un joueur…"
            aria-label="Nom du joueur"
          />
          <button type="submit" aria-label="Ajouter">
            +
          </button>
        </form>

        <button className="bench__csv" onClick={onImportCsv}>
          Importer une liste (CSV)
        </button>
      </div>
    </section>
  );
}
