import type { AttrType, Lineup, Project } from "../types";
import { uid } from "../storage";
import type { ImportedPlayer } from "../csv";

type ProjectUpdater = (fn: (p: Project) => Project) => void;
type LineupUpdater = (fn: (l: Lineup) => Lineup) => void;

// Player roster + custom attribute columns, shared across every compo in the
// current project.
export function usePlayerRoster(
  updateProject: ProjectUpdater,
  setLineup: LineupUpdater,
) {
  const addPlayer = (name: string, number?: number) =>
    updateProject((p) => ({
      ...p,
      players: [
        ...p.players,
        { id: uid("p"), name, ...(number != null ? { number } : {}) },
      ],
    }));

  // Set or clear a player's (optional) shirt number. Pass null to remove it.
  const setPlayerNumber = (id: string, number: number | null) =>
    updateProject((p) => ({
      ...p,
      players: p.players.map((pl) => {
        if (pl.id !== id) return pl;
        if (number == null) {
          const { number: _omit, ...rest } = pl;
          return rest;
        }
        return { ...pl, number };
      }),
    }));

  const addPlayers = (players: ImportedPlayer[]) =>
    updateProject((p) => ({
      ...p,
      players: [
        ...p.players,
        ...players.map((pl) => ({
          id: uid("p"),
          name: pl.name,
          ...(pl.number != null ? { number: pl.number } : {}),
        })),
      ],
    }));

  const renamePlayer = (id: string, name: string) =>
    updateProject((p) => ({
      ...p,
      players: p.players.map((pl) => (pl.id === id ? { ...pl, name } : pl)),
    }));

  // Removing a player clears its reference from every slot of every compo in
  // the project (the roster is shared), not just the one currently open. The
  // currently-open compo also needs a direct write, since it only lives in
  // `project.lineups` once the debounced sync effect folds it back in. Set
  // pieces hold a bare `playerId` on their tokens (no "empty" state to fall
  // back to like a slot), so a removed player's tokens are dropped outright.
  const removePlayer = (id: string) => {
    const clearSlots = (slots: Lineup["slots"]) =>
      slots.map((s) => ({
        ...s,
        starterId: s.starterId === id ? null : s.starterId,
        subId: s.subId === id ? null : s.subId,
      }));
    const clearSetPieces = (setPieces: Lineup["setPieces"]) =>
      setPieces.map((sp) => ({
        ...sp,
        tokens: sp.tokens.filter((t) => t.playerId !== id),
      }));
    updateProject((p) => ({
      ...p,
      players: p.players.filter((pl) => pl.id !== id),
      lineups: p.lineups.map((l) => ({
        ...l,
        slots: clearSlots(l.slots),
        setPieces: clearSetPieces(l.setPieces),
      })),
    }));
    setLineup((l) => ({
      ...l,
      slots: clearSlots(l.slots),
      setPieces: clearSetPieces(l.setPieces),
    }));
  };

  // Set/clear a custom attribute value for a player. Pass null to remove it.
  const setAttribute = (
    id: string,
    attrId: string,
    value: string | number | null,
  ) =>
    updateProject((p) => ({
      ...p,
      players: p.players.map((pl) => {
        if (pl.id !== id) return pl;
        const attributes = { ...pl.attributes };
        if (value == null) delete attributes[attrId];
        else attributes[attrId] = value;
        return { ...pl, attributes };
      }),
    }));

  const addColumn = (name: string, type: AttrType) =>
    updateProject((p) => ({
      ...p,
      attributeDefs: [...p.attributeDefs, { id: uid("attr"), name, type }],
    }));

  const renameColumn = (attrId: string, name: string) =>
    updateProject((p) => ({
      ...p,
      attributeDefs: p.attributeDefs.map((d) =>
        d.id === attrId ? { ...d, name } : d,
      ),
    }));

  const removeColumn = (attrId: string) =>
    updateProject((p) => ({
      ...p,
      attributeDefs: p.attributeDefs.filter((d) => d.id !== attrId),
      players: p.players.map((pl) => {
        if (!pl.attributes || !(attrId in pl.attributes)) return pl;
        const attributes = { ...pl.attributes };
        delete attributes[attrId];
        return { ...pl, attributes };
      }),
    }));

  return {
    addPlayer,
    setPlayerNumber,
    addPlayers,
    renamePlayer,
    removePlayer,
    setAttribute,
    addColumn,
    renameColumn,
    removeColumn,
  };
}
