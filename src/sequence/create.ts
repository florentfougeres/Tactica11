// Building / migrating sequences. Kept free of storage.ts imports (storage
// itself calls migrateSequence) to avoid an import cycle.
import type { Lineup, Phase, Pos } from "../types";
import { OPPONENT_FORMATION } from "../types";
import type {
  Anchor,
  SeqActor,
  SeqAnnotation,
  SeqStep,
  Sequence,
  SeqPreset,
} from "./types";
import { DEFAULT_CAMERA, PRESET_THEMES, defaultAnnColor } from "./types";

export const sid = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

export const DEFAULT_TRANSITION_MS = 1200;
export const DEFAULT_HOLD_MS = 1000;

export function blankStep(positions: Record<string, Pos>, ball: SeqStep["ball"]): SeqStep {
  return {
    id: sid("step"),
    positions,
    ball,
    camera: { ...DEFAULT_CAMERA },
    transitionMs: DEFAULT_TRANSITION_MS,
    holdMs: DEFAULT_HOLD_MS,
    easing: "easeInOut",
  };
}

// New sequence seeded from one phase of a compo: our XI, the opponents (the
// phase's own discs when it has some, else the default block) and that
// phase's drawings turned into annotations.
export function createSequence(
  lineup: Lineup,
  phase: Phase,
  name: string,
  preset: SeqPreset = "cinema",
): Sequence {
  const actors: SeqActor[] = [];
  const positions: Record<string, Pos> = {};

  lineup.slots.forEach((slot) => {
    const id = sid("act");
    actors.push({ id, team: "home", slotId: slot.id, gk: slot.role === "G" });
    positions[id] = { ...slot.positions[phase] };
  });

  const opp =
    phase !== "base" && (lineup.opponents?.length ?? 0) > 0
      ? lineup.opponents!.map((o) => ({ label: o.label, pos: o.positions[phase] }))
      : OPPONENT_FORMATION.map((o) => ({ label: o.label, pos: { x: o.x, y: o.y } }));
  opp.forEach((o) => {
    const id = sid("act");
    actors.push({ id, team: "away", label: o.label, gk: o.label === "1" });
    positions[id] = { ...o.pos };
  });

  // Ball at the feet of the home player closest to the centre circle.
  const home = actors.filter((a) => a.team === "home" && !a.gk);
  let carrier = home[0];
  let best = Infinity;
  home.forEach((a) => {
    const p = positions[a.id];
    const d = Math.hypot(p.x - 50, p.y - 62);
    if (d < best) {
      best = d;
      carrier = a;
    }
  });

  const first = blankStep(positions, carrier ? { carrierId: carrier.id } : { pos: { x: 50, y: 50 } });
  first.name = "Situation initiale";
  first.holdMs = 1500;

  const theme = { ...PRESET_THEMES[preset] };
  const annotations: SeqAnnotation[] = [];
  (lineup.drawings?.[phase] ?? []).forEach((d) => {
    const kind =
      d.tool === "arrow" ? "run" : d.tool === "dashed" ? "pass" : d.tool === "zone" ? "zone" : null;
    if (!kind) return;
    const anchors: Anchor[] =
      kind === "zone"
        ? d.points.map((p) => ({ pos: p }))
        : [{ pos: d.points[0] }, { pos: d.points[d.points.length - 1] }];
    annotations.push({
      id: sid("ann"),
      kind,
      anchors,
      color: kind === "zone" ? d.color : defaultAnnColor(kind, theme),
      fromStep: first.id,
      toStep: first.id,
    });
  });

  return {
    id: sid("seq"),
    name,
    format: "9:16",
    squareOrient: "portrait",
    preset,
    title: lineup.name,
    subtitle: lineup.formation,
    showNames: true,
    showNumbers: true,
    theme,
    actors,
    steps: [first],
    annotations,
  };
}

// Duplicate a step (the core "next step" gesture): same board, fresh id,
// caption/effects cleared since they describe one moment only.
export function duplicateStep(step: SeqStep): SeqStep {
  return {
    ...step,
    id: sid("step"),
    name: undefined,
    positions: { ...step.positions },
    camera: { ...step.camera },
    caption: undefined,
    chapter: undefined,
    effect: undefined,
    effectText: undefined,
    focusIds: step.focusIds ? [...step.focusIds] : undefined,
    transitionMs: step.transitionMs || DEFAULT_TRANSITION_MS,
  };
}

// Defensive normalisation of a stored / imported sequence.
export function migrateSequence(q: Sequence): Sequence {
  const preset: SeqPreset = q.preset === "sober" ? "sober" : "cinema";
  const actors = (q.actors ?? []).filter((a) => a && a.id);
  const ids = new Set(actors.map((a) => a.id));
  const steps = (q.steps ?? []).map((s) => ({
    ...s,
    positions: s.positions ?? {},
    ball:
      s.ball && ("carrierId" in s.ball ? ids.has(s.ball.carrierId) : "pos" in s.ball)
        ? s.ball
        : { pos: { x: 50, y: 50 } },
    camera: s.camera ?? { ...DEFAULT_CAMERA },
    transitionMs: Number.isFinite(s.transitionMs) ? s.transitionMs : DEFAULT_TRANSITION_MS,
    holdMs: Number.isFinite(s.holdMs) ? s.holdMs : DEFAULT_HOLD_MS,
    easing: s.easing === "linear" ? ("linear" as const) : ("easeInOut" as const),
  }));
  const stepIds = new Set(steps.map((s) => s.id));
  return {
    ...q,
    format: q.format === "16:9" || q.format === "1:1" ? q.format : "9:16",
    squareOrient: q.squareOrient === "landscape" ? "landscape" : "portrait",
    preset,
    title: q.title ?? "",
    subtitle: q.subtitle ?? "",
    showNames: q.showNames ?? true,
    showNumbers: q.showNumbers ?? true,
    theme: { ...PRESET_THEMES[preset], ...(q.theme ?? {}) },
    actors,
    steps,
    annotations: (q.annotations ?? []).filter(
      (a) => a && stepIds.has(a.fromStep) && stepIds.has(a.toStep),
    ),
  };
}
