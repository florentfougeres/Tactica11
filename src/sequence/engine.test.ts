import { describe, expect, it } from "vitest";
import { frameAt, playheadAt, stepSpans, totalDuration } from "./engine";
import { blankStep } from "./create";
import { DEFAULT_THEME } from "./types";
import type { SeqAnnotation, SeqStep, Sequence } from "./types";

// Two actors, A carrying the ball; each step moves A along x.
function makeSeq(timings: [transition: number, hold: number][], extra: Partial<Sequence> = {}): Sequence {
  const steps: SeqStep[] = timings.map(([tr, hold], i) => ({
    ...blankStep({ a: { x: 10 + i * 20, y: 50 }, b: { x: 50, y: 20 } }, { carrierId: "a" }),
    id: `s${i}`,
    transitionMs: tr,
    holdMs: hold,
    easing: "linear",
  }));
  return {
    id: "q",
    name: "test",
    format: "9:16",
    orient: "portrait",
    title: "",
    subtitle: "",
    showNames: true,
    discMode: "role",
    theme: { ...DEFAULT_THEME },
    actors: [
      { id: "a", team: "home" },
      { id: "b", team: "away" },
    ],
    steps,
    annotations: [],
    ...extra,
  };
}

const arrow = (from: string, to: string): SeqAnnotation => ({
  id: "ann",
  kind: "run",
  anchors: [{ actorId: "a" }, { pos: { x: 90, y: 50 } }],
  color: "#fff",
  fromStep: from,
  toStep: to,
});

describe("stepSpans", () => {
  it("chains transition then hold, the first step included", () => {
    const q = makeSeq([[500, 1000], [800, 0], [0, 400]]);
    expect(stepSpans(q.steps)).toEqual([
      { index: 0, start: 0, arrive: 500, end: 1500 },
      { index: 1, start: 1500, arrive: 2300, end: 2300 },
      { index: 2, start: 2300, arrive: 2300, end: 2700 },
    ]);
    expect(totalDuration(q.steps)).toBe(2700);
  });

  it("clamps negative timings to zero", () => {
    const q = makeSeq([[-100, -5]]);
    expect(stepSpans(q.steps)[0]).toEqual({ index: 0, start: 0, arrive: 0, end: 0 });
  });
});

describe("playheadAt", () => {
  it("is in transition before arrival, holding after", () => {
    const q = makeSeq([[0, 1000], [1000, 1000]]);
    const mid = playheadAt(q.steps, 1500);
    expect(mid).toMatchObject({ index: 1, from: 0, holding: false });
    expect(mid.p).toBeCloseTo(0.5);
    expect(playheadAt(q.steps, 2500)).toMatchObject({ index: 1, from: 1, holding: true });
  });

  it("plays the first step's transition as an intro", () => {
    const q = makeSeq([[1000, 1000]]);
    expect(playheadAt(q.steps, 500)).toMatchObject({ index: 0, from: 0, holding: false });
  });

  it("keeps the last step at the very end", () => {
    const q = makeSeq([[0, 1000], [500, 500]]);
    expect(playheadAt(q.steps, 2000).index).toBe(1);
    expect(playheadAt(q.steps, 99999).index).toBe(1);
  });

  it("lets a step with no hold own its arrival instant", () => {
    const q = makeSeq([[0, 1000], [800, 0], [800, 1000]]);
    const spans = stepSpans(q.steps);
    expect(playheadAt(q.steps, spans[1].arrive)).toMatchObject({ index: 1, holding: true });
  });

  it("uses the picked step when two steps share an instant", () => {
    // step 1 has no hold, step 2 no transition: both sit at t = 1800
    const q = makeSeq([[0, 1000], [800, 0], [0, 1000]]);
    const spans = stepSpans(q.steps);
    expect(spans[1].arrive).toBe(spans[2].arrive);
    expect(playheadAt(q.steps, spans[1].arrive, 1).index).toBe(1);
    expect(playheadAt(q.steps, spans[2].arrive, 2).index).toBe(2);
    // a stale pick that doesn't match the instant is ignored
    expect(playheadAt(q.steps, 500, 2).index).toBe(0);
  });
});

describe("frameAt", () => {
  it("interpolates positions and keeps the ball at the carrier's feet", () => {
    const q = makeSeq([[0, 1000], [1000, 1000]]);
    const f = frameAt(q, 1500);
    expect(f.positions.a.x).toBeCloseTo(20);
    expect(f.ball.x).toBeGreaterThan(f.positions.a.x);
  });

  it("draws a step's arrow in during its transition, intro included", () => {
    const q = makeSeq([[1000, 1000]], {});
    q.annotations = [arrow("s0", "s0")];
    const start = frameAt(q, 0).annotations[0];
    expect(start?.visibility ?? 0).toBe(0);
    const mid = frameAt(q, 500).annotations[0];
    expect(mid.progress).toBeCloseTo(0.5);
    const held = frameAt(q, 1500).annotations[0];
    expect(held).toMatchObject({ visibility: 1, progress: 1 });
  });

  it("keeps an arrow spanning two steps fully drawn across the transition", () => {
    const q = makeSeq([[0, 1000], [1000, 1000]]);
    q.annotations = [arrow("s0", "s1")];
    expect(frameAt(q, 1500).annotations[0]).toMatchObject({ visibility: 1, progress: 1 });
  });

  it("only draws trails for players that have them", () => {
    const q = makeSeq([[0, 1000], [1000, 1000]]);
    expect(frameAt(q, 1500).trails).toHaveLength(0);
    q.actors[0].trail = true;
    expect(frameAt(q, 1500).trails.map((t) => t.actorId)).toEqual(["a"]);
  });

  it("adds idle micro-movement only when live, and deterministically", () => {
    const q = makeSeq([[0, 5000]], { idle: 2 });
    const still = frameAt(q, 2000, false).positions.a;
    expect(still).toEqual({ x: 10, y: 50 });
    const live1 = frameAt(q, 2000).positions.a;
    const live2 = frameAt(q, 2000).positions.a;
    expect(live1).toEqual(live2);
    expect(Math.hypot(live1.x - 10, live1.y - 50)).toBeGreaterThan(0);
    expect(Math.hypot(live1.x - 10, live1.y - 50)).toBeLessThan(2);
    q.actors[0].idle = false;
    expect(frameAt(q, 2000).positions.a).toEqual({ x: 10, y: 50 });
  });
});
