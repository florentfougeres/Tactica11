import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Lineup, Project } from "../types";
import { buildShareUrl, decodeLineup, takeSharedFromUrl } from "../share";
import { mergeImportedBundle } from "../storage";

// Share-link handling for the current compo: on mount, merge a compo encoded
// in the URL (and the players/attribute columns it references) into the
// current project as a new entry, plus the "copy share link" action.
export function useShareLink(
  project: Project,
  lineup: Lineup,
  setProjects: Dispatch<SetStateAction<Project[]>>,
  reset: (next: Lineup) => void,
) {
  useEffect(() => {
    const enc = takeSharedFromUrl();
    if (!enc) return;
    const bundle = decodeLineup(enc);
    if (!bundle) return;
    const { project: merged, lineup: newLineup } = mergeImportedBundle(
      project,
      bundle,
    );
    setProjects((ps) => ps.map((p) => (p.id === merged.id ? merged : p)));
    reset(newLineup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(buildShareUrl(project, lineup));
    } catch {
      alert("Impossible de copier le lien.");
    }
  };

  return { copyShareLink };
}
