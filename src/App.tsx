import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import type {
  AttrType,
  DrawTool,
  Drawing,
  InfluenceMode,
  Lineup,
  Orient,
  Phase,
  Player,
  Project,
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
  createDefaultProject,
  createOpponents,
  exportProject,
  importProject,
  loadLibrary,
  mergeImportedBundle,
  saveLibrary,
  uid,
} from "./storage";
import Bench from "./components/Bench";
import Pitch from "./components/Pitch";
import TopBar from "./components/TopBar";
import CsvImportDialog from "./components/CsvImportDialog";
import RosterTable from "./components/RosterTable";
import Onboarding from "./components/Onboarding";
import ZonePresets from "./components/ZonePresets";
import { presetsFor, presetRadii } from "./zonePresets";
import { exportPitchPng } from "./exportImage";
import { buildShareUrl, decodeLineup, takeSharedFromUrl } from "./share";
import { useUndoableLineup } from "./useUndoableLineup";
import type { ImportedPlayer } from "./csv";

type Point = { x: number; y: number };

const ONBOARD_KEY = "tactica11.onboarded";

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
  const [projects, setProjects] = useState<Project[]>(initialLib.projects);
  const [currentProjectId, setCurrentProjectId] = useState(
    initialLib.currentProjectId,
  );
  const project = useMemo(
    () => projects.find((p) => p.id === currentProjectId) ?? projects[0],
    [projects, currentProjectId],
  );
  const { lineup, setLineup, undo, redo, reset, canUndo, canRedo } =
    useUndoableLineup(
      project.lineups.find((l) => l.id === project.currentLineupId) ??
        project.lineups[0],
    );
  // Mutate the current project's shared roster / attribute columns.
  const updateProject = useCallback(
    (fn: (p: Project) => Project) =>
      setProjects((ps) =>
        ps.map((p) => (p.id === currentProjectId ? fn(p) : p)),
      ),
    [currentProjectId],
  );

  const [rosterOpen, setRosterOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("base");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [benchDragging, setBenchDragging] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  // First-launch walkthrough of the existing features (reopenable from the top
  // bar). The flag lives in localStorage so it shows exactly once per device.
  const [onboardOpen, setOnboardOpen] = useState(
    () => localStorage.getItem(ONBOARD_KEY) == null,
  );
  const closeOnboarding = () => {
    setOnboardOpen(false);
    try {
      localStorage.setItem(ONBOARD_KEY, "1");
    } catch {
      // storage unavailable — the tour just shows again next time, harmless
    }
  };
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
  // Base-only display toggle: swap which label rides the main disc (role vs
  // shirt number). Purely a view preference, not persisted with the lineup.
  const [showNumbers, setShowNumbers] = useState(false);
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

  // If opened on a share link, merge the encoded compo (and the players/
  // attribute columns it references) into the current project as a new entry.
  useEffect(() => {
    const enc = takeSharedFromUrl();
    if (!enc) return;
    const bundle = decodeLineup(enc);
    if (!bundle) return;
    const { project: merged, lineup: newLineup } = mergeImportedBundle(
      project,
      bundle,
    );
    setProjects((ps) => ps.map((p) => (p.id === merged.id ? merged : p)));
    reset(newLineup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fold the actively-edited compo back into its project's lineups (debounced,
  // so a drag burst syncs once), then persist the whole project library.
  useEffect(() => {
    const t = setTimeout(() => {
      setProjects((ps) =>
        ps.map((p) =>
          p.id === currentProjectId
            ? {
                ...p,
                lineups: p.lineups.map((l) =>
                  l.id === lineup.id ? lineup : l,
                ),
                currentLineupId: lineup.id,
              }
            : p,
        ),
      );
    }, 400);
    return () => clearTimeout(t);
  }, [lineup, currentProjectId]);

  useEffect(() => {
    saveLibrary({ projects, currentProjectId });
  }, [projects, currentProjectId]);

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
  // `project.lineups` once the debounced sync effect folds it back in.
  const removePlayer = (id: string) => {
    const clearSlots = (slots: Lineup["slots"]) =>
      slots.map((s) => ({
        ...s,
        starterId: s.starterId === id ? null : s.starterId,
        subId: s.subId === id ? null : s.subId,
      }));
    updateProject((p) => ({
      ...p,
      players: p.players.filter((pl) => pl.id !== id),
      lineups: p.lineups.map((l) => ({ ...l, slots: clearSlots(l.slots) })),
    }));
    setLineup((l) => ({ ...l, slots: clearSlots(l.slots) }));
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

  // --- whole-project save / open (.json) ---
  const saveProject = () => exportProject(project);

  const openProjectFile = async (file: File) => {
    try {
      const p = await importProject(file);
      setProjects((ps) => [...ps, p]);
      setCurrentProjectId(p.id);
      reset(p.lineups.find((l) => l.id === p.currentLineupId) ?? p.lineups[0]);
      setSelectedSlot(null);
    } catch {
      alert("Impossible de lire ce fichier projet Tactica11.");
    }
  };

  // --- compos (within the current project) ---
  const openCompo = (id: string) => {
    if (id === lineup.id) return;
    updateProject((p) => ({
      ...p,
      lineups: p.lineups.map((l) => (l.id === lineup.id ? lineup : l)),
    }));
    const target = project.lineups.find((l) => l.id === id);
    if (target) {
      reset(structuredClone(target));
      setSelectedSlot(null);
    }
  };

  const newCompo = () => {
    const c = createDefaultLineup();
    updateProject((p) => ({ ...p, lineups: [...p.lineups, c] }));
    reset(c);
    setSelectedSlot(null);
  };

  const duplicateCompo = () => {
    const c = {
      ...structuredClone(lineup),
      id: uid("lineup"),
      name: `${lineup.name} (copie)`,
    };
    updateProject((p) => ({ ...p, lineups: [...p.lineups, c] }));
    reset(c);
    setSelectedSlot(null);
  };

  const deleteCompo = (id: string) => {
    const target = project.lineups.find((l) => l.id === id);
    const label = target?.name?.trim() || "cette compo";
    // Deletion clears the undo history (reset), so there's no taking it back.
    if (!window.confirm(`Supprimer « ${label} » ? Cette action est définitive.`))
      return;
    const rest = project.lineups.filter((l) => l.id !== id);
    if (rest.length === 0) {
      const def = createDefaultLineup();
      updateProject((p) => ({ ...p, lineups: [def], currentLineupId: def.id }));
      reset(def);
    } else {
      updateProject((p) => ({ ...p, lineups: rest }));
      if (id === lineup.id) reset(structuredClone(rest[0]));
    }
    setSelectedSlot(null);
  };

  // --- projects ---
  const setProjectName = (name: string) => updateProject((p) => ({ ...p, name }));

  const openProject = (id: string) => {
    if (id === currentProjectId) return;
    updateProject((p) => ({
      ...p,
      lineups: p.lineups.map((l) => (l.id === lineup.id ? lineup : l)),
      currentLineupId: lineup.id,
    }));
    const target = projects.find((p) => p.id === id);
    if (!target) return;
    setCurrentProjectId(id);
    const targetLineup =
      target.lineups.find((l) => l.id === target.currentLineupId) ??
      target.lineups[0];
    reset(structuredClone(targetLineup));
    setSelectedSlot(null);
  };

  const newProject = () => {
    const p = createDefaultProject();
    setProjects((ps) => [...ps, p]);
    setCurrentProjectId(p.id);
    reset(p.lineups[0]);
    setSelectedSlot(null);
  };

  // Duplicates the whole project: roster, attribute columns and every compo,
  // with fresh ids throughout (including players) so the copy never shares
  // identity with the original — slot references are remapped accordingly.
  const duplicateProject = () => {
    const base: Project = {
      ...project,
      lineups: project.lineups.map((l) => (l.id === lineup.id ? lineup : l)),
    };
    const src = structuredClone(base);
    const playerIdMap = new Map<string, string>();
    const players = src.players.map((pl) => {
      const id = uid("p");
      playerIdMap.set(pl.id, id);
      return { ...pl, id };
    });
    const lineups = src.lineups.map((l) => ({
      ...l,
      id: uid("lineup"),
      slots: l.slots.map((s) => ({
        ...s,
        starterId: s.starterId ? (playerIdMap.get(s.starterId) ?? null) : null,
        subId: s.subId ? (playerIdMap.get(s.subId) ?? null) : null,
      })),
    }));
    const p: Project = {
      ...src,
      id: uid("proj"),
      name: `${src.name} (copie)`,
      players,
      lineups,
      currentLineupId: lineups[0].id,
    };
    setProjects((ps) => [...ps, p]);
    setCurrentProjectId(p.id);
    reset(p.lineups[0]);
    setSelectedSlot(null);
  };

  const deleteProject = (id: string) => {
    const target = projects.find((p) => p.id === id);
    const label = target?.name?.trim() || "ce projet";
    if (!window.confirm(`Supprimer « ${label} » ? Cette action est définitive.`))
      return;
    const rest = projects.filter((p) => p.id !== id);
    if (rest.length === 0) {
      const def = createDefaultProject();
      setProjects([def]);
      setCurrentProjectId(def.id);
      reset(def.lineups[0]);
    } else {
      setProjects(rest);
      if (id === currentProjectId) {
        const next = rest[0];
        setCurrentProjectId(next.id);
        reset(
          structuredClone(
            next.lineups.find((l) => l.id === next.currentLineupId) ??
              next.lineups[0],
          ),
        );
      }
    }
    setSelectedSlot(null);
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(project, lineup));
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
        name={lineup.name}
        formation={lineup.formation}
        onPresent={enterPresent}
        onHelp={() => setOnboardOpen(true)}
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
        onOpenRoster={() => setRosterOpen(true)}
        onUndo={undo}
        onRedo={redo}
        onExportPng={handleExportPng}
        onCopyLink={copyShareLink}
        onSaveProject={saveProject}
        onImportProject={openProjectFile}
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
          onOpenRoster={() => setRosterOpen(true)}
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
      </main>

      {csvOpen && (
        <CsvImportDialog
          onClose={() => setCsvOpen(false)}
          onImport={addPlayers}
        />
      )}

      {rosterOpen && (
        <RosterTable
          players={project.players}
          attributeDefs={project.attributeDefs}
          onClose={() => setRosterOpen(false)}
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
      )}

      {onboardOpen && <Onboarding onClose={closeOnboarding} />}
    </div>
  );
}
