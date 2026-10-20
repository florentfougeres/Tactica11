// Data model for the "Séquence" mode: a tactical action told as N successive
// steps (keyframes) that the player interpolates, with arrows, zones, labels,
// captions and a camera — rendered by one SVG stage that drives the editor,
// the fullscreen preview and the video export alike.
//
// Positions use the same logical pitch percent as the rest of the app
// (see types.ts: y=0 opponent goal, y=100 our goal).
import type { Pos } from "../types";

// Output frame of the composition. 9:16 is the TikTok / Reels / Shorts default.
export type SeqFormat = "9:16" | "16:9" | "1:1";


export type Team = "home" | "away";

// One disc on the board. Home actors created from the compo keep a `slotId`
// so they show the real player's name / number; extra ones are free-text.
export interface SeqActor {
  id: string;
  team: Team;
  slotId?: string;
  playerId?: string; // roster player shown on this disc (overrides the slot's starter)
  label?: string; // text inside the disc (overrides number/role)
  name?: string; // label under the disc (overrides the roster name)
  gk?: boolean;
}

// Where the ball is at a given step: a free spot, or at a player's feet (it
// then follows that player, and a change of carrier between two steps is a
// pass that flies from one to the other during the transition).
export type BallState = { pos: Pos } | { carrierId: string };

// Camera framing of the pitch: centre in pitch percent + zoom (1 = whole pitch).
export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

export const DEFAULT_CAMERA: Camera = { x: 50, y: 50, zoom: 1 };

export type Easing = "linear" | "easeInOut";

export type StepEffect = "none" | "flash" | "bigText";

export interface SeqStep {
  id: string;
  name?: string;
  positions: Record<string, Pos>; // keyed by SeqActor.id
  ball: BallState;
  camera: Camera;
  caption?: string; // subtitle shown during this step
  karaoke?: boolean; // highlight the caption word by word
  chapter?: string; // starts a new chapter at this step (cinema header)
  focusIds?: string[]; // highlighted actors (halo)
  dimOthers?: boolean; // fade every non-focused actor
  ghosts?: boolean; // show where moved players came from (previous step)
  effect?: StepEffect;
  effectText?: string;
  effectColor?: string;
  // Time to travel INTO this step from the previous one (ignored for the
  // first step), then time spent standing still on it.
  transitionMs: number;
  holdMs: number;
  easing: Easing;
}

// Arrows (movements & passes) — each kind has its own default look.
export type ArrowKind = "pass" | "run" | "dribble" | "deep" | "press";
export const ARROW_KINDS: ArrowKind[] = ["pass", "run", "dribble", "deep", "press"];

export type AnnKind =
  | ArrowKind
  | "zone" // free polygon, translucent fill
  | "space" // free polygon, hatched (space to attack / free space)
  | "playerZone" // polygon whose corners are players (follows them)
  | "playerLine" // polyline through players (e.g. back four)
  | "marking" // thin link player ↔ player
  | "circle" // highlight ring around a player or a spot
  | "line" // straight separation / height line, optional label
  | "label"; // text bubble attached to a player or a spot

export type Anchor = { pos: Pos } | { actorId: string };

export interface SeqAnnotation {
  id: string;
  kind: AnnKind;
  anchors: Anchor[];
  control?: Pos; // curve control point (arrows only)
  text?: string;
  color: string;
  size?: number; // circle radius / label scale, 1 = default
  // Visible from step `fromStep` to step `toStep` (inclusive, by id).
  fromStep: string;
  toStep: string;
}

export interface SeqTheme {
  homeColor: string;
  homeText: string;
  homeGk: string;
  awayColor: string;
  awayText: string;
  awayGk: string;
  accent: string;
}

export interface Sequence {
  id: string;
  name: string;
  format: SeqFormat;
  orient: "portrait" | "landscape"; // pitch orientation (vertical / horizontal)
  discMode?: "number" | "role"; // what our discs show: shirt number or position
  title: string; // header line (brand / topic)
  subtitle: string;
  showNames: boolean;
  showNumbers: boolean;
  showGrid?: boolean; // juego de posición zones, as on the Terrain tab
  homeDiscScale?: number; // disc size of our team, 1 = default
  awayDiscScale?: number; // disc size of the opponents, 1 = default
  theme: SeqTheme;
  actors: SeqActor[];
  steps: SeqStep[];
  annotations: SeqAnnotation[];
}

// Default colours: white vs black discs, gold accent ("L'Instant Football").
// The board itself follows the app's light / dark theme (see SequenceStage).
export const DEFAULT_THEME: SeqTheme = {
  homeColor: "#f2f2ee",
  homeText: "#0b0f14",
  homeGk: "#9fd8ff",
  awayColor: "#1b2129",
  awayText: "#f2f2ee",
  awayGk: "#5b6675",
  accent: "#f4c531",
};

export const ARROW_LABEL: Record<ArrowKind, string> = {
  pass: "Passe",
  run: "Course",
  dribble: "Conduite",
  deep: "Appel",
  press: "Pressing",
};

export const ANN_LABEL: Record<AnnKind, string> = {
  ...ARROW_LABEL,
  zone: "Zone",
  space: "Espace",
  playerZone: "Zone joueurs",
  playerLine: "Ligne joueurs",
  marking: "Marquage",
  circle: "Cercle",
  line: "Ligne",
  label: "Texte",
};

// Default colour of each annotation kind (per preset accent where relevant).
export function defaultAnnColor(kind: AnnKind, theme: SeqTheme): string {
  switch (kind) {
    case "pass":
      return "#ffffff";
    case "run":
      return theme.accent;
    case "dribble":
      return "#ffffff";
    case "deep":
      return theme.accent;
    case "press":
      return "#ff4d4f";
    case "zone":
      return theme.accent;
    case "space":
      return "#3ee06a";
    case "playerZone":
      return theme.accent;
    case "playerLine":
      return "#ff4d4f";
    case "marking":
      return "#ff4d4f";
    case "circle":
      return "#ff4d4f";
    case "line":
      return "#ffffff";
    case "label":
      return theme.accent;
  }
}

export const SEQ_COLORS = [
  "#f4c531",
  "#ffffff",
  "#ff4d4f",
  "#3ee06a",
  "#3f8fe0",
  "#ff8a3d",
  "#b388ff",
  "#0b0f14",
];

// Disc size multiplier of an actor (per team).
export function discScale(seq: Pick<Sequence, "homeDiscScale" | "awayDiscScale">, actor: SeqActor | undefined): number {
  if (!actor) return 1;
  const v = actor.team === "home" ? seq.homeDiscScale : seq.awayDiscScale;
  return v && Number.isFinite(v) ? v : 1;
}

export const isArrow = (k: AnnKind): k is ArrowKind =>
  (ARROW_KINDS as string[]).includes(k);
