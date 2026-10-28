import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import type {
  DrawTool,
  InfluenceMode,
  Orient,
  Phase,
  Player,
  Project,
  SetPieceState,
  ZoneRadii,
} from "./types";
import {
  DEFAULT_DRAW_COLOR,
  DEFAULT_OPPONENT_COLOR,
} from "./types";
import { loadLibrary } from "./storage";
import Bench from "./components/Bench";
import Pitch from "./components/Pitch";
import TopBar from "./components/TopBar";
import FmSelect from "./components/FmSelect";
import { FORMATIONS } from "./formations";
import type { ShareItem } from "./components/ShareMenu";
import CsvImportDialog from "./components/CsvImportDialog";
import ProjectImportDialog from "./components/ProjectImportDialog";
import RosterView from "./components/roster/RosterView";
import ViewTabs, { type View } from "./components/ViewTabs";
import PhaseToggle from "./components/PhaseToggle";
import Onboarding from "./components/Onboarding";
import ZonePresets from "./components/ZonePresets";
import { presetsFor, presetRadii } from "./zonePresets";
import { exportPitchPng } from "./exportImage";
import { useUndoableLineup } from "./useUndoableLineup";
import { useAutoplay } from "./hooks/useAutoplay";
import BlendSlider from "./components/BlendSlider";
import OpponentControls from "./components/OpponentControls";
import { useOnboarding } from "./hooks/useOnboarding";
import { useTheme } from "./hooks/useTheme";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { usePresentation } from "./hooks/usePresentation";
import { useShareLink } from "./hooks/useShareLink";
import { usePlayerRoster } from "./hooks/usePlayerRoster";
import { useProjectStore } from "./hooks/useProjectStore";
import { useProjectActions } from "./hooks/useProjectActions";
import { usePitchActions } from "./hooks/usePitchActions";
import { useSetPieceActions } from "./hooks/useSetPieceActions";
import { useStudio } from "./hooks/useStudio";
import SetPieceView from "./components/SetPieceView";
import StudioView from "./components/StudioView";
import SequenceView from "./components/sequence/SequenceView";
import { useSequenceActions } from "./hooks/useSequenceActions";
import Switch from "./components/Switch";
import Icon from "./components/Icon";

// French phase labels, used to suffix exported PNG filenames.
const PHASE_LABEL: Record<Phase, string> = {
  base: "base",
  attack: "attaque",
  defense: "defense",
};

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
  // Project read from "Ouvrir…", waiting for the user to choose what to do with it.
  const [projectToImport, setProjectToImport] = useState<Project | null>(null);
  const { onboardOpen, openOnboarding, closeOnboarding } = useOnboarding();
  const { theme, toggleTheme } = useTheme();
  const [influenceMode, setInfluenceMode] = useState<InfluenceMode>("none");
  // Follow the screen (and an iPad being rotated): a portrait pitch on a
  // landscape screen left ~40% of the width empty. Once the rotate button is
  // used, that choice wins.
  const screenOrient: Orient = useMediaQuery("(min-aspect-ratio: 1/1)") ? "landscape" : "portrait";
  const [manualOrient, setManualOrient] = useState<Orient | null>(null);
  const orient = manualOrient ?? screenOrient;
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

  // Séquence mode: animated multi-step sequences stored on the compo (so they
  // share its undo/redo stack). Only the shown sequence id is view state.
  const sequenceActions = useSequenceActions(lineup, setLineup);
  const [seqId, setSeqId] = useState<string | null>(null);

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

  // Hands-free walkthrough of the défense↔attaque slider (team-briefing mode).
  // While playing, treat it like an active scrub so tokens track the blend
  // 1:1 instead of chasing it with a spring (see PitchToken's `instant`).
  const blendAutoplay = useAutoplay(blend, handleBlend);
  useEffect(() => {
    if (blendAutoplay.playing) setScrubbing(true);
    else setScrubbing(false);
  }, [blendAutoplay.playing]);
  // Leaving the pitch tab shouldn't leave the loop running unattended.
  useEffect(() => {
    if (view !== "pitch") blendAutoplay.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const handlePhase = (p: Phase) => {
    blendAutoplay.stop();
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
    readProjectToImport,
    openAsNewProject,
    importIntoProject,
    openDemoProject,
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
    updatePlayer,
    createPlayerInSlot,
    setPlayerNumber,
    addPlayers,
    renamePlayer,
    removePlayer,
    setAttribute,
    addColumn,
    renameColumn,
    removeColumn,
  } = usePlayerRoster(updateProject, setLineup);

  // Main pitch's lineup mutations (formation/slots, opponents, drawings,
  // drag-and-drop) — see usePitchActions.ts.
  const {
    changeFormation,
    moveSlot,
    setRoleLabel,
    mirrorPhase,
    resetPhase,
    toggleOpponentMode,
    moveOpponent,
    setOpponentLabel,
    setOpponentColor,
    setOpponentColor2,
    handlePlayerDrop,
    handleBenchDrop,
    removeStarter,
    removeSub,
    swapStarterSub,
  } = usePitchActions({
    lineup,
    setLineup,
    phase,
    orient,
    pitchRef,
    benchRef,
    opponentMode,
    setOpponentMode,
    setSelectedSlot,
  });

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

  // Quick-create from an empty slot's popover: add the player to the shared
  // roster and drop it straight in, then close the popover.
  const handleCreatePlayerInSlot = (
    slotId: string,
    name: string,
    number?: number,
  ) => {
    createPlayerInSlot(slotId, name, number);
    setSelectedSlot(null);
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

  // Phase arrêtée: same capture as Compo, on the half-pitch of the set piece.
  const SP_STATE_LABEL: Record<SetPieceState, string> = { start: "Début", mid: "Intermédiaire", end: "Fin" };
  const handleExportSetPiecePng = async () => {
    const current = setPieceActions.currentSetPiece;
    const el = document.querySelector(".sp-pitch-col .pitch") as HTMLElement | null;
    if (!current || !el) return;
    try {
      await exportPitchPng(el, `${lineup.name} ${current.name}`, SP_STATE_LABEL[spState]);
    } catch {
      alert("Échec de l'export en image.");
    }
  };
  // Séquence hands its own items (image of the instant shown, video) up here.
  const [seqShare, setSeqShare] = useState<ShareItem[] | null>(null);
  const share: ShareItem[] | null =
    view === "setpiece"
      ? setPieceActions.currentSetPiece
        ? [{ label: "Image (vue actuelle)", ext: ".png", onClick: handleExportSetPiecePng }]
        : null
      : view === "sequence"
        ? seqShare
        : null;

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
        <BlendSlider
          from="Déf"
          to="Att"
          value={blend}
          onChange={handleBlend}
          onScrub={setScrubbing}
          autoplay={blendAutoplay}
        />
      )}

      {phase !== "base" && (
        <div className="pitch-ctl__actions">
          <button
            type="button"
            className="pitch-ctl__btn"
            onClick={mirrorPhase}
            title="Inverser gauche / droite pour cette phase"
          >
            <Icon name="swap" /> Miroir G/D
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

      <Switch label="Afficher la grille" checked={showGrid} onChange={setShowGrid} />

      {phase === "base" && (
        <Switch label="Afficher les numéros" checked={showNumbers} onChange={setShowNumbers} />
      )}

      {phase !== "base" && (
        <OpponentControls
          on={opponentMode}
          onToggle={toggleOpponentMode}
          color={lineup.opponentColor}
          onColor={setOpponentColor}
          color2={lineup.opponentColor2}
          onColor2={setOpponentColor2}
        />
      )}
    </div>
  );

  // Séquence (with a sequence to edit) puts the view tabs above its inspector,
  // so the pitch can use the row they'd otherwise take.
  // Top-bar element the Séquence toolbar is portalled into.
  const [seqSlot, setSeqSlot] = useState<HTMLDivElement | null>(null);
  const [spStateSlot, setSpStateSlot] = useState<HTMLDivElement | null>(null);
  const seqTabsInside = view === "sequence" && (lineup.sequences?.length ?? 0) > 0;

  return (
    <div className={`app ${presenting ? "app--present" : ""}`}>
      {presenting && (
        <button className="present-exit" onClick={exitPresent}>
          <Icon name="close" /> Quitter
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
            <Icon name={presentToolsOpen ? "close" : "settings"} />
          </button>
          {presentToolsOpen && (
            <div className="present-tools__panel glass">{pitchControls}</div>
          )}
        </div>
      )}
      <TopBar
        view={view}
        name={lineup.name}
        onPresent={enterPresent}
        onStudio={openStudio}
        onHelp={openOnboarding}
        theme={theme}
        onToggleTheme={toggleTheme}
        onSeqSlot={setSeqSlot}
        compos={project.lineups.map((l) => ({ id: l.id, name: l.name }))}
        currentId={lineup.id}
        projectName={project.name}
        projects={projects.map((p) => ({ id: p.id, name: p.name }))}
        currentProjectId={project.id}
        canUndo={canUndo}
        canRedo={canRedo}
        onName={(name) => setLineup((l) => ({ ...l, name }))}
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
        share={share}
        onCopyLink={copyShareLink}
        onSaveProject={saveProject}
        onOpenDemo={openDemoProject}
        onImportProject={async (file) =>
          setProjectToImport(await readProjectToImport(file))
        }
      />

      {!presenting && !seqTabsInside && (
        <div className="view-row">
          <ViewTabs view={view} onView={setView} />
          {view === "pitch" && (
            <div className="view-row__phase">
              {/* The formation sits with the phases, right above the pitch it
                  shapes, rather than in the top bar where it squeezed the
                  project and compo names. */}
              <FmSelect
                className="view-row__formation"
                value={lineup.formation}
                options={FORMATIONS.map((f) => ({ value: f, label: f }))}
                onChange={changeFormation}
                ariaLabel="Système"
              />
              <PhaseToggle phase={phase} onPhase={handlePhase} />
            </div>
          )}
          {/* Phase arrêtée's Début / Intermédiaire / Fin goes in the same
              place as Compo's phases (portalled from SetPieceView). */}
          {view === "setpiece" && <div className="view-row__phase" ref={setSpStateSlot} />}
        </div>
      )}

      <main className={`layout ${view === "sequence" ? "layout--seq" : ""}`}>
        {view === "roster" ? (
          <RosterView
            players={project.players}
            attributeDefs={project.attributeDefs}
            onAddPlayer={addPlayer}
            onPatchPlayer={updatePlayer}
            onSetAttribute={setAttribute}
            onRemovePlayer={removePlayer}
            onAddColumn={addColumn}
            onRenameColumn={renameColumn}
            onRemoveColumn={removeColumn}
            onImportCsv={() => setCsvOpen(true)}
          />
        ) : view === "sequence" ? (
          <SequenceView
            toolbarSlot={seqSlot}
            tabs={seqTabsInside ? <ViewTabs view={view} onView={setView} /> : undefined}
            lineup={lineup}
            players={project.players}
            look={theme}
            playerById={playerById}
            actions={sequenceActions}
            seqId={seqId}
            onSeqId={setSeqId}
            onShare={setSeqShare}
          />
        ) : view === "setpiece" ? (
          <SetPieceView
            stateSlot={spStateSlot}
            look={theme}
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
            {/* The list of available players only matters in Base (the only
                phase where they can be dragged on). In Attaque / Défense the
                column holds that phase's controls instead of an inert list. */}
            {phase === "base" ? (
              <Bench
                ref={benchRef}
                players={benchPlayers}
                rosterSize={project.players.length}
                onRename={renamePlayer}
                onSetNumber={setPlayerNumber}
                onRemove={removePlayer}
                onDropToPitch={handleBenchDrop}
                onDragStateChange={setBenchDragging}
                canDrag
                footer={pitchControls}
              />
            ) : (
              <aside className="bench glass phase-panel">
                <header className="panel__header">
                  <h2>{phase === "attack" ? "Attaque" : "Défense"}</h2>
                </header>
                <div className="phase-panel__body">{pitchControls}</div>
              </aside>
            )}

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
              look={theme}
              onToggleOrient={() =>
                setManualOrient(orient === "portrait" ? "landscape" : "portrait")
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
              onRenamePlayer={renamePlayer}
              onCreatePlayer={handleCreatePlayerInSlot}
              onInfluence={setInfluenceManual}
              blend={blend}
              scrubbing={scrubbing}
              showGrid={showGrid}
              showNumbers={showNumbers}
              opponents={lineup.opponents ?? []}
              opponentMode={opponentMode}
              opponentColor={lineup.opponentColor ?? DEFAULT_OPPONENT_COLOR}
              opponentColor2={lineup.opponentColor2}
              onMoveOpponent={moveOpponent}
              onLabelOpponent={setOpponentLabel}
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

      {projectToImport && (
        <ProjectImportDialog
          source={projectToImport}
          currentProjectName={project.name}
          onClose={() => setProjectToImport(null)}
          onOpenAsNew={() => openAsNewProject(projectToImport)}
          onImport={(options) => importIntoProject(projectToImport, options)}
        />
      )}

      {onboardOpen && <Onboarding onClose={closeOnboarding} />}

      {studioOpen && (
        <StudioView
          lineup={lineup}
          phase={phase}
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
