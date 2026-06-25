import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import type { InfluenceMode, Lineup, Phase, Player, ZoneRadii } from "./types";
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
import TopBar from "./components/TopBar";
import CsvImportDialog from "./components/CsvImportDialog";
import ZonePresets from "./components/ZonePresets";
import { presetsFor, presetRadii } from "./zonePresets";
import { exportPitchPng } from "./exportImage";
import type { ImportedPlayer } from "./csv";

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
  const [csvOpen, setCsvOpen] = useState(false);
  const [influenceMode, setInfluenceMode] = useState<InfluenceMode>("none");
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Forget the active preset whenever the selected player changes.
  useEffect(() => {
    setActivePreset(null);
  }, [selectedSlot]);

  const pitchRef = useRef<HTMLDivElement>(null);
  const benchRef = useRef<HTMLElement>(null);

  useEffect(() => {
    saveLineup(lineup);
  }, [lineup]);

  // Invariant: a slot can never hold a sub without a starter (that would render
  // as an empty token with an invisible, trapped player). Auto-promote the sub.
  useEffect(() => {
    if (lineup.slots.some((s) => !s.starterId && s.subId)) {
      setLineup((l) => ({
        ...l,
        slots: l.slots.map((s) =>
          !s.starterId && s.subId
            ? { ...s, starterId: s.subId, subId: null }
            : s,
        ),
      }));
    }
  }, [lineup.slots]);

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

  const addPlayers = (players: ImportedPlayer[]) =>
    setLineup((l) => ({
      ...l,
      players: [
        ...l.players,
        ...players.map((p) => ({
          id: uid("p"),
          name: p.name,
          ...(p.number != null ? { number: p.number } : {}),
        })),
      ],
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
  const moveSlot = (slotId: string, pos: Point) =>
    setLineup((l) => ({
      ...l,
      slots: l.slots.map((s) =>
        s.id === slotId
          ? { ...s, positions: { ...s.positions, [phase]: pos } }
          : s,
      ),
    }));

  // Influence shape is per phase; edits apply to the current (attack/defense) one.
  const setInfluence = (slotId: string, radii: ZoneRadii) =>
    setLineup((l) => ({
      ...l,
      slots: l.slots.map((s) =>
        s.id === slotId
          ? { ...s, influence: { ...s.influence, [phase]: radii } }
          : s,
      ),
    }));

  // Hand-edited via the pitch handles → no longer a named preset.
  const setInfluenceManual = (slotId: string, influence: ZoneRadii) => {
    setActivePreset(null);
    setInfluence(slotId, influence);
  };

  // Apply an EA-FC role preset, mirrored onto the player's flank.
  const applyPreset = (slotId: string, key: string) => {
    const slot = lineup.slots.find((s) => s.id === slotId);
    if (!slot) return;
    const p = presetsFor(slot.role).find((r) => r.key === key);
    if (!p) return;
    const sideLeft = slot.positions[phase].x < 48;
    setActivePreset(key);
    setInfluence(slotId, presetRadii(p.base, sideLeft));
  };

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

  const handleExportPng = async () => {
    const pitchEl = pitchRef.current?.querySelector(".pitch") as HTMLElement | null;
    if (!pitchEl) return;
    setSelectedSlot(null); // drop the selection ring / popover from the capture
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      await exportPitchPng(pitchEl, lineup.name);
    } catch {
      alert("Échec de l'export en image.");
    }
  };

  // Influence controls live at the bottom of the Effectif panel (attack/defense
  // only) so they don't shrink the pitch.
  const selSlot = lineup.slots.find((s) => s.id === selectedSlot) ?? null;
  const selStarter = selSlot ? playerById(selSlot.starterId) : null;
  const INFLUENCE_LABEL: Record<InfluenceMode, string> = {
    none: "Aucune",
    player: "Joueur",
    team: "Équipe",
  };
  const influenceFooter =
    phase === "base" ? undefined : (
      <div className="influence-ctl">
        <span className="influence-ctl__title">Zones d'influence</span>
        <div className="influence-mode" role="group" aria-label="Zones d'influence">
          {(["none", "player", "team"] as InfluenceMode[]).map((m) => (
            <button
              key={m}
              className={`influence-mode__btn ${influenceMode === m ? "is-active" : ""}`}
              onClick={() => setInfluenceMode(m)}
            >
              {INFLUENCE_LABEL[m]}
            </button>
          ))}
        </div>
        {influenceMode === "player" &&
          (selSlot && selStarter ? (
            <div className="influence-ctl__roles">
              <div className="influence-ctl__player">
                {selSlot.role} · {selStarter.name} ·{" "}
                {phase === "attack" ? "Attaque" : "Défense"}
              </div>
              <ZonePresets
                presets={presetsFor(selSlot.role)}
                activeKey={activePreset}
                onPick={(k) => applyPreset(selSlot.id, k)}
              />
            </div>
          ) : (
            <p className="influence-ctl__hint">
              Sélectionne un joueur pour ajuster sa zone.
            </p>
          ))}
        {influenceMode === "team" && (
          <p className="influence-ctl__hint">
            Vert vif = zone bien couverte · terrain sombre = trou.
          </p>
        )}
      </div>
    );

  return (
    <div className="app">
      <TopBar
        name={lineup.name}
        formation={lineup.formation}
        onName={(name) => setLineup((l) => ({ ...l, name }))}
        onFormation={changeFormation}
        onExport={() => exportLineup(lineup)}
        onExportPng={handleExportPng}
        onImport={handleImport}
        onReset={handleReset}
      />

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
          onImportCsv={() => setCsvOpen(true)}
          footer={influenceFooter}
        />

        <Pitch
          ref={pitchRef}
          slots={lineup.slots}
          phase={phase}
          playerById={playerById}
          selectedSlot={selectedSlot}
          dropActive={benchDragging}
          influenceMode={influenceMode}
          onPhase={(p) => {
            setPhase(p);
            setSelectedSlot(null); // roster popover is base-only
          }}
          onSelect={setSelectedSlot}
          onMove={moveSlot}
          onPlayerDrop={handlePlayerDrop}
          onRemoveStarter={removeStarter}
          onRemoveSub={removeSub}
          onSwap={swapStarterSub}
          onInfluence={setInfluenceManual}
        />
      </main>

      {csvOpen && (
        <CsvImportDialog
          onClose={() => setCsvOpen(false)}
          onImport={addPlayers}
        />
      )}
    </div>
  );
}
