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

export interface Lineup {
  id: string;
  name: string;
  formation: string; // e.g. "4-3-3"
  players: Player[]; // full roster (on pitch + bench)
  slots: Slot[]; // always 11 on-pitch slots
}

// Schema version for the exported .json files.
export const FILE_VERSION = 1;

export interface LineupFile {
  app: "tactica11";
  version: number;
  lineup: Lineup;
}
