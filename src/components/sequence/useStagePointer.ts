// Pointer interaction on the Séquence stage: hit testing, tools (arrows,
// shapes, rectangles, labels…), dragging players / ball / handles / camera,
// marquee selection and panning.
import type { Dispatch, PointerEvent as ReactPointerEvent, MutableRefObject, RefObject, SetStateAction } from "react";
import type { Pos } from "../../types";
import { pxToPos } from "../../types";
import type { SequenceActions } from "../../hooks/useSequenceActions";
import type { Anchor, AnnKind, ArrowKind, Camera, SeqAnnotation, SeqStep, Sequence } from "../../sequence/types";
import { defaultAnnColor, discScale, isArrow } from "../../sequence/types";
import type { FrameState } from "../../sequence/engine";
import { toLocal, type FrameLayout } from "../../sequence/layout";
import { sid } from "../../sequence/create";
import type { SeqTool } from "./SeqTopTools";

export type Drag =
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

export const clampPct = (v: number) => Math.min(104, Math.max(-4, v));

type Setter<T> = Dispatch<SetStateAction<T>>;

export interface StagePointerCtx {
  seq: Sequence;
  step: SeqStep;
  stepIndex: number;
  editable: boolean;
  tool: SeqTool;
  frame: FrameState;
  L: FrameLayout;
  actions: SequenceActions;
  propagate: boolean;
  draft: SeqAnnotation | null;
  setDraft: Setter<SeqAnnotation | null>;
  setCursor: Setter<Pos | null>;
  setMarquee: Setter<{ a: Pos; b: Pos } | null>;
  selActors: Set<string>;
  setSelActors: Setter<Set<string>>;
  selAnn: string | null;
  setSelAnn: Setter<string | null>;
  setFocusLabel: Setter<number>;
  dragRef: MutableRefObject<Drag | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  camRef: RefObject<SVGGElement | null>;
  spaceDown: MutableRefObject<boolean>;
  pan: { x: number; y: number };
  setPan: Setter<{ x: number; y: number }>;
}

export function useStagePointer(ctx: StagePointerCtx) {
  const {
    seq, step, stepIndex, editable, tool, frame, L, actions, propagate, draft, setDraft, setCursor, setMarquee,
    selActors, setSelActors, selAnn, setSelAnn, setFocusLabel, dragRef, svgRef, camRef, spaceDown, pan, setPan,
  } = ctx;
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

  // ----- pointer handling on the stage -----
  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
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

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
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

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
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

  return { onPointerDown, onPointerMove, onPointerUp, finishPolygon };
}
