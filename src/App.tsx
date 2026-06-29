import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import type {
  DrawTool,
  Drawing,
  InfluenceMode,
  Lineup,
  Orient,
  Phase,
  Player,
  ZoneRadii,
} from "./types";
import {
  DEFAULT_DRAW_COLOR,
  DEFAULT_OPPONENT_COLOR,
  DRAW_COLORS,
  OPPONENT_COLORS,
  pxToPos,
} from "./types";
import { buildSlots } from "./formations";
import {
  createDefaultLineup,
  createOpponents,
  exportLineup,
  importLineup,
  loadLibrary,
  migrateLineup,
  saveLibrary,
  uid,
} from "./storage";
import Bench from "./components/Bench";
import Pitch from "./components/Pitch";
import TopBar from "./components/TopBar";
import CsvImportDialog from "./components/CsvImportDialog";
import ZonePresets from "./components/ZonePresets";
import { presetsFor, presetRadii } from "./zonePresets";
import { exportPitchPng } from "./exportImage";
import { buildShareUrl, decodeLineup, takeSharedFromUrl } from "./share";
import { useUndoableLineup } from "./useUndoableLineup";
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
  const initialLib = useMemo(() => loadLibrary(), []);
  const [library, setLibrary] = useState<Lineup[]>(initialLib.lineups);
  const { lineup, setLineup, undo, redo, reset, canUndo, canRedo } =
    useUndoableLineup(
      initialLib.lineups.find((l) => l.id === initialLib.currentId) ??
        initialLib.lineups[0],
    );

  const [phase, setPhase] = useState<Phase>("base");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [benchDragging, setBenchDragging] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [influenceMode, setInfluenceMode] = useState<InfluenceMode>("none");
  const [orient, setOrient] = useState<Orient>("portrait");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [presenting, setPresenting] = useState(false);
  // Fullscreen: the controls drawer on the left, collapsed by default.
  const [presentToolsOpen, setPresentToolsOpen] = useState(false);
  // Opponent-placement mode (attack/defense only): shows + lets you drag the
  // opposing discs. Ephemeral view state; the discs themselves are persisted.
  const [opponentMode, setOpponentMode] = useState(false);
  // Pitch view controls (lifted here so they can live in the Effectif panel):
  // the Défense(0)↔Attaque(1) scrub, whether the user is actively scrubbing,
  // and the positional grid overlay.
  const [blend, setBlend] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  // Drawing layer: free-hand annotations stored per phase on the lineup. Tool /
  // colour are ephemeral view state; the strokes themselves are persisted.
  const [drawMode, setDrawMode] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>("arrow");
  const [drawColor, setDrawColor] = useState<string>(DEFAULT_DRAW_COLOR);

  // Keep the scrub in sync when the phase is set from the toggle buttons.
  useEffect(() => {
    if (phase === "attack") setBlend(1);
    else if (phase === "defense") setBlend(0);
  }, [phase]);

  const handleBlend = (v: number) => {
    setBlend(v);
    if (v === 0) setPhase("defense");
    else if (v === 1) setPhase("attack");
  };

  // Fullscreen presentation: hide the panels, fill the screen with the pitch.
  const enterPresent = () => {
    setPresenting(true);
    setPresentToolsOpen(false); // start collapsed in fullscreen
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const exitPresent = () => {
    setPresenting(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  };
  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresenting(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Forget the active preset whenever the selected player changes.
  useEffect(() => {
    setActivePreset(null);
  }, [selectedSlot]);

  const pitchRef = useRef<HTMLDivElement>(null);
  const benchRef = useRef<HTMLElement>(null);

  // If opened on a share link, import the encoded compo as a new entry.
  useEffect(() => {
    const enc = takeSharedFromUrl();
    if (!enc) return;
    const decoded = decodeLineup(enc);
    if (!decoded) return;
    const compo = { ...migrateLineup(decoded), id: uid("lineup") };
    setLibrary((lib) => [...lib, compo]);
    reset(compo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the current compo's library entry in sync (debounced, so a drag burst
  // syncs once), then persist the whole library.
  useEffect(() => {
    const t = setTimeout(() => {
      setLibrary((lib) => lib.map((l) => (l.id === lineup.id ? lineup : l)));
    }, 400);
    return () => clearTimeout(t);
  }, [lineup]);

  useEffect(() => {
    saveLibrary({ lineups: library, currentId: lineup.id });
  }, [library, lineup.id]);

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
  }, [lineup.slots, setLineup]);

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
  const addPlayer = (name: string, number?: number) =>
    setLineup((l) => ({
      ...l,
      players: [
        ...l.players,
        { id: uid("p"), name, ...(number != null ? { number } : {}) },
      ],
    }));

  // Set or clear a player's (optional) shirt number. Pass null to remove it.
  const setPlayerNumber = (id: string, number: number | null) =>
    setLineup((l) => ({
      ...l,
      players: l.players.map((p) => {
        if (p.id !== id) return p;
        if (number == null) {
          const { number: _omit, ...rest } = p;
          return rest;
        }
        return { ...p, number };
      }),
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

  // --- opponents (attack/defense only) ---
  const toggleOpponentMode = () => {
    // Enforce the "11 or nothing" invariant: spawn a fresh block whenever the
    // count isn't exactly 11 (fresh start, or a partial set left by an older
    // version that allowed individual removal).
    if (!opponentMode && (lineup.opponents?.length ?? 0) !== 11)
      setLineup((l) => ({ ...l, opponents: createOpponents() }));
    setOpponentMode((on) => !on);
  };

  const moveOpponent = (id: string, pos: Point) => {
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
  // Conversion is relative to the field of play (.pitch__field, which excludes
  // the grass margin) and respects the current orientation.
  const pointToPitchPct = (point: Point): Point | null => {
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

  // --- file / library ---
  const handleImport = async (file: File) => {
    try {
      const imported = { ...(await importLineup(file)), id: uid("lineup") };
      setLibrary((lib) => [...lib, imported]);
      reset(imported);
      setSelectedSlot(null);
    } catch {
      alert("Impossible de lire ce fichier Tactica11.");
    }
  };

  const openCompo = (id: string) => {
    if (id === lineup.id) return;
    setLibrary((lib) => lib.map((l) => (l.id === lineup.id ? lineup : l)));
    const target = library.find((l) => l.id === id);
    if (target) {
      reset(structuredClone(target));
      setSelectedSlot(null);
    }
  };

  const newCompo = () => {
    const c = createDefaultLineup();
    setLibrary((lib) => [...lib, c]);
    reset(c);
    setSelectedSlot(null);
  };

  const duplicateCompo = () => {
    const c = {
      ...structuredClone(lineup),
      id: uid("lineup"),
      name: `${lineup.name} (copie)`,
    };
    setLibrary((lib) => [...lib, c]);
    reset(c);
    setSelectedSlot(null);
  };

  const deleteCompo = (id: string) => {
    const rest = library.filter((l) => l.id !== id);
    if (rest.length === 0) {
      const def = createDefaultLineup();
      setLibrary([def]);
      reset(def);
    } else {
      setLibrary(rest);
      if (id === lineup.id) reset(structuredClone(rest[0]));
    }
    setSelectedSlot(null);
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(lineup));
    } catch {
      alert("Impossible de copier le lien.");
    }
  };

  // Undo / redo keyboard shortcuts (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "z") return;
      const t = e.target as HTMLElement | null;
      if (t && /^(input|textarea|select)$/i.test(t.tagName)) return;
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

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

  // Influence controls now live in the pitch toolbar (passed as a node) so the
  // Effectif column is purely the roster.
  const selSlot = lineup.slots.find((s) => s.id === selectedSlot) ?? null;
  const selStarter = selSlot ? playerById(selSlot.starterId) : null;
  const INFLUENCE_LABEL: Record<InfluenceMode, string> = {
    none: "Aucune",
    player: "Joueur",
    team: "Équipe",
  };
  // All pitch view controls, pinned at the bottom of the Effectif column so they
  // never overlap or shrink the pitch.
  const pitchControls = (
    <div className="pitch-ctl">
      {phase !== "base" && (
        <div className="pitch-ctl__slider">
          <span>Déf</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={blend}
            aria-label="Transition Défense → Attaque"
            onPointerDown={() => setScrubbing(true)}
            onPointerUp={() => setScrubbing(false)}
            onChange={(e) => handleBlend(Number(e.target.value))}
          />
          <span>Att</span>
        </div>
      )}

      {phase !== "base" && (
        <div className="influence-ctl">
          <span className="influence-ctl__label">Zones d'influence</span>
          <div
            className="influence-mode"
            role="group"
            aria-label="Zones d'influence"
          >
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
          {influenceMode === "player" && selSlot && selStarter && (
            <div className="influence-ctl__roles">
              <ZonePresets
                presets={presetsFor(selSlot.role)}
                activeKey={activePreset}
                onPick={(k) => applyPreset(selSlot.id, k)}
              />
            </div>
          )}
        </div>
      )}

      <label className="pitch-ctl__row">
        <span>Afficher la grille</span>
        <span className="switch">
          <input
            type="checkbox"
            checked={showGrid}
            onChange={(e) => setShowGrid(e.target.checked)}
          />
          <span className="switch__track" />
          <span className="switch__thumb" />
        </span>
      </label>

      <label className="pitch-ctl__row">
        <span>Dessin</span>
        <span className="switch">
          <input
            type="checkbox"
            checked={drawMode}
            onChange={(e) => setDrawMode(e.target.checked)}
          />
          <span className="switch__track" />
          <span className="switch__thumb" />
        </span>
      </label>

      {phase !== "base" && (
        <>
          <label className="pitch-ctl__row">
            <span>Adversaires</span>
            <span className="switch">
              <input
                type="checkbox"
                checked={opponentMode}
                onChange={toggleOpponentMode}
              />
              <span className="switch__track" />
              <span className="switch__thumb" />
            </span>
          </label>
          {opponentMode && (
            <div
              className="opp-colors-row"
              role="group"
              aria-label="Couleur des adversaires"
            >
              {OPPONENT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`opp-swatch ${
                    c === (lineup.opponentColor ?? DEFAULT_OPPONENT_COLOR)
                      ? "is-active"
                      : ""
                  }`}
                  style={{ background: c }}
                  onClick={() => setOpponentColor(c)}
                  aria-label={`Couleur ${c}`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className={`app ${presenting ? "app--present" : ""}`}>
      {presenting && (
        <button className="present-exit" onClick={exitPresent}>
          ✕ Quitter
        </button>
      )}
      {presenting && (
        <div
          className={`present-tools ${presentToolsOpen ? "is-open" : ""}`}
        >
          <button
            className="present-tools__toggle"
            onClick={() => setPresentToolsOpen((o) => !o)}
            aria-expanded={presentToolsOpen}
            title={presentToolsOpen ? "Fermer les outils" : "Ouvrir les outils"}
          >
            {presentToolsOpen ? "✕" : "⚙"}
          </button>
          {presentToolsOpen && (
            <div className="present-tools__panel glass">{pitchControls}</div>
          )}
        </div>
      )}
      <TopBar
        name={lineup.name}
        formation={lineup.formation}
        onPresent={enterPresent}
        compos={library.map((l) => ({ id: l.id, name: l.name }))}
        currentId={lineup.id}
        canUndo={canUndo}
        canRedo={canRedo}
        onName={(name) => setLineup((l) => ({ ...l, name }))}
        onFormation={changeFormation}
        onOpenCompo={openCompo}
        onNewCompo={newCompo}
        onDuplicate={duplicateCompo}
        onDelete={deleteCompo}
        onUndo={undo}
        onRedo={redo}
        onExport={() => exportLineup(lineup)}
        onExportPng={handleExportPng}
        onCopyLink={copyShareLink}
        onImport={handleImport}
      />

      <main className="layout">
        <Bench
          ref={benchRef}
          players={benchPlayers}
          onAdd={addPlayer}
          onRename={renamePlayer}
          onSetNumber={setPlayerNumber}
          onRemove={removePlayer}
          onDropToPitch={handleBenchDrop}
          onDragStateChange={setBenchDragging}
          canDrag={phase === "base"}
          onImportCsv={() => setCsvOpen(true)}
          footer={pitchControls}
        />

        <Pitch
          ref={pitchRef}
          slots={lineup.slots}
          phase={phase}
          playerById={playerById}
          selectedSlot={selectedSlot}
          dropActive={benchDragging}
          influenceMode={influenceMode}
          orient={orient}
          onToggleOrient={() =>
            setOrient((o) => (o === "portrait" ? "landscape" : "portrait"))
          }
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
          onSetNumber={setPlayerNumber}
          onInfluence={setInfluenceManual}
          blend={blend}
          scrubbing={scrubbing}
          showGrid={showGrid}
          opponents={lineup.opponents ?? []}
          opponentMode={opponentMode}
          opponentColor={lineup.opponentColor ?? DEFAULT_OPPONENT_COLOR}
          onMoveOpponent={moveOpponent}
          onLabelOpponent={setOpponentLabel}
          drawMode={drawMode}
          drawTool={drawTool}
          drawColor={drawColor}
          drawColors={DRAW_COLORS}
          drawings={lineup.drawings?.[phase] ?? []}
          onAddDrawing={addDrawing}
          onDrawTool={setDrawTool}
          onDrawColor={setDrawColor}
          onUndoDrawing={undoDrawing}
          onClearDrawings={clearDrawings}
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
