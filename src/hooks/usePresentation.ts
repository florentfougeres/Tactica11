import { useEffect, useState } from "react";

// Fullscreen presentation mode: hide the panels, fill the screen with the
// pitch. `onEnter` lets the caller force any view state it needs on entry
// (e.g. switching back to the tactical board). Exits on Escape or the
// browser's native fullscreen-exit gesture.
export function usePresentation(onEnter: () => void) {
  const [presenting, setPresenting] = useState(false);
  // Fullscreen: the controls drawer on the left, collapsed by default.
  const [presentToolsOpen, setPresentToolsOpen] = useState(false);

  const enterPresent = () => {
    setPresenting(true);
    setPresentToolsOpen(false); // start collapsed in fullscreen
    onEnter();
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const exitPresent = () => {
    setPresenting(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  };

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) setPresenting(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPresenting(false);
    };
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return {
    presenting,
    presentToolsOpen,
    setPresentToolsOpen,
    enterPresent,
    exitPresent,
  };
}
