import { useEffect, useRef, useState } from "react";
import { FORMATIONS } from "../formations";

interface Props {
  name: string;
  formation: string;
  compos: { id: string; name: string }[];
  currentId: string;
  canUndo: boolean;
  canRedo: boolean;
  onName: (name: string) => void;
  onFormation: (formation: string) => void;
  onOpenCompo: (id: string) => void;
  onNewCompo: () => void;
  onDuplicate: () => void;
  onDelete: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExport: () => void;
  onExportPng: () => void;
  onCopyLink: () => void;
  onImport: (file: File) => void;
}

function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, ref]);
}

export default function TopBar({
  name,
  formation,
  compos,
  currentId,
  canUndo,
  canRedo,
  onName,
  onFormation,
  onOpenCompo,
  onNewCompo,
  onDuplicate,
  onDelete,
  onUndo,
  onRedo,
  onExport,
  onExportPng,
  onCopyLink,
  onImport,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const fmRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const compoRef = useRef<HTMLDivElement>(null);
  const [fmOpen, setFmOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [compoOpen, setCompoOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useDismiss(fmOpen, () => setFmOpen(false), fmRef);
  useDismiss(exportOpen, () => setExportOpen(false), exportRef);
  useDismiss(compoOpen, () => setCompoOpen(false), compoRef);

  const copyLink = () => {
    onCopyLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <header className="topbar glass">
      <div className="brand">
        <span className="brand__mark">⬡</span>
        <span className="brand__name">
          Tactica<span className="brand__accent">11</span>
        </span>
      </div>

      <div className="topbar__field topbar__field--name">
        <span className="topbar__label">Compo</span>
        <div className="compo" ref={compoRef}>
          <input
            className="compo__name"
            value={name}
            onChange={(e) => onName(e.target.value)}
            aria-label="Nom de la compo"
          />
          <button
            type="button"
            className="compo__toggle"
            onClick={() => setCompoOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={compoOpen}
            aria-label="Mes compos"
          >
            ▾
          </button>
          {compoOpen && (
            <div className="compo-menu" role="menu">
              <div className="compo-menu__list">
                {compos.map((c) => (
                  <button
                    key={c.id}
                    role="menuitemradio"
                    aria-checked={c.id === currentId}
                    className={c.id === currentId ? "is-active" : ""}
                    onClick={() => {
                      onOpenCompo(c.id);
                      setCompoOpen(false);
                    }}
                  >
                    {c.name || "Sans nom"}
                  </button>
                ))}
              </div>
              <div className="compo-menu__sep" />
              <button
                className="compo-menu__action"
                onClick={() => {
                  onDuplicate();
                  setCompoOpen(false);
                }}
              >
                Dupliquer
              </button>
              <button
                className="compo-menu__action compo-menu__danger"
                onClick={() => {
                  onDelete(currentId);
                  setCompoOpen(false);
                }}
              >
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

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
        <button
          className="btn btn--icon"
          onClick={onUndo}
          disabled={!canUndo}
          title="Annuler (Cmd/Ctrl+Z)"
          aria-label="Annuler"
        >
          ↶
        </button>
        <button
          className="btn btn--icon"
          onClick={onRedo}
          disabled={!canRedo}
          title="Rétablir (Cmd/Ctrl+Maj+Z)"
          aria-label="Rétablir"
        >
          ↷
        </button>

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
              <button role="menuitem" onClick={copyLink}>
                <span>{copied ? "Lien copié ✓" : "Copier le lien"}</span>
                <span className="export-menu__ext">URL</span>
              </button>
            </div>
          )}
        </div>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Importer…
        </button>
        <button className="btn btn--ghost" onClick={onNewCompo}>
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
