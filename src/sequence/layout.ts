// Frame geometry of a sequence: output size per format, where the header,
// the captions and the pitch sit inside it, and the camera transform. Shared
// by the stage (editor/preview) and the video export so both frame things
// identically.
//
// The header and caption areas are reserved only when they have something to
// show, and never overlap the pitch: the pitch takes all the room left.
// When the frame is wider than the pitch (16:9, or 1:1 with a vertical pitch)
// the header moves to a left column if that gives the pitch more room.
import type { Orient, Pos } from "../types";
import { posToPx } from "../types";
import type { Camera, SeqFormat, Sequence } from "./types";

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
  header: (Box & { mode: "top" | "side" }) | null;
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

type LayoutInput = Pick<Sequence, "format" | "orient" | "title" | "subtitle" | "steps">;

function fit(availW: number, availH: number, ratio: number) {
  const boxW = Math.max(1, Math.min(availW, availH * ratio));
  const w = boxW / APRON;
  return { w, h: w / ratio };
}

export function frameLayout(seq: LayoutInput): FrameLayout {
  const { W, H } = FORMAT_SIZE[seq.format];
  const orient: Orient = seq.orient;
  const short = Math.min(W, H);
  const pad = Math.round(short * 0.03);
  const base = short * 0.028;
  const captionFs = short * 0.042;
  const ratio = orient === "portrait" ? 68 / 105 : 105 / 68; // pitch w / h

  // The header always carries the progress bar.
  const hasHeader = true;
  const hasCaption = (seq.steps ?? []).some((s) => s.caption?.trim());
  const vertical = seq.format === "9:16";
  const captionOverlay = vertical;
  const capH = hasCaption && !captionOverlay ? captionFs * 1.35 * 2 + pad * 1.5 : 0;

  // --- option 1: header band on top ---
  const headH = hasHeader ? pad + base * 4.4 : 0;
  const topAvailW = W - 2 * pad;
  const topAvailH = H - headH - capH - (hasHeader ? pad * 0.6 : pad) - pad;
  const top = fit(topAvailW, topAvailH, ratio);

  // --- option 2: header column on the left (wide frames only) ---
  const colW = hasHeader ? Math.min(380, Math.max(260, W * 0.17)) : 0;
  const sideAvailW = W - colW - 2 * pad;
  const sideAvailH = H - capH - 2 * pad;
  // Only worth it when the pitch leaves spare width (frame wider than the pitch).
  const side = hasHeader && W / H > ratio * 1.1 ? fit(sideAvailW, sideAvailH, ratio) : null;

  const useSide = !!side && side.w * side.h > top.w * top.h * 1.05;
  const p = useSide ? side! : top;

  let pitch: Box;
  let header: FrameLayout["header"] = null;
  if (useSide) {
    const regionX = colW + pad;
    const regionW = W - regionX - pad;
    const regionH = H - capH - 2 * pad;
    pitch = {
      x: regionX + (regionW - p.w) / 2,
      y: pad + (regionH - p.h) / 2,
      w: p.w,
      h: p.h,
    };
    header = { mode: "side", x: pad, y: pad, w: colW - pad * 0.5, h: H - 2 * pad };
  } else {
    const regionY = headH + (hasHeader ? pad * 0.6 : pad);
    const regionH = H - regionY - capH - pad;
    pitch = {
      x: (W - p.w) / 2,
      y: regionY + (regionH - p.h) / 2,
      w: p.w,
      h: p.h,
    };
    if (hasHeader) header = { mode: "top", x: pad, y: pad, w: W - 2 * pad, h: headH - pad };
  }

  let caption: FrameLayout["caption"] = null;
  if (hasCaption) {
    if (captionOverlay) caption = { overlay: true, x: W * 0.07, y: H * 0.765, w: W * 0.86, h: 0 };
    else {
      // Band under the pitch, as wide as the pitch area.
      const x = useSide ? colW + pad : pad;
      caption = { overlay: false, x, y: H - capH - pad * 0.5, w: W - x - pad, h: capH };
    }
  }

  return {
    W,
    H,
    orient,
    pitch,
    u: Math.min(pitch.w, pitch.h) / 100,
    pad,
    base,
    captionFs,
    header,
    caption,
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
