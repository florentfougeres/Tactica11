import { useEffect, useRef, useState } from "react";
import type { Sequence } from "../../sequence/types";
import type { ActorInfo } from "../../sequence/SequenceStage";
import { ExportCancelled, ExportUnsupported, exportVideo } from "../../sequence/exportVideo";
import { totalDuration } from "../../sequence/engine";
import { FORMAT_SIZE } from "../../sequence/layout";

type Status = { kind: "idle" } | { kind: "running"; p: number } | { kind: "done" } | { kind: "error"; msg: string };

export default function SequenceExportDialog({
  seq,
  info,
  onClose,
}: {
  seq: Sequence;
  info: Record<string, ActorInfo>;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [fps, setFps] = useState(30);
  const [background, setBackground] = useState<"normal" | "chroma">("normal");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const { W, H } = FORMAT_SIZE[seq.format];
  const seconds = totalDuration(seq.steps) / 1000;
  const running = status.kind === "running";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !abortRef.current) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const run = async () => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus({ kind: "running", p: 0 });
    try {
      await exportVideo({
        seq,
        info,
        background,
        scale,
        fps,
        signal: ctrl.signal,
        onProgress: (p) => setStatus({ kind: "running", p }),
      });
      setStatus({ kind: "done" });
    } catch (e) {
      if (e instanceof ExportCancelled) setStatus({ kind: "idle" });
      else if (e instanceof ExportUnsupported)
        setStatus({
          kind: "error",
          msg: "Ce navigateur ne sait pas encoder de vidéo à cette résolution. Essaie la résolution standard, ou Chrome / Edge / Safari récent.",
        });
      else setStatus({ kind: "error", msg: `L'export a échoué : ${(e as Error).message || e}` });
    } finally {
      abortRef.current = null;
    }
  };

  return (
    <div className="modal-backdrop" onClick={() => !running && onClose()}>
      <div className="modal glass seq-export" role="dialog" aria-label="Exporter en vidéo" onClick={(e) => e.stopPropagation()}>
        <h2>Exporter en vidéo</h2>
        <p className="seq-muted">
          MP4 au format {seq.format}, {seconds.toFixed(1)} s. Chaque image est calculée une par une :
          l'export prend un peu de temps mais la vidéo est parfaitement fluide.
        </p>

        <div className="seq-field">
          <span>Résolution</span>
          <div className="seg">
            <button type="button" disabled={running} className={`seg__btn ${scale === 1 ? "is-active" : ""}`} onClick={() => setScale(1)}>
              {W}×{H}
            </button>
            <button type="button" disabled={running} className={`seg__btn ${scale === 2 ? "is-active" : ""}`} onClick={() => setScale(2)}>
              4K ({W * 2}×{H * 2})
            </button>
          </div>
        </div>
        <div className="seq-field">
          <span>Images par seconde</span>
          <div className="seg">
            {[30, 60].map((v) => (
              <button key={v} type="button" disabled={running} className={`seg__btn ${fps === v ? "is-active" : ""}`} onClick={() => setFps(v)}>
                {v} i/s
              </button>
            ))}
          </div>
        </div>
        <div className="seq-field">
          <span>Fond</span>
          <div className="seg">
            <button type="button" disabled={running} className={`seg__btn ${background === "normal" ? "is-active" : ""}`} onClick={() => setBackground("normal")}>
              Normal
            </button>
            <button type="button" disabled={running} className={`seg__btn ${background === "chroma" ? "is-active" : ""}`} onClick={() => setBackground("chroma")}>
              Fond vert (incrustation)
            </button>
          </div>
        </div>

        {status.kind === "running" && (
          <div className="seq-progress" aria-live="polite">
            <div className="seq-progress__bar" style={{ width: `${Math.round(status.p * 100)}%` }} />
            <span>{Math.round(status.p * 100)} %</span>
          </div>
        )}
        {status.kind === "done" && <p className="seq-ok">Vidéo exportée — regarde dans tes téléchargements.</p>}
        {status.kind === "error" && <p className="seq-err">{status.msg}</p>}

        <div className="modal__actions">
          {running ? (
            <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>
              Annuler
            </button>
          ) : (
            <>
              <button type="button" className="btn" onClick={onClose}>
                Fermer
              </button>
              <button type="button" className="btn btn--primary" onClick={run}>
                Exporter
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
