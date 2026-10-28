import { useMemo, useState } from "react";
import {
  LINE_LABEL,
  type AttrType,
  type AttributeDef,
  type Player,
  type PlayerPosition,
  type PositionLine,
} from "../../types";
import ColumnsDialog from "./ColumnsDialog";
import PlayerSheet from "./PlayerSheet";
import RosterCards from "./RosterCards";
import RosterTable from "./RosterTable";
import {
  filterPlayers,
  lineOf,
  sortPlayers,
  type LineFilter,
  type Sort,
  type SortKey,
  displayName,
} from "./rosterModel";
import Icon from "../Icon";

interface Props {
  players: Player[];
  attributeDefs: AttributeDef[];
  onAddPlayer: (name: string) => string;
  onPatchPlayer: (id: string, patch: Partial<Omit<Player, "id">>) => void;
  onSetAttribute: (id: string, attrId: string, value: string | number | null) => void;
  onRemovePlayer: (id: string) => void;
  onAddColumn: (name: string, type: AttrType) => void;
  onRenameColumn: (attrId: string, name: string) => void;
  onRemoveColumn: (attrId: string) => void;
  onImportCsv: () => void;
}

type Mode = "table" | "cards";
const MODE_KEY = "tactica11.rosterView";

function loadMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === "cards" ? "cards" : "table";
  } catch {
    return "table";
  }
}

// Default position of a player added from a line's "+ Ajouter" card.
const LINE_DEFAULT: Record<PositionLine, PlayerPosition> = { gk: "G", def: "DC", mid: "MC", att: "BU" };

// Effectif: the project's whole player base (shared by all its compos), as a
// sortable table or as cards by line, with a fiche on the side to edit the
// selected player.
export default function RosterView({
  players,
  attributeDefs,
  onAddPlayer,
  onPatchPlayer,
  onSetAttribute,
  onRemovePlayer,
  onAddColumn,
  onRenameColumn,
  onRemoveColumn,
  onImportCsv,
}: Props) {
  const [mode, setModeState] = useState<Mode>(loadMode);
  const [query, setQuery] = useState("");
  const [line, setLine] = useState<LineFilter>("all");
  const [sort, setSort] = useState<Sort>({ key: "position", dir: "asc" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Just created from "Ajouter": its name field gets the focus, and it's
  // dropped again if left without a name.
  const [newId, setNewId] = useState<string | null>(null);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const setMode = (m: Mode) => {
    setModeState(m);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      // per-viewer preference only
    }
  };

  const visible = useMemo(
    () => sortPlayers(filterPlayers(players, { query, line }), sort),
    [players, query, line, sort],
  );
  const selected = players.find((p) => p.id === selectedId) ?? null;

  const lineCounts = useMemo(() => {
    const c: Record<string, number> = { all: players.length };
    players.forEach((p) => {
      const l = lineOf(p);
      if (l) c[l] = (c[l] ?? 0) + 1;
    });
    return c;
  }, [players]);

  const select = (id: string | null) => {
    if (newId && newId !== id) {
      const fresh = players.find((p) => p.id === newId);
      if (fresh && !fresh.name.trim() && fresh.number == null) onRemovePlayer(newId);
      setNewId(null);
    }
    setSelectedId(id);
  };

  const add = (position?: PlayerPosition) => {
    const id = onAddPlayer("");
    if (position) onPatchPlayer(id, { position });
    // Make sure the new player isn't hidden by the current filters.
    setQuery("");
    if (line !== "all" && (!position || LINE_DEFAULT[line] !== position)) setLine("all");
    select(id);
    setNewId(id);
  };

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const remove = (p: Player) => {
    if (
      !window.confirm(
        `Supprimer ${displayName(p)} de l'effectif ? Il sera aussi retiré des compos et des phases arrêtées où il apparaît.`,
      )
    )
      return;
    setNewId(null);
    setSelectedId(null);
    onRemovePlayer(p.id);
  };

  return (
    <section className={`roster-page glass${selected ? " has-sheet" : ""}`} aria-label="Effectif">
      <header className="roster-bar">
        <h2>Effectif</h2>
        <span className="chip">{players.length}</span>
        <label className="roster-search">
          <Icon name="search" size={14} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un nom ou un numéro"
            aria-label="Rechercher un joueur"
          />
        </label>
        <div className="seg roster-bar__mode" role="group" aria-label="Affichage">
          <button type="button" className={`seg__btn${mode === "table" ? " is-active" : ""}`} aria-pressed={mode === "table"} onClick={() => setMode("table")}>
            Table
          </button>
          <button type="button" className={`seg__btn${mode === "cards" ? " is-active" : ""}`} aria-pressed={mode === "cards"} onClick={() => setMode("cards")}>
            Cartes
          </button>
        </div>
        <div className="roster-bar__actions">
          <button type="button" className="btn" onClick={() => setColumnsOpen(true)}>
            Infos
          </button>
          <button type="button" className="btn" onClick={onImportCsv}>
            Importer un CSV
          </button>
          <button type="button" className="btn btn--primary" onClick={() => add()}>
            Ajouter un joueur
          </button>
        </div>
      </header>

      <div className="roster-filters">
        <div className="roster-chips" role="group" aria-label="Filtrer par ligne">
          {(["all", "gk", "def", "mid", "att"] as LineFilter[]).map((l) => (
            <button
              key={l}
              type="button"
              className={`roster-chip${line === l ? " is-active" : ""}`}
              aria-pressed={line === l}
              onClick={() => setLine(l)}
            >
              {l === "all" ? "Tous" : LINE_LABEL[l]}
              <span>{lineCounts[l] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="roster-main">
        <div className="roster-list">
          {players.length === 0 ? (
            <div className="roster-empty">
              <strong>Ton effectif est vide</strong>
              <p>Ajoute tes joueurs un par un, ou importe une liste depuis un fichier CSV (Excel, Google Sheets).</p>
              <div>
                <button type="button" className="btn btn--primary" onClick={() => add()}>
                  Ajouter un joueur
                </button>{" "}
                <button type="button" className="btn" onClick={onImportCsv}>
                  Importer un CSV
                </button>
              </div>
            </div>
          ) : visible.length === 0 ? (
            <p className="roster-empty">Aucun joueur ne correspond à ces filtres.</p>
          ) : mode === "table" ? (
            <RosterTable
              players={visible}
              attributeDefs={attributeDefs}
              sort={sort}
              onSort={toggleSort}
              selectedId={selectedId}
              onSelect={select}
            />
          ) : (
            <RosterCards
              players={visible}
              selectedId={selectedId}
              onSelect={select}
              onAddToLine={(l) => add(l ? LINE_DEFAULT[l] : undefined)}
            />
          )}
        </div>

        {selected && (
          <PlayerSheet
            key={selected.id}
            player={selected}
            attributeDefs={attributeDefs}
            autoFocusName={selected.id === newId}
            onPatch={(patch) => onPatchPlayer(selected.id, patch)}
            onSetAttribute={(attrId, v) => onSetAttribute(selected.id, attrId, v)}
            onDelete={() => remove(selected)}
            onClose={() => select(null)}
            onManageColumns={() => setColumnsOpen(true)}
          />
        )}
      </div>

      {columnsOpen && (
        <ColumnsDialog
          attributeDefs={attributeDefs}
          players={players}
          onAdd={onAddColumn}
          onRename={onRenameColumn}
          onRemove={onRemoveColumn}
          onClose={() => setColumnsOpen(false)}
        />
      )}
    </section>
  );
}
