// Text measuring shared by the stage and the frame layout (captions band).
export const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Text metrics measured with the real font, so pills hug their text and
// centre it whatever font the system ends up using (Inter isn't bundled).
// Falls back to estimates where there's no canvas (tests). Results are
// cached only once the web fonts are in, so a fallback measure isn't kept.
type Metrics = { w: number; inkDx: number; capDy: number }; // in em
const metrics = new Map<string, Metrics>();
let measureCtx: CanvasRenderingContext2D | null | undefined;
export const measure = (text: string, weight: number): Metrics | null => {
  const key = `${weight}|${text}`;
  const hit = metrics.get(key);
  if (hit) return hit;
  if (measureCtx === undefined) {
    try {
      measureCtx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    } catch {
      measureCtx = null;
    }
  }
  if (!measureCtx) return null;
  measureCtx.font = `${weight} 100px ${FONT}`;
  const m = measureCtx.measureText(text);
  const cap = measureCtx.measureText("H").actualBoundingBoxAscent;
  const r: Metrics = {
    w: m.width / 100,
    // Shift that puts the ink (not the advance box) on the anchor.
    inkDx: (m.actualBoundingBoxLeft - m.actualBoundingBoxRight + m.width) / 200,
    // Baseline offset that centres the capitals on the anchor.
    capDy: cap / 200,
  };
  if (document.fonts?.status === "loaded") metrics.set(key, r);
  return r;
};
export const textW = (s: string, fs: number, upper = false, weight = 700) => {
  const text = upper ? s.toUpperCase() : s;
  const spacing = upper ? fs * 0.04 * text.length : 0;
  const m = measure(text, weight);
  return (m ? m.w * fs : text.length * fs * (upper ? 0.66 : 0.58)) + spacing;
};

// Greedy word wrap into lines that fit `maxW`: indices of each line's words.
// Measured in the captions' weight (their only user).
export function wrap(words: string[], fs: number, maxW: number, upper: boolean) {
  const lines: number[][] = [[]];
  let w = 0;
  const space = fs * 0.32;
  words.forEach((word, i) => {
    const ww = textW(word, fs, upper, 800) + fs * 0.5;
    if (w > 0 && w + ww > maxW) {
      lines.push([]);
      w = 0;
    }
    lines[lines.length - 1].push(i);
    w += ww + space;
  });
  return lines;
}
