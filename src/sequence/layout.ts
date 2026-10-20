// Frame geometry of a sequence: output size per format, where the header,
// the captions and the pitch sit inside it, and the camera transform. Shared
// by the stage (editor/preview) and the video export so both frame things
// identically.
//
// The header and caption areas are reserved only when they have something to
// show, and never overlap the pitch: the pitch takes all the room left,
// centred with even margins. Tall frames stack the header (title, progress,
// chapter); wide ones fit it on a single line to leave the pitch more height.
import type { Orient, Pos } from "../types";
import { posToPx } from "../types";
import type { Camera, SeqFormat, Sequence } from "./types";
import { wrap } from "./text";

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FrameLayout {
  W: number;
  H: number;
  orient: Orient;
  pitch: Box;
  u: number; // 1% of the pitch's short side, in px — base unit for sizes
  pad: number;
  base: number; // header font unit
  captionFs: number;
  header: (Box & { mode: "stack" | "line" }) | null;
  // Captions: a reserved band under the pitch, or overlaid (vertical formats
  // keep them above the TikTok / Reels bottom UI, over the lower pitch).
  caption: (Box & { overlay: boolean }) | null;
}

export const FORMAT_SIZE: Record<SeqFormat, { W: number; H: number }> = {
  "9:16": { W: 1080, H: 1920 },
  "16:9": { W: 1920, H: 1080 },
  "1:1": { W: 1080, H: 1080 },
};

// The drawn grass apron extends 5% beyond the pitch lines on every side.
const APRON = 1.1;

type LayoutInput = Pick<Sequence, "format" | "orient" | "steps">;

function fit(availW: number, availH: number, ratio: number) {
  const boxW = Math.max(1, Math.min(availW, availH * ratio));
  const w = boxW / APRON;
  return { w, h: w / ratio };
}

// `chrome` = the published look (preview, export): header + caption areas
// are reserved around the pitch. Without it (the editor) the pitch alone
// fills the frame, so there's maximum room to work.
export function frameLayout(seq: LayoutInput, chrome = true): FrameLayout {
  if (!chrome) return editorLayout(seq.orient);
  const { W, H } = FORMAT_SIZE[seq.format];
  const orient = exportOrient(seq);
  const short = Math.min(W, H);
  const pad = Math.round(short * 0.03);
  const base = short * 0.028;
  const captionFs = short * 0.042;
  const ratio = orient === "portrait" ? 68 / 105 : 105 / 68; // pitch w / h

  // Captions get their own band under the pitch — never drawn over it —
  // as tall as the longest one needs (two lines at most, longer ones are set
  // smaller to fit).
  const capLines = Math.max(
    0,
    ...(seq.steps ?? []).map((s) => {
      const words = s.caption?.trim().split(/\s+/) ?? [];
      return words.length ? Math.min(2, wrap(words, captionFs, W - 2 * pad, false).length) : 0;
    }),
  );
  const hasCaption = capLines > 0;
  const capH = hasCaption ? captionFs * 1.35 * capLines + pad : 0;

  // The header always carries the progress bar.
  const mode = W > H * 0.9 ? "line" : "stack";
  const headH = pad + base * (mode === "line" ? 2.3 : 4.4);
  const topY = headH + pad * 0.6;
  const p = fit(W - 2 * pad, H - topY - capH - pad, ratio);
  const apronH = p.h * APRON;

  // The pitch (with its grass apron) and the caption band below it form one
  // block, centred in the space under the header.
  const regionH = H - topY - pad;
  const blockY = topY + Math.max(0, (regionH - apronH - capH) / 2);
  const pitch: Box = {
    x: (W - p.w) / 2,
    y: blockY + (apronH - p.h) / 2,
    w: p.w,
    h: p.h,
  };

  return {
    W,
    H,
    orient,
    pitch,
    u: Math.min(pitch.w, pitch.h) / 100,
    pad,
    base,
    captionFs,
    header: { mode, x: pad, y: pad, w: W - 2 * pad, h: headH - pad },
    caption: hasCaption ? { overlay: false, x: pad, y: blockY + apronH, w: W - 2 * pad, h: capH } : null,
  };
}

// Pitch orientation of the published frame: a wide frame gets a horizontal
// pitch, a tall one a vertical pitch; only the square format leaves the
// choice (the sequence's own orientation, as in the editor).
export function exportOrient(seq: Pick<Sequence, "format" | "orient">): Orient {
  return seq.format === "16:9" ? "landscape" : seq.format === "9:16" ? "portrait" : seq.orient;
}

// Editing view: no output format at all — just the pitch (vertical or
// horizontal, like the Compo tab) with its grass apron and a thin margin.
// Same pitch-relative coordinates and camera as the export, so what you
// build here lands identically in any format.
function editorLayout(orient: Orient): FrameLayout {
  const long = 1545;
  const short = 1000;
  const w = orient === "portrait" ? short : long;
  const h = orient === "portrait" ? long : short;
  const pad = 30;
  return {
    W: Math.round(w * APRON + 2 * pad),
    H: Math.round(h * APRON + 2 * pad),
    orient,
    pitch: { x: pad + w * 0.05, y: pad + h * 0.05, w, h },
    u: short / 100,
    pad,
    base: 28,
    captionFs: 42,
    header: null,
    caption: null,
  };
}

// Pitch percent → pitch-local px (before the camera).
export const toLocal = (L: FrameLayout, p: Pos) =>
  posToPx(p, { w: L.pitch.w, h: L.pitch.h }, L.orient);

// SVG transform of the camera group: the camera centre lands on the centre of
// the pitch box, scaled by its zoom. Zoom 1 + centre (50,50) = whole pitch.
export function cameraTransform(L: FrameLayout, cam: Camera): string {
  const c = toLocal(L, { x: cam.x, y: cam.y });
  const cx = L.pitch.x + L.pitch.w / 2;
  const cy = L.pitch.y + L.pitch.h / 2;
  const z = Math.max(0.3, cam.zoom);
  return `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${z.toFixed(4)}) translate(${(-c.x).toFixed(2)} ${(-c.y).toFixed(2)})`;
}
