import { Fragment } from "react";
import { FOOT_LABEL, type AttributeDef, type Player } from "../../types";
import { NumberBadge, StatusBadge } from "./RosterBits";
import Icon from "../Icon";
import { positionInfo, type Sort, type SortKey, displayName } from "./rosterModel";

interface Props {
  players: Player[]; // already filtered and sorted
  attributeDefs: AttributeDef[];
  sort: Sort;
  onSort: (key: SortKey) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Read-only rows: a click (or Entrée) opens the player's fiche, ↑ ↓ move
// through the list with the fiche following.
export default function RosterTable({
  players,
  attributeDefs,
  sort,
  onSort,
  selectedId,
  onSelect,
}: Props) {
  const head = (key: SortKey, label: string, className?: string) => (
    <th className={className} aria-sort={sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" className="roster-table__sort" onClick={() => onSort(key)}>
        {label}
        {sort.key === key && (
          <span className="roster-table__arrow" aria-hidden="true">
            <Icon name={sort.dir === "asc" ? "chevron-up" : "chevron-down"} size={12} />
          </span>
        )}
      </button>
    </th>
  );

  const move = (from: number, delta: number) => {
    const next = players[from + delta];
    if (!next) return;
    onSelect(next.id);
    document.getElementById(`roster-row-${next.id}`)?.focus();
  };

  return (
    <div className="roster-table__scroll">
      <table className="roster-table">
        <thead>
          <tr>
            {head("number", "#", "roster-table__num")}
            {head("name", "Nom")}
            {head("position", "Poste")}
            {head("status", "Statut")}
            <th className="roster-table__plain">Pied</th>
            {attributeDefs.map((a) => (
              <Fragment key={a.id}>{head(a.id, a.name)}</Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => {
            const pos = positionInfo(p.position);
            return (
              <tr
                key={p.id}
                id={`roster-row-${p.id}`}
                tabIndex={0}
                className={p.id === selectedId ? "is-selected" : undefined}
                aria-selected={p.id === selectedId}
                onClick={() => onSelect(p.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(p.id);
                  } else if (e.key === "ArrowDown") {
                    e.preventDefault();
                    move(i, 1);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    move(i, -1);
                  }
                }}
              >
                <td className="roster-table__num">
                  <NumberBadge player={p} />
                </td>
                <td className="roster-table__name">{displayName(p)}</td>
                <td title={pos?.label}>{pos ? pos.code : <span className="roster-dim">–</span>}</td>
                <td>
                  <StatusBadge player={p} />
                </td>
                <td>{p.foot ? FOOT_LABEL[p.foot] : <span className="roster-dim">–</span>}</td>
                {attributeDefs.map((a) => (
                  <td key={a.id} className={a.type === "number" ? "roster-table__numeric" : undefined}>
                    {p.attributes?.[a.id] ?? <span className="roster-dim">–</span>}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
