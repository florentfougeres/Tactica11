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

  // Quick-create from an empty pitch slot (base mode): mint a player with a
  // name and/or shirt number and drop it straight into the slot as starter,
  // skipping the roster tab.
  const createPlayerInSlot = (slotId: string, name: string, number?: number) => {
    const id = uid("p");
    updateProject((p) => ({
      ...p,
      players: [
        ...p.players,
        { id, name, ...(number != null ? { number } : {}) },
      ],
    }));
    setLineup((l) => ({
      ...l,
      slots: l.slots.map((s) =>
        s.id === slotId ? { ...s, starterId: id } : s,
      ),
    }));
  };

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

  // Extra CSV columns (beyond name/number) are matched to an existing
  // roster attribute column by name, or create a new one on the fly.
  const addPlayers = (players: ImportedPlayer[]) =>
    updateProject((p) => {
      const attributeDefs = [...p.attributeDefs];
      const attrIdForLabel = (label: string, type: AttrType): string => {
        const existing = attributeDefs.find(
          (d) => d.name.trim().toLowerCase() === label.trim().toLowerCase(),
        );
        if (existing) return existing.id;
        const def = { id: uid("attr"), name: label, type };
        attributeDefs.push(def);
        return def.id;
      };

      const newPlayers = players.map((pl) => {
        let attributes: Record<string, string | number> | undefined;
        if (pl.attributes) {
          attributes = {};
          for (const [label, value] of Object.entries(pl.attributes)) {
            const type: AttrType = typeof value === "number" ? "number" : "text";
            attributes[attrIdForLabel(label, type)] = value;
          }
        }
        return {
          id: uid("p"),
          name: pl.name,
          ...(pl.number != null ? { number: pl.number } : {}),
          ...(attributes ? { attributes } : {}),
        };
      });

      return { ...p, attributeDefs, players: [...p.players, ...newPlayers] };
    });

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
    createPlayerInSlot,
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
