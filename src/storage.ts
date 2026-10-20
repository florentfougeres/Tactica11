import {
  DEFAULT_STUDIO_SETTINGS,
  FILE_VERSION,
  OPPONENT_FORMATION,
  PROJECT_FILE_VERSION,
  type AttributeDef,
  type Lineup,
  type LineupFile,
  type Opponent,
  type Phase,
  type Player,
  type Pos,
  type Project,
  type ProjectFile,
  type SetPiece,
  type SetPieceState,
  type SetPieceType,
  type Slot,
  type StudioSettings,
  type ZoneRadii,
} from "./types";
import { buildSlots } from "./formations";
import { migrateSequence } from "./sequence/create";
import { saveFile } from "./download";
import { createDemoProject } from "./demo";

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

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// Spawn the 11 opposing discs from the default block — same positions for both
// phases initially; the user then tweaks each phase independently.
export function createOpponents(): Opponent[] {
  return OPPONENT_FORMATION.map(({ label, x, y }) => ({
    id: uid("opp"),
    label,
    positions: { attack: { x, y }, defense: { x, y } },
  }));
}

export function createDefaultLineup(): Lineup {
  const formation = "4-3-3";
  const slots = buildSlots(formation);
  return {
    id: uid("lineup"),
    name: "Ma compo",
    formation,
    slots,
    setPieces: [],
  };
}

export function createDefaultProject(): Project {
  const lineup = createDefaultLineup();
  return {
    id: uid("proj"),
    name: "Mon projet",
    players: [],
    attributeDefs: [],
    lineups: [lineup],
    currentLineupId: lineup.id,
  };
}

const SET_PIECE_LABEL: Record<SetPieceType, string> = {
  corner: "Corner",
  "free-kick": "Coup franc",
};

// Default ball spot per type: a right corner arc, or just outside the box for
// a free kick. Both states start identical — the user drags "Fin" apart.
const SET_PIECE_DEFAULT_BALL: Record<SetPieceType, { x: number; y: number }> =
  {
    corner: { x: 98, y: 3 },
    "free-kick": { x: 50, y: 25 },
  };

export function createSetPiece(
  type: SetPieceType,
  existingCount: number,
): SetPiece {
  const ball = SET_PIECE_DEFAULT_BALL[type];
  return {
    id: uid("sp"),
    name: `${SET_PIECE_LABEL[type]} ${existingCount + 1}`,
    type,
    ball: { start: ball, mid: ball, end: ball },
    tokens: [],
    opponents: [],
  };
}

// Midpoint used to backfill the "mid" phase for set pieces saved before it
// existed — keeps old files loadable without the intermediate stage
// collapsing to (0,0).
const midpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

function migrateSetPiece(sp: SetPiece): SetPiece {
  const withMid = (
    positions: Record<SetPieceState, Pos>,
  ): Record<SetPieceState, Pos> => ({
    ...positions,
    mid: positions.mid ?? midpoint(positions.start, positions.end),
  });
  return {
    ...sp,
    ball: withMid(sp.ball),
    tokens: sp.tokens.map((t) => ({ ...t, positions: withMid(t.positions) })),
    opponents: sp.opponents.map((o) => ({
      ...o,
      positions: withMid(o.positions),
    })),
  };
}

// Normalise a lineup that may come from an older schema (v1 used `playerId`,
// carried its own `players` array, and only had attack/defense positions, no
// locked "base" phase, no sub). The returned Lineup never carries `players` —
// that field now lives on the parent Project.
export function migrateLineup(
  parsed: Lineup & { players?: Player[] },
): Lineup {
  const fresh = buildSlots(parsed.formation || "4-3-3");
  const slots = fresh.map((s, i) => {
    const old = parsed.slots[i] as
      | (Slot & { playerId?: string | null })
      | undefined;
    if (!old) return s;
    return {
      ...s,
      // Keep the stored id: sequences reference slots by id across reloads.
      id: old.id || s.id,
      ...(old.roleLabels ? { roleLabels: old.roleLabels } : {}),
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
  return {
    id: parsed.id,
    name: parsed.name,
    formation: parsed.formation,
    slots,
    opponents: parsed.opponents ?? [],
    opponentColor: parsed.opponentColor,
    opponentColor2: parsed.opponentColor2,
    drawings: parsed.drawings,
    setPieces: (parsed.setPieces ?? [])
      .filter((sp) => sp && sp.id)
      .map(migrateSetPiece),
    ...(parsed.sequences?.length
      ? { sequences: parsed.sequences.filter((q) => q && q.id && q.steps?.length).map(migrateSequence) }
      : {}),
  };
}

// Wrap a legacy (pre-project) compo — which carried its own `players` array —
// into its own single-compo project. Used only during migration: rosters are
// never merged across legacy compos.
function wrapLegacyLineup(parsed: Lineup & { players?: Player[] }): Project {
  const lineup = migrateLineup(parsed);
  return {
    id: uid("proj"),
    name: parsed.name?.trim() || "Projet",
    players: parsed.players ?? [],
    attributeDefs: [],
    lineups: [lineup],
    currentLineupId: lineup.id,
  };
}

function migrateProject(parsed: Project): Project {
  let lineups = (parsed.lineups ?? [])
    .filter((l) => l && l.slots)
    .map(migrateLineup);
  if (!lineups.length) lineups = [createDefaultLineup()];
  const currentLineupId = lineups.some((l) => l.id === parsed.currentLineupId)
    ? parsed.currentLineupId
    : lineups[0].id;
  return {
    id: parsed.id,
    name: parsed.name,
    players: parsed.players ?? [],
    attributeDefs: parsed.attributeDefs ?? [],
    lineups,
    currentLineupId,
  };
}

// --- Library (several projects in localStorage, each holding its own roster
// and its own compos) ---

const PROJECTS_KEY = "tactica11.projects";
const CURRENT_PROJECT_KEY = "tactica11.currentProjectId";

// Legacy keys from before the "project" concept existed — read-only
// migration sources, never written to again.
const LEGACY_LIBRARY_KEY = "tactica11.library";
const LEGACY_CURRENT_KEY = "tactica11.currentId";
const LEGACY_LINEUP_KEY = "tactica11.lineup";

export interface Library {
  projects: Project[];
  currentProjectId: string;
}

export function loadLibrary(): Library {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (raw) {
      const projects = (JSON.parse(raw) as Project[])
        .filter((p) => p && p.lineups)
        .map(migrateProject);
      if (projects.length) {
        const saved = localStorage.getItem(CURRENT_PROJECT_KEY);
        const currentProjectId = projects.some((p) => p.id === saved)
          ? (saved as string)
          : projects[0].id;
        return { projects, currentProjectId };
      }
    }
  } catch {
    // fall through to legacy migration / fresh library
  }

  // First run after this feature shipped: migrate the old flat "library of
  // compos". Each legacy compo becomes its own single-compo project — rosters
  // are NOT merged across compos.
  try {
    const legacyLib = localStorage.getItem(LEGACY_LIBRARY_KEY);
    if (legacyLib) {
      const legacyLineups = JSON.parse(legacyLib) as (Lineup & {
        players?: Player[];
      })[];
      const valid = legacyLineups.filter((l) => l && l.slots && l.players);
      if (valid.length) {
        const projects = valid.map(wrapLegacyLineup);
        const savedId = localStorage.getItem(LEGACY_CURRENT_KEY);
        const target = projects.find((p) => p.lineups[0].id === savedId);
        return { projects, currentProjectId: (target ?? projects[0]).id };
      }
    }
    const legacySingle = localStorage.getItem(LEGACY_LINEUP_KEY);
    if (legacySingle) {
      const parsed = JSON.parse(legacySingle) as Lineup & {
        players?: Player[];
      };
      if (parsed.slots && parsed.players) {
        const project = wrapLegacyLineup(parsed);
        return { projects: [project], currentProjectId: project.id };
      }
    }
  } catch {
    // fall through to a fresh library
  }

  // Very first launch: open on the demo project, with an empty one beside it.
  const demo = createDemoProject();
  return {
    projects: [demo, createDefaultProject()],
    currentProjectId: demo.id,
  };
}

export function saveLibrary(lib: Library): void {
  try {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(lib.projects));
    localStorage.setItem(CURRENT_PROJECT_KEY, lib.currentProjectId);
  } catch {
    // storage full or unavailable — ignore, export still works
  }
}

// --- Studio settings (kit colours / poster layout) — a visual-identity
// preference, not tactical data, so it lives in its own key rather than on
// Lineup/Project (see StudioSettings in types.ts for why).

const STUDIO_SETTINGS_KEY = "tactica11.studio";

export function loadStudioSettings(): StudioSettings {
  try {
    const raw = localStorage.getItem(STUDIO_SETTINGS_KEY);
    if (raw) {
      // Before the poster redesign: background "2d" | "3d", labelColor.
      const { background, labelColor: _old, ...rest } = JSON.parse(raw) as Partial<StudioSettings> & {
        background?: string;
        labelColor?: string;
      };
      void _old;
      return {
        ...DEFAULT_STUDIO_SETTINGS,
        ...(background === "2d" ? { camera: "flat" as const } : {}),
        ...rest,
      };
    }
  } catch {
    // fall through to defaults
  }
  return DEFAULT_STUDIO_SETTINGS;
}

export function saveStudioSettings(settings: StudioSettings): void {
  try {
    localStorage.setItem(STUDIO_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // storage full or unavailable — ignore
  }
}

// --- Whole-project export / import ("Enregistrer" / "Ouvrir un projet") ---

export function exportProject(project: Project): void {
  const file: ProjectFile = {
    app: "tactica11",
    version: PROJECT_FILE_VERSION,
    project,
  };
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: "application/json",
  });
  const safeName = project.name.trim().replace(/[^\w-]+/g, "_") || "projet";
  void saveFile(blob, `${safeName}.tactica11-projet.json`);
}

// Parse a whole-project .json. The project keeps its original ids: the caller
// either opens it as a new project (fresh project id) or picks parts of it to
// merge into an existing one (mergeProjectParts mints fresh ids there).
export async function readProjectFile(file: File): Promise<Project> {
  const text = await file.text();
  const data = JSON.parse(text) as Partial<ProjectFile>;
  const raw = data.project;
  if (!raw || !raw.lineups || !raw.players) {
    throw new Error("Fichier de projet invalide");
  }
  return migrateProject(raw);
}

// --- Copying compos between projects ---

// Copy a compo into another project: fresh ids for the compo and its set
// pieces / sequences, and every player reference remapped through `mapPlayer`.
// A player it doesn't map isn't carried over: the slot is left empty, the
// set-piece token dropped, and a sequence disc falls back to its slot's player.
// Slot ids are kept: they are only unique within a compo, and sequences
// reference them.
export function remapLineup(
  lineup: Lineup,
  mapPlayer: (id: string) => string | undefined,
): Lineup {
  const map = (id: string | null | undefined) =>
    id ? (mapPlayer(id) ?? null) : null;
  return {
    ...lineup,
    id: uid("lineup"),
    slots: lineup.slots.map((s) => ({
      ...s,
      starterId: map(s.starterId),
      subId: map(s.subId),
    })),
    setPieces: lineup.setPieces.map((sp) => ({
      ...sp,
      id: uid("sp"),
      tokens: sp.tokens.flatMap((t) => {
        const playerId = mapPlayer(t.playerId);
        return playerId ? [{ ...t, id: uid("spt"), playerId }] : [];
      }),
      opponents: sp.opponents.map((o) => ({ ...o, id: uid("spo") })),
    })),
    ...(lineup.sequences
      ? {
          sequences: lineup.sequences.map((q) => ({
            ...q,
            id: uid("seq"),
            actors: q.actors.map((a) => {
              if (!a.playerId) return a;
              const playerId = mapPlayer(a.playerId);
              if (playerId) return { ...a, playerId };
              const { playerId: _drop, ...rest } = a;
              void _drop;
              return rest;
            }),
          })),
        }
      : {}),
  };
}

// Every roster player a compo points at: starters, subs, set-piece tokens and
// sequence discs.
function lineupPlayerIds(lineup: Lineup): Set<string> {
  const ids = referencedPlayerIds(lineup);
  lineup.setPieces.forEach((sp) => sp.tokens.forEach((t) => ids.add(t.playerId)));
  lineup.sequences?.forEach((q) =>
    q.actors.forEach((a) => a.playerId && ids.add(a.playerId)),
  );
  return ids;
}

const playerKey = (name: string) => name.trim().toLocaleLowerCase("fr");

// Bring `incoming` players into a project's roster. Custom-attribute columns
// are deduped by name+type; with `matchByName`, a player whose name already
// exists in the roster maps onto that player instead of becoming a duplicate.
// Returns the new roster/columns and the old → new player id map.
function mergePlayers(
  project: Project,
  incoming: Player[],
  incomingDefs: AttributeDef[],
  matchByName: boolean,
): {
  players: Player[];
  attributeDefs: AttributeDef[];
  playerIdMap: Map<string, string>;
} {
  const playerIdMap = new Map<string, string>();
  const byName = new Map<string, string>();
  if (matchByName) {
    project.players.forEach((p) => {
      const key = playerKey(p.name);
      if (key && !byName.has(key)) byName.set(key, p.id);
    });
  }
  const fresh: Player[] = [];
  incoming.forEach((p) => {
    const existing = matchByName ? byName.get(playerKey(p.name)) : undefined;
    if (existing) {
      playerIdMap.set(p.id, existing);
      return;
    }
    const id = uid("p");
    playerIdMap.set(p.id, id);
    fresh.push({ ...p, id });
  });

  // Only the columns the newly added players actually use.
  const usedAttrIds = new Set<string>();
  fresh.forEach((p) =>
    Object.keys(p.attributes ?? {}).forEach((k) => usedAttrIds.add(k)),
  );
  const attrIdMap = new Map<string, string>();
  let attributeDefs = project.attributeDefs;
  incomingDefs
    .filter((d) => usedAttrIds.has(d.id))
    .forEach((def) => {
      const existing = attributeDefs.find(
        (d) => d.name === def.name && d.type === def.type,
      );
      if (existing) {
        attrIdMap.set(def.id, existing.id);
      } else {
        const created: AttributeDef = { ...def, id: uid("attr") };
        attributeDefs = [...attributeDefs, created];
        attrIdMap.set(def.id, created.id);
      }
    });

  const added = fresh.map((p) =>
    p.attributes
      ? {
          ...p,
          attributes: Object.fromEntries(
            Object.entries(p.attributes).map(([k, v]) => [
              attrIdMap.get(k) ?? k,
              v,
            ]),
          ),
        }
      : p,
  );
  return {
    players: [...project.players, ...added],
    attributeDefs,
    playerIdMap,
  };
}

// What to take from another project's file: whole compos, each with only the
// chosen set pieces and sequences.
export interface LineupPick {
  lineupId: string;
  setPieceIds: string[];
  sequenceIds: string[];
}

export interface ProjectImportOptions {
  picks: LineupPick[];
  wholeRoster: boolean; // also bring players no picked compo uses (bench)
  matchByName: boolean; // reuse roster players with the same name
}

// Merge the picked parts of `source` into `target` as new compos, with fresh
// ids throughout and the players they reference added to the target roster.
export function mergeProjectParts(
  target: Project,
  source: Project,
  { picks, wholeRoster, matchByName }: ProjectImportOptions,
): { project: Project; lineups: Lineup[] } {
  const picked: Lineup[] = picks.flatMap((pick) => {
    const l = source.lineups.find((x) => x.id === pick.lineupId);
    if (!l) return [];
    const sequences = (l.sequences ?? []).filter((q) =>
      pick.sequenceIds.includes(q.id),
    );
    return [
      {
        ...l,
        setPieces: l.setPieces.filter((sp) => pick.setPieceIds.includes(sp.id)),
        ...(sequences.length ? { sequences } : { sequences: undefined }),
      },
    ];
  });

  const needed = new Set<string>();
  picked.forEach((l) => lineupPlayerIds(l).forEach((id) => needed.add(id)));
  const incoming = source.players.filter(
    (p) => wholeRoster || needed.has(p.id),
  );
  const { players, attributeDefs, playerIdMap } = mergePlayers(
    target,
    incoming,
    source.attributeDefs,
    matchByName,
  );

  const lineups = picked.map((l) =>
    remapLineup(l, (id) => playerIdMap.get(id)),
  );
  return {
    project: {
      ...target,
      players,
      attributeDefs,
      lineups: [...target.lineups, ...lineups],
      currentLineupId: lineups[0]?.id ?? target.currentLineupId,
    },
    lineups,
  };
}

// --- Share links (self-contained, single compo) ---

function referencedPlayerIds(lineup: Lineup): Set<string> {
  const ids = new Set<string>();
  lineup.slots.forEach((s) => {
    if (s.starterId) ids.add(s.starterId);
    if (s.subId) ids.add(s.subId);
  });
  return ids;
}

// A compo file/link is self-contained: it embeds only the players actually on
// the pitch (starters + subs), not the whole project roster/bench. Shared by
// .json export and share-link encoding.
export function buildLineupFile(project: Project, lineup: Lineup): LineupFile {
  const ids = referencedPlayerIds(lineup);
  const players = project.players.filter((p) => ids.has(p.id));
  const usedAttrIds = new Set<string>();
  players.forEach((p) =>
    Object.keys(p.attributes ?? {}).forEach((k) => usedAttrIds.add(k)),
  );
  const attributeDefs = project.attributeDefs.filter((d) =>
    usedAttrIds.has(d.id),
  );
  // Sequences stay out of compo files / share links (far too long for a URL);
  // they travel with the whole-project .json instead.
  const { sequences: _omit, ...shared } = lineup;
  void _omit;
  return {
    app: "tactica11",
    version: FILE_VERSION,
    lineup: shared,
    players,
    attributeDefs,
  };
}

export interface ImportedBundle {
  lineup: Lineup;
  players: Player[];
  attributeDefs: AttributeDef[];
}

// Shared by share-link decoding: accepts both the current (v2, denormalized)
// format and the older v1 format where players were embedded directly inside
// the lineup.
export function parseLineupBundle(text: string): ImportedBundle {
  const data = JSON.parse(text) as Partial<LineupFile> &
    Partial<Lineup & { players?: Player[] }>;
  const rawLineup = (data.lineup ?? data) as
    | (Lineup & { players?: Player[] })
    | undefined;
  if (!rawLineup || !rawLineup.slots) throw new Error("Fichier invalide");

  if (data.players) {
    // v2: players/attributeDefs are denormalized alongside `lineup`.
    return {
      lineup: migrateLineup(rawLineup),
      players: data.players,
      attributeDefs: data.attributeDefs ?? [],
    };
  }
  // v1 (or a bare lineup): players were embedded inside the lineup itself.
  const players = rawLineup.players ?? [];
  return { lineup: migrateLineup(rawLineup), players, attributeDefs: [] };
}

// Merge an imported/shared compo bundle into a project: mints fresh ids for
// the compo and every player it references (imported players are always new
// roster entries), remaps the slot references accordingly, and dedupes
// custom-attribute columns against the project's existing ones by name+type.
export function mergeImportedBundle(
  project: Project,
  bundle: ImportedBundle,
): { project: Project; lineup: Lineup } {
  const { players, attributeDefs, playerIdMap } = mergePlayers(
    project,
    bundle.players,
    bundle.attributeDefs,
    false,
  );
  const lineup = remapLineup(bundle.lineup, (id) => playerIdMap.get(id));
  return {
    project: {
      ...project,
      players,
      attributeDefs,
      lineups: [...project.lineups, lineup],
      currentLineupId: lineup.id,
    },
    lineup,
  };
}
