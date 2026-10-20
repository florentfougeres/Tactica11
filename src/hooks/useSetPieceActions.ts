import { useEffect, useState } from "react";
import type {
  Drawing,
  Lineup,
  Pos,
  SetPiece,
  SetPieceState,
  SetPieceType,
} from "../types";
import { createSetPiece, uid } from "../storage";

type LineupUpdater = (fn: (l: Lineup) => Lineup) => void;

// Set pieces belong to the compo they're built for (its own on-pitch players
// are what gets proposed), so this hook mutates the active lineup through the
// same `setLineup` the rest of the pitch uses — meaning set-piece edits ride
// along on the main undo/redo stack for free.
export function useSetPieceActions(lineup: Lineup, setLineup: LineupUpdater) {
  const [currentSetPieceId, setCurrentSetPieceId] = useState<string | null>(
    lineup.setPieces[0]?.id ?? null,
  );

  // Switching to a different compo resets the selection to its own list.
  // Deliberately keyed on lineup.id only — depending on lineup.setPieces too
  // would reset the selection back to the first entry on every edit.
  useEffect(() => {
    setCurrentSetPieceId(lineup.setPieces[0]?.id ?? null);
  }, [lineup.id]);

  const currentSetPiece =
    lineup.setPieces.find((sp) => sp.id === currentSetPieceId) ?? null;

  const updateSetPiece = (id: string, fn: (sp: SetPiece) => SetPiece) =>
    setLineup((l) => ({
      ...l,
      setPieces: l.setPieces.map((sp) => (sp.id === id ? fn(sp) : sp)),
    }));

  const newSetPiece = (type: SetPieceType) => {
    const sp = createSetPiece(type, lineup.setPieces.length);
    setLineup((l) => ({ ...l, setPieces: [...l.setPieces, sp] }));
    setCurrentSetPieceId(sp.id);
  };

  const renameSetPiece = (id: string, name: string) =>
    updateSetPiece(id, (sp) => ({ ...sp, name }));

  const setSetPieceType = (id: string, type: SetPieceType) =>
    updateSetPiece(id, (sp) => ({ ...sp, type }));

  const setOpponentColor = (id: string, color: string) =>
    updateSetPiece(id, (sp) => ({ ...sp, opponentColor: color }));

  const setOpponentColor2 = (id: string, color: string | undefined) =>
    updateSetPiece(id, (sp) => ({ ...sp, opponentColor2: color }));

  const duplicateSetPiece = (id: string) => {
    const src = lineup.setPieces.find((sp) => sp.id === id);
    if (!src) return;
    const copy: SetPiece = {
      ...structuredClone(src),
      id: uid("sp"),
      name: `${src.name} (copie)`,
    };
    setLineup((l) => ({ ...l, setPieces: [...l.setPieces, copy] }));
    setCurrentSetPieceId(copy.id);
  };

  const deleteSetPiece = (id: string) => {
    const target = lineup.setPieces.find((sp) => sp.id === id);
    const label = target?.name?.trim() || "cette phase arrêtée";
    if (
      !window.confirm(`Supprimer « ${label} » ? Cette action est définitive.`)
    )
      return;
    const rest = lineup.setPieces.filter((sp) => sp.id !== id);
    setLineup((l) => ({ ...l, setPieces: rest }));
    if (id === currentSetPieceId) setCurrentSetPieceId(rest[0]?.id ?? null);
  };

  const moveBall = (id: string, state: SetPieceState, pos: Pos) =>
    updateSetPiece(id, (sp) => ({ ...sp, ball: { ...sp.ball, [state]: pos } }));

  // Stagger repeated adds inside/near the box so new markers don't stack
  // exactly on top of each other.
  const staggerSpot = (index: number): Pos => ({
    x: 50 + ((index % 5) - 2) * 10,
    y: 65 + Math.floor(index / 5) * 8,
  });

  const addToken = (id: string, playerId: string) =>
    updateSetPiece(id, (sp) => {
      if (sp.tokens.some((t) => t.playerId === playerId)) return sp;
      const spot = staggerSpot(sp.tokens.length);
      return {
        ...sp,
        tokens: [
          ...sp.tokens,
          {
            id: uid("spt"),
            playerId,
            positions: { start: spot, mid: spot, end: spot },
          },
        ],
      };
    });

  const removeToken = (id: string, tokenId: string) =>
    updateSetPiece(id, (sp) => ({
      ...sp,
      tokens: sp.tokens.filter((t) => t.id !== tokenId),
    }));

  const moveToken = (
    id: string,
    tokenId: string,
    state: SetPieceState,
    pos: Pos,
  ) =>
    updateSetPiece(id, (sp) => ({
      ...sp,
      tokens: sp.tokens.map((t) =>
        t.id === tokenId
          ? { ...t, positions: { ...t.positions, [state]: pos } }
          : t,
      ),
    }));

  const addOpponent = (id: string) =>
    updateSetPiece(id, (sp) => {
      const spot = staggerSpot(sp.opponents.length);
      return {
        ...sp,
        opponents: [
          ...sp.opponents,
          {
            id: uid("spo"),
            label: String(sp.opponents.length + 1),
            positions: { start: spot, mid: spot, end: spot },
          },
        ],
      };
    });

  const removeOpponent = (id: string, oppId: string) =>
    updateSetPiece(id, (sp) => ({
      ...sp,
      opponents: sp.opponents.filter((o) => o.id !== oppId),
    }));

  const moveOpponent = (
    id: string,
    oppId: string,
    state: SetPieceState,
    pos: Pos,
  ) =>
    updateSetPiece(id, (sp) => ({
      ...sp,
      opponents: sp.opponents.map((o) =>
        o.id === oppId ? { ...o, positions: { ...o.positions, [state]: pos } } : o,
      ),
    }));

  const labelOpponent = (id: string, oppId: string, label: string) =>
    updateSetPiece(id, (sp) => ({
      ...sp,
      opponents: sp.opponents.map((o) =>
        o.id === oppId ? { ...o, label } : o,
      ),
    }));

  // Lets the user carry a phase's positions forward as a starting point for
  // the next one instead of re-placing everyone from scratch: "mid" copies
  // from "start", "end" copies from "mid". No-op on "start" (nothing before it).
  const PREVIOUS_STATE: Partial<Record<SetPieceState, SetPieceState>> = {
    mid: "start",
    end: "mid",
  };

  const applyPreviousPhase = (id: string, state: SetPieceState) => {
    const prev = PREVIOUS_STATE[state];
    if (!prev) return;
    updateSetPiece(id, (sp) => ({
      ...sp,
      ball: { ...sp.ball, [state]: sp.ball[prev] },
      tokens: sp.tokens.map((t) => ({
        ...t,
        positions: { ...t.positions, [state]: t.positions[prev] },
      })),
      opponents: sp.opponents.map((o) => ({
        ...o,
        positions: { ...o.positions, [state]: o.positions[prev] },
      })),
    }));
  };

  const addDrawing = (id: string, state: SetPieceState, d: Drawing) =>
    updateSetPiece(id, (sp) => ({
      ...sp,
      drawings: {
        ...sp.drawings,
        [state]: [...(sp.drawings?.[state] ?? []), d],
      },
    }));

  const undoDrawing = (id: string, state: SetPieceState) =>
    updateSetPiece(id, (sp) => {
      const cur = sp.drawings?.[state] ?? [];
      if (!cur.length) return sp;
      return { ...sp, drawings: { ...sp.drawings, [state]: cur.slice(0, -1) } };
    });

  const clearDrawings = (id: string, state: SetPieceState) =>
    updateSetPiece(id, (sp) => ({
      ...sp,
      drawings: { ...sp.drawings, [state]: [] },
    }));

  return {
    currentSetPieceId,
    currentSetPiece,
    selectSetPiece: setCurrentSetPieceId,
    newSetPiece,
    renameSetPiece,
    duplicateSetPiece,
    deleteSetPiece,
    setSetPieceType,
    setOpponentColor,
    setOpponentColor2,
    moveBall,
    addToken,
    removeToken,
    moveToken,
    addOpponent,
    removeOpponent,
    moveOpponent,
    labelOpponent,
    applyPreviousPhase,
    addDrawing,
    undoDrawing,
    clearDrawings,
  };
}
