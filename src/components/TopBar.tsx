import { useEffect, useRef, useState } from "react";
import { FORMATIONS } from "../formations";

interface Props {
  name: string;
  formation: string;
  onName: (name: string) => void;
  onFormation: (formation: string) => void;
  onExport: () => void;
  onExportPng: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
}

export default function TopBar({
  name,
  formation,
  onName,
  onFormation,
  onExport,
  onExportPng,
  onImport,
  onReset,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    if (!exportOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!exportRef.current?.contains(e.target as Node)) setExportOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExportOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [exportOpen]);

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

      <label className="topbar__field">
        <span className="topbar__label">Système</span>
        <div className="select-wrap">
          <select
            value={formation}
            onChange={(e) => onFormation(e.target.value)}
            aria-label="Système de jeu"
          >
            {FORMATIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <span className="select-wrap__chevron" aria-hidden="true">
            ▾
          </span>
        </div>
      </label>

      <div className="topbar__actions">
        <div className="export" ref={exportRef}>
          <button
            className="btn btn--primary"
            onClick={() => setExportOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
          >
            Exporter <span className="export__chevron" aria-hidden="true">▾</span>
          </button>
          {exportOpen && (
            <div className="export-menu" role="menu">
              <button
                role="menuitem"
                onClick={() => {
                  setExportOpen(false);
                  onExportPng();
                }}
              >
                <span>Image</span>
                <span className="export-menu__ext">.png</span>
              </button>
              <button
                role="menuitem"
                onClick={() => {
                  setExportOpen(false);
                  onExport();
                }}
              >
                <span>Données</span>
                <span className="export-menu__ext">.json</span>
              </button>
            </div>
          )}
        </div>
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
