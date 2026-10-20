// Colour helpers shared by every board (Compo, Phase arrêtée, Séquence,
// Studio): readable text on a colour, and two-colour kits — a disc or jersey
// split down the middle, the main colour on the left half and the second one
// on the right. A team without a second colour stays plain.

function rgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Perceived brightness, 0 (black) – 255 (white); mid-grey when unparsable.
export function luminance(hex: string): number {
  const c = rgb(hex);
  return c ? 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] : 128;
}

// The same colour, darker by `k` (0 = unchanged, 1 = black).
export function darken(hex: string, k: number): string {
  const c = rgb(hex);
  if (!c) return hex;
  const h = (v: number) => Math.round(v * (1 - k)).toString(16).padStart(2, "0");
  return `#${h(c[0])}${h(c[1])}${h(c[2])}`;
}

// Dark enough that text on it should be white.
export const isDark = (hex: string) => luminance(hex) < 110;

// White or near-black, whichever stands out on `hex`. Also the default
// second colour when "Bicolore" is switched on, so the split shows at once.
export const contrastColor = (hex: string) => (isDark(hex) ? "#ffffff" : "#101418");

// CSS background of an HTML disc.
export const discBackground = (color: string, color2?: string) =>
  color2 ? `linear-gradient(90deg, ${color} 50%, ${color2} 50%)` : color;

// On a two-colour disc the label straddles both halves: a halo in the
// colour contrasting with the text keeps it readable on either.
export const textHalo = (textColor: string) => {
  const c = contrastColor(textColor);
  return `0 0 3px ${c}, 0 0 2px ${c}, 0 0 1px ${c}`;
};

// Text colour of the opponents' discs (styles/opponents.css, setpiece.css).
export const OPPONENT_TEXT = "#0f141c";
