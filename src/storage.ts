import {
  FILE_VERSION,
  type Lineup,
  type LineupFile,
  type Phase,
  type Slot,
  type ZoneRadii,
} from "./types";
import { buildSlots } from "./formations";

// Influence used to be a single flat ZoneRadii (shared across phases). Convert
// that to the per-phase shape, applying the old zone to both attack and defense.
function migrateInfluence(
  inf: unknown,
): Partial<Record<Phase, ZoneRadii>> | undefined {
  if (!inf || typeof inf !== "object") return undefined;
  if ("up" in inf) {
    const flat = inf as ZoneRadii;
    return { attack: flat, defense: flat };
  }
  return inf as Partial<Record<Phase, ZoneRadii>>;
}

const STORAGE_KEY = "tactica11.lineup";

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createDefaultLineup(): Lineup {
  const formation = "4-3-3";
  const slots = buildSlots(formation);
  return {
    id: uid("lineup"),
    name: "Ma compo",
    formation,
    players: [],
    slots,
  };
}

// Normalise a lineup that may come from an older schema (v1 used `playerId`
// and only had attack/defense positions, no locked "base" phase, no sub).
export function migrateLineup(parsed: Lineup): Lineup {
  const fresh = buildSlots(parsed.formation || "4-3-3");
  const slots = fresh.map((s, i) => {
    const old = parsed.slots[i] as
      | (Slot & { playerId?: string | null })
      | undefined;
    if (!old) return s;
    return {
      ...s,
      starterId: old.starterId ?? old.playerId ?? null,
      subId: old.subId ?? null,
      influence: migrateInfluence(old.influence),
      positions: {
        base: s.positions.base, // base always comes from the template (locked)
        attack: old.positions?.attack ?? s.positions.attack,
        defense: old.positions?.defense ?? s.positions.defense,
      },
    };
  });
  return { ...parsed, slots };
}

// --- Library (several compos in localStorage) ---

const LIBRARY_KEY = "tactica11.library";
const CURRENT_KEY = "tactica11.currentId";

export interface Library {
  lineups: Lineup[];
  currentId: string;
}

export function loadLibrary(): Library {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (raw) {
      const lineups = (JSON.parse(raw) as Lineup[])
        .filter((l) => l && l.slots && l.players)
        .map(migrateLineup);
      if (lineups.length) {
        const saved = localStorage.getItem(CURRENT_KEY);
        const currentId = lineups.some((l) => l.id === saved)
          ? (saved as string)
          : lineups[0].id;
        return { lineups, currentId };
      }
    }
    // migrate a legacy single-lineup save into the library
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Lineup;
      if (parsed.slots && parsed.players) {
        const lineup = migrateLineup(parsed);
        return { lineups: [lineup], currentId: lineup.id };
      }
    }
  } catch {
    // fall through to a fresh library
  }
  const def = createDefaultLineup();
  return { lineups: [def], currentId: def.id };
}

export function saveLibrary(lib: Library): void {
  try {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib.lineups));
    localStorage.setItem(CURRENT_KEY, lib.currentId);
  } catch {
    // storage full or unavailable — ignore, export still works
  }
}

// --- File export / import (.json) ---

export function exportLineup(lineup: Lineup): void {
  const file: LineupFile = { app: "tactica11", version: FILE_VERSION, lineup };
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeName = lineup.name.trim().replace(/[^\w-]+/g, "_") || "compo";
  a.href = url;
  a.download = `${safeName}.tactica11.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importLineup(file: File): Promise<Lineup> {
  const text = await file.text();
  const data = JSON.parse(text) as Partial<LineupFile> & Partial<Lineup>;
  // Accept both the wrapped file format and a bare lineup object.
  const lineup = (data as LineupFile).lineup ?? (data as Lineup);
  if (!lineup || !lineup.slots || !lineup.players) {
    throw new Error("Fichier invalide");
  }
  return migrateLineup(lineup);
}
