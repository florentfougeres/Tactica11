import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Lineup, Phase, Player, Pos } from "../../types";
import { pxToPos } from "../../types";
import type { SequenceActions } from "../../hooks/useSequenceActions";
import { useSequencePlayback } from "../../hooks/useSequencePlayback";
import type {
  Anchor,
  AnnKind,
  ArrowKind,
  Camera,
  SeqAnnotation,
  Sequence,
} from "../../sequence/types";
import { ANN_LABEL, ARROW_KINDS, DEFAULT_CAMERA, defaultAnnColor, discScale, isArrow } from "../../sequence/types";
import { frameAt, playheadAt, stepSpans, totalDuration } from "../../sequence/engine";
import type { AnnFrame } from "../../sequence/engine";
import { frameLayout, toLocal } from "../../sequence/layout";
import SequenceStage, { type ActorInfo, type SeqLook } from "../../sequence/SequenceStage";
import { sid } from "../../sequence/create";
import { canExportVideo, exportStepPng } from "../../sequence/exportVideo";
import SequenceTimeline from "./SequenceTimeline";
import SequenceInspector from "./SequenceInspector";
import SequencePreview from "./SequencePreview";
import SequenceExportDialog from "./SequenceExportDialog";
import "./sequence.css";
import RotatePitchButton from "../RotatePitchButton";

export type SeqTool = "select" | AnnKind | "camera";

interface Props {
  lineup: Lineup;
  players: Player[];
  look: SeqLook; // follows the app theme
  playerById: (id: string | null) => Player | null;
  actions: SequenceActions;
  seqId: string | null;
  onSeqId: (id: string | null) => void;
  tabs?: React.ReactNode; // app view tabs, shown above the inspector (frees the row above the pitch)
}

const TOOL_GROUPS: { label: string; tools: SeqTool[] }[] = [
  { label: "", tools: ["select"] },
  { label: "Flèches", tools: ARROW_KINDS },
  { label: "Formes", tools: ["zone", "space", "playerZone", "playerLine", "marking", "circle", "line", "label"] },
  { label: "", tools: ["camera"] },
];

const TOOL_LABEL: Record<SeqTool, string> = { ...ANN_LABEL, select: "Sélection", camera: "Caméra" };
const TOOL_KEY: Partial<Record<SeqTool, string>> = { select: "V", camera: "C", pass: "P", run: "R", label: "T" };

const TOOL_HINT: Record<SeqTool, string> = {
  select: "Clic : sélectionner · ⇧ : ajouter · glisser le fond : sélection rectangle · glisser le ballon sur un joueur : le lui donner",
  pass: "Glisser d'un joueur vers un autre (ou un point). Le ballon suivra la passe si le porteur change à l'étape suivante.",
  run: "Glisser depuis un joueur vers sa destination",
  dribble: "Glisser : course avec ballon",
  deep: "Glisser : appel en profondeur",
  press: "Glisser : déplacement défensif / pressing",
  zone: "Glisser pour un rectangle · ou cliquer pour poser les sommets · Entrée ou clic sur le 1er point pour fermer · Échap pour annuler",
  space: "Glisser pour un rectangle · ou cliquer pour poser les sommets de l'espace libre · Entrée pour fermer",
  playerZone: "Cliquer sur 3 joueurs ou plus · Entrée pour fermer. La zone suit les joueurs",
  playerLine: "Cliquer sur des joueurs dans l'ordre · Entrée pour terminer",
  marking: "Cliquer sur un joueur puis sur son vis-à-vis",
  circle: "Cliquer sur un joueur ou un point",
  line: "Glisser pour tracer une ligne (⇧ : horizontale)",
  label: "Cliquer sur un joueur ou un point, puis saisir le texte",
  camera: "Glisser pour déplacer le cadrage de l'étape · zoom avec le curseur « Zoom » de l'onglet Étape",
};

type Drag =
  | { type: "actors"; ids: string[]; start: Record<string, Pos>; p0: Pos; moved: boolean }
  | { type: "ball"; p0: Pos; start: Pos }
  | { type: "ann"; id: string; p0: Pos; start: SeqAnnotation; moved: boolean }
  | { type: "handle"; id: string; handle: string }
  | { type: "marquee"; a: Pos; add: boolean }
  | { type: "arrow"; kind: ArrowKind; a: Anchor }
  | { type: "line"; a: Pos }
  | { type: "rect"; kind: "zone" | "space"; a: Pos; moved: boolean }
  | { type: "camera"; f0: { x: number; y: number }; cam0: Camera }
  | { type: "pan"; c0: { x: number; y: number }; pan0: { x: number; y: number } };

const CARRY_KEY = "tactica11.seqCarryGraphics";

const clampPct = (v: number) => Math.min(104, Math.max(-4, v));

export default function SequenceView({ lineup, players, look, playerById, actions, seqId, onSeqId, tabs }: Props) {
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
}: {
  tabs?: React.ReactNode;
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
  // The toolbars live in the app chrome (top bar), via portals.
  const [topSlot, setTopSlot] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    setTopSlot(document.getElementById("seq-topbar-slot"));
  }, []);
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
  const pitchSize = { w: L.pitch.w, h: L.pitch.h };
  const toPitch = (cx: number, cy: number): Pos | null => {
    const g = camRef.current;
    const m = g?.getScreenCTM();
    if (!m) return null;
    const pt = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return pxToPos(pt.x, pt.y, pitchSize, L.orient);
  };
  const toFrame = (cx: number, cy: number) => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const pt = new DOMPoint(cx, cy).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  };
  const R = 3.2 * L.u;
  const hitActor = (p: Pos): string | null => {
    const c = toLocal(L, p);
    let best: string | null = null;
    let bd = Infinity;
    // Later actors draw on top → test them first.
    for (const a of [...seq.actors].reverse()) {
      const ap = frame.positions[a.id];
      if (!ap) continue;
      const q = toLocal(L, ap);
      const d = Math.hypot(q.x - c.x, q.y - c.y);
      if (d < R * discScale(seq, a) * 1.15 && d < bd) {
        bd = d;
        best = a.id;
      }
    }
    return best;
  };
  const hitBall = (p: Pos) => {
    const c = toLocal(L, p);
    const b = toLocal(L, frame.ball);
    return Math.hypot(b.x - c.x, b.y - c.y) < R * 0.75;
  };
  const anchorAt = (p: Pos): Anchor => {
    const a = hitActor(p);
    return a ? { actorId: a } : { pos: p };
  };

  const newAnn = (kind: AnnKind, anchors: Anchor[], extra: Partial<SeqAnnotation> = {}): SeqAnnotation => ({
    id: sid("ann"),
    kind,
    anchors,
    color: defaultAnnColor(kind, seq.theme),
    fromStep: step.id,
    toStep: step.id,
    ...extra,
  });

  const commitAnn = (ann: SeqAnnotation) => {
    actions.addAnnotation(seq.id, ann);
    setSelAnn(ann.id);
    setSelActors(new Set());
    if (ann.kind === "label") setFocusLabel((n) => n + 1);
  };

  const finishPolygon = () => {
    if (!draft) return;
    const min = draft.kind === "playerLine" ? 2 : 3;
    if (draft.anchors.length >= min) commitAnn(draft);
    setDraft(null);
    setCursor(null);
  };

  // ----- view zoom / pan (editor only, independent from the camera) -----
  const [wrapSize, setWrapSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setWrapSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const [viewZoom, setViewZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const fit = wrapSize.w ? Math.min(wrapSize.w / L.W, wrapSize.h / L.H) * 0.97 : 0.3;
  const scale = fit * viewZoom;
  const offX = (wrapSize.w - L.W * scale) / 2 + pan.x;
  const offY = (wrapSize.h - L.H * scale) / 2 + pan.y;
  const resetView = () => {
    setViewZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const zoomViewAt = (factor: number, cx?: number, cy?: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = cx != null ? cx - r.left : r.width / 2;
    const py = cy != null ? cy - r.top : r.height / 2;
    const z1 = Math.min(6, Math.max(0.5, viewZoom * factor));
    const s0 = scale;
    const s1 = fit * z1;
    const fx = (px - offX) / s0;
    const fy = (py - offY) / s0;
    setViewZoom(z1);
    setPan({
      x: px - (wrapSize.w - L.W * s1) / 2 - fx * s1,
      y: py - (wrapSize.h - L.H * s1) / 2 - fy * s1,
    });
  };

  // ----- pointer handling on the stage -----
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    if (e.button === 1 || spaceDown.current) {
      e.preventDefault();
      svg.setPointerCapture(e.pointerId);
      dragRef.current = { type: "pan", c0: { x: e.clientX, y: e.clientY }, pan0: pan };
      return;
    }
    if (e.button !== 0) return;
    if (!editable) return;
    const p = toPitch(e.clientX, e.clientY);
    if (!p) return;
    svg.setPointerCapture(e.pointerId);
    const target = e.target as Element;

    if (tool === "camera") {
      dragRef.current = { type: "camera", f0: toFrame(e.clientX, e.clientY), cam0: step.camera };
      return;
    }

    if (tool === "select") {
      const handle = target.closest("[data-handle]")?.getAttribute("data-handle");
      if (handle && selAnn) {
        dragRef.current = { type: "handle", id: selAnn, handle };
        return;
      }
      if (hitBall(p)) {
        dragRef.current = { type: "ball", p0: p, start: frame.ball };
        return;
      }
      const actor = hitActor(p);
      if (actor) {
        let ids: Set<string>;
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          ids = new Set(selActors);
          if (ids.has(actor)) ids.delete(actor);
          else ids.add(actor);
        } else ids = selActors.has(actor) ? selActors : new Set([actor]);
        setSelActors(ids);
        setSelAnn(null);
        const start: Record<string, Pos> = {};
        ids.forEach((id) => (start[id] = { ...(step.positions[id] ?? frame.positions[id]) }));
        if (ids.has(actor)) dragRef.current = { type: "actors", ids: [...ids], start, p0: p, moved: false };
        return;
      }
      const annId = target.closest("[data-ann]")?.getAttribute("data-ann");
      const ann = annId ? seq.annotations.find((a) => a.id === annId) : null;
      if (ann) {
        setSelAnn(ann.id);
        setSelActors(new Set());
        dragRef.current = { type: "ann", id: ann.id, p0: p, start: ann, moved: false };
        return;
      }
      const add = e.shiftKey || e.metaKey || e.ctrlKey;
      if (!add) {
        setSelActors(new Set());
        setSelAnn(null);
      }
      dragRef.current = { type: "marquee", a: p, add };
      setMarquee({ a: p, b: p });
      return;
    }

    if (isArrow(tool as AnnKind)) {
      const a = anchorAt(p);
      dragRef.current = { type: "arrow", kind: tool as ArrowKind, a };
      setDraft(newAnn(tool as AnnKind, [a, { pos: p }]));
      return;
    }
    // Zone / space: drag = regular rectangle; a plain click starts a free polygon.
    if ((tool === "zone" || tool === "space") && !draft) {
      dragRef.current = { type: "rect", kind: tool, a: p, moved: false };
      return;
    }
    if (tool === "line") {
      dragRef.current = { type: "line", a: p };
      setDraft(newAnn("line", [{ pos: p }, { pos: p }]));
    }
    // Click-based tools act on pointer-up.
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (d?.type === "pan") {
      setPan({ x: d.pan0.x + e.clientX - d.c0.x, y: d.pan0.y + e.clientY - d.c0.y });
      return;
    }
    const p = toPitch(e.clientX, e.clientY);
    if (!p) return;
    if (!d) {
      if (draft && ["zone", "space", "playerZone", "playerLine"].includes(draft.kind)) setCursor(p);
      return;
    }
    switch (d.type) {
      case "actors": {
        const dx = p.x - d.p0.x;
        const dy = p.y - d.p0.y;
        if (!d.moved && Math.hypot(dx, dy) < 0.4) return;
        d.moved = true;
        const moves: Record<string, Pos> = {};
        d.ids.forEach((id) => {
          const s = d.start[id];
          moves[id] = { x: clampPct(s.x + dx), y: clampPct(s.y + dy) };
        });
        if (propagate) actions.moveActorsPropagate(seq.id, stepIndex, moves);
        else actions.moveActors(seq.id, stepIndex, moves);
        return;
      }
      case "ball": {
        actions.setBall(seq.id, stepIndex, {
          pos: { x: clampPct(d.start.x + p.x - d.p0.x), y: clampPct(d.start.y + p.y - d.p0.y) },
        });
        return;
      }
      case "ann": {
        const dx = p.x - d.p0.x;
        const dy = p.y - d.p0.y;
        if (!d.moved && Math.hypot(dx, dy) < 0.4) return;
        d.moved = true;
        const sh = (q: Pos) => ({ x: q.x + dx, y: q.y + dy });
        actions.patchAnnotation(seq.id, d.id, {
          anchors: d.start.anchors.map((an) => ("pos" in an ? { pos: sh(an.pos) } : an)),
          ...(d.start.control ? { control: sh(d.start.control) } : {}),
        });
        return;
      }
      case "handle": {
        const ann = seq.annotations.find((a) => a.id === d.id);
        if (!ann) return;
        if (d.handle === "ctl") actions.patchAnnotation(seq.id, d.id, { control: p });
        else {
          const i = Number(d.handle.slice(1));
          actions.patchAnnotation(seq.id, d.id, {
            anchors: ann.anchors.map((an, k) => (k === i ? { pos: p } : an)),
          });
        }
        return;
      }
      case "marquee":
        setMarquee({ a: d.a, b: p });
        return;
      case "arrow":
        setDraft((dr) => (dr ? { ...dr, anchors: [d.a, { pos: p }] } : dr));
        return;
      case "rect": {
        if (!d.moved && Math.hypot(p.x - d.a.x, p.y - d.a.y) < 1) return;
        d.moved = true;
        const a = d.a;
        setDraft(newAnn(d.kind, [{ pos: a }, { pos: { x: p.x, y: a.y } }, { pos: p }, { pos: { x: a.x, y: p.y } }]));
        return;
      }
      case "line": {
        const b = e.shiftKey ? { x: p.x, y: d.a.y } : p;
        setDraft((dr) => (dr ? { ...dr, anchors: [{ pos: d.a }, { pos: b }] } : dr));
        return;
      }
      case "camera": {
        const f = toFrame(e.clientX, e.clientY);
        const z = Math.max(0.3, d.cam0.zoom);
        const dxPx = (f.x - d.f0.x) / z;
        const dyPx = (f.y - d.f0.y) / z;
        let dxPct: number;
        let dyPct: number;
        if (L.orient === "portrait") {
          dxPct = (dxPx / L.pitch.w) * 100;
          dyPct = (dyPx / L.pitch.h) * 100;
        } else {
          dyPct = -(dxPx / L.pitch.w) * 100;
          dxPct = (dyPx / L.pitch.h) * 100;
        }
        actions.patchStep(seq.id, stepIndex, {
          camera: { ...d.cam0, x: d.cam0.x - dxPct, y: d.cam0.y - dyPct },
        });
        return;
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    dragRef.current = null;
    const p = toPitch(e.clientX, e.clientY);

    if (d?.type === "ball" && p) {
      // Dropped on a player → it's now at their feet.
      const a = hitActor(p);
      if (a) actions.setBall(seq.id, stepIndex, { carrierId: a });
      return;
    }
    if (d?.type === "marquee") {
      setMarquee(null);
      if (!p) return;
      const x0 = Math.min(d.a.x, p.x);
      const x1 = Math.max(d.a.x, p.x);
      const y0 = Math.min(d.a.y, p.y);
      const y1 = Math.max(d.a.y, p.y);
      if (x1 - x0 < 0.8 && y1 - y0 < 0.8) return;
      const ids = new Set(d.add ? selActors : []);
      seq.actors.forEach((a) => {
        const q = frame.positions[a.id];
        if (q && q.x >= x0 && q.x <= x1 && q.y >= y0 && q.y <= y1) ids.add(a.id);
      });
      setSelActors(ids);
      return;
    }
    if (d?.type === "arrow") {
      if (!p || !draft) return setDraft(null);
      const end = anchorAt(p);
      const a = d.a;
      const sameActor = "actorId" in a && "actorId" in end && a.actorId === end.actorId;
      const ap = "actorId" in a ? frame.positions[a.actorId] : a.pos;
      const bp = "actorId" in end ? frame.positions[end.actorId] : end.pos;
      setDraft(null);
      if (sameActor || !ap || !bp || Math.hypot(ap.x - bp.x, ap.y - bp.y) < 2) return;
      commitAnn({ ...draft, anchors: [a, end] });
      return;
    }
    if (d?.type === "rect") {
      if (d.moved && draft && draft.anchors.length === 4) commitAnn(draft);
      setDraft(d.moved ? null : newAnn(d.kind, [{ pos: d.a }]));
      return;
    }
    if (d?.type === "line") {
      if (draft) {
        const [a, b] = draft.anchors as { pos: Pos }[];
        if (Math.hypot(a.pos.x - b.pos.x, a.pos.y - b.pos.y) > 2) commitAnn(draft);
      }
      setDraft(null);
      return;
    }
    if (d) return;
    if (!editable || !p || e.button !== 0) return;

    // ----- click-based tools -----
    if (tool === "zone" || tool === "space") {
      if (draft && draft.anchors.length >= 3) {
        const first = (draft.anchors[0] as { pos: Pos }).pos;
        const c0 = toLocal(L, first);
        const c1 = toLocal(L, p);
        if (Math.hypot(c0.x - c1.x, c0.y - c1.y) < R * 0.8) return finishPolygon();
      }
      setDraft((dr) => (dr ? { ...dr, anchors: [...dr.anchors, { pos: p }] } : newAnn(tool, [{ pos: p }])));
      return;
    }
    if (tool === "playerZone" || tool === "playerLine") {
      const a = hitActor(p);
      if (!a) return;
      if (draft) {
        const first = draft.anchors[0];
        if (tool === "playerZone" && draft.anchors.length >= 3 && "actorId" in first && first.actorId === a)
          return finishPolygon();
        if (draft.anchors.some((an) => "actorId" in an && an.actorId === a)) return;
      }
      setDraft((dr) =>
        dr ? { ...dr, anchors: [...dr.anchors, { actorId: a }] } : newAnn(tool, [{ actorId: a }]),
      );
      return;
    }
    if (tool === "marking") {
      const a = hitActor(p);
      if (!a) return;
      if (!draft) return setDraft(newAnn("marking", [{ actorId: a }]));
      const first = draft.anchors[0];
      if ("actorId" in first && first.actorId !== a) commitAnn({ ...draft, anchors: [first, { actorId: a }] });
      setDraft(null);
      return;
    }
    if (tool === "circle") {
      commitAnn(newAnn("circle", [anchorAt(p)]));
      return;
    }
    if (tool === "label") {
      commitAnn(newAnn("label", [anchorAt(p)], { text: "Texte" }));
    }
  };

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
      if (t && /^(input|textarea|select|button)$/i.test(t.tagName)) {
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
        {topSlot && (
          <SeqTopTools
            slot={topSlot}
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

const toolTitle = (t: SeqTool) => `${TOOL_LABEL[t]}${TOOL_KEY[t] ? ` (${TOOL_KEY[t]})` : ""} : ${TOOL_HINT[t]}`;

const GRID_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18M15 3v18M3 9h18M3 15h18" strokeDasharray="2 2" />
  </svg>
);

interface TopToolsProps {
  slot: HTMLElement;
  tool: SeqTool;
  onTool: (t: SeqTool) => void;
  showGrid: boolean;
  onGrid: () => void;
  zoomPct: number;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onZoomIn: () => void;
  onPreview: () => void;
  onPng: () => void;
  pngTitle: string;
  onVideo: (() => void) | null;
}

// Séquence tools, portalled into the app's top bar. When they don't fit, the
// arrow/shape groups collapse into dropdowns and view/export go into a "⋯"
// menu (Aperçu stays visible); they expand again once there's room.
function SeqTopTools(p: TopToolsProps) {
  // 0 = icons + labels, 1 = icons only, 2 = dropdown menus. Step down while
  // the tools overflow; step back up once the width the previous level
  // needed is available again.
  const [level, setLevel] = useState(0);
  const widths = useRef<number[]>([]);
  useLayoutEffect(() => {
    const el = p.slot;
    const check = () => {
      if (level < 2 && el.scrollWidth > el.clientWidth + 1) {
        widths.current[level] = el.scrollWidth;
        setLevel(level + 1);
      } else if (level > 0 && el.clientWidth >= widths.current[level - 1]) setLevel(level - 1);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [p.slot, level]);
  const compact = level === 2;

  const toolBtn = (t: SeqTool, inMenu = false) => (
    <button
      key={t}
      type="button"
      className={`${inMenu ? "seq-menu__item" : "seq-tool"} seq-tool--${t} ${p.tool === t ? "is-active" : ""}`}
      onClick={() => p.onTool(t)}
      title={toolTitle(t)}
      aria-pressed={p.tool === t}
    >
      <ToolIcon tool={t} />
      <span>{TOOL_LABEL[t]}</span>
    </button>
  );
  const groups = TOOL_GROUPS.slice(0, -1);
  const gridBtn = (cls: string) => (
    <button type="button" className={`${cls} ${p.showGrid ? "is-active" : ""}`} onClick={p.onGrid} aria-pressed={p.showGrid}
      title="Afficher la grille positionnelle (couloirs et zones, comme sur l'onglet Compo), visible aussi dans la vidéo">
      {GRID_ICON}
      <span>Grille</span>
    </button>
  );
  const zoom = (
    <>
      <button type="button" className="seq-tool" onClick={p.onZoomOut} title="Dézoomer la vue" aria-label="Dézoomer">−</button>
      <button type="button" className="seq-tool seq-tool--pct" onClick={p.onZoomFit} title="Ajuster la vue">{p.zoomPct}%</button>
      <button type="button" className="seq-tool" onClick={p.onZoomIn} title="Zoomer la vue" aria-label="Zoomer">+</button>
    </>
  );
  const preview = (
    <button type="button" className="seq-tool seq-tool--cta" onClick={p.onPreview} title="Aperçu plein écran, sans l'interface">
      ▶ Aperçu
    </button>
  );

  return createPortal(
    compact ? (
      <div className="seq-toolbar seq-toolbar--top" role="toolbar" aria-label="Outils">
        <div className="seq-toolbar__group">
          {groups.map((g, gi) => {
            if (g.tools.length === 1) return toolBtn(g.tools[0]);
            const cur = g.tools.includes(p.tool) ? p.tool : null;
            return (
              <ToolMenu key={gi} active={!!cur} title={g.label} button={<ToolIcon tool={cur ?? g.tools[0]} />}>
                {g.tools.map((t) => toolBtn(t, true))}
              </ToolMenu>
            );
          })}
          {toolBtn("camera")}
        </div>
        <div className="seq-toolbar__group">
          {preview}
          <ToolMenu title="Vue et export" button={<span className="seq-tool__more">⋯</span>}>
            {gridBtn("seq-menu__item")}
            <div className="seq-menu__row" data-keep>{zoom}</div>
            <button type="button" className="seq-menu__item" onClick={p.onPng} title={p.pngTitle}>
              <span>Exporter en PNG</span>
            </button>
            {p.onVideo && (
              <button type="button" className="seq-menu__item" onClick={p.onVideo} title="Exporter la séquence en vidéo MP4">
                <span>Exporter en vidéo</span>
              </button>
            )}
          </ToolMenu>
        </div>
      </div>
    ) : (
      <div className={`seq-toolbar seq-toolbar--top ${level ? "seq-toolbar--icons" : ""}`} role="toolbar" aria-label="Outils">
        {groups.map((g, gi) => (
          <div key={gi} className="seq-toolbar__group">
            {g.label && <span className="seq-toolbar__label">{g.label}</span>}
            {g.tools.map((t) => toolBtn(t))}
          </div>
        ))}
        <div className="seq-toolbar__group">{toolBtn("camera")}</div>
        <div className="seq-toolbar__group">
          {gridBtn("seq-tool")}
          {zoom}
        </div>
        <div className="seq-toolbar__group">
          {preview}
          <button type="button" className="seq-tool" onClick={p.onPng} title={p.pngTitle}>PNG</button>
          {p.onVideo && (
            <button type="button" className="seq-tool" onClick={p.onVideo} title="Exporter la séquence en vidéo MP4">Vidéo</button>
          )}
        </div>
      </div>
    ),
    p.slot,
  );
}

// Toolbar button opening a small floating menu (portalled, fixed, so the top
// bar can't clip it). Clicking an item closes it, except inside [data-keep].
function ToolMenu({ button, title, active, children }: { button: React.ReactNode; title: string; active?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - 220)), top: r.bottom + 6 });
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const close = () => setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`seq-tool seq-tool--menu ${active ? "is-active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {button}
        <i className="seq-tool__chev" aria-hidden="true">▾</i>
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="seq-menu"
            role="menu"
            style={{ left: pos.left, top: pos.top }}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest("[data-keep]")) setOpen(false);
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}

// Small inline icons for the toolbar.
function ToolIcon({ tool }: { tool: SeqTool }) {
  const s = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (tool) {
    case "select":
      return <svg {...s}><path d="M5 3l14 8-6 2-3 6z" /></svg>;
    case "pass":
      return <svg {...s}><path d="M4 18L18 6" strokeDasharray="3 3" /><path d="M12 6h6v6" /></svg>;
    case "run":
      return <svg {...s}><path d="M4 18L18 6" /><path d="M12 6h6v6" /></svg>;
    case "dribble":
      return <svg {...s}><path d="M3 17c2-3 4 1 6-2s4 1 6-2 2-3 3-4" /><path d="M14 6h5v5" /></svg>;
    case "deep":
      return <svg {...s} strokeWidth={3}><path d="M12 21V5" /><path d="M6 10l6-6 6 6" /></svg>;
    case "press":
      return <svg {...s} stroke="#ff4d4f"><path d="M4 12h13" /><path d="M13 7l5 5-5 5" /></svg>;
    case "zone":
      return <svg {...s}><path d="M5 18L8 5l11 4-3 10z" fill="currentColor" fillOpacity={0.2} /></svg>;
    case "space":
      return <svg {...s} strokeDasharray="3 2"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 19L18 9M4 15L14 5" strokeDasharray="" /></svg>;
    case "playerZone":
      return <svg {...s}><path d="M6 17L12 5l6 12z" fill="currentColor" fillOpacity={0.2} /><circle cx="6" cy="17" r="2" /><circle cx="12" cy="5" r="2" /><circle cx="18" cy="17" r="2" /></svg>;
    case "playerLine":
      return <svg {...s}><path d="M3 14l6-2 6 2 6-2" /><circle cx="3" cy="14" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="14" r="1.6" /><circle cx="21" cy="12" r="1.6" /></svg>;
    case "marking":
      return <svg {...s}><circle cx="6" cy="16" r="3" /><circle cx="18" cy="8" r="3" /><path d="M8.5 14.5l7-5" strokeDasharray="2 2" /></svg>;
    case "circle":
      return <svg {...s}><circle cx="12" cy="12" r="8" /></svg>;
    case "line":
      return <svg {...s} strokeDasharray="4 3"><path d="M3 12h18" /></svg>;
    case "label":
      return <svg {...s}><path d="M5 6h14M12 6v13" /></svg>;
    case "camera":
      return <svg {...s}><path d="M3 8V5h3M21 8V5h-3M3 16v3h3M21 16v3h-3" /><circle cx="12" cy="12" r="3" /></svg>;
  }
}
