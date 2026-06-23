import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import type { Lineup, Phase, Player } from "./types";
import { buildSlots } from "./formations";
import {
  createDefaultLineup,
  exportLineup,
  importLineup,
  loadLineup,
  saveLineup,
  uid,
} from "./storage";
import Bench from "./components/Bench";
import Pitch from "./components/Pitch";
import Sidebar from "./components/Sidebar";

type Point = { x: number; y: number };

function pointInRect(p: Point, el: HTMLElement | null): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const px = p.x - window.scrollX;
  const py = p.y - window.scrollY;
  return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
}

export default function App() {
  const [lineup, setLineup] = useState<Lineup>(() => loadLineup());
  const [phase, setPhase] = useState<Phase>("base");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [benchDragging, setBenchDragging] = useState(false);

  const pitchRef = useRef<HTMLDivElement>(null);
  const benchRef = useRef<HTMLElement>(null);

  useEffect(() => {
    saveLineup(lineup);
  }, [lineup]);

  const playerMap = useMemo(() => {
    const m = new Map<string, Player>();
    lineup.players.forEach((p) => m.set(p.id, p));
    return m;
  }, [lineup.players]);

  const playerById = useCallback(
    (id: string | null) => (id ? playerMap.get(id) ?? null : null),
    [playerMap],
  );

  const assignedIds = useMemo(() => {
    const s = new Set<string>();
    lineup.slots.forEach((slot) => {
      if (slot.starterId) s.add(slot.starterId);
      if (slot.subId) s.add(slot.subId);
    });
    return s;
  }, [lineup.slots]);

  const benchPlayers = useMemo(
    () => lineup.players.filter((p) => !assignedIds.has(p.id)),
    [lineup.players, assignedIds],
  );

  // --- roster ---
  const addPlayer = (name: string) =>
    setLineup((l) => ({
      ...l,
      players: [...l.players, { id: uid("p"), name }],
    }));

  const renamePlayer = (id: string, name: string) =>
    setLineup((l) => ({
      ...l,
      players: l.players.map((p) => (p.id === id ? { ...p, name } : p)),
    }));

  const removePlayer = (id: string) =>
    setLineup((l) => ({
      ...l,
      players: l.players.filter((p) => p.id !== id),
      slots: l.slots.map((s) => ({
        ...s,
        starterId: s.starterId === id ? null : s.starterId,
        subId: s.subId === id ? null : s.subId,
      })),
    }));

  // --- formation / phase ---
  const changeFormation = (formation: string) =>
    setLineup((l) => {
      const fresh = buildSlots(formation);
      const slots = fresh.map((s, i) => ({
        ...s,
        starterId: l.slots[i]?.starterId ?? null,
        subId: l.slots[i]?.subId ?? null,
      }));
      return { ...l, formation, slots };
    });

  // --- pitch interactions ---
  const moveSlot = (slotId: string, pos: Point) =>
    setLineup((l) => ({
      ...l,
      slots: l.slots.map((s) =>
        s.id === slotId
          ? { ...s, positions: { ...s.positions, [phase]: pos } }
          : s,
      ),
    }));

  // Pixel → pitch-percent helper for a drop point. Returns null if outside.
  const pointToPitchPct = (point: Point): Point | null => {
    const pitchEl = pitchRef.current?.querySelector(".pitch") as HTMLElement | null;
    if (!pointInRect(point, pitchEl)) return null;
    const r = pitchEl!.getBoundingClientRect();
    return {
      x: ((point.x - window.scrollX - r.left) / r.width) * 100,
      y: ((point.y - window.scrollY - r.top) / r.height) * 100,
    };
  };

  // Base phase only: a starter token was dragged. Drop on the bench → send the
  // player back. Drop near another slot → move there, swapping if it's occupied.
  const handlePlayerDrop = (slotId: string, point: Point) => {
    if (phase !== "base") return;
    if (pointInRect(point, benchRef.current)) {
      removeStarter(slotId);
      setSelectedSlot(null);
      return;
    }
    const pct = pointToPitchPct(point);
    if (!pct) return;
    console.log("[drop] " + JSON.stringify({ slotId, point, pct }));
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
  const handleBenchDrop = (playerId: string, point: Point) => {
    if (phase !== "base") return;
    const pitchEl = pitchRef.current?.querySelector(".pitch") as HTMLElement | null;
    if (!pointInRect(point, pitchEl)) return;
    const r = pitchEl!.getBoundingClientRect();
    const px = ((point.x - window.scrollX - r.left) / r.width) * 100;
    const py = ((point.y - window.scrollY - r.top) / r.height) * 100;

    setLineup((l) => {
      const dist = (s: (typeof l.slots)[number]) => {
        const pos = s.positions[phase];
        return (pos.x - px) ** 2 + (pos.y - py) ** 2;
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

  // --- file / reset ---
  const handleImport = async (file: File) => {
    try {
      const imported = await importLineup(file);
      setLineup(imported);
      setSelectedSlot(null);
    } catch {
      alert("Impossible de lire ce fichier Tactica11.");
    }
  };

  const handleReset = () => {
    if (confirm("Créer une nouvelle compo ? La compo actuelle sera remplacée."))
      setLineup(createDefaultLineup());
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">⬡</span>
          <span className="brand__name">
            Tactica<span className="brand__accent">11</span>
          </span>
        </div>
        <div className="topbar__title">{lineup.name}</div>
        <div className="topbar__meta">{lineup.formation}</div>
      </header>

      <main className="layout">
        <Bench
          ref={benchRef}
          players={benchPlayers}
          onAdd={addPlayer}
          onRename={renamePlayer}
          onRemove={removePlayer}
          onDropToPitch={handleBenchDrop}
          onDragStateChange={setBenchDragging}
          canDrag={phase === "base"}
        />

        <Pitch
          ref={pitchRef}
          slots={lineup.slots}
          phase={phase}
          playerById={playerById}
          selectedSlot={selectedSlot}
          dropActive={benchDragging}
          onSelect={setSelectedSlot}
          onMove={moveSlot}
          onPlayerDrop={handlePlayerDrop}
          onRemoveStarter={removeStarter}
          onRemoveSub={removeSub}
          onSwap={swapStarterSub}
        />

        <Sidebar
          name={lineup.name}
          formation={lineup.formation}
          phase={phase}
          onName={(name) => setLineup((l) => ({ ...l, name }))}
          onFormation={changeFormation}
          onPhase={(p) => {
            setPhase(p);
            setSelectedSlot(null); // roster popover is base-only
          }}
          onExport={() => exportLineup(lineup)}
          onImport={handleImport}
          onReset={handleReset}
        />
      </main>
    </div>
  );
}
