import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import type {
  DrawTool,
  Drawing,
  InfluenceMode,
  Orient,
  Phase,
  Player,
  SetPieceState,
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
import { createOpponents, loadLibrary } from "./storage";
import Bench from "./components/Bench";
import Pitch from "./components/Pitch";
import TopBar from "./components/TopBar";
import CsvImportDialog from "./components/CsvImportDialog";
import RosterTable from "./components/RosterTable";
import ViewTabs, { type View } from "./components/ViewTabs";
import PhaseToggle from "./components/PhaseToggle";
import Onboarding from "./components/Onboarding";
import ZonePresets from "./components/ZonePresets";
import { presetsFor, presetRadii } from "./zonePresets";
import { exportPitchPng } from "./exportImage";
import { useUndoableLineup } from "./useUndoableLineup";
import { useOnboarding } from "./hooks/useOnboarding";
import { useTheme } from "./hooks/useTheme";
import { usePresentation } from "./hooks/usePresentation";
import { useShareLink } from "./hooks/useShareLink";
import { usePlayerRoster } from "./hooks/usePlayerRoster";
import { useProjectStore } from "./hooks/useProjectStore";
import { useProjectActions } from "./hooks/useProjectActions";
import { useSetPieceActions } from "./hooks/useSetPieceActions";
import { useStudio } from "./hooks/useStudio";
import SetPieceView from "./components/SetPieceView";
import StudioView from "./components/StudioView";

type Point = { x: number; y: number };

// French phase labels, used to suffix exported PNG filenames.
const PHASE_LABEL: Record<Phase, string> = {
  base: "base",
  attack: "attaque",
  defense: "defense",
};

function pointInRect(p: Point, el: HTMLElement | null): boolean {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const px = p.x - window.scrollX;
  const py = p.y - window.scrollY;
  return px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
}

export default function App() {
  const initialLib = useMemo(() => loadLibrary(), []);
  const {
    projects,
    setProjects,
    currentProjectId,
    setCurrentProjectId,
    project,
    updateProject,
  } = useProjectStore(initialLib);
  const { lineup, setLineup, undo, redo, reset, canUndo, canRedo } =
    useUndoableLineup(
      project.lineups.find((l) => l.id === project.currentLineupId) ??
        project.lineups[0],
    );

  const [view, setView] = useState<View>("pitch");
  const [phase, setPhase] = useState<Phase>("base");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [benchDragging, setBenchDragging] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const { onboardOpen, openOnboarding, closeOnboarding } = useOnboarding();
  const { theme, toggleTheme } = useTheme();
  const [influenceMode, setInfluenceMode] = useState<InfluenceMode>("none");
  const [orient, setOrient] = useState<Orient>("portrait");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  // Opponent-placement mode (attack/defense only): shows + lets you drag the
  // opposing discs. Ephemeral view state; the discs themselves are persisted.
  const [opponentMode, setOpponentMode] = useState(false);
  // Pitch view controls (lifted here so they can live in the Effectif panel):
  // the Défense(0)↔Attaque(1) scrub, whether the user is actively scrubbing,
  // and the positional grid overlay.
  const [blend, setBlend] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  // Base-only display toggle: swap which label rides the main disc (role vs
  // shirt number). Purely a view preference, not persisted with the lineup.
  const [showNumbers, setShowNumbers] = useState(false);
  // Drawing layer: free-hand annotations stored per phase on the lineup. Tool /
  // colour are ephemeral view state; the strokes themselves are persisted.
  const [drawMode, setDrawMode] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>("arrow");
  const [drawColor, setDrawColor] = useState<string>(DEFAULT_DRAW_COLOR);

  // Set-piece editor: compo-scoped (see useSetPieceActions) — edits go through
  // setLineup, so they ride the main undo/redo stack. Its own ephemeral view
  // state (which state is being edited, the Début↔Fin scrub, opponent/draw
  // modes, poste/numéro) mirrors the main pitch's phase/blend/opponentMode/
  // drawMode/showNumbers, but kept separate since the two boards are independent.
  const setPieceActions = useSetPieceActions(lineup, setLineup);
  const [spState, setSpState] = useState<SetPieceState>("start");
  const [spBlend, setSpBlend] = useState(0);
  const [spScrubbing, setSpScrubbing] = useState(false);
  const [spOpponentMode, setSpOpponentMode] = useState(false);
  const [spShowNumbers, setSpShowNumbers] = useState(false);
  const [spDrawMode, setSpDrawMode] = useState(false);
  const [spDrawTool, setSpDrawTool] = useState<DrawTool>("arrow");
  const [spDrawColor, setSpDrawColor] = useState<string>(DEFAULT_DRAW_COLOR);

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

  const handlePhase = (p: Phase) => {
    setPhase(p);
    setSelectedSlot(null); // roster popover is base-only
  };

  // Fullscreen presentation: hide the panels, fill the screen with the pitch.
  // Presentation always shows the tactical board, not the roster page.
  const {
    presenting,
    presentToolsOpen,
    setPresentToolsOpen,
    enterPresent,
    exitPresent,
  } = usePresentation(() => setView("pitch"));

  // Studio: a separate fullscreen mode for exporting a stylised, shareable
  // poster of the base lineup — see useStudio.ts for why its settings live
  // outside Lineup (keeps kit-colour tweaking out of the undo/redo history).
  const { studioOpen, openStudio, closeStudio, studioSettings, patchStudioSettings } =
    useStudio();

  // Forget the active preset whenever the selected player changes.
  useEffect(() => {
    setActivePreset(null);
  }, [selectedSlot]);

  const pitchRef = useRef<HTMLDivElement>(null);
  const benchRef = useRef<HTMLElement>(null);

  // Share-link import (on mount) + "copy share link" for the current compo.
  const { copyShareLink } = useShareLink(project, lineup, setProjects, reset);

  // Project- and compo-level actions (create/open/duplicate/delete, .json
  // import/export) plus the debounced sync of the actively-edited compo back
  // into its project's lineups.
  const {
    openCompo,
    newCompo,
    duplicateCompo,
    deleteCompo,
    setProjectName,
    openProject,
    newProject,
    duplicateProject,
    deleteProject,
    saveProject,
    openProjectFile,
  } = useProjectActions({
    projects,
    setProjects,
    project,
    currentProjectId,
    setCurrentProjectId,
    updateProject,
    lineup,
    reset,
    setSelectedSlot,
  });

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
    project.players.forEach((p) => m.set(p.id, p));
    return m;
  }, [project.players]);

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
    () => project.players.filter((p) => !assignedIds.has(p.id)),
    [project.players, assignedIds],
  );

  // --- roster (shared across every compo in the current project) ---
  const {
    addPlayer,
    setPlayerNumber,
    addPlayers,
    renamePlayer,
    removePlayer,
    setAttribute,
    addColumn,
    renameColumn,
    removeColumn,
  } = usePlayerRoster(updateProject, setLineup);

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
    const mx = (p: Point): Point => ({ x: 100 - p.x, y: p.y });
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
      await exportPitchPng(pitchEl, lineup.name, PHASE_LABEL[phase]);
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
        <div className="pitch-ctl__actions">
          <button
            type="button"
            className="pitch-ctl__btn"
            onClick={mirrorPhase}
            title="Inverser gauche / droite pour cette phase"
          >
            ⇄ Miroir G/D
          </button>
          <button
            type="button"
            className="pitch-ctl__btn"
            onClick={resetPhase}
            title="Replacer les joueurs selon la formation"
          >
            ↺ Réinitialiser
          </button>
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

      {phase === "base" && (
        <label className="pitch-ctl__row">
          <span>Afficher les numéros</span>
          <span className="switch">
            <input
              type="checkbox"
              checked={showNumbers}
              onChange={(e) => setShowNumbers(e.target.checked)}
            />
            <span className="switch__track" />
            <span className="switch__thumb" />
          </span>
        </label>
      )}

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
        view={view}
        phase={phase}
        name={lineup.name}
        formation={lineup.formation}
        onPresent={enterPresent}
        onStudio={openStudio}
        onHelp={openOnboarding}
        theme={theme}
        onToggleTheme={toggleTheme}
        compos={project.lineups.map((l) => ({ id: l.id, name: l.name }))}
        currentId={lineup.id}
        projectName={project.name}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        currentProjectId={project.id}
        canUndo={canUndo}
        canRedo={canRedo}
        onName={(name) => setLineup((l) => ({ ...l, name }))}
        onFormation={changeFormation}
        onOpenCompo={openCompo}
        onNewCompo={newCompo}
        onDuplicate={duplicateCompo}
        onDelete={deleteCompo}
        onProjectName={setProjectName}
        onOpenProject={openProject}
        onNewProject={newProject}
        onDuplicateProject={duplicateProject}
        onDeleteProject={deleteProject}
        onUndo={undo}
        onRedo={redo}
        onExportPng={handleExportPng}
        onCopyLink={copyShareLink}
        onSaveProject={saveProject}
        onImportProject={openProjectFile}
      />

      {!presenting && (
        <div className="view-row">
          <ViewTabs view={view} onView={setView} />
          {view === "pitch" && (
            <div className="view-row__phase">
              <PhaseToggle phase={phase} onPhase={handlePhase} />
            </div>
          )}
        </div>
      )}

      <main className="layout">
        {view === "roster" ? (
          <RosterTable
            players={project.players}
            attributeDefs={project.attributeDefs}
            onAddPlayer={addPlayer}
            onRenamePlayer={renamePlayer}
            onSetNumber={setPlayerNumber}
            onSetAttribute={setAttribute}
            onRemovePlayer={removePlayer}
            onAddColumn={addColumn}
            onRenameColumn={renameColumn}
            onRemoveColumn={removeColumn}
            onImportCsv={() => setCsvOpen(true)}
          />
        ) : view === "setpiece" ? (
          <SetPieceView
            lineup={lineup}
            playerById={playerById}
            sp={setPieceActions}
            state={spState}
            onStateChange={setSpState}
            blend={spBlend}
            onBlend={setSpBlend}
            scrubbing={spScrubbing}
            onScrubbing={setSpScrubbing}
            opponentMode={spOpponentMode}
            onOpponentMode={setSpOpponentMode}
            showNumbers={spShowNumbers}
            onShowNumbers={setSpShowNumbers}
            drawMode={spDrawMode}
            onDrawMode={setSpDrawMode}
            drawTool={spDrawTool}
            onDrawTool={setSpDrawTool}
            drawColor={spDrawColor}
            onDrawColor={setSpDrawColor}
          />
        ) : (
          <>
            <Bench
              ref={benchRef}
              players={benchPlayers}
              onRename={renamePlayer}
              onSetNumber={setPlayerNumber}
              onRemove={removePlayer}
              onDropToPitch={handleBenchDrop}
              onDragStateChange={setBenchDragging}
              canDrag={phase === "base"}
              footer={pitchControls}
            />

            <Pitch
              ref={pitchRef}
              slots={lineup.slots}
              phase={phase}
              showPhaseToggle={presenting}
              playerById={playerById}
              selectedSlot={selectedSlot}
              dropActive={benchDragging}
              influenceMode={influenceMode}
              orient={orient}
              onToggleOrient={() =>
                setOrient((o) => (o === "portrait" ? "landscape" : "portrait"))
              }
              onPhase={handlePhase}
              onSelect={setSelectedSlot}
              onMove={moveSlot}
              onSetRoleLabel={setRoleLabel}
              onPlayerDrop={handlePlayerDrop}
              onRemoveStarter={removeStarter}
              onRemoveSub={removeSub}
              onSwap={swapStarterSub}
              onSetNumber={setPlayerNumber}
              onInfluence={setInfluenceManual}
              blend={blend}
              scrubbing={scrubbing}
              showGrid={showGrid}
              showNumbers={showNumbers}
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
          </>
        )}
      </main>

      {csvOpen && (
        <CsvImportDialog
          onClose={() => setCsvOpen(false)}
          onImport={addPlayers}
        />
      )}

      {onboardOpen && <Onboarding onClose={closeOnboarding} />}

      {studioOpen && (
        <StudioView
          lineup={lineup}
          project={project}
          playerById={playerById}
          settings={studioSettings}
          onPatchSettings={patchStudioSettings}
          onClose={closeStudio}
        />
      )}
    </div>
  );
}
