// Frame geometry of a sequence: output size per format, where the pitch sits
// inside it, and the camera transform. Shared by the stage (editor/preview)
// and the video export so both frame things identically.
import type { Orient, Pos } from "../types";
import { posToPx } from "../types";
import type { Camera, SeqFormat, Sequence } from "./types";

export interface FrameLayout {
  W: number;
  H: number;
  orient: Orient;
  pitch: { x: number; y: number; w: number; h: number };
  u: number; // 1% of the pitch's short side, in px — base unit for sizes
}

export const FORMAT_SIZE: Record<SeqFormat, { W: number; H: number }> = {
  "9:16": { W: 1080, H: 1920 },
  "16:9": { W: 1920, H: 1080 },
  "1:1": { W: 1080, H: 1080 },
};

// Margins leave room for the header (top) and the captions (bottom).
const MARGINS: Record<SeqFormat, { t: number; b: number; s: number }> = {
  "9:16": { t: 250, b: 300, s: 44 },
  "16:9": { t: 150, b: 170, s: 70 },
  "1:1": { t: 150, b: 170, s: 50 },
};

export function frameLayout(seq: Pick<Sequence, "format" | "orient">): FrameLayout {
  const { W, H } = FORMAT_SIZE[seq.format];
  const orient: Orient = seq.orient;
  const m = MARGINS[seq.format];
  const availW = W - 2 * m.s;
  const availH = H - m.t - m.b;
  // Real pitch ratio 68:105.
  const ratio = orient === "portrait" ? 68 / 105 : 105 / 68; // w / h
  let w = availW;
  let h = w / ratio;
  if (h > availH) {
    h = availH;
    w = h * ratio;
  }
  const x = (W - w) / 2;
  const y = m.t + (availH - h) / 2;
  return { W, H, orient, pitch: { x, y, w, h }, u: Math.min(w, h) / 100 };
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

// Frame px → pitch-local px (inverse camera), used to frame a selection.
export function frameToLocal(L: FrameLayout, cam: Camera, fx: number, fy: number) {
  const c = toLocal(L, { x: cam.x, y: cam.y });
  const cx = L.pitch.x + L.pitch.w / 2;
  const cy = L.pitch.y + L.pitch.h / 2;
  const z = Math.max(0.3, cam.zoom);
  return { x: (fx - cx) / z + c.x, y: (fy - cy) / z + c.y };
}
