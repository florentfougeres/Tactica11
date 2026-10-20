import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Lineup, Project } from "../types";
import {
  createDefaultLineup,
  createDefaultProject,
  exportProject,
  mergeProjectParts,
  readProjectFile,
  remapLineup,
  uid,
  type ProjectImportOptions,
} from "../storage";

interface Args {
  projects: Project[];
  setProjects: Dispatch<SetStateAction<Project[]>>;
  project: Project;
  currentProjectId: string;
  setCurrentProjectId: Dispatch<SetStateAction<string>>;
  updateProject: (fn: (p: Project) => Project) => void;
  lineup: Lineup;
  reset: (next: Lineup) => void;
  setSelectedSlot: Dispatch<SetStateAction<string | null>>;
}

// Project- and compo-level actions (create/open/duplicate/delete, whole-project
// .json file import/export) plus the debounced sync that folds the
// actively-edited compo back into its project's lineups.
export function useProjectActions({
  projects,
  setProjects,
  project,
  currentProjectId,
  setCurrentProjectId,
  updateProject,
  lineup,
  reset,
  setSelectedSlot,
}: Args) {
  // Fold the actively-edited compo back into its project's lineups (debounced,
  // so a drag burst syncs once); useProjectStore then persists the library.
  useEffect(() => {
    const t = setTimeout(() => {
      setProjects((ps) =>
        ps.map((p) =>
          p.id === currentProjectId
            ? {
                ...p,
                lineups: p.lineups.map((l) =>
                  l.id === lineup.id ? lineup : l,
                ),
                currentLineupId: lineup.id,
              }
            : p,
        ),
      );
    }, 400);
    return () => clearTimeout(t);
  }, [lineup, currentProjectId, setProjects]);

  // --- compos (within the current project) ---
  const openCompo = (id: string) => {
    if (id === lineup.id) return;
    updateProject((p) => ({
      ...p,
      lineups: p.lineups.map((l) => (l.id === lineup.id ? lineup : l)),
    }));
    const target = project.lineups.find((l) => l.id === id);
    if (target) {
      reset(structuredClone(target));
      setSelectedSlot(null);
    }
  };

  const newCompo = () => {
    const c = createDefaultLineup();
    updateProject((p) => ({ ...p, lineups: [...p.lineups, c] }));
    reset(c);
    setSelectedSlot(null);
  };

  const duplicateCompo = () => {
    const c = {
      ...structuredClone(lineup),
      id: uid("lineup"),
      name: `${lineup.name} (copie)`,
    };
    updateProject((p) => ({ ...p, lineups: [...p.lineups, c] }));
    reset(c);
    setSelectedSlot(null);
  };

  const deleteCompo = (id: string) => {
    const target = project.lineups.find((l) => l.id === id);
    const label = target?.name?.trim() || "cette compo";
    // Deletion clears the undo history (reset), so there's no taking it back.
    if (!window.confirm(`Supprimer « ${label} » ? Cette action est définitive.`))
      return;
    const rest = project.lineups.filter((l) => l.id !== id);
    if (rest.length === 0) {
      const def = createDefaultLineup();
      updateProject((p) => ({ ...p, lineups: [def], currentLineupId: def.id }));
      reset(def);
    } else {
      updateProject((p) => ({ ...p, lineups: rest }));
      if (id === lineup.id) reset(structuredClone(rest[0]));
    }
    setSelectedSlot(null);
  };

  // --- projects ---
  const setProjectName = (name: string) =>
    updateProject((p) => ({ ...p, name }));

  const openProject = (id: string) => {
    if (id === currentProjectId) return;
    updateProject((p) => ({
      ...p,
      lineups: p.lineups.map((l) => (l.id === lineup.id ? lineup : l)),
      currentLineupId: lineup.id,
    }));
    const target = projects.find((p) => p.id === id);
    if (!target) return;
    setCurrentProjectId(id);
    const targetLineup =
      target.lineups.find((l) => l.id === target.currentLineupId) ??
      target.lineups[0];
    reset(structuredClone(targetLineup));
    setSelectedSlot(null);
  };

  const newProject = () => {
    const p = createDefaultProject();
    setProjects((ps) => [...ps, p]);
    setCurrentProjectId(p.id);
    reset(p.lineups[0]);
    setSelectedSlot(null);
  };

  // Duplicates the whole project: roster, attribute columns and every compo,
  // with fresh ids throughout (including players) so the copy never shares
  // identity with the original — slot references are remapped accordingly.
  const duplicateProject = () => {
    const base: Project = {
      ...project,
      lineups: project.lineups.map((l) => (l.id === lineup.id ? lineup : l)),
    };
    const src = structuredClone(base);
    const playerIdMap = new Map<string, string>();
    const players = src.players.map((pl) => {
      const id = uid("p");
      playerIdMap.set(pl.id, id);
      return { ...pl, id };
    });
    const lineups = src.lineups.map((l) =>
      remapLineup(l, (id) => playerIdMap.get(id)),
    );
    const p: Project = {
      ...src,
      id: uid("proj"),
      name: `${src.name} (copie)`,
      players,
      lineups,
      currentLineupId: lineups[0].id,
    };
    setProjects((ps) => [...ps, p]);
    setCurrentProjectId(p.id);
    reset(p.lineups[0]);
    setSelectedSlot(null);
  };

  const deleteProject = (id: string) => {
    const target = projects.find((p) => p.id === id);
    const label = target?.name?.trim() || "ce projet";
    if (!window.confirm(`Supprimer « ${label} » ? Cette action est définitive.`))
      return;
    const rest = projects.filter((p) => p.id !== id);
    if (rest.length === 0) {
      const def = createDefaultProject();
      setProjects([def]);
      setCurrentProjectId(def.id);
      reset(def.lineups[0]);
    } else {
      setProjects(rest);
      if (id === currentProjectId) {
        const next = rest[0];
        setCurrentProjectId(next.id);
        reset(
          structuredClone(
            next.lineups.find((l) => l.id === next.currentLineupId) ??
              next.lineups[0],
          ),
        );
      }
    }
    setSelectedSlot(null);
  };

  // --- whole-project save / open (.json) ---
  // Include the compo being edited as it is right now: the sync above is
  // debounced, so an edit made just before saving would otherwise be missing.
  const saveProject = () =>
    exportProject({
      ...project,
      lineups: project.lineups.map((l) => (l.id === lineup.id ? lineup : l)),
      currentLineupId: lineup.id,
    });

  // "Ouvrir…" reads the file first; the import dialog then either opens it
  // as a new project or merges picked compos into the current one.
  const readProjectToImport = async (file: File): Promise<Project | null> => {
    try {
      return await readProjectFile(file);
    } catch {
      alert("Impossible de lire ce fichier projet Tactica11.");
      return null;
    }
  };

  const openAsNewProject = (source: Project) => {
    updateProject((p) => ({
      ...p,
      lineups: p.lineups.map((l) => (l.id === lineup.id ? lineup : l)),
      currentLineupId: lineup.id,
    }));
    const p: Project = { ...structuredClone(source), id: uid("proj") };
    setProjects((ps) => [...ps, p]);
    setCurrentProjectId(p.id);
    reset(p.lineups.find((l) => l.id === p.currentLineupId) ?? p.lineups[0]);
    setSelectedSlot(null);
  };

  // Add picked compos (with their chosen set pieces / sequences) to the
  // current project, then open the first one.
  const importIntoProject = (source: Project, options: ProjectImportOptions) => {
    const base: Project = {
      ...project,
      lineups: project.lineups.map((l) => (l.id === lineup.id ? lineup : l)),
    };
    const { project: merged, lineups } = mergeProjectParts(
      base,
      structuredClone(source),
      options,
    );
    if (!lineups.length) return;
    updateProject(() => merged);
    reset(structuredClone(lineups[0]));
    setSelectedSlot(null);
  };

  return {
    openCompo,
    newCompo,
    duplicateCompo,
    deleteCompo,
    setProjectName,
    openProject,
    newProject,
    duplicateProject,
    deleteProject,
    saveProject,
    readProjectToImport,
    openAsNewProject,
    importIntoProject,
  };
}
