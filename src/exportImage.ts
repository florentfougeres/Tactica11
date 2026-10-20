import { toPng } from "html-to-image";
import { saveFile } from "./download";

// Nodes that are UI chrome (phase toggle, hints, the management popover) and
// shouldn't appear in the exported picture.
const EXCLUDED = ["pitch__top", "pitch__drop-hint", "slot-pop-anchor", "draw-bar"];

function safeName(name: string): string {
  return name.trim().replace(/[^\w-]+/g, "_") || "compo";
}

// Capture the pitch element to a PNG and trigger a download. The optional
// suffix (e.g. the current phase) keeps successive captures from overwriting
// each other in the downloads folder.
export async function exportPitchPng(
  pitchEl: HTMLElement,
  name: string,
  suffix?: string,
): Promise<void> {
  const filter = (node: HTMLElement) => {
    const cls = node.classList;
    return !cls || !EXCLUDED.some((c) => cls.contains(c));
  };

  const dataUrl = await toPng(pitchEl, {
    pixelRatio: 2,
    cacheBust: true,
    filter,
  });

  const tail = suffix ? `-${safeName(suffix)}` : "";
  // Decode the data URL locally (a fetch of data: would be blocked by the CSP).
  const [head, b64] = dataUrl.split(",");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: head.match(/data:([^;]+)/)?.[1] ?? "image/png" });
  await saveFile(blob, `${safeName(name)}${tail}.png`);
}
