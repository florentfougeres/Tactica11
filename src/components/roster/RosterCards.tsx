import { LINE_LABEL, type Player, type PositionLine } from "../../types";
import { NumberBadge, StatusBadge } from "./RosterBits";
import { lineOf, positionInfo, displayName } from "./rosterModel";

interface Props {
  players: Player[]; // already filtered and sorted
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddToLine: (line: PositionLine | null) => void;
}

const LINES: (PositionLine | null)[] = ["gk", "def", "mid", "att", null];

// Team-sheet view: one block per line (gardiens → attaquants), players
// without a position last. Each card opens the fiche.
export default function RosterCards({ players, selectedId, onSelect, onAddToLine }: Props) {
  return (
    <div className="roster-cards">
      {LINES.map((line) => {
        const group = players.filter((p) => lineOf(p) === line);
        if (!group.length && line === null) return null;
        return (
          <section key={line ?? "none"} className="roster-cards__group" aria-label={line ? LINE_LABEL[line] : "Sans poste"}>
            <h3 className="roster-cards__title">
              {line ? LINE_LABEL[line] : "Sans poste"}
              <span>{group.length}</span>
            </h3>
            <div className="roster-cards__grid">
              {group.map((p) => {
                const pos = positionInfo(p.position);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`roster-card${p.id === selectedId ? " is-selected" : ""}${
                      p.status && p.status !== "available" ? " is-unavailable" : ""
                    }`}
                    onClick={() => onSelect(p.id)}
                  >
                    <NumberBadge player={p} large />
                    <span className="roster-card__body">
                      <span className="roster-card__name">{displayName(p)}</span>
                      <span className="roster-card__meta">{pos?.label ?? "Poste à définir"}</span>
                      <StatusBadge player={p} />
                    </span>
                  </button>
                );
              })}
              {line && (
                <button type="button" className="roster-card roster-card--add" onClick={() => onAddToLine(line)}>
                  + Ajouter
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
