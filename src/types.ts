import type { Sequence } from "./sequence/types";

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

// Custom roster columns, defined per project. "text" values are free strings,
// "number" values are stored/edited as numbers (e.g. age, vitesse, taille).
export type AttrType = "text" | "number";

export interface AttributeDef {
  id: string;
  name: string; // column header, user-editable
  type: AttrType;
}

export interface Player {
  id: string;
  name: string;
  number?: number;
  // Custom attribute values, keyed by AttributeDef.id.
  attributes?: Record<string, string | number>;
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
  // Free-text override for the role badge (e.g. "MOC" → "ZZ"), editable only in
  // attack/defense — base always shows the formation's role. Falls back to
  // `role` when unset for that phase.
  roleLabels?: Partial<Record<Phase, string>>;
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

// ---------- Studio (shareable lineup poster) ----------
// Settings for the "Studio" mode: a standalone, base-phase-only fullscreen
// view that renders the starting XI as a stylised, exportable poster for
// social media. Deliberately NOT part of Lineup — it's a visual-identity
// preference (kit colours, layout), not tactical data, and keeping it out of
// Lineup keeps it out of the undo/redo history too (see useUndoableLineup).
export type StudioDiscStyle = "circle" | "jersey";
// The pitch is always the poster's background — "2d" is the familiar flat
// top-down view, "3d" tilts it into a broadcast-style perspective shot.
export type StudioBackground = "2d" | "3d";

export interface StudioSettings {
  discStyle: StudioDiscStyle;
  discColor: string;
  numberColor: string;
  labelColor: string; // role/name text under the disc, and title/subtitle
  discSize: number; // token width, in % of the pitch field's own width
  nameFontSize: number; // px, base size for the role/name labels
  background: StudioBackground;
  showRole: boolean;
  showName: boolean;
  showNumber: boolean;
  showLines: boolean; // pitch markings
  title: string; // empty → falls back to the project name at render time
  subtitle: string; // empty → falls back to the formation at render time
  // The canvas is always sized to the pitch's own true ratio (68:105 or its
  // inverse) — no arbitrary social-media presets to letterbox against, so
  // the pitch fills the poster edge to edge instead of floating in padding.
  aspect: Orient;
}

export const STUDIO_DISC_COLORS = ["#eef1f2", "#101418", ...DRAW_COLORS];

export const DEFAULT_STUDIO_SETTINGS: StudioSettings = {
  discStyle: "circle",
  discColor: STUDIO_DISC_COLORS[0],
  numberColor: STUDIO_DISC_COLORS[1],
  labelColor: "#ffffff",
  discSize: 10,
  nameFontSize: 14,
  background: "2d",
  showRole: true,
  showName: true,
  showNumber: true,
  showLines: true,
  title: "",
  subtitle: "",
  aspect: "portrait",
};

// Logical position (percent) → percent offsets for a statically positioned
// element (left/top + translate(-50%,-50%)). Unlike posToPx above, this needs
// no container measurement — Studio tokens don't drag, so pixels aren't
// necessary, just the same portrait/landscape percent remap.
export function posToPercent(
  pos: Pos,
  orient: Orient,
): { left: number; top: number } {
  if (orient === "landscape") return { left: 100 - pos.y, top: pos.x };
  return { left: pos.x, top: pos.y };
}

export interface Lineup {
  id: string;
  name: string;
  formation: string; // e.g. "4-3-3"
  slots: Slot[]; // always 11 on-pitch slots
  opponents?: Opponent[]; // optional opposing discs (attack/defense only)
  opponentColor?: string; // disc colour for the opposing team
  drawings?: Partial<Record<Phase, Drawing[]>>; // optional annotations per phase
  setPieces: SetPiece[]; // corners / coups francs belonging to this compo
  sequences?: Sequence[]; // animated tactical sequences (mode Séquence)
}

// Set pieces (corners / coups francs): compo-scoped combinations — a set
// piece's players are drawn from that compo's own starting XI, so it's tied
// to a Lineup rather than shared across the whole project. Each one is edited
// on a half-pitch and has three states — the positions right as the kick is
// taken ("start"), an intermediate stage ("mid"), and where everyone/the
// ball ends up ("end") — so a slider can scrub across them like the main
// pitch's défense↔attaque blend.
export type SetPieceType = "corner" | "free-kick";
export type SetPieceState = "start" | "mid" | "end";
export const SET_PIECE_STATES: SetPieceState[] = ["start", "mid", "end"];

// Half-pitch coordinates: x is unchanged (0..100 = full width), but y is
// rescaled so 0 = goal line and 100 = halfway line (not 0..50 of the full
// pitch) — every stored percent point covers half the physical distance of
// the main pitch, giving finer effective precision for the same 0..100 range.
// posToPx/pxToPos above need no changes: they only care about "percent of
// container", so rendering into a half-height container just works.

// One of our players placed on the board. Bound to a real roster player (so
// it shows their actual name/number), unlike the free-text Opponent discs.
export interface SetPieceToken {
  id: string;
  playerId: string;
  positions: Record<SetPieceState, Pos>;
}

// Same free-text opposing marker as `Opponent`, but keyed by start/end
// instead of attack/defense, and not capped at 11 — a set piece usually only
// needs a handful of markers, added/removed one at a time.
export interface SetPieceOpponent {
  id: string;
  label: string;
  positions: Record<SetPieceState, Pos>;
}

export interface SetPiece {
  id: string;
  name: string;
  type: SetPieceType;
  ball: Record<SetPieceState, Pos>;
  tokens: SetPieceToken[];
  opponents: SetPieceOpponent[];
  opponentColor?: string; // disc colour for the opposing team, same palette as the main pitch
  drawings?: Partial<Record<SetPieceState, Drawing[]>>;
}

// A project owns ONE shared player roster (+ its custom attribute columns),
// used by every compo inside it. Slots reference players by id — resolved
// against `players` here, not against the individual Lineup anymore.
export interface Project {
  id: string;
  name: string;
  players: Player[]; // shared roster (on pitch + bench, across all lineups)
  attributeDefs: AttributeDef[]; // custom roster columns, project-scoped
  lineups: Lineup[];
  currentLineupId: string;
}

// Schema version for the share links (self-contained, single-compo).
export const FILE_VERSION = 2;

// A self-contained, denormalized single-compo share payload: the compo plus a
// snapshot of only the players (and the attribute columns they use)
// referenced by its slots, so a shared link works without the project.
export interface LineupFile {
  app: "tactica11";
  version: number;
  lineup: Lineup;
  players: Player[];
  attributeDefs: AttributeDef[];
}

// Schema version for the "Enregistrer le projet" / "Ouvrir un projet" .json
// files — a whole project (shared roster, attribute columns, every compo).
export const PROJECT_FILE_VERSION = 1;

export interface ProjectFile {
  app: "tactica11";
  version: number;
  project: Project;
}
