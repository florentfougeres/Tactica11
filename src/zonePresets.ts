import type { ZoneRadii } from "./types";

// EA FC-inspired role presets. The pitch is vertical with y=0 = opponent goal,
// so "up" reaches forward. Bases are defined for a RIGHT-side / neutral player
// and mirrored for the left side. Focus tilts the zone forward (attack) or back
// (defense). Values are fractions of the pitch width.

export interface RolePreset {
  key: string;
  label: string;
  base: ZoneRadii;
}

type Group =
  | "gk"
  | "fullback"
  | "cb"
  | "cdm"
  | "cm"
  | "cam"
  | "wide"
  | "winger"
  | "striker";

export function roleGroup(role: string): Group {
  switch (role) {
    case "G":
      return "gk";
    case "DD":
    case "DG":
      return "fullback";
    case "DC":
      return "cb";
    case "MDC":
      return "cdm";
    case "MC":
    case "MCD":
    case "MCG":
      return "cm";
    case "MOC":
      return "cam";
    case "MD":
    case "MG":
      return "wide";
    case "AD":
    case "AG":
      return "winger";
    case "AT":
    case "BU":
      return "striker";
    default:
      return "cm";
  }
}

const PRESETS: Record<Group, RolePreset[]> = {
  gk: [
    { key: "gk", label: "Gardien", base: { up: 0.14, down: 0.1, left: 0.16, right: 0.16 } },
    { key: "sweeper", label: "Gardien-libéro", base: { up: 0.26, down: 0.1, left: 0.18, right: 0.18 } },
  ],
  fullback: [
    { key: "fb", label: "Latéral", base: { up: 0.28, down: 0.22, left: 0.16, right: 0.26 } },
    { key: "wb", label: "Latéral offensif", base: { up: 0.42, down: 0.18, left: 0.16, right: 0.28 } },
    { key: "falseback", label: "Faux latéral", base: { up: 0.22, down: 0.2, left: 0.26, right: 0.16 } },
  ],
  cb: [
    { key: "def", label: "Défenseur", base: { up: 0.16, down: 0.26, left: 0.26, right: 0.26 } },
    { key: "stopper", label: "Stoppeur", base: { up: 0.28, down: 0.2, left: 0.22, right: 0.22 } },
    { key: "bpd", label: "Relanceur", base: { up: 0.22, down: 0.24, left: 0.28, right: 0.28 } },
  ],
  cdm: [
    { key: "holding", label: "Sentinelle", base: { up: 0.24, down: 0.24, left: 0.24, right: 0.24 } },
    { key: "dlp", label: "Meneur reculé", base: { up: 0.3, down: 0.22, left: 0.3, right: 0.3 } },
    { key: "halfback", label: "Demi-centre", base: { up: 0.2, down: 0.3, left: 0.28, right: 0.28 } },
  ],
  cm: [
    { key: "b2b", label: "Box-to-box", base: { up: 0.42, down: 0.36, left: 0.22, right: 0.22 } },
    { key: "playmaker", label: "Meneur de jeu", base: { up: 0.34, down: 0.24, left: 0.3, right: 0.3 } },
    { key: "halfwinger", label: "Demi-ailier", base: { up: 0.36, down: 0.2, left: 0.18, right: 0.34 } },
  ],
  cam: [
    { key: "playmaker", label: "Meneur de jeu", base: { up: 0.34, down: 0.24, left: 0.32, right: 0.32 } },
    { key: "shadow", label: "Attaquant fantôme", base: { up: 0.44, down: 0.18, left: 0.2, right: 0.2 } },
    { key: "ten", label: "Numéro 10", base: { up: 0.34, down: 0.26, left: 0.3, right: 0.3 } },
  ],
  wide: [
    { key: "winger", label: "Ailier", base: { up: 0.34, down: 0.22, left: 0.16, right: 0.28 } },
    { key: "widemid", label: "Milieu de couloir", base: { up: 0.3, down: 0.26, left: 0.18, right: 0.26 } },
    { key: "wpm", label: "Meneur excentré", base: { up: 0.3, down: 0.22, left: 0.28, right: 0.26 } },
  ],
  winger: [
    { key: "winger", label: "Ailier", base: { up: 0.4, down: 0.18, left: 0.14, right: 0.3 } },
    { key: "inside", label: "Avant intérieur", base: { up: 0.44, down: 0.18, left: 0.3, right: 0.16 } },
    { key: "wpm", label: "Meneur excentré", base: { up: 0.3, down: 0.22, left: 0.28, right: 0.28 } },
  ],
  striker: [
    { key: "advanced", label: "Avant-centre", base: { up: 0.4, down: 0.2, left: 0.22, right: 0.22 } },
    { key: "poacher", label: "Renard des surfaces", base: { up: 0.26, down: 0.12, left: 0.18, right: 0.18 } },
    { key: "false9", label: "Faux 9", base: { up: 0.3, down: 0.34, left: 0.26, right: 0.26 } },
    { key: "target", label: "Avant pivot", base: { up: 0.3, down: 0.18, left: 0.26, right: 0.26 } },
  ],
};

export function presetsFor(role: string): RolePreset[] {
  return PRESETS[roleGroup(role)];
}

const clamp = (v: number) => Math.max(0.06, Math.min(0.62, v));

// Mirror the (right-reference) base onto the left flank when needed.
export function presetRadii(base: ZoneRadii, sideLeft: boolean): ZoneRadii {
  const { up, down } = base;
  const left = sideLeft ? base.right : base.left;
  const right = sideLeft ? base.left : base.right;
  return { up: clamp(up), down: clamp(down), left: clamp(left), right: clamp(right) };
}
