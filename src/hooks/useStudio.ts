import { useEffect, useState } from "react";
import { type StudioSettings } from "../types";
import { loadStudioSettings, saveStudioSettings } from "../storage";

// The "Studio" poster mode: a simple show/hide overlay (not a real OS
// fullscreen like usePresentation — Studio is for tweaking + exporting, not
// live display, so a plain fixed-position overlay is enough). Settings persist
// on their own (see storage.ts) independently of any project/compo.
export function useStudio() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<StudioSettings>(() =>
    loadStudioSettings(),
  );

  useEffect(() => {
    saveStudioSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const patchSettings = (patch: Partial<StudioSettings>) =>
    setSettings((s) => ({ ...s, ...patch }));

  return {
    studioOpen: open,
    openStudio: () => setOpen(true),
    closeStudio: () => setOpen(false),
    studioSettings: settings,
    patchStudioSettings: patchSettings,
  };
}
