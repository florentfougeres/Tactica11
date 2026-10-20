import { useRef, useState } from "react";
import type { SeqStep } from "../../sequence/types";
import type { StepSpan } from "../../sequence/engine";

interface Props {
  steps: SeqStep[];
  spans: StepSpan[];
  time: number;
  duration: number;
  current: number; // step under the playhead
  holding: boolean;
  playing: boolean;
  speed: number;
  loop: boolean;
  onToggle: () => void;
  onStart: () => void;
  onPrev: () => void;
  onNext: () => void;
  onCycleSpeed: () => void;
  onLoop: (v: boolean) => void;
  onSeek: (t: number) => void;
  onSelectStep: (i: number) => void;
  onAddStep: () => void;
  carry: boolean;
  onCarry: (v: boolean) => void;
  onMoveStep: (from: number, to: number) => void;
  onHold: (i: number, ms: number) => void;
}

const fmt = (ms: number) => {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(1).padStart(4, "0")}`;
};

// Compact strip under the board: transport controls + one block per step
// (width ∝ duration; the hatched head is the incoming transition). Click =
// go to step, drag a block = reorder, drag its right edge = hold duration.
export default function SequenceTimeline({
  steps,
  spans,
  time,
  duration,
  current,
  holding,
  playing,
  speed,
  loop,
  onToggle,
  onStart,
  onPrev,
  onNext,
  onCycleSpeed,
  onLoop,
  onSeek,
  onSelectStep,
  onAddStep,
  carry,
  onCarry,
  onMoveStep,
  onHold,
}: Props) {
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const resizeRef = useRef<{ i: number; x0: number; hold0: number; pxPerMs: number } | null>(null);

  const startResize = (e: React.PointerEvent, i: number) => {
    e.stopPropagation();
    e.preventDefault();
    const block = (e.currentTarget as HTMLElement).parentElement!;
    const len = Math.max(1, spans[i].end - spans[i].start);
    resizeRef.current = {
      i,
      x0: e.clientX,
      hold0: steps[i].holdMs,
      pxPerMs: block.getBoundingClientRect().width / len,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const moveResize = (e: React.PointerEvent) => {
    const r = resizeRef.current;
    if (!r) return;
    const ms = r.hold0 + (e.clientX - r.x0) / r.pxPerMs;
    onHold(r.i, Math.max(0, Math.round(ms / 100) * 100));
  };
  const endResize = () => {
    resizeRef.current = null;
  };

  return (
    <div className="seq-timeline glass">
      <div className="seq-timeline__controls">
        <button type="button" className="seq-tbtn" onClick={onStart} title="Retour au début (Début)" aria-label="Retour au début">
          ⏮
        </button>
        <button type="button" className="seq-tbtn" onClick={onPrev} title="Étape précédente (←)" aria-label="Étape précédente">
          ◀
        </button>
        <button
          type="button"
          className="seq-tbtn seq-tbtn--play"
          onClick={onToggle}
          title={playing ? "Pause (Espace)" : "Lecture (Espace)"}
          aria-label={playing ? "Pause" : "Lecture"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <button type="button" className="seq-tbtn" onClick={onNext} title="Étape suivante (→)" aria-label="Étape suivante">
          ▶▏
        </button>
        <button type="button" className="seq-tbtn seq-tbtn--speed" onClick={onCycleSpeed} title="Vitesse de lecture">
          {speed}×
        </button>
        <button
          type="button"
          className={`seq-tbtn ${loop ? "is-active" : ""}`}
          onClick={() => onLoop(!loop)}
          title="Lecture en boucle"
          aria-pressed={loop}
        >
          ⟲
        </button>
        <span className="seq-timeline__time">
          {fmt(time)} / {fmt(duration)}
        </span>
        <span className="seq-timeline__state">
          {playing ? "Lecture" : holding ? `Étape ${current + 1} / ${steps.length}` : `Transition → étape ${current + 1}`}
        </span>
        <label className="seq-carry" title="La nouvelle étape garde les flèches, zones et textes de l'étape courante">
          <input type="checkbox" checked={carry} onChange={(e) => onCarry(e.target.checked)} />
          Garder les éléments graphiques
        </label>
        <button type="button" className="seq-tbtn seq-tbtn--add" onClick={onAddStep} title="Nouvelle étape : duplique l'étape courante (N)">
          + Étape
        </button>
      </div>

      <div className="seq-timeline__track" onPointerMove={moveResize} onPointerUp={endResize}>
        {steps.map((s, i) => {
          const sp = spans[i];
          const len = Math.max(1, sp.end - sp.start);
          const trFrac = (sp.arrive - sp.start) / len;
          const inBlock = time >= sp.start && (time < sp.end || (i === steps.length - 1 && time <= sp.end));
          const head = inBlock ? Math.min(1, (time - sp.start) / len) : null;
          return (
            <div
              key={s.id}
              className={`seq-block ${i === current ? "is-current" : ""} ${dragOver === i ? "is-over" : ""}`}
              style={{ flexGrow: len, flexBasis: 0 }}
              draggable
              onDragStart={(e) => {
                setDragFrom(i);
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
              }}
              onDragOver={(e) => {
                if (dragFrom == null) return;
                e.preventDefault();
                setDragOver(i);
              }}
              onDragLeave={() => setDragOver((o) => (o === i ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragFrom != null) onMoveStep(dragFrom, i);
                setDragFrom(null);
                setDragOver(null);
              }}
              onDragEnd={() => {
                setDragFrom(null);
                setDragOver(null);
              }}
              onClick={(e) => {
                // Click inside the block: seek there if it's the transition part,
                // else jump to the step itself.
                const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                const frac = (e.clientX - r.left) / r.width;
                if (e.altKey) onSeek(sp.start + frac * len);
                else onSelectStep(i);
              }}
              title={`${s.name || `Étape ${i + 1}`} : transition ${(sp.arrive - sp.start) / 1000}s, maintien ${s.holdMs / 1000}s (glisser pour réordonner, Alt+clic pour se placer)`}
            >
              {trFrac > 0 && <span className="seq-block__tr" style={{ width: `${trFrac * 100}%` }} />}
              <span className="seq-block__label">
                <b>{i + 1}</b> {s.name || (s.caption ? s.caption : "")}
              </span>
              {s.chapter && <span className="seq-block__chapter">{s.chapter}</span>}
              {head != null && <span className="seq-block__head" style={{ left: `${head * 100}%` }} />}
              <span
                className="seq-block__resize"
                onPointerDown={(e) => startResize(e, i)}
                onClick={(e) => e.stopPropagation()}
                title="Glisser pour régler le temps de maintien"
              />
            </div>
          );
        })}
      </div>

      <input
        className="seq-timeline__scrub"
        type="range"
        min={0}
        max={Math.max(1, duration)}
        step={10}
        value={time}
        onChange={(e) => onSeek(Number(e.target.value))}
        aria-label="Position dans la séquence"
      />
    </div>
  );
}
