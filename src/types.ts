// Core data model for Tactica11.
// The pitch is vertical: y=0 is the opponent goal (top, where we attack),
// y=100 is our own goal (bottom). x=0 left, x=100 right. All in percent.

// Three phases:
//  - "base"    : the formation's neutral shape, positions are LOCKED (no drag)
//  - "attack"  : freely movable positions
//  - "defense" : freely movable positions
export type Phase = "base" | "attack" | "defense";

export const PHASES: Phase[] = ["base", "attack", "defense"];

// Influence-zone display: off, the selected player's editable zone, or every
// starter's zone blended into a team coverage map.
export type InfluenceMode = "none" | "player" | "team";

export interface Pos {
  x: number; // 0..100
  y: number; // 0..100
}

// Pitch orientation. "portrait" is the default (own goal at the bottom). In
// "landscape" the same logical pitch is rotated 90° clockwise so the goal-to-goal
// axis runs horizontally (opponent goal on the right), handy on wide screens.
export type Orient = "portrait" | "landscape";

interface Size {
  w: number;
  h: number;
}

// Logical position (percent) → pixel centre inside the field, per orientation.
export function posToPx(pos: Pos, size: Size, orient: Orient) {
  if (orient === "landscape") {
    return { x: (1 - pos.y / 100) * size.w, y: (pos.x / 100) * size.h };
  }
  return { x: (pos.x / 100) * size.w, y: (pos.y / 100) * size.h };
}

// Pixel centre → logical position (percent). Inverse of posToPx.
export function pxToPos(x: number, y: number, size: Size, orient: Orient): Pos {
  if (orient === "landscape") {
    return { x: (y / size.h) * 100, y: (1 - x / size.w) * 100 };
  }
  return { x: (x / size.w) * 100, y: (y / size.h) * 100 };
}

export interface Player {
  id: string;
  name: string;
  number?: number;
}

// Influence zone radii, as a fraction of the pitch WIDTH, in each direction
// from the player. Lets the zone be lopsided (e.g. reach further forward).
export interface ZoneRadii {
  up: number;
  down: number;
  left: number;
  right: number;
}

export const DEFAULT_ZONE: ZoneRadii = {
  up: 0.3,
  down: 0.3,
  left: 0.24,
  right: 0.24,
};

export interface Slot {
  id: string;
  role: string; // GK, DC, MD, BU... label hint
  starterId: string | null; // titulaire (principal)
  subId: string | null; // suppléant (optionnel)
  positions: Record<Phase, Pos>;
  // Custom influence-zone shape per phase (base has no zone). Falls back to
  // DEFAULT_ZONE when a phase isn't set.
  influence?: Partial<Record<Phase, ZoneRadii>>;
}

// An opposing player: a plain disc with a short free-text label (2-3 chars),
// positioned independently in the attack and defense phases (never in base).
export interface Opponent {
  id: string;
  label: string; // 2-3 characters shown inside the disc
  positions: { attack: Pos; defense: Pos };
}

// Default opposing block (a 4-3-3 mirror sitting in the top half, since the
// opponent attacks downward toward our goal). Used to spawn the 11 at once.
export const OPPONENT_FORMATION: { label: string; x: number; y: number }[] = [
  { label: "1", x: 50, y: 7 }, // GK
  { label: "2", x: 82, y: 20 },
  { label: "3", x: 60, y: 17 },
  { label: "4", x: 40, y: 17 },
  { label: "5", x: 18, y: 20 },
  { label: "6", x: 50, y: 31 },
  { label: "8", x: 28, y: 37 },
  { label: "7", x: 72, y: 37 },
  { label: "9", x: 50, y: 48 },
  { label: "10", x: 30, y: 50 },
  { label: "11", x: 70, y: 50 },
];

// Pastel palette for the opposing team's discs (kept clear of our green/white).
export const OPPONENT_COLORS = [
  "#8fb3e0", // blue
  "#e0a0a0", // rose
  "#e6c079", // amber
  "#c4a7e0", // lavender
  "#8fd0c8", // teal
  "#aeb6c2", // slate
];
export const DEFAULT_OPPONENT_COLOR = OPPONENT_COLORS[0];

// Free-hand tactical annotations drawn over the pitch, stored per phase.
//  - "arrow"  : straight solid arrow (a run / a movement)
//  - "dashed" : straight dashed arrow (a pass)
//  - "free"   : free-hand polyline
//  - "zone"   : free-hand closed area, translucent fill
export type DrawTool = "arrow" | "dashed" | "free" | "zone";

export interface Drawing {
  id: string;
  tool: DrawTool;
  color: string;
  // Points in pitch percent. arrow/dashed use [start, end]; free/zone keep the
  // whole sampled polyline (so they follow the orientation like everything else).
  points: Pos[];
}

// Pen palette for the drawing layer (kept legible over the green grass).
export const DRAW_COLORS = [
  "#f4c531", // amber
  "#e0533a", // red
  "#3f8fe0", // blue
  "#23b083", // green
  "#f2f2ee", // chalk white
];
export const DEFAULT_DRAW_COLOR = DRAW_COLORS[0];

export interface Lineup {
  id: string;
  name: string;
  formation: string; // e.g. "4-3-3"
  players: Player[]; // full roster (on pitch + bench)
  slots: Slot[]; // always 11 on-pitch slots
  opponents?: Opponent[]; // optional opposing discs (attack/defense only)
  opponentColor?: string; // disc colour for the opposing team
  drawings?: Partial<Record<Phase, Drawing[]>>; // optional annotations per phase
}

// Schema version for the exported .json files.
export const FILE_VERSION = 1;

export interface LineupFile {
  app: "tactica11";
  version: number;
  lineup: Lineup;
}
