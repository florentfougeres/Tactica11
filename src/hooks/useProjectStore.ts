import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project } from "../types";
import { saveLibrary, type Library } from "../storage";

// The projects library: every project (roster + compos) the user has, which
// one is active, and persistence to localStorage. Doesn't know about the
// actively-edited compo (see useProjectActions) — just the projects list.
export function useProjectStore(initialLib: Library) {
  const [projects, setProjects] = useState<Project[]>(initialLib.projects);
  const [currentProjectId, setCurrentProjectId] = useState(
    initialLib.currentProjectId,
  );

  const project = useMemo(
    () => projects.find((p) => p.id === currentProjectId) ?? projects[0],
    [projects, currentProjectId],
  );

  // Mutate the current project's shared roster / attribute columns.
  const updateProject = useCallback(
    (fn: (p: Project) => Project) =>
      setProjects((ps) =>
        ps.map((p) => (p.id === currentProjectId ? fn(p) : p)),
      ),
    [currentProjectId],
  );

  useEffect(() => {
    saveLibrary({ projects, currentProjectId });
  }, [projects, currentProjectId]);

  return {
    projects,
    setProjects,
    currentProjectId,
    setCurrentProjectId,
    project,
    updateProject,
  };
}
