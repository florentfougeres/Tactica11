// Frame geometry of a sequence: output size per format, where the header,
// the captions and the pitch sit inside it, and the camera transform. Shared
// by the stage (editor/preview) and the video export so both frame things
// identically.
//
// The header and caption areas are reserved only when they have something to
// show, and never overlap the pitch: the pitch takes all the room left,
// centred with even margins. Tall frames stack the header (title, progress,
// chapter); wide ones fit it on a single line to leave the pitch more height.
//
// A half-pitch sequence frames only that half: `view` is the visible part,
// `pitch` the whole pitch at the same scale (its other half overflows the
// view and is clipped away).
import type { Orient, Pos } from "../types";
import { posToPx } from "../types";
import type { Camera, PitchHalf, SeqFormat, Sequence } from "./types";
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
  pitch: Box; // the whole pitch (lines), in frame px
  view: Box; // the visible part of it: the whole pitch, or one half
  focus: Pos; // pitch percent at the centre of `view`
  u: number; // 1% of the pitch's short side, in px — base unit for sizes
  actorK: number; // players' discs and names, on top of `u` (a bit smaller on a horizontal pitch)
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

type LayoutInput = Pick<Sequence, "format" | "orient" | "steps" | "half">;

function fit(availW: number, availH: number, ratio: number) {
  const boxW = Math.max(1, Math.min(availW, availH * ratio));
  const w = boxW / APRON;
  return { w, h: w / ratio };
}

// Visible extent of the pitch, in metres (width × length).
export function visibleMetres(half: PitchHalf | undefined) {
  return { x: 68, y: half ? 52.5 : 105 };
}

const focusOf = (half: PitchHalf | undefined): Pos => ({ x: 50, y: half === "attack" ? 25 : half === "defense" ? 75 : 50 });

// The visible box (w × h px, centred on cx, cy) → the matching geometry: the
// whole pitch placed so that the visible part lands exactly in that box.
function place(orient: Orient, half: PitchHalf | undefined, cx: number, cy: number, w: number, h: number) {
  const long = half ? 2 : 1; // the pitch is twice the visible half along its length
  const pw = orient === "portrait" ? w : w * long;
  const ph = orient === "portrait" ? h * long : h;
  const focus = focusOf(half);
  const f = posToPx(focus, { w: pw, h: ph }, orient);
  return {
    view: { x: cx - w / 2, y: cy - h / 2, w, h },
    pitch: { x: cx - f.x, y: cy - f.y, w: pw, h: ph },
    focus,
  };
}

// `chrome` = the published look (preview, export): header + caption areas
// are reserved around the pitch. Without it (the editor) the pitch alone
// fills the frame, so there's maximum room to work.
export function frameLayout(seq: LayoutInput, chrome = true): FrameLayout {
  if (!chrome) return editorLayout(seq.orient, seq.half);
  const { W, H } = FORMAT_SIZE[seq.format];
  const orient = exportOrient(seq);
  const short = Math.min(W, H);
  const pad = Math.round(short * 0.03);
  const base = short * 0.028;
  const captionFs = short * 0.042;
  const m = visibleMetres(seq.half);
  const ratio = orient === "portrait" ? m.x / m.y : m.y / m.x; // visible w / h

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
  const g = place(orient, seq.half, W / 2, blockY + apronH / 2, p.w, p.h);

  return {
    W,
    H,
    orient,
    ...g,
    u: Math.min(g.pitch.w, g.pitch.h) / 100,
    actorK: actorK(orient),
    pad,
    base,
    captionFs,
    header: { mode, x: pad, y: pad, w: W - 2 * pad, h: headH - pad },
    caption: hasCaption ? { overlay: false, x: pad, y: blockY + apronH, w: W - 2 * pad, h: capH } : null,
  };
}

// Pitch orientation of the published frame: a wide frame gets a horizontal
// pitch, a tall one a vertical pitch; only the square format leaves the
// choice (the sequence's own orientation, as in the editor). A half pitch is
// wider than long, so it always sits goal up / down in a wide or tall frame.
export function exportOrient(seq: Pick<Sequence, "format" | "orient" | "half">): Orient {
  if (seq.format === "1:1") return seq.orient;
  return seq.half || seq.format === "9:16" ? "portrait" : "landscape";
}

// Editing view: no output format at all — just the pitch (vertical or
// horizontal, like the Compo tab) with its grass apron and a thin margin.
// Same pitch-relative coordinates and camera as the export, so what you
// build here lands identically in any format.
function editorLayout(orient: Orient, half: PitchHalf | undefined): FrameLayout {
  const long = half ? 772.5 : 1545;
  const short = 1000;
  const w = orient === "portrait" ? short : long;
  const h = orient === "portrait" ? long : short;
  const pad = 30;
  const W = Math.round(w * APRON + 2 * pad);
  const H = Math.round(h * APRON + 2 * pad);
  return {
    W,
    H,
    orient,
    ...place(orient, half, W / 2, H / 2, w, h),
    u: short / 100,
    actorK: actorK(orient),
    pad,
    base: 28,
    captionFs: 42,
    header: null,
    caption: null,
  };
}

// On a horizontal pitch the players are scaled down to the Compo tab's
// proportions: its 38px tokens span ~4.5% of a landscape pitch's short side
// on a 1920×1080 screen, vs 6.4% for our ×1 discs.
const actorK = (orient: Orient) => (orient === "landscape" ? 0.7 : 1);

// Pitch percent → pitch-local px (before the camera).
export const toLocal = (L: FrameLayout, p: Pos) =>
  posToPx(p, { w: L.pitch.w, h: L.pitch.h }, L.orient);

// SVG transform of the camera group: the camera centre lands on the centre of
// the visible box, scaled by its zoom. Zoom 1 + centre (50,50) = the whole
// visible area (the camera is offset by the half's own centre).
export function cameraTransform(L: FrameLayout, cam: Camera): string {
  const c = toLocal(L, { x: cam.x + L.focus.x - 50, y: cam.y + L.focus.y - 50 });
  const cx = L.view.x + L.view.w / 2;
  const cy = L.view.y + L.view.h / 2;
  const z = Math.max(0.3, cam.zoom);
  return `translate(${cx.toFixed(2)} ${cy.toFixed(2)}) scale(${z.toFixed(4)}) translate(${(-c.x).toFixed(2)} ${(-c.y).toFixed(2)})`;
}
