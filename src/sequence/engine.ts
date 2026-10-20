// Pure timing + interpolation for a Sequence: given a time t (ms), compute
// the exact state of the board. Everything the stage draws is derived from
// this single t, so players, ball, arrows and captions can never drift apart,
// and the video export can render any instant deterministically.
import type { Pos } from "../types";
import type {
  Anchor,
  BallState,
  Camera,
  Easing,
  SeqAnnotation,
  SeqStep,
  Sequence,
} from "./types";

export interface StepSpan {
  index: number;
  start: number; // ms — beginning of the transition into this step
  arrive: number; // ms — the board reaches the step exactly (hold starts)
  end: number; // ms — end of hold
}

// Every step plays its transition, the first one too: nothing moves into it,
// but its graphics draw themselves in (an intro).
export const effectiveTransition = (steps: SeqStep[], i: number) => Math.max(0, steps[i].transitionMs);

export function stepSpans(steps: SeqStep[]): StepSpan[] {
  const spans: StepSpan[] = [];
  let t = 0;
  steps.forEach((s, i) => {
    const tr = effectiveTransition(steps, i);
    const start = t;
    const arrive = start + tr;
    const end = arrive + Math.max(0, s.holdMs);
    spans.push({ index: i, start, arrive, end });
    t = end;
  });
  return spans;
}

export const totalDuration = (steps: SeqStep[]) => {
  const spans = stepSpans(steps);
  return spans.length ? spans[spans.length - 1].end : 0;
};

export function ease(p: number, easing: Easing): number {
  const c = Math.min(1, Math.max(0, p));
  if (easing === "linear") return c;
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const lerpPos = (a: Pos, b: Pos, t: number): Pos => ({
  x: lerp(a.x, b.x, t),
  y: lerp(a.y, b.y, t),
});

// Point on a quadratic Bézier.
export function quadAt(a: Pos, c: Pos, b: Pos, t: number): Pos {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

export interface Playhead {
  index: number; // current step (the one being travelled to, or held)
  from: number; // previous step while transitioning, else = index
  p: number; // raw transition progress 0..1 (1 while holding)
  e: number; // eased progress
  segT: number; // 0..1 progress through the whole step segment (transition + hold)
  holding: boolean;
}

// `prefer`: step picked in the editor. Steps with no hold followed by steps
// with no transition share the same instant; this says which one is meant.
export function playheadAt(steps: SeqStep[], t: number, prefer?: number): Playhead {
  const spans = stepSpans(steps);
  if (!spans.length) return { index: 0, from: 0, p: 1, e: 1, segT: 0, holding: true };
  const last = spans[spans.length - 1];
  const tc = Math.min(Math.max(0, t), last.end);
  // A step with no hold (arrive === end) still owns the instant it arrives,
  // so it can be selected and edited.
  let span = spans.find((s) => tc < s.end || (tc === s.arrive && s.end === s.arrive)) ?? last;
  // Exactly at the end of a hold → we're still on that step.
  if (tc === last.end) span = last;
  if (prefer != null && spans[prefer] && spans[prefer].arrive === tc) span = spans[prefer];
  const i = span.index;
  const segLen = Math.max(1, span.end - span.start);
  const segT = (tc - span.start) / segLen;
  if (tc < span.arrive) {
    const p = (tc - span.start) / Math.max(1, span.arrive - span.start);
    return { index: i, from: Math.max(0, i - 1), p, e: ease(p, steps[i].easing), segT, holding: false };
  }
  return { index: i, from: i, p: 1, e: 1, segT, holding: true };
}

// Ball offset from a carrier's centre (in pitch %), so it sits "at the feet".
const BALL_OFFSET = { x: 1.6, y: -1.4 };

export function ballAt(ball: BallState, positions: Record<string, Pos>): Pos {
  if ("carrierId" in ball) {
    const c = positions[ball.carrierId];
    if (c) return { x: c.x + BALL_OFFSET.x, y: c.y + BALL_OFFSET.y };
    return { x: 50, y: 50 };
  }
  return ball.pos;
}

export function anchorPos(a: Anchor, positions: Record<string, Pos>): Pos | null {
  if ("actorId" in a) return positions[a.actorId] ?? null;
  return a.pos;
}

export interface AnnFrame {
  ann: SeqAnnotation;
  visibility: number; // 0..1 opacity
  progress: number; // 0..1 draw progress (arrows draw themselves in)
}

export interface GhostFrame {
  actorId: string;
  from: Pos;
  to: Pos;
  opacity: number;
}

// Highlighter trail: the path a player just travelled, fading out shortly
// after arrival.
export interface TrailFrame {
  actorId: string;
  from: Pos;
  to: Pos;
  opacity: number;
}

// How long a trail lingers once the player has arrived.
export const TRAIL_FADE_MS = 1600;

export interface FrameState {
  head: Playhead;
  positions: Record<string, Pos>;
  ball: Pos;
  camera: Camera;
  annotations: AnnFrame[];
  ghosts: GhostFrame[];
  trails: TrailFrame[];
  focus: Record<string, number>; // actorId → halo strength 0..1
  dim: number; // 0..1 how much non-focused actors are faded
  caption: { text: string; karaoke: boolean; t: number; opacity: number } | null;
  effect: { kind: "flash" | "bigText"; text: string; color: string; strength: number } | null;
  chapterIndex: number; // -1 when no chapter
  chapters: { title: string; start: number; end: number }[];
  time: number;
  duration: number;
}

function positionsOf(seq: Sequence, step: SeqStep): Record<string, Pos> {
  const out: Record<string, Pos> = {};
  seq.actors.forEach((a) => {
    out[a.id] = step.positions[a.id] ?? { x: 50, y: 50 };
  });
  return out;
}

const stepIndexById = (steps: SeqStep[]) => {
  const m = new Map<string, number>();
  steps.forEach((s, i) => m.set(s.id, i));
  return m;
};

export function annVisibleAt(
  ann: SeqAnnotation,
  idx: Map<string, number>,
  i: number,
): boolean {
  const a = idx.get(ann.fromStep);
  const b = idx.get(ann.toStep);
  if (a == null || b == null) return false;
  return i >= Math.min(a, b) && i <= Math.max(a, b);
}

export function chaptersOf(steps: SeqStep[]) {
  const spans = stepSpans(steps);
  const out: { title: string; start: number; end: number; firstStep: number }[] = [];
  steps.forEach((s, i) => {
    if (s.chapter && s.chapter.trim()) {
      if (out.length) out[out.length - 1].end = spans[i].start;
      out.push({ title: s.chapter.trim(), start: spans[i].start, end: spans[spans.length - 1].end, firstStep: i });
    }
  });
  return out;
}

// Idle micro-movement ("living" players): a slow, smooth drift around the
// step position, different for every player (seeded by id) and computed from
// t alone, so preview and export always match. Amplitude in pitch %.
const IDLE_AMP = [0, 0.45, 0.8, 1.3];

function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

function idleOffset(id: string, t: number, amp: number): Pos {
  const r = seedOf(id) * 1000;
  const wave = (k: number) => {
    // two incommensurate sines (periods ~2.5–6 s) read as organic drift
    const w1 = 0.0011 + 0.0012 * ((r * (k + 1) * 0.37) % 1);
    const w2 = 0.0023 + 0.0014 * ((r * (k + 2) * 0.61) % 1);
    return (Math.sin(w1 * t + r * (k + 3)) + 0.55 * Math.sin(w2 * t + r * (k + 5))) / 1.55;
  };
  return { x: wave(0) * amp, y: wave(1) * amp };
}

// live=false (paused editor) freezes the idle micro-movement.
export function frameAt(seq: Sequence, t: number, live = true, prefer?: number): FrameState {
  const steps = seq.steps;
  const duration = totalDuration(steps);
  const head = playheadAt(steps, t, prefer);
  const to = steps[head.index];
  const from = steps[head.from];

  const posFrom = positionsOf(seq, from);
  const posTo = positionsOf(seq, to);
  const positions: Record<string, Pos> = {};
  Object.keys(posTo).forEach((id) => {
    positions[id] = lerpPos(posFrom[id], posTo[id], head.e);
  });
  const idleAmp = live ? IDLE_AMP[seq.idle ?? 0] : 0;
  if (idleAmp > 0)
    seq.actors.forEach((a) => {
      const p = positions[a.id];
      if (!p || a.idle === false) return;
      const o = idleOffset(a.id, t, idleAmp);
      positions[a.id] = { x: p.x + o.x, y: p.y + o.y };
    });

  // Ball: each end is evaluated against the *current* player positions, so a
  // carried ball follows its carrier; a carrier change is a pass that leaves
  // slightly after the movement starts and lands as it ends.
  const bFrom = ballAt(from.ball, positions);
  const bTo = ballAt(to.ball, positions);
  let ball = bTo;
  if (!head.holding) {
    const sameCarrier =
      "carrierId" in from.ball &&
      "carrierId" in to.ball &&
      from.ball.carrierId === to.ball.carrierId;
    if (sameCarrier) ball = bTo;
    else {
      const pb = Math.min(1, Math.max(0, (head.p - 0.12) / 0.76));
      const eb = ease(pb, "easeInOut");
      // Follow a curved pass arrow drawn between the two carriers, if any.
      const pass =
        "carrierId" in from.ball && "carrierId" in to.ball
          ? seq.annotations.find(
              (a) =>
                a.kind === "pass" &&
                a.control &&
                a.anchors.length === 2 &&
                "actorId" in a.anchors[0] &&
                "actorId" in a.anchors[1] &&
                a.anchors[0].actorId === (from.ball as { carrierId: string }).carrierId &&
                a.anchors[1].actorId === (to.ball as { carrierId: string }).carrierId,
            )
          : undefined;
      ball = pass?.control ? quadAt(bFrom, pass.control, bTo, eb) : lerpPos(bFrom, bTo, eb);
    }
  }

  const camera: Camera = {
    x: lerp(from.camera.x, to.camera.x, head.e),
    y: lerp(from.camera.y, to.camera.y, head.e),
    zoom: lerp(from.camera.zoom, to.camera.zoom, head.e),
  };

  const idx = stepIndexById(steps);
  const annotations: AnnFrame[] = [];
  seq.annotations.forEach((ann) => {
    const inTo = annVisibleAt(ann, idx, head.index);
    const inFrom = head.from !== head.index && annVisibleAt(ann, idx, head.from);
    let visibility = 0;
    let progress = 1;
    if (head.holding) visibility = inTo ? 1 : 0;    else if (inFrom && inTo) visibility = 1;
    else if (inTo) {
      visibility = Math.min(1, head.p * 2.5);
      progress = head.e;
    } else if (inFrom) visibility = 1 - Math.min(1, head.p * 2);
    if (visibility > 0.001) annotations.push({ ann, visibility, progress });
  });

  // Ghosts: where moved players stood on the previous step.
  const ghosts: GhostFrame[] = [];
  if (to.ghosts && head.index > 0) {
    const prev = positionsOf(seq, steps[head.index - 1]);
    const opacity = head.holding ? 1 : Math.min(1, head.p * 3);
    seq.actors.forEach((a) => {
      const f = prev[a.id];
      const tt = posTo[a.id];
      if (Math.hypot(f.x - tt.x, f.y - tt.y) > 2.5)
        ghosts.push({ actorId: a.id, from: f, to: positions[a.id], opacity });
    });
  }

  // Trails: drawn while moving, then fading out during the hold.
  const trails: TrailFrame[] = [];
  if (head.index > 0) {
    const prev = head.holding ? positionsOf(seq, steps[head.index - 1]) : posFrom;
    let opacity = 1;
    if (head.holding) {
      const since = Math.max(0, t - stepSpans(steps)[head.index].arrive);
      opacity = Math.max(0, 1 - since / TRAIL_FADE_MS);
    }
    if (opacity > 0.01)
      seq.actors.forEach((a) => {
        if (!a.trail) return;
        const f = prev[a.id];
        const tt = posTo[a.id];
        if (f && tt && Math.hypot(f.x - tt.x, f.y - tt.y) > 1.5)
          trails.push({ actorId: a.id, from: f, to: positions[a.id], opacity });
      });
  }

  // Focus halo / dimming cross-fade between the two steps.
  const focus: Record<string, number> = {};
  const fFrom = new Set(from.focusIds ?? []);
  const fTo = new Set(to.focusIds ?? []);
  seq.actors.forEach((a) => {
    const v = lerp(fFrom.has(a.id) ? 1 : 0, fTo.has(a.id) ? 1 : 0, head.e);
    if (v > 0) focus[a.id] = v;
  });
  const dimOf = (s: SeqStep) => (s.dimOthers && (s.focusIds?.length ?? 0) > 0 ? 1 : 0);
  const dim = lerp(dimOf(from), dimOf(to), head.e);

  const caption = to.caption?.trim()
    ? {
        text: to.caption.trim(),
        karaoke: !!to.karaoke,
        t: head.segT,
        opacity: Math.min(1, head.segT * 12),
      }
    : null;

  let effect: FrameState["effect"] = null;
  if (to.effect === "flash") {
    effect = {
      kind: "flash",
      text: "",
      color: to.effectColor || "#ff2d3a",
      strength: Math.max(0, 1 - head.segT * 1.4),
    };
  } else if (to.effect === "bigText" && to.effectText?.trim()) {
    effect = {
      kind: "bigText",
      text: to.effectText.trim(),
      color: to.effectColor || seq.theme.accent,
      strength: Math.min(1, head.segT * 6) * Math.min(1, (1 - head.segT) * 8),
    };
  }

  const chapters = chaptersOf(steps);
  let chapterIndex = -1;
  chapters.forEach((c, i) => {
    if (c.firstStep <= head.index) chapterIndex = i;
  });

  return {
    head,
    positions,
    ball,
    camera,
    annotations,
    ghosts,
    trails,
    focus,
    dim,
    caption,
    effect,
    chapterIndex,
    chapters: chapters.map(({ title, start, end }) => ({ title, start, end })),
    time: Math.min(Math.max(0, t), duration),
    duration,
  };
}
