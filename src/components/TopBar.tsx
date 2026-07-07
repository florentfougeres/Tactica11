import { useEffect, useRef, useState } from "react";
import { FORMATIONS } from "../formations";

interface Props {
  name: string;
  formation: string;
  compos: { id: string; name: string }[];
  currentId: string;
  projectName: string;
  projects: { id: string; name: string }[];
  currentProjectId: string;
  canUndo: boolean;
  canRedo: boolean;
  onName: (name: string) => void;
  onFormation: (formation: string) => void;
  onOpenCompo: (id: string) => void;
  onNewCompo: () => void;
  onDuplicate: () => void;
  onDelete: (id: string) => void;
  onProjectName: (name: string) => void;
  onOpenProject: (id: string) => void;
  onNewProject: () => void;
  onDuplicateProject: () => void;
  onDeleteProject: (id: string) => void;
  onOpenRoster: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportPng: () => void;
  onCopyLink: () => void;
  onSaveProject: () => void;
  onImportProject: (file: File) => void;
  onPresent: () => void;
  onHelp: () => void;
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
  projectName,
  projects,
  currentProjectId,
  canUndo,
  canRedo,
  onName,
  onFormation,
  onOpenCompo,
  onNewCompo,
  onDuplicate,
  onDelete,
  onProjectName,
  onOpenProject,
  onNewProject,
  onDuplicateProject,
  onDeleteProject,
  onOpenRoster,
  onUndo,
  onRedo,
  onExportPng,
  onCopyLink,
  onSaveProject,
  onImportProject,
  onPresent,
  onHelp,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const fmRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const compoRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
  const [fmOpen, setFmOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [compoOpen, setCompoOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useDismiss(fmOpen, () => setFmOpen(false), fmRef);
  useDismiss(exportOpen, () => setExportOpen(false), exportRef);
  useDismiss(compoOpen, () => setCompoOpen(false), compoRef);
  useDismiss(projectOpen, () => setProjectOpen(false), projectRef);

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
        <span className="topbar__label">Projet</span>
        <div className="compo" ref={projectRef}>
          <input
            className="compo__name"
            value={projectName}
            onChange={(e) => onProjectName(e.target.value)}
            aria-label="Nom du projet"
          />
          <button
            type="button"
            className="compo__toggle"
            onClick={() => setProjectOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={projectOpen}
            aria-label="Mes projets"
          >
            ▾
          </button>
          {projectOpen && (
            <div className="compo-menu" role="menu">
              <div className="compo-menu__list">
                {projects.map((p) => (
                  <button
                    key={p.id}
                    role="menuitemradio"
                    aria-checked={p.id === currentProjectId}
                    className={p.id === currentProjectId ? "is-active" : ""}
                    onClick={() => {
                      onOpenProject(p.id);
                      setProjectOpen(false);
                    }}
                  >
                    {p.name || "Sans nom"}
                  </button>
                ))}
              </div>
              <div className="compo-menu__sep" />
              <button
                className="compo-menu__action"
                onClick={() => {
                  onNewProject();
                  setProjectOpen(false);
                }}
              >
                Nouveau projet
              </button>
              <button
                className="compo-menu__action"
                onClick={() => {
                  fileRef.current?.click();
                  setProjectOpen(false);
                }}
              >
                Ouvrir…
              </button>
              <button
                className="compo-menu__action"
                onClick={() => {
                  onDuplicateProject();
                  setProjectOpen(false);
                }}
              >
                Dupliquer
              </button>
              <button
                className="compo-menu__action"
                onClick={() => {
                  onSaveProject();
                  setProjectOpen(false);
                }}
              >
                Enregistrer
              </button>
              <button
                className="compo-menu__action compo-menu__danger"
                onClick={() => {
                  onDeleteProject(currentProjectId);
                  setProjectOpen(false);
                }}
              >
                Supprimer
              </button>
            </div>
          )}
        </div>
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
                  onNewCompo();
                  setCompoOpen(false);
                }}
              >
                Nouvelle compo
              </button>
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
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          className="btn btn--icon"
          onClick={onRedo}
          disabled={!canRedo}
          title="Rétablir (Cmd/Ctrl+Maj+Z)"
          aria-label="Rétablir"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="m15 14 5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="export" ref={exportRef}>
          <button
            className="btn btn--primary"
            onClick={() => setExportOpen((o) => !o)}
            aria-haspopup="menu"
            aria-expanded={exportOpen}
          >
            Partager <span className="export__chevron" aria-hidden="true">▾</span>
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
                <span>Image (vue actuelle)</span>
                <span className="export-menu__ext">.png</span>
              </button>
              <button role="menuitem" onClick={copyLink}>
                <span>{copied ? "Lien copié ✓" : "Copier le lien (cette compo)"}</span>
                <span className="export-menu__ext">URL</span>
              </button>
            </div>
          )}
        </div>
        <button className="btn" onClick={onOpenRoster}>
          Base de joueurs
        </button>
        <button
          className="btn btn--icon"
          onClick={onHelp}
          title="Présentation des fonctionnalités"
          aria-label="Aide"
        >
          ?
        </button>
        <button
          className="btn btn--icon"
          onClick={onPresent}
          title="Présentation plein écran"
          aria-label="Présentation plein écran"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportProject(f);
            e.target.value = "";
          }}
        />
      </div>
    </header>
  );
}
