// Small pieces shared by the roster table, cards and fiche.
import { STATUS_LABEL, type Player } from "../../types";

export function NumberBadge({ player, large }: { player: Player; large?: boolean }) {
  return (
    <span className={`roster-num${large ? " roster-num--lg" : ""}`} aria-hidden="true">
      {player.number ?? "–"}
    </span>
  );
}

// Nothing for an available player: only what needs attention stands out.
export function StatusBadge({ player }: { player: Player }) {
  const s = player.status;
  if (!s || s === "available") return null;
  return <span className={`roster-status roster-status--${s}`}>{STATUS_LABEL[s]}</span>;
}
