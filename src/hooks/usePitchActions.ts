import type { Dispatch, RefObject, SetStateAction } from "react";
import type { Drawing, Lineup, Orient, Phase, Pos, ZoneRadii } from "../types";
import { pxToPos } from "../types";
import { buildSlots } from "../formations";
import { createOpponents } from "../storage";

type LineupUpdater = (fn: (l: Lineup) => Lineup) => void;

interface Args {
  lineup: Lineup;
  setLineup: LineupUpdater;
  phase: Phase;
  orient: Orient;
  pitchRef: RefObject<HTMLDivElement | null>;
  benchRef: RefObject<HTMLElement | null>;
  opponentMode: boolean;
  setOpponentMode: Dispatch<SetStateAction<boolean>>;
  setSelectedSlot: Dispatch<SetStateAction<string | null>>;
}

function pointInRect(p: Pos, el: HTMLElement | null): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const px = p.x - window.scrollX;
  const py = p.y - window.scrollY;
  return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
}

// The main pitch's lineup mutations: formation/slot placement, opponents,
// drawings and drag-and-drop. Mirrors useSetPieceActions.ts's shape, but
// operates directly on the lineup (rather than on one of its set pieces) and
// on the main phase (rather than a set-piece state).
export function usePitchActions({
  lineup,
  setLineup,
  phase,
  orient,
  pitchRef,
  benchRef,
  opponentMode,
  setOpponentMode,
  setSelectedSlot,
}: Args) {
  // --- formation / phase ---
  const changeFormation = (formation: string) =>
    setLineup((l) => {
      const fresh = buildSlots(formation);
      // Reuse the existing slot ids so the PitchToken instances persist and
      // spring to their new positions (instead of remounting with no animation).
      const slots = fresh.map((s, i) => ({
        ...s,
        id: l.slots[i]?.id ?? s.id,
        starterId: l.slots[i]?.starterId ?? null,
        subId: l.slots[i]?.subId ?? null,
        influence: l.slots[i]?.influence,
      }));
      return { ...l, formation, slots };
    });

  // --- pitch interactions ---
  const moveSlot = (slotId: string, pos: Pos) =>
    setLineup((l) => ({
      ...l,
      slots: l.slots.map((s) =>
        s.id === slotId
          ? { ...s, positions: { ...s.positions, [phase]: pos } }
          : s,
      ),
    }));

  // Free-text role label, edited per phase (attack/defense only — base always
  // shows the formation's role). Clearing the text removes the override.
  const setRoleLabel = (slotId: string, text: string) =>
    setLineup((l) => ({
      ...l,
      slots: l.slots.map((s) => {
        if (s.id !== slotId) return s;
        const trimmed = text.trim();
        const next = { ...s.roleLabels };
        if (trimmed) next[phase] = trimmed;
        else delete next[phase];
        return { ...s, roleLabels: next };
      }),
    }));

  // Mirror the current phase left↔right (x → 100 − x): players, their influence
  // shape, opponents and drawings. Base is the locked template, so skip it.
  const mirrorPhase = () => {
    if (phase === "base") return;
    const ph = phase as "attack" | "defense";
    const mx = (p: Pos): Pos => ({ x: 100 - p.x, y: p.y });
    const mirrorRadii = (r: ZoneRadii): ZoneRadii => ({
      ...r,
      left: r.right,
      right: r.left,
    });
    setLineup((l) => ({
      ...l,
      slots: l.slots.map((s) => ({
        ...s,
        positions: { ...s.positions, [ph]: mx(s.positions[ph]) },
        influence: s.influence?.[ph]
          ? { ...s.influence, [ph]: mirrorRadii(s.influence[ph]!) }
          : s.influence,
      })),
      opponents: (l.opponents ?? []).map((o) => ({
        ...o,
        positions: { ...o.positions, [ph]: mx(o.positions[ph]) },
      })),
      drawings: {
        ...l.drawings,
        [ph]: (l.drawings?.[ph] ?? []).map((d) => ({
          ...d,
          points: d.points.map(mx),
        })),
      },
    }));
  };

  // Reset the current phase's player positions back to the formation-derived
  // shape (handy after dragging the block around). Players/opponents/drawings of
  // other phases are untouched. Base is locked, so skip it.
  const resetPhase = () => {
    if (phase === "base") return;
    const ph = phase as "attack" | "defense";
    const fresh = buildSlots(lineup.formation);
    setLineup((l) => ({
      ...l,
      slots: l.slots.map((s, i) => {
        const def = fresh[i]?.positions[ph];
        return def ? { ...s, positions: { ...s.positions, [ph]: def } } : s;
      }),
    }));
  };

  // --- opponents (attack/defense only) ---
  const toggleOpponentMode = () => {
    // Enforce the "11 or nothing" invariant: spawn a fresh block whenever the
    // count isn't exactly 11 (fresh start, or a partial set left by an older
    // version that allowed individual removal).
    if (!opponentMode && (lineup.opponents?.length ?? 0) !== 11)
      setLineup((l) => ({ ...l, opponents: createOpponents() }));
    setOpponentMode((on) => !on);
  };

  const moveOpponent = (id: string, pos: Pos) => {
    if (phase === "base") return; // opponents live only in attack/defense
    setLineup((l) => ({
      ...l,
      opponents: (l.opponents ?? []).map((o) =>
        o.id === id ? { ...o, positions: { ...o.positions, [phase]: pos } } : o,
      ),
    }));
  };

  const setOpponentLabel = (id: string, label: string) =>
    setLineup((l) => ({
      ...l,
      opponents: (l.opponents ?? []).map((o) =>
        o.id === id ? { ...o, label } : o,
      ),
    }));

  const setOpponentColor = (color: string) =>
    setLineup((l) => ({ ...l, opponentColor: color }));

  // --- drawings (per phase) ---
  const addDrawing = (d: Drawing) =>
    setLineup((l) => ({
      ...l,
      drawings: { ...l.drawings, [phase]: [...(l.drawings?.[phase] ?? []), d] },
    }));

  const undoDrawing = () =>
    setLineup((l) => {
      const cur = l.drawings?.[phase] ?? [];
      if (!cur.length) return l;
      return { ...l, drawings: { ...l.drawings, [phase]: cur.slice(0, -1) } };
    });

  const clearDrawings = () =>
    setLineup((l) => ({ ...l, drawings: { ...l.drawings, [phase]: [] } }));

  // Pixel → pitch-percent helper for a drop point. Returns null if outside.
  // Conversion is relative to the field of play (.pitch__field, which excludes
  // the grass margin) and respects the current orientation.
  const pointToPitchPct = (point: Pos): Pos | null => {
    const pitchEl = pitchRef.current?.querySelector(".pitch") as HTMLElement | null;
    if (!pointInRect(point, pitchEl)) return null;
    const fieldEl = pitchRef.current?.querySelector(
      ".pitch__field",
    ) as HTMLElement | null;
    if (!fieldEl) return null;
    const r = fieldEl.getBoundingClientRect();
    const fx = point.x - window.scrollX - r.left;
    const fy = point.y - window.scrollY - r.top;
    return pxToPos(fx, fy, { w: r.width, h: r.height }, orient);
  };

  // Base phase only: a starter token was dragged. Drop on the bench → send the
  // player back. Drop near another slot → move there, swapping if it's occupied.
  const handlePlayerDrop = (slotId: string, point: Pos) => {
    if (phase !== "base") return;
    if (pointInRect(point, benchRef.current)) {
      removeStarter(slotId);
      setSelectedSlot(null);
      return;
    }
    const pct = pointToPitchPct(point);
    if (!pct) return;
    setLineup((l) => {
      const src = l.slots.find((s) => s.id === slotId);
      if (!src || !src.starterId) return l;
      const dist = (s: (typeof l.slots)[number]) =>
        (s.positions[phase].x - pct.x) ** 2 + (s.positions[phase].y - pct.y) ** 2;
      const target = l.slots.reduce((a, b) => (dist(a) < dist(b) ? a : b));
      if (target.id === slotId) return l; // dropped back on itself
      const srcPlayer = src.starterId;
      const tgtPlayer = target.starterId;
      return {
        ...l,
        slots: l.slots.map((s) => {
          if (s.id === slotId) {
            // occupied target → swap; empty target → promote our sub (if any)
            return tgtPlayer
              ? { ...s, starterId: tgtPlayer }
              : { ...s, starterId: s.subId, subId: null };
          }
          if (s.id === target.id) return { ...s, starterId: srcPlayer };
          return s;
        }),
      };
    });
    setSelectedSlot(null);
  };

  // Drop a bench player onto the pitch (base phase only). Target = nearest slot.
  // Cascade: empty starter → empty sub → otherwise replace the starter.
  const handleBenchDrop = (playerId: string, point: Pos) => {
    if (phase !== "base") return;
    const pct = pointToPitchPct(point);
    if (!pct) return;

    setLineup((l) => {
      const dist = (s: (typeof l.slots)[number]) => {
        const pos = s.positions[phase];
        return (pos.x - pct.x) ** 2 + (pos.y - pct.y) ** 2;
      };
      const target = l.slots.reduce((a, b) => (dist(a) < dist(b) ? a : b));
      return {
        ...l,
        slots: l.slots.map((s) => {
          if (s.id !== target.id) return s;
          if (!s.starterId) return { ...s, starterId: playerId };
          if (!s.subId) return { ...s, subId: playerId };
          return { ...s, starterId: playerId }; // replace starter
        }),
      };
    });
    setSelectedSlot(null);
  };

  // --- slot management (popover) ---
  const removeStarter = (slotId: string) =>
    setLineup((l) => ({
      ...l,
      slots: l.slots.map((s) =>
        s.id === slotId
          ? { ...s, starterId: s.subId, subId: null } // promote sub if any
          : s,
      ),
    }));

  const removeSub = (slotId: string) =>
    setLineup((l) => ({
      ...l,
      slots: l.slots.map((s) =>
        s.id === slotId ? { ...s, subId: null } : s,
      ),
    }));

  const swapStarterSub = (slotId: string) =>
    setLineup((l) => ({
      ...l,
      slots: l.slots.map((s) =>
        s.id === slotId
          ? { ...s, starterId: s.subId, subId: s.starterId }
          : s,
      ),
    }));

  return {
    changeFormation,
    moveSlot,
    setRoleLabel,
    mirrorPhase,
    resetPhase,
    toggleOpponentMode,
    moveOpponent,
    setOpponentLabel,
    setOpponentColor,
    addDrawing,
    undoDrawing,
    clearDrawings,
    handlePlayerDrop,
    handleBenchDrop,
    removeStarter,
    removeSub,
    swapStarterSub,
  };
}
