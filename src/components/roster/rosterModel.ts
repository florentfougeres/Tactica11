// Shared logic of the Effectif page (the project's whole player base, not
// tied to any compo): filtering and sorting, used by the table and the cards.
import {
  POSITIONS,
  type Player,
  type PlayerPosition,
  type PositionLine,
} from "../../types";

export const displayName = (p: Player) => p.name.trim() || "Sans nom";

export const positionInfo = (code?: PlayerPosition) =>
  POSITIONS.find((p) => p.code === code);

export const lineOf = (p: Player): PositionLine | null =>
  positionInfo(p.position)?.line ?? null;

export type LineFilter = "all" | PositionLine;

export function filterPlayers(
  players: Player[],
  { query, line }: { query: string; line: LineFilter },
): Player[] {
  const q = query.trim().toLocaleLowerCase("fr");
  return players.filter((p) => {
    if (q && !p.name.toLocaleLowerCase("fr").includes(q) && String(p.number ?? "") !== q)
      return false;
    return line === "all" || lineOf(p) === line;
  });
}

export type SortKey = "number" | "name" | "position" | "status" | string; // string = attribute id
export type Sort = { key: SortKey; dir: "asc" | "desc" };

const POSITION_ORDER = new Map(POSITIONS.map((p, i) => [p.code, i]));
const STATUS_ORDER = { available: 0, doubtful: 1, injured: 2, suspended: 3 };

export function sortPlayers(players: Player[], { key, dir }: Sort): Player[] {
  const value = (p: Player): string | number | null => {
    switch (key) {
      case "number":
        return p.number ?? null;
      case "name":
        return p.name;
      case "position":
        return p.position ? POSITION_ORDER.get(p.position)! : null;
      case "status":
        return STATUS_ORDER[p.status ?? "available"];
      default:
        return p.attributes?.[key] ?? null;
    }
  };
  const factor = dir === "asc" ? 1 : -1;
  return [...players].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    // Empty values always last, whatever the direction.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
    return String(av).localeCompare(String(bv), "fr", { numeric: true }) * factor;
  });
}
