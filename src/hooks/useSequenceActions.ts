import type { Lineup, Phase, Pos } from "../types";
import type {
  BallState,
  SeqActor,
  SeqAnnotation,
  SeqStep,
  Sequence,
  Team,
} from "../sequence/types";
import { DEFAULT_THEME } from "../sequence/types";
import { createSequence, duplicateStep, sid } from "../sequence/create";

type SetLineup = (u: Lineup | ((l: Lineup) => Lineup)) => void;

// Lineup mutations for the Séquence mode. Sequences live on the compo, so
// every edit goes through setLineup and rides the existing undo/redo stack.
export function useSequenceActions(lineup: Lineup, setLineup: SetLineup) {
  const sequences = lineup.sequences ?? [];

  const update = (id: string, fn: (q: Sequence) => Sequence) =>
    setLineup((l) => ({
      ...l,
      sequences: (l.sequences ?? []).map((q) => (q.id === id ? fn(q) : q)),
    }));

  const updateStep = (id: string, index: number, fn: (s: SeqStep) => SeqStep) =>
    update(id, (q) => ({
      ...q,
      steps: q.steps.map((s, i) => (i === index ? fn(s) : s)),
    }));

  // --- sequences ---
  const createSeq = (phase: Phase): string => {
    const n = sequences.length + 1;
    const q = createSequence(lineup, phase, `Séquence ${n}`);
    setLineup((l) => ({ ...l, sequences: [...(l.sequences ?? []), q] }));
    return q.id;
  };

  const duplicateSeq = (id: string): string | null => {
    const src = sequences.find((q) => q.id === id);
    if (!src) return null;
    const copy: Sequence = JSON.parse(JSON.stringify(src));
    copy.id = sid("seq");
    copy.name = `${src.name} (copie)`;
    setLineup((l) => ({ ...l, sequences: [...(l.sequences ?? []), copy] }));
    return copy.id;
  };

  const deleteSeq = (id: string) =>
    setLineup((l) => ({
      ...l,
      sequences: (l.sequences ?? []).filter((q) => q.id !== id),
    }));

  const patchSeq = (id: string, patch: Partial<Sequence>) =>
    update(id, (q) => ({ ...q, ...patch }));

  const resetTheme = (id: string) => update(id, (q) => ({ ...q, theme: { ...DEFAULT_THEME } }));

  // --- steps ---
  // Insert a copy of step `index` right after it (the "next step" gesture).
  // Returns the new step's id so the editor can jump to it. With
  // `carryGraphics`, everything drawn on the source step (arrows, zones,
  // labels…) stays visible on the new one instead of ending there.
  const addStep = (id: string, index: number, carryGraphics = false): string => {
    const newId = sid("step");
    update(id, (q) => {
      const src = q.steps[index] ?? q.steps[q.steps.length - 1];
      const steps = [...q.steps];
      steps.splice(index + 1, 0, { ...duplicateStep(src), id: newId });
      const annotations = carryGraphics
        ? q.annotations.map((a) => (a.toStep === src.id ? { ...a, toStep: newId } : a))
        : q.annotations;
      return { ...q, steps, annotations };
    });
    return newId;
  };

  const deleteStep = (id: string, index: number) =>
    update(id, (q) => {
      if (q.steps.length <= 1) return q;
      const gone = q.steps[index];
      const steps = q.steps.filter((_, i) => i !== index);
      const neighbour = steps[Math.min(index, steps.length - 1)];
      const prev = steps[Math.max(0, index - 1)];
      const annotations = q.annotations
        .filter((a) => !(a.fromStep === gone.id && a.toStep === gone.id))
        .map((a) => ({
          ...a,
          fromStep: a.fromStep === gone.id ? neighbour.id : a.fromStep,
          toStep: a.toStep === gone.id ? prev.id : a.toStep,
        }));
      return { ...q, steps, annotations };
    });

  const moveStep = (id: string, from: number, to: number) =>
    update(id, (q) => {
      if (from === to || to < 0 || to >= q.steps.length) return q;
      const steps = [...q.steps];
      const [s] = steps.splice(from, 1);
      steps.splice(to, 0, s);
      return { ...q, steps };
    });

  const patchStep = (id: string, index: number, patch: Partial<SeqStep>) =>
    updateStep(id, index, (s) => ({ ...s, ...patch }));

  const moveActors = (id: string, index: number, moves: Record<string, Pos>) =>
    updateStep(id, index, (s) => ({ ...s, positions: { ...s.positions, ...moves } }));

  // Same correction on this step and every later step that still had the
  // exact old value ("propager").
  const moveActorsPropagate = (id: string, index: number, moves: Record<string, Pos>) =>
    update(id, (q) => {
      const old = q.steps[index].positions;
      return {
        ...q,
        steps: q.steps.map((s, i) => {
          if (i < index) return s;
          const positions = { ...s.positions };
          Object.entries(moves).forEach(([a, p]) => {
            const o = old[a];
            const cur = s.positions[a];
            if (i === index || (o && cur && o.x === cur.x && o.y === cur.y)) positions[a] = p;
          });
          return { ...s, positions };
        }),
      };
    });

  const setBall = (id: string, index: number, ball: BallState) =>
    updateStep(id, index, (s) => ({ ...s, ball }));

  // Reset the home players of a step to one phase of the compo.
  const applyPhase = (id: string, index: number, phase: Phase) =>
    update(id, (q) => {
      const step = q.steps[index];
      const positions = { ...step.positions };
      q.actors.forEach((a) => {
        if (a.team !== "home" || !a.slotId) return;
        const slot = lineup.slots.find((s) => s.id === a.slotId);
        if (slot) positions[a.id] = { ...slot.positions[phase] };
      });
      return {
        ...q,
        steps: q.steps.map((s, i) => (i === index ? { ...s, positions } : s)),
      };
    });

  // Mirror every position of a step left ↔ right.
  const mirrorStep = (id: string, index: number) =>
    updateStep(id, index, (s) => {
      const positions: Record<string, Pos> = {};
      Object.entries(s.positions).forEach(([a, p]) => (positions[a] = { x: 100 - p.x, y: p.y }));
      const ball = "pos" in s.ball ? { pos: { x: 100 - s.ball.pos.x, y: s.ball.pos.y } } : s.ball;
      return { ...s, positions, ball };
    });

  // --- actors ---
  const addActor = (id: string, team: Team, at: Pos): string => {
    const aid = sid("act");
    update(id, (q) => {
      const n = q.actors.filter((a) => a.team === team).length + 1;
      const actor: SeqActor = { id: aid, team, label: String(n), name: "" };
      return {
        ...q,
        actors: [...q.actors, actor],
        steps: q.steps.map((s) => ({ ...s, positions: { ...s.positions, [aid]: { ...at } } })),
      };
    });
    return aid;
  };

  const patchActor = (id: string, actorId: string, patch: Partial<SeqActor>) =>
    update(id, (q) => ({
      ...q,
      actors: q.actors.map((a) => (a.id === actorId ? { ...a, ...patch } : a)),
    }));

  const removeActors = (id: string, actorIds: string[]) =>
    update(id, (q) => {
      const gone = new Set(actorIds);
      const steps = q.steps.map((s) => {
        const positions = { ...s.positions };
        let ball = s.ball;
        if ("carrierId" in ball && gone.has(ball.carrierId)) {
          const p = s.positions[ball.carrierId] ?? { x: 50, y: 50 };
          ball = { pos: { x: p.x + 1.6, y: p.y - 1.4 } };
        }
        actorIds.forEach((a) => delete positions[a]);
        return {
          ...s,
          positions,
          ball,
          focusIds: s.focusIds?.filter((f) => !gone.has(f)),
        };
      });
      const annotations = q.annotations
        .map((a) => {
          // Arrows / single-anchor shapes keep their geometry by turning the
          // removed player's anchor into a fixed point.
          const anchors = a.anchors.flatMap((an) => {
            if ("actorId" in an && gone.has(an.actorId)) {
              if (a.kind === "playerZone" || a.kind === "playerLine" || a.kind === "marking") return [];
              const p = q.steps[0].positions[an.actorId] ?? { x: 50, y: 50 };
              return [{ pos: p }];
            }
            return [an];
          });
          return { ...a, anchors };
        })
        .filter((a) =>
          a.kind === "playerZone"
            ? a.anchors.length >= 3
            : a.kind === "playerLine" || a.kind === "marking"
              ? a.anchors.length >= 2
              : true,
        );
      return {
        ...q,
        actors: q.actors.filter((a) => !gone.has(a.id)),
        steps,
        annotations,
      };
    });

  // --- annotations ---
  const addAnnotation = (id: string, ann: SeqAnnotation) =>
    update(id, (q) => ({ ...q, annotations: [...q.annotations, ann] }));

  const patchAnnotation = (id: string, annId: string, patch: Partial<SeqAnnotation>) =>
    update(id, (q) => ({
      ...q,
      annotations: q.annotations.map((a) => (a.id === annId ? { ...a, ...patch } : a)),
    }));

  const removeAnnotation = (id: string, annId: string) =>
    update(id, (q) => ({
      ...q,
      annotations: q.annotations.filter((a) => a.id !== annId),
    }));

  // Take a graphic off one step only: it shrinks its visible range, or
  // splits in two when the step sits in the middle of it. Gone once it no
  // longer covers any step.
  const removeAnnotationAtStep = (id: string, annId: string, stepId: string) =>
    update(id, (q) => {
      const ann = q.annotations.find((a) => a.id === annId);
      if (!ann) return q;
      const at = (sId: string) => q.steps.findIndex((s) => s.id === sId);
      const i = at(stepId);
      const from = at(ann.fromStep);
      const to = at(ann.toStep);
      if (i < from || i > to) return q;
      const pieces: SeqAnnotation[] =
        from === to
          ? []
          : i === from
            ? [{ ...ann, fromStep: q.steps[i + 1].id }]
            : i === to
              ? [{ ...ann, toStep: q.steps[i - 1].id }]
              : [
                  { ...ann, toStep: q.steps[i - 1].id },
                  { ...ann, id: sid("ann"), fromStep: q.steps[i + 1].id },
                ];
      return {
        ...q,
        annotations: q.annotations.flatMap((a) => (a.id === annId ? pieces : [a])),
      };
    });

  return {
    sequences,
    createSeq,
    duplicateSeq,
    deleteSeq,
    patchSeq,
    resetTheme,
    addStep,
    deleteStep,
    moveStep,
    patchStep,
    moveActors,
    moveActorsPropagate,
    setBall,
    applyPhase,
    mirrorStep,
    addActor,
    patchActor,
    removeActors,
    addAnnotation,
    patchAnnotation,
    removeAnnotation,
    removeAnnotationAtStep,
  };
}

export type SequenceActions = ReturnType<typeof useSequenceActions>;
