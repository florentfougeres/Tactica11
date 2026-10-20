// PNG of the Studio poster: the same SVG as the preview, rasterised at 2×
// (static markup → <img> → canvas), like the Séquence image export.
import { createElement, type ComponentProps } from "react";
import { saveFile } from "../download";
import StudioPoster, { posterSize } from "./StudioPoster";

type PosterProps = ComponentProps<typeof StudioPoster>;

function safeName(name: string): string {
  return name.trim().replace(/[^\p{L}\p{N}_-]+/gu, "_") || "compo";
}

export async function exportPosterPng(props: Omit<PosterProps, "pixelSize" | "className">, name: string) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { W, H } = posterSize(props.settings.aspect);
  const w = W * 2;
  const h = H * 2;
  const markup = renderToStaticMarkup(createElement(StudioPoster, { ...props, pixelSize: { w, h } }));
  const url = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("PNG");
    await saveFile(blob, `${safeName(name)}-visuel.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}
