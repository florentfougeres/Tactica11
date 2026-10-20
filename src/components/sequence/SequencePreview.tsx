import { useEffect, useMemo, useRef, useState } from "react";
import type { Sequence } from "../../sequence/types";
import { frameAt, totalDuration } from "../../sequence/engine";
import { frameLayout } from "../../sequence/layout";
import SequenceStage, { type ActorInfo } from "../../sequence/SequenceStage";
import { useSequencePlayback } from "../../hooks/useSequencePlayback";

// Fullscreen preview: exactly what the audience will see — the stage alone,
// no handles or panels — played from the start.
export default function SequencePreview({
  seq,
  info,
  onClose,
}: {
  seq: Sequence;
  info: Record<string, ActorInfo>;
  onClose: () => void;
}) {
  const L = useMemo(() => frameLayout(seq), [seq]);
  const duration = totalDuration(seq.steps);
  const pb = useSequencePlayback(duration);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  useEffect(() => {
    pb.setTime(0);
    pb.play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") {
        e.preventDefault();
        pb.toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, pb]);

  const scale = Math.min(size.w / L.W, (size.h - 56) / L.H);
  const frame = frameAt(seq, pb.time);

  return (
    <div className="seq-preview" ref={wrapRef} role="dialog" aria-label="Aperçu de la séquence">
      <div className="seq-preview__stage" style={{ width: L.W * scale, height: L.H * scale }} onClick={pb.toggle}>
        <SequenceStage seq={seq} frame={frame} layout={L} info={info} idPrefix="pv" className="seq-preview__svg" />
      </div>
      <div className="seq-preview__bar">
        <button type="button" className="seq-tbtn" onClick={() => { pb.setTime(0); pb.play(); }} title="Rejouer">
          ⟲
        </button>
        <button type="button" className="seq-tbtn seq-tbtn--play" onClick={pb.toggle} aria-label={pb.playing ? "Pause" : "Lecture"}>
          {pb.playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(1, duration)}
          step={10}
          value={pb.time}
          onChange={(e) => {
            pb.pause();
            pb.setTime(Number(e.target.value));
          }}
          aria-label="Position"
        />
        <button type="button" className="seq-tbtn" onClick={onClose}>
          ✕ Fermer
        </button>
      </div>
    </div>
  );
}
