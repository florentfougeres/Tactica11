import { toPng } from "html-to-image";

// Nodes that are UI chrome (phase toggle, hints, the management popover) and
// shouldn't appear in the exported picture.
const EXCLUDED = ["pitch__top", "pitch__drop-hint", "slot-pop-anchor", "draw-bar"];

function safeName(name: string): string {
  return name.trim().replace(/[^\w-]+/g, "_") || "compo";
}

// Capture the pitch element to a PNG and trigger a download.
export async function exportPitchPng(
  pitchEl: HTMLElement,
  name: string,
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

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${safeName(name)}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
