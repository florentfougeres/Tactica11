import { useEffect, useRef, useState } from "react";
import { FORMATIONS } from "../formations";

interface Props {
  name: string;
  formation: string;
  onName: (name: string) => void;
  onFormation: (formation: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
}

export default function TopBar({
  name,
  formation,
  onName,
  onFormation,
  onExport,
  onImport,
  onReset,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const fmRef = useRef<HTMLDivElement>(null);
  const [fmOpen, setFmOpen] = useState(false);

  useEffect(() => {
    if (!fmOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!fmRef.current?.contains(e.target as Node)) setFmOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFmOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [fmOpen]);

  return (
    <header className="topbar glass">
      <div className="brand">
        <span className="brand__mark">⬡</span>
        <span className="brand__name">
          Tactica<span className="brand__accent">11</span>
        </span>
      </div>

      <label className="topbar__field topbar__field--name">
        <span className="topbar__label">Compo</span>
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          aria-label="Nom de la compo"
        />
      </label>

      <div className="topbar__field">
        <span className="topbar__label">Système</span>
        <div className="fmselect" ref={fmRef}>
          <button
            type="button"
            className="fmselect__btn"
            onClick={() => setFmOpen((o) => !o)}
            aria-haspopup="listbox"
            aria-expanded={fmOpen}
          >
            <span>{formation}</span>
            <span className="fmselect__chevron" aria-hidden="true">
              ▾
            </span>
          </button>
          {fmOpen && (
            <ul className="fmselect__menu" role="listbox">
              {FORMATIONS.map((f) => (
                <li key={f}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={f === formation}
                    className={f === formation ? "is-active" : ""}
                    onClick={() => {
                      onFormation(f);
                      setFmOpen(false);
                    }}
                  >
                    {f}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="topbar__actions">
        <button className="btn btn--primary" onClick={onExport}>
          Exporter
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Importer…
        </button>
        <button className="btn btn--ghost" onClick={onReset}>
          Nouvelle
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImport(f);
            e.target.value = "";
          }}
        />
      </div>
    </header>
  );
}
