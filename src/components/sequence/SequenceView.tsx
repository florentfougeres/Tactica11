import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Lineup, Phase, Player, Pos } from "../../types";
import type { SequenceActions } from "../../hooks/useSequenceActions";
import { useSequencePlayback } from "../../hooks/useSequencePlayback";
import type {
  SeqAnnotation,
  Sequence } from "../../sequence/types";
import { DEFAULT_CAMERA } from "../../sequence/types";
import { frameAt, playheadAt, stepSpans, totalDuration } from "../../sequence/engine";
import type { AnnFrame } from "../../sequence/engine";
import { frameLayout } from "../../sequence/layout";
import SequenceStage, { type ActorInfo, type SeqLook } from "../../sequence/SequenceStage";
import { canExportVideo, exportStepPng } from "../../sequence/exportVideo";
import SequenceTimeline from "./SequenceTimeline";
import SequenceInspector from "./SequenceInspector";
import SequencePreview from "./SequencePreview";
import SequenceExportDialog from "./SequenceExportDialog";
import "./sequence.css";
import { useStageView } from "../../hooks/useStageView";
import { clampPct, useStagePointer, type Drag } from "./useStagePointer";
import RotatePitchButton from "../RotatePitchButton";
import SeqTopTools, { type SeqTool } from "./SeqTopTools";

interface Props {
  lineup: Lineup;
  players: Player[];
  look: SeqLook; // follows the app theme
  playerById: (id: string | null) => Player | null;
  actions: SequenceActions;
  seqId: string | null;
  onSeqId: (id: string | null) => void;
  toolbarSlot?: HTMLElement | null; // top-bar element the toolbar is portalled into
  tabs?: React.ReactNode; // app view tabs, shown above the inspector (frees the row above the pitch)
}


const CARRY_KEY = "tactica11.seqCarryGraphics";


export default function SequenceView({ lineup, players, look, playerById, actions, seqId, onSeqId, tabs, toolbarSlot }: Props) {
  const sequences = lineup.sequences ?? [];
  const seq: Sequence | null = sequences.find((q) => q.id === seqId) ?? sequences[0] ?? null;
  // A freshly created / duplicated sequence opens with its name field focused.
  const [renameId, setRenameId] = useState<string | null>(null);
  const openCreated = (id: string) => {
    setRenameId(id);
    onSeqId(id);
  };

  if (!seq) return <SequenceEmpty actions={actions} onSeqId={openCreated} />;
  return (
    <SequenceEditor
      key={seq.id}
      seq={seq}
      lineup={lineup}
      players={players}
      look={look}
      playerById={playerById}
      actions={actions}
      onSeqId={onSeqId}
      onCreated={openCreated}
      autoRename={renameId === seq.id}
      onRenameDone={() => setRenameId(null)}
      tabs={tabs}
      toolbarSlot={toolbarSlot}
    />
  );
}

function SequenceEmpty({ actions, onSeqId }: { actions: SequenceActions; onSeqId: (id: string) => void }) {
  const create = (phase: Phase) => onSeqId(actions.createSeq(phase));
  return (
    <div className="seq-empty glass">
      <h2>Mode Séquence</h2>
      <p>
        Raconte une action en plusieurs étapes : place les deux équipes et le ballon, dessine passes
        et déplacements, ajoute des annotations, puis lis l'animation ou exporte-la en vidéo pour
        TikTok, Reels ou YouTube.
      </p>
      <p className="seq-empty__label">Créer une séquence à partir de la compo :</p>
      <div className="seq-empty__actions">
        <button type="button" className="btn btn--primary" onClick={() => create("base")}>
          Formation de base
        </button>
        <button type="button" className="btn" onClick={() => create("attack")}>
          Phase d'attaque
        </button>
        <button type="button" className="btn" onClick={() => create("defense")}>
          Phase de défense
        </button>
      </div>
    </div>
  );
}

function SequenceEditor({
  seq,
  lineup,
  players,
  look,
  playerById,
  actions,
  onSeqId,
  onCreated,
  autoRename,
  onRenameDone,
  tabs,
  toolbarSlot,
}: {
  tabs?: React.ReactNode;
  toolbarSlot?: HTMLElement | null;
  seq: Sequence;
  lineup: Lineup;
  players: Player[];
  look: SeqLook;
  playerById: (id: string | null) => Player | null;
  actions: SequenceActions;
  onSeqId: (id: string | null) => void;
  onCreated: (id: string) => void;
  autoRename: boolean;
  onRenameDone: () => void;
}) {
  // Editing view: the pitch alone fills the frame — title, chapters and
  // captions only appear in the preview / export.
  const L = useMemo(() => frameLayout(seq, false), [seq]);
  const spans = useMemo(() => stepSpans(seq.steps), [seq.steps]);
  const duration = useMemo(() => totalDuration(seq.steps), [seq.steps]);
  // Open on step 1 itself (after its intro), ready to edit.
  const pb = useSequencePlayback(duration, spans[0]?.arrive ?? 0);
  // Step last picked (timeline, arrows…): breaks ties between steps that
  // land on the same instant (no hold, then no transition).
  const [pickedStep, setPickedStep] = useState<number | undefined>(undefined);
  const head = playheadAt(seq.steps, pb.time, pickedStep);
  const stepIndex = head.index;
  const step = seq.steps[stepIndex];
  const editable = !pb.playing && head.holding;

  const [tool, setTool] = useState<SeqTool>("select");
  const [selActors, setSelActors] = useState<Set<string>>(new Set());
  const [selAnn, setSelAnn] = useState<string | null>(null);
  const [draft, setDraft] = useState<SeqAnnotation | null>(null);
  const [cursor, setCursor] = useState<Pos | null>(null);
  const [marquee, setMarquee] = useState<{ a: Pos; b: Pos } | null>(null);
  const [propagate, setPropagate] = useState(false);
  const [preview, setPreview] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [focusLabel, setFocusLabel] = useState(0); // bump to focus the label text field
  // "Garder les éléments graphiques" when creating a step — remembered per browser.
  const [carry, setCarryRaw] = useState(() => {
    try {
      return localStorage.getItem(CARRY_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const setCarry = (v: boolean) => {
    setCarryRaw(v);
    try {
      localStorage.setItem(CARRY_KEY, v ? "1" : "0");
    } catch {
      // storage unavailable — keep it for this session only
    }
  };

  const svgRef = useRef<SVGSVGElement>(null);
  const camRef = useRef<SVGGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const spaceDown = useRef(false);

  // ----- actor labels (disc text + name) -----
  const info = useMemo(() => {
    const m: Record<string, ActorInfo> = {};
    const mode = seq.discMode ?? "role";
    seq.actors.forEach((a) => {
      if (a.team === "away") {
        m[a.id] = { disc: a.label ?? "", name: a.name ?? "" };
        return;
      }
      if (!a.slotId && !a.playerId) {
        m[a.id] = { disc: mode === "none" ? "" : (a.label ?? ""), name: a.name ?? "" };
        return;
      }
      // A disc shows its bound roster player, else the slot's starter.
      const slot = a.slotId ? lineup.slots.find((s) => s.id === a.slotId) : null;
      const player = a.playerId ? playerById(a.playerId) : slot ? playerById(slot.starterId) : null;
      const role = slot?.role ?? "";
      const number = player?.number != null ? String(player.number) : "";
      // Our discs: position, shirt number (empty when the player has none) or
      // nothing; a hand-typed disc label still wins unless "Rien".
      const auto = mode === "role" ? role : mode === "number" ? number : "";
      m[a.id] = {
        disc: mode === "none" ? "" : (a.label ?? auto),
        name: a.name ?? player?.name ?? "",
      };
    });
    return m;
  }, [seq.actors, seq.discMode, lineup.slots, playerById]);

  const frame = useMemo(() => frameAt(seq, pb.time, pb.playing, pickedStep), [seq, pb.time, pb.playing, pickedStep]);

  // ----- go to a step (after it's been created / moved) -----
  // Jump to a step once it exists in the (re-rendered) sequence — by id, so
  // an unrelated re-render can't consume the request early.
  const pendingStep = useRef<string | null>(null);
  useEffect(() => {
    const target = pendingStep.current;
    if (target == null) return;
    const i = seq.steps.findIndex((s) => s.id === target);
    if (i < 0) return;
    pendingStep.current = null;
    setPickedStep(i);
    pb.setTime(spans[i].arrive);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spans]);

  const goToStep = useCallback(
    (i: number) => {
      pb.pause();
      const c = Math.max(0, Math.min(spans.length - 1, i));
      setPickedStep(c);
      pb.setTime(spans[c].arrive);
    },
    [pb, spans],
  );

  const addStep = () => {
    pb.pause();
    pendingStep.current = actions.addStep(seq.id, stepIndex, carry);
  };

  // Drop selections pointing at things that no longer exist.
  useEffect(() => {
    if (selAnn && !seq.annotations.some((a) => a.id === selAnn)) setSelAnn(null);
    const ids = new Set(seq.actors.map((a) => a.id));
    if ([...selActors].some((a) => !ids.has(a)))
      setSelActors(new Set([...selActors].filter((a) => ids.has(a))));
  }, [seq.annotations, seq.actors, selAnn, selActors]);

  // Cancel in-progress drawings when the tool changes.
  useEffect(() => {
    setDraft(null);
    setCursor(null);
  }, [tool]);

  // ----- coordinates -----
  // ----- view zoom / pan (editor only, independent from the camera) -----
  const { viewZoom, pan, setPan, scale, offX, offY, resetView, zoomViewAt } = useStageView(wrapRef, L);

  // ----- pointer handling on the stage -----
  const { onPointerDown, onPointerMove, onPointerUp, finishPolygon } = useStagePointer({
    seq, step, stepIndex, editable, tool, frame, L, actions, propagate, draft, setDraft, setCursor, setMarquee,
    selActors, setSelActors, selAnn, setSelAnn, setFocusLabel, dragRef, svgRef, camRef, spaceDown, pan, setPan,
  });

  // No mouse-wheel zoom on purpose (too easy to trigger by accident): the
  // view zooms with the − / + buttons, the camera with the step's Zoom slider.

  // ----- keyboard -----
  const deleteSelection = useCallback(() => {
    if (selAnn) {
      actions.removeAnnotation(seq.id, selAnn);
      setSelAnn(null);
    } else if (selActors.size) {
      actions.removeActors(seq.id, [...selActors]);
      setSelActors(new Set());
    }
  }, [actions, selAnn, selActors, seq.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;
      if (preview || exportOpen) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      if (k === " ") {
        // Space on a focused button activates that button, not playback.
        if (t?.closest("button, [role='button']")) return;
        e.preventDefault();
        spaceDown.current = true;
        return;
      }
      if (k === "Escape") {
        if (draft) setDraft(null);
        else {
          setSelActors(new Set());
          setSelAnn(null);
        }
        return;
      }
      if (k === "Enter" && draft) {
        e.preventDefault();
        finishPolygon();
        return;
      }
      if ((k === "Delete" || k === "Backspace") && editable) {
        e.preventDefault();
        deleteSelection();
        return;
      }
      if (k.startsWith("Arrow")) {
        e.preventDefault();
        if (selActors.size && editable && (k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight")) {
          const stepPx = e.shiftKey ? 2 : 0.4;
          const dx = k === "ArrowLeft" ? -stepPx : k === "ArrowRight" ? stepPx : 0;
          const dy = k === "ArrowUp" ? -stepPx : k === "ArrowDown" ? stepPx : 0;
          // Screen-space nudge: in landscape the logical axes are rotated.
          const [lx, ly] = L.orient === "landscape" ? [dy, -dx] : [dx, dy];
          const moves: Record<string, Pos> = {};
          selActors.forEach((id) => {
            const q = step.positions[id];
            if (q) moves[id] = { x: clampPct(q.x + lx), y: clampPct(q.y + ly) };
          });
          actions.moveActors(seq.id, stepIndex, moves);
        } else if (k === "ArrowLeft") goToStep(head.holding ? stepIndex - 1 : head.from);
        else if (k === "ArrowRight") goToStep(stepIndex + (head.holding ? 1 : 0));
        return;
      }
      if (k === "Home") return goToStep(0);
      if (k === "End") return goToStep(seq.steps.length - 1);
      const lower = k.toLowerCase();
      if (lower === "n") return addStep();
      if (lower === "v") return setTool("select");
      if (lower === "c") return setTool("camera");
      if (lower === "p") return setTool("pass");
      if (lower === "r") return setTool("run");
      if (lower === "t") return setTool("label");
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key !== " ") return;
      const t = e.target as HTMLElement | null;
      if (t && (/^(input|textarea|select|button)$/i.test(t.tagName) || t.closest("[role='button']"))) {
        spaceDown.current = false;
        return;
      }
      // A short tap of the space bar (no pan) toggles playback.
      if (spaceDown.current && dragRef.current?.type !== "pan") pb.toggle();
      spaceDown.current = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
    };
  });

  // ----- draft rendering (polygons show the rubber band to the cursor) -----
  const draftFrame: AnnFrame | null = draft
    ? {
        ann:
          cursor && ["zone", "space"].includes(draft.kind)
            ? { ...draft, anchors: [...draft.anchors, { pos: cursor }] }
            : cursor && draft.kind === "playerLine"
              ? { ...draft, anchors: [...draft.anchors, { pos: cursor }] }
              : draft,
        visibility: 0.85,
        progress: 1,
      }
    : null;
  // A 2-node player zone in progress previews as a line.
  const draftForStage =
    draftFrame && draftFrame.ann.kind === "playerZone" && draftFrame.ann.anchors.length < 3
      ? { ...draftFrame, ann: { ...draftFrame.ann, kind: "playerLine" as const, anchors: cursor ? [...draftFrame.ann.anchors, { pos: cursor }] : draftFrame.ann.anchors } }
      : draftFrame;

  const exportPng = async () => {
    try {
      await exportStepPng({
        seq,
        info,
        background: "normal",
        look,
        scale: 1,
        time: pb.time,
        suffix: step.name || `etape-${stepIndex + 1}`,
      });
    } catch {
      alert("Échec de l'export en image.");
    }
  };

  const frameSelection = () => {
    const ids = selActors.size ? [...selActors] : seq.actors.map((a) => a.id);
    const pts = ids.map((id) => step.positions[id]).filter(Boolean) as Pos[];
    if (!pts.length) return;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const x0 = Math.min(...xs);
    const x1 = Math.max(...xs);
    const y0 = Math.min(...ys);
    const y1 = Math.max(...ys);
    const span = Math.max((x1 - x0) * (L.orient === "portrait" ? 1 : 105 / 68), (y1 - y0) * (L.orient === "portrait" ? 105 / 68 : 1), 28);
    const zoom = Math.min(3, Math.max(1, 100 / (span * 1.35)));
    actions.patchStep(seq.id, stepIndex, { camera: { x: (x0 + x1) / 2, y: (y0 + y1) / 2, zoom } });
  };

  return (
    <>
      <div className="seq-side">
      {tabs}
      <SequenceInspector
        seq={seq}
        sequences={lineup.sequences ?? []}
        lineup={lineup}
        players={players}
        playerById={playerById}
        step={step}
        stepIndex={stepIndex}
        editable={editable}
        info={info}
        selActors={selActors}
        selAnn={selAnn}
        propagate={propagate}
        focusLabel={focusLabel}
        actions={actions}
        onSeqId={onSeqId}
        onCreated={onCreated}
        autoRename={autoRename}
        onRenameDone={onRenameDone}
        onSelectActors={setSelActors}
        onSelectAnn={setSelAnn}
        onPropagate={setPropagate}
        onGoToStep={goToStep}
        onFrameSelection={frameSelection}
        onResetCamera={() => actions.patchStep(seq.id, stepIndex, { camera: { ...DEFAULT_CAMERA } })}
        onAddActor={(team) => {
          const aid = actions.addActor(seq.id, team, team === "home" ? { x: 50, y: 60 } : { x: 50, y: 40 });
          setSelActors(new Set([aid]));
          setSelAnn(null);
        }}
        onDeleteSelection={deleteSelection}
      />
      </div>

      <div className="seq-main">
        {toolbarSlot && (
          <SeqTopTools
            slot={toolbarSlot}
            tool={tool}
            onTool={setTool}
            showGrid={!!seq.showGrid}
            onGrid={() => actions.patchSeq(seq.id, { showGrid: !seq.showGrid })}
            zoomPct={Math.round(viewZoom * 100)}
            onZoomOut={() => zoomViewAt(1 / 1.25)}
            onZoomFit={resetView}
            onZoomIn={() => zoomViewAt(1.25)}
            onPreview={() => { pb.pause(); setPreview(true); }}
            onPng={exportPng}
            pngTitle={`Exporter l'image de l'instant affiché (PNG, format ${seq.format})`}
            onVideo={canExportVideo() ? () => { pb.pause(); setExportOpen(true); } : null}
          />
        )}

        <div
          ref={wrapRef}
          className={`seq-stage-wrap ${editable ? "" : "is-locked"} seq-stage-wrap--${tool}`}
        >
          <RotatePitchButton
            orient={seq.orient}
            onToggle={() => actions.patchSeq(seq.id, { orient: seq.orient === "portrait" ? "landscape" : "portrait" })}
          />
          <div
            className="seq-stage-inner"
            style={{ transform: `translate(${offX}px, ${offY}px) scale(${scale})`, width: L.W, height: L.H }}
          >
            <SequenceStage
              seq={seq}
              frame={frame}
              layout={L}
              info={info}
              look={look}
              chrome={false}
              idPrefix="ed"
              svgRef={svgRef}
              cameraRef={camRef}
              className="seq-stage"
              overlay={{
                selectedActors: selActors,
                selectedAnn: selAnn,
                draft: draftForStage,
                marquee,
                editable,
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onDoubleClick={() => draft && finishPolygon()}
            />
          </div>
        </div>

        <SequenceTimeline
          steps={seq.steps}
          spans={spans}
          time={pb.time}
          duration={duration}
          current={stepIndex}
          holding={head.holding}
          playing={pb.playing}
          speed={pb.speed}
          loop={pb.loop}
          onToggle={pb.toggle}
          onStart={() => goToStep(0)}
          onPrev={() => goToStep(head.holding ? stepIndex - 1 : head.from)}
          onNext={() => goToStep(stepIndex + (head.holding ? 1 : 0))}
          onCycleSpeed={pb.cycleSpeed}
          onLoop={pb.setLoop}
          onSeek={(t) => {
            pb.pause();
            pb.setTime(t);
          }}
          onSelectStep={goToStep}
          onAddStep={addStep}
          carry={carry}
          onCarry={setCarry}
          onMoveStep={(from, to) => {
            pendingStep.current = seq.steps[from]?.id ?? null;
            actions.moveStep(seq.id, from, to);
          }}
          onHold={(i, ms) => actions.patchStep(seq.id, i, { holdMs: ms })}
        />
      </div>

      {preview && <SequencePreview seq={seq} info={info} look={look} onFormat={(format) => actions.patchSeq(seq.id, { format })} onClose={() => setPreview(false)} />}
      {exportOpen && <SequenceExportDialog seq={seq} info={info} look={look} time={pb.time} onFormat={(format) => actions.patchSeq(seq.id, { format })} onOrient={(orient) => actions.patchSeq(seq.id, { orient })} onClose={() => setExportOpen(false)} />}
    </>
  );
}
