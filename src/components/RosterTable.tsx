import { useMemo, useState } from "react";
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

type SortKey = "number" | "name" | string; // string = attribute id
type Sort = { key: SortKey; dir: "asc" | "desc" } | null;

// A table cell that reads as plain text at rest and only turns into an
// editable input once clicked — the "read, then edit on click" spreadsheet
// feel, instead of every cell permanently looking like a form field.
function EditableCell({
  displayValue,
  editValue,
  inputType = "text",
  align,
  onCommit,
  ariaLabel,
  placeholder,
}: {
  displayValue: string;
  editValue: string;
  inputType?: "text" | "number";
  align?: "center";
  onCommit: (raw: string) => void;
  ariaLabel: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(editValue);

  if (editing) {
    return (
      <input
        autoFocus
        className="roster-table__cell-input"
        style={align === "center" ? { textAlign: "center" } : undefined}
        type={inputType}
        inputMode={inputType === "number" ? "numeric" : undefined}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => {
          setEditing(false);
          onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(editValue);
            setEditing(false);
          }
        }}
        aria-label={ariaLabel}
      />
    );
  }

  return (
    <button
      type="button"
      className="roster-table__cell"
      style={align === "center" ? { textAlign: "center" } : undefined}
      onClick={() => {
        setDraft(editValue);
        setEditing(true);
      }}
      aria-label={`${ariaLabel}, cliquer pour modifier`}
    >
      {displayValue || (
        <span className="roster-table__cell-empty">
          {placeholder ?? "—"}
        </span>
      )}
    </button>
  );
}

function SortArrow({ dir }: { dir: "asc" | "desc" }) {
  return (
    <span className="roster-table__sort-arrow" aria-hidden="true">
      {dir === "asc" ? "▲" : "▼"}
    </span>
  );
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
  const [sort, setSort] = useState<Sort>(null);

  function submitAdd() {
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

  function toggleSort(key: SortKey) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  const sortedPlayers = useMemo(() => {
    if (!sort) return players;
    const { key, dir } = sort;
    const factor = dir === "asc" ? 1 : -1;
    const value = (p: Player): string | number | null => {
      if (key === "number") return p.number ?? null;
      if (key === "name") return p.name;
      return p.attributes?.[key] ?? null;
    };
    return [...players].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * factor;
      }
      return String(av).localeCompare(String(bv), "fr", { numeric: true }) * factor;
    });
  }, [players, sort]);

  return (
    <section className="roster-page glass" aria-label="Base de joueurs">
      <header className="panel__header roster-page__header">
        <h2>Base de joueurs</h2>
        <span className="chip">{players.length}</span>
        <button
          type="button"
          className="roster-page__csv-btn"
          onClick={onImportCsv}
        >
          Importer CSV
        </button>
      </header>

      <div className="roster-page__body">
        <p className="modal__hint">
          Cette base est partagée par toutes les compos du projet : modifier
          un joueur ici l'actualise partout. Cliquez sur une cellule pour la
          modifier, sur un en-tête pour trier.
        </p>

        <div className="roster-table__scroll">
          <table className="roster-table">
            <thead>
              <tr>
                <th className="roster-table__num">
                  <button
                    type="button"
                    className="roster-table__sort-btn"
                    onClick={() => toggleSort("number")}
                  >
                    #{sort?.key === "number" && <SortArrow dir={sort.dir} />}
                  </button>
                </th>
                <th>
                  <button
                    type="button"
                    className="roster-table__sort-btn"
                    onClick={() => toggleSort("name")}
                  >
                    Nom{sort?.key === "name" && <SortArrow dir={sort.dir} />}
                  </button>
                </th>
                {attributeDefs.map((attr) => (
                  <th key={attr.id} className="roster-table__attr">
                    <div className="roster-table__attr-head">
                      <input
                        className="roster-table__colname"
                        value={attr.name}
                        onChange={(e) =>
                          onRenameColumn(attr.id, e.target.value)
                        }
                        aria-label={`Renommer la colonne ${attr.name}`}
                      />
                      <button
                        type="button"
                        className="roster-table__col-sort"
                        onClick={() => toggleSort(attr.id)}
                        aria-label={`Trier par ${attr.name}`}
                        title="Trier"
                      >
                        {sort?.key === attr.id ? (
                          <SortArrow dir={sort.dir} />
                        ) : (
                          "⇅"
                        )}
                      </button>
                      <button
                        type="button"
                        className="roster-table__col-remove"
                        onClick={() => onRemoveColumn(attr.id)}
                        aria-label={`Supprimer la colonne ${attr.name}`}
                        title="Supprimer la colonne"
                      >
                        ×
                      </button>
                    </div>
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
              {sortedPlayers.map((p) => (
                <tr key={p.id}>
                  <td>
                    <EditableCell
                      displayValue={p.number != null ? String(p.number) : ""}
                      editValue={p.number != null ? String(p.number) : ""}
                      inputType="number"
                      align="center"
                      placeholder="—"
                      ariaLabel={`Numéro de ${p.name}`}
                      onCommit={(raw) => {
                        const v = raw.replace(/\D/g, "").slice(0, 2);
                        const n = parseInt(v, 10);
                        onSetNumber(p.id, Number.isNaN(n) ? null : n);
                      }}
                    />
                  </td>
                  <td>
                    <EditableCell
                      displayValue={p.name}
                      editValue={p.name}
                      ariaLabel={`Nom de ${p.name}`}
                      onCommit={(raw) => onRenamePlayer(p.id, raw)}
                    />
                  </td>
                  {attributeDefs.map((attr) => {
                    const raw = p.attributes?.[attr.id];
                    const display = raw != null ? String(raw) : "";
                    return (
                      <td key={attr.id}>
                        <EditableCell
                          displayValue={display}
                          editValue={display}
                          inputType={attr.type === "number" ? "number" : "text"}
                          align={attr.type === "number" ? "center" : undefined}
                          ariaLabel={`${attr.name} de ${p.name}`}
                          onCommit={(v) => {
                            if (attr.type === "number") {
                              onSetAttribute(
                                p.id,
                                attr.id,
                                v.trim() === "" ? null : Number(v),
                              );
                            } else {
                              onSetAttribute(
                                p.id,
                                attr.id,
                                v.trim() === "" ? null : v,
                              );
                            }
                          }}
                        />
                      </td>
                    );
                  })}
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
              <tr className="roster-table__row--add">
                <td>
                  <input
                    className="roster-table__num-input"
                    value={newNum}
                    onChange={(e) =>
                      setNewNum(e.target.value.replace(/\D/g, "").slice(0, 2))
                    }
                    onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                    inputMode="numeric"
                    placeholder="N°"
                    aria-label="Numéro du nouveau joueur"
                  />
                </td>
                <td>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                    placeholder="Ajouter un joueur…"
                    aria-label="Nom du nouveau joueur"
                  />
                </td>
                {attributeDefs.map((attr) => (
                  <td key={attr.id} aria-hidden="true" />
                ))}
                <td>
                  <button
                    type="button"
                    className="roster-table__add-btn"
                    onClick={submitAdd}
                    disabled={!newName.trim()}
                    aria-label="Ajouter ce joueur"
                    title="Ajouter ce joueur"
                  >
                    +
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
