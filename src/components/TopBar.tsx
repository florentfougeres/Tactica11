import { useRef, useState } from "react";
import type { Phase } from "../types";
import type { View } from "./ViewTabs";
import { useDismiss } from "../hooks/useDismiss";
import ShareMenu, { type ShareItem } from "./ShareMenu";

interface Props {
  view: View;
  phase: Phase;
  name: string;
  compos: { id: string; name: string }[];
  currentId: string;
  projectName: string;
  projects: { id: string; name: string }[];
  currentProjectId: string;
  canUndo: boolean;
  canRedo: boolean;
  onName: (name: string) => void;
  onOpenCompo: (id: string) => void;
  onNewCompo: () => void;
  onDuplicate: () => void;
  onDelete: (id: string) => void;
  onProjectName: (name: string) => void;
  onOpenProject: (id: string) => void;
  onNewProject: () => void;
  onDuplicateProject: () => void;
  onDeleteProject: (id: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onExportPng: () => void;
  onCopyLink: () => void;
  onSaveProject: () => void;
  onImportProject: (file: File) => void;
  onOpenDemo: () => void;
  onPresent: () => void;
  onStudio: () => void;
  onHelp: () => void;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  // Séquence renders its tools into this element (see SeqTopTools).
  onSeqSlot?: (el: HTMLDivElement | null) => void;
  // "Partager" items of Phase arrêtée / Séquence (Compo builds its own).
  share?: ShareItem[] | null;
}

export default function TopBar({
  view,
  phase,
  name,
  compos,
  currentId,
  projectName,
  projects,
  currentProjectId,
  canUndo,
  canRedo,
  onName,
  onOpenCompo,
  onNewCompo,
  onDuplicate,
  onDelete,
  onProjectName,
  onOpenProject,
  onNewProject,
  onDuplicateProject,
  onDeleteProject,
  onUndo,
  onRedo,
  onExportPng,
  onCopyLink,
  onSaveProject,
  onImportProject,
  onOpenDemo,
  onPresent,
  onStudio,
  onHelp,
  theme,
  onToggleTheme,
  onSeqSlot,
  share,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const compoRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
  const [compoOpen, setCompoOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useDismiss(compoOpen, () => setCompoOpen(false), [compoRef]);
  useDismiss(projectOpen, () => setProjectOpen(false), [projectRef]);

  const copyLink = () => {
    onCopyLink();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const shareItems: ShareItem[] | null =
    view === "pitch"
      ? [
          { label: "Image (vue actuelle)", ext: ".png", onClick: onExportPng },
          { label: copied ? "Lien copié ✓" : "Copier le lien (cette compo)", ext: "URL", onClick: copyLink, keepOpen: true },
          // Studio is the poster-style share visual; it works from the base
          // positions only.
          {
            label: "Créer un visuel (Studio)",
            ext: phase !== "base" ? "Base" : "poster",
            onClick: onStudio,
            disabled: phase !== "base",
            title: phase !== "base" ? "Disponible en phase Base" : undefined,
          },
        ]
      : (share ?? null);

  return (
    <header className={`topbar topbar--${view} glass`}>
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
                  onOpenDemo();
                  setProjectOpen(false);
                }}
              >
                Projet de démo
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

      {view === "pitch" && (
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
      )}

      {/* Séquence portals its camera/view/export buttons in here. */}
      {view === "sequence" && <div ref={onSeqSlot} className="topbar__seq" />}

      <div className="topbar__actions">
        {/* Undo/redo cover the active compo's whole edit history — pitch
            positions/opponents/drawings AND its set pieces share one stack —
            so they're relevant on Compo, Phase arrêtée and Séquence. Effectif
            (the shared roster) isn't part of that history, so hide them there
            rather than show controls that would just do nothing. */}
        {(view === "pitch" || view === "setpiece" || view === "sequence") && (
          <>
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
          </>
        )}

        {shareItems && <ShareMenu items={shareItems} />}
        <button
          className="btn btn--icon"
          onClick={onToggleTheme}
          title={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
          aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
        >
          {theme === "dark" ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5 8.5 8.5 0 1 0 20.5 14.5Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
        <button
          className="btn btn--icon"
          onClick={onHelp}
          title="Présentation des fonctionnalités"
          aria-label="Aide"
        >
          ?
        </button>
        {view === "pitch" && (
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
        )}
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
