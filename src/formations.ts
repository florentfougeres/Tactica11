import type { Phase, Pos, Slot } from "./types";

// Base ("neutral") shape for each formation, vertical pitch.
// y: 0 = opponent goal (top), 100 = own goal (bottom). x: 0 left .. 100 right.
// We attack upward, so forwards have small y, GK has large y.

interface BaseSlot {
  role: string;
  x: number;
  y: number;
}

const BASE: Record<string, BaseSlot[]> = {
  "4-3-3": [
    { role: "G", x: 50, y: 92 },
    { role: "DD", x: 84, y: 72 },
    { role: "DC", x: 62, y: 77 },
    { role: "DC", x: 38, y: 77 },
    { role: "DG", x: 16, y: 72 },
    { role: "MC", x: 70, y: 52 },
    { role: "MDC", x: 50, y: 58 },
    { role: "MC", x: 30, y: 52 },
    { role: "AD", x: 80, y: 26 },
    { role: "BU", x: 50, y: 18 },
    { role: "AG", x: 20, y: 26 },
  ],
  "4-3-3 faux 9": [
    { role: "G", x: 50, y: 92 },
    { role: "DD", x: 84, y: 72 },
    { role: "DC", x: 62, y: 77 },
    { role: "DC", x: 38, y: 77 },
    { role: "DG", x: 16, y: 72 },
    { role: "MDC", x: 50, y: 62 },
    { role: "MC", x: 68, y: 50 },
    { role: "MC", x: 32, y: 50 },
    { role: "AD", x: 82, y: 24 },
    { role: "AT", x: 50, y: 32 },
    { role: "AG", x: 18, y: 24 },
  ],
  "4-2-3-1": [
    { role: "G", x: 50, y: 92 },
    { role: "DD", x: 84, y: 72 },
    { role: "DC", x: 62, y: 77 },
    { role: "DC", x: 38, y: 77 },
    { role: "DG", x: 16, y: 72 },
    { role: "MDC", x: 64, y: 60 },
    { role: "MDC", x: 36, y: 60 },
    { role: "MD", x: 80, y: 38 },
    { role: "MOC", x: 50, y: 36 },
    { role: "MG", x: 20, y: 38 },
    { role: "BU", x: 50, y: 16 },
  ],
  "4-4-2": [
    { role: "G", x: 50, y: 92 },
    { role: "DD", x: 84, y: 72 },
    { role: "DC", x: 62, y: 77 },
    { role: "DC", x: 38, y: 77 },
    { role: "DG", x: 16, y: 72 },
    { role: "MD", x: 84, y: 50 },
    { role: "MC", x: 60, y: 54 },
    { role: "MC", x: 40, y: 54 },
    { role: "MG", x: 16, y: 50 },
    { role: "BU", x: 60, y: 20 },
    { role: "BU", x: 40, y: 20 },
  ],
  "4-4-2 losange": [
    { role: "G", x: 50, y: 92 },
    { role: "DD", x: 84, y: 72 },
    { role: "DC", x: 62, y: 77 },
    { role: "DC", x: 38, y: 77 },
    { role: "DG", x: 16, y: 72 },
    { role: "MDC", x: 50, y: 62 },
    { role: "MCD", x: 70, y: 48 },
    { role: "MCG", x: 30, y: 48 },
    { role: "MOC", x: 50, y: 36 },
    { role: "BU", x: 60, y: 18 },
    { role: "BU", x: 40, y: 18 },
  ],
  "4-5-1": [
    { role: "G", x: 50, y: 92 },
    { role: "DD", x: 84, y: 72 },
    { role: "DC", x: 62, y: 77 },
    { role: "DC", x: 38, y: 77 },
    { role: "DG", x: 16, y: 72 },
    { role: "MD", x: 85, y: 48 },
    { role: "MC", x: 65, y: 54 },
    { role: "MDC", x: 50, y: 62 },
    { role: "MC", x: 35, y: 54 },
    { role: "MG", x: 15, y: 48 },
    { role: "BU", x: 50, y: 18 },
  ],
  "3-5-2": [
    { role: "G", x: 50, y: 92 },
    { role: "DC", x: 72, y: 78 },
    { role: "DC", x: 50, y: 80 },
    { role: "DC", x: 28, y: 78 },
    { role: "MD", x: 88, y: 52 },
    { role: "MC", x: 65, y: 56 },
    { role: "MC", x: 50, y: 60 },
    { role: "MC", x: 35, y: 56 },
    { role: "MG", x: 12, y: 52 },
    { role: "BU", x: 60, y: 20 },
    { role: "BU", x: 40, y: 20 },
  ],
  "3-4-3": [
    { role: "G", x: 50, y: 92 },
    { role: "DC", x: 72, y: 78 },
    { role: "DC", x: 50, y: 80 },
    { role: "DC", x: 28, y: 78 },
    { role: "MD", x: 86, y: 54 },
    { role: "MC", x: 62, y: 58 },
    { role: "MC", x: 38, y: 58 },
    { role: "MG", x: 14, y: 54 },
    { role: "AD", x: 80, y: 26 },
    { role: "BU", x: 50, y: 18 },
    { role: "AG", x: 20, y: 26 },
  ],
  "3-4-2-1": [
    { role: "G", x: 50, y: 92 },
    { role: "DC", x: 72, y: 78 },
    { role: "DC", x: 50, y: 80 },
    { role: "DC", x: 28, y: 78 },
    { role: "MD", x: 86, y: 54 },
    { role: "MC", x: 62, y: 58 },
    { role: "MC", x: 38, y: 58 },
    { role: "MG", x: 14, y: 54 },
    { role: "MOC", x: 66, y: 34 },
    { role: "MOC", x: 34, y: 34 },
    { role: "BU", x: 50, y: 16 },
  ],
  "5-3-2": [
    { role: "G", x: 50, y: 92 },
    { role: "DD", x: 90, y: 66 },
    { role: "DC", x: 70, y: 78 },
    { role: "DC", x: 50, y: 80 },
    { role: "DC", x: 30, y: 78 },
    { role: "DG", x: 10, y: 66 },
    { role: "MC", x: 68, y: 52 },
    { role: "MDC", x: 50, y: 56 },
    { role: "MC", x: 32, y: 52 },
    { role: "BU", x: 60, y: 22 },
    { role: "BU", x: 40, y: 22 },
  ],
  "5-2-3": [
    { role: "G", x: 50, y: 92 },
    { role: "DD", x: 90, y: 66 },
    { role: "DC", x: 70, y: 78 },
    { role: "DC", x: 50, y: 80 },
    { role: "DC", x: 30, y: 78 },
    { role: "DG", x: 10, y: 66 },
    { role: "MC", x: 62, y: 56 },
    { role: "MC", x: 38, y: 56 },
    { role: "AD", x: 80, y: 26 },
    { role: "BU", x: 50, y: 18 },
    { role: "AG", x: 20, y: 26 },
  ],
  "5-4-1": [
    { role: "G", x: 50, y: 92 },
    { role: "DD", x: 90, y: 66 },
    { role: "DC", x: 70, y: 78 },
    { role: "DC", x: 50, y: 80 },
    { role: "DC", x: 30, y: 78 },
    { role: "DG", x: 10, y: 66 },
    { role: "MD", x: 84, y: 46 },
    { role: "MC", x: 60, y: 52 },
    { role: "MC", x: 40, y: 52 },
    { role: "MG", x: 16, y: 46 },
    { role: "BU", x: 50, y: 18 },
  ],
};

export const FORMATIONS = Object.keys(BASE);

const clamp = (v: number, lo = 5, hi = 95) => Math.max(lo, Math.min(hi, v));

// Derive attack and defense variants from the neutral shape.
// Attack: push up the pitch (lower y) and widen. Defense: drop back (higher y)
// and narrow into a compact block. The goalkeeper stays put.
function deriveVariants(base: BaseSlot, isGK: boolean): Record<Phase, Pos> {
  const basePos: Pos = { x: base.x, y: base.y };
  if (isGK) {
    return {
      base: basePos,
      attack: { x: base.x, y: base.y - 6 },
      defense: { x: base.x, y: Math.min(96, base.y + 2) },
    };
  }
  const attack: Pos = {
    x: clamp(50 + (base.x - 50) * 1.12),
    y: clamp(base.y - base.y * 0.16),
  };
  const defense: Pos = {
    x: clamp(50 + (base.x - 50) * 0.82),
    y: clamp(base.y + (100 - base.y) * 0.16),
  };
  return { base: basePos, attack, defense };
}

let slotCounter = 0;
const nextSlotId = () => `slot_${Date.now().toString(36)}_${slotCounter++}`;

export function buildSlots(formation: string): Slot[] {
  const base = BASE[formation] ?? BASE["4-3-3"];
  return base.map((b) => ({
    id: nextSlotId(),
    role: b.role,
    starterId: null,
    subId: null,
    positions: deriveVariants(b, b.role === "G"),
  }));
}
