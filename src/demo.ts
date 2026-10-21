// Built-in demo project: the Real Madrid squad (effectif Transfermarkt,
// octobre 2026), a 4-3-3 with tuned attack/defense phases and opponents, two
// set pieces and a handful of animated sequences (sortie à 3, renversement,
// latéral intérieur, pressing haut, milieu carré), plus a 4-2-3-1 plan B.
//
// Written as code rather than a bundled .json so it always matches the
// current data model. Kept free of storage.ts imports (storage seeds a fresh
// library with it) to avoid an import cycle.
import { buildSlots } from "./formations";
import { sid } from "./sequence/create";
import type {
  AnnKind,
  Anchor,
  SeqActor,
  SeqAnnotation,
  SeqStep,
  SeqTheme,
  Sequence,
  StepEffect,
} from "./sequence/types";
import { DEFAULT_CAMERA, DEFAULT_THEME, defaultAnnColor } from "./sequence/types";
import type {
  Lineup,
  Opponent,
  Player,
  PlayerPosition,
  Pos,
  Project,
  SetPiece,
  SetPieceState,
} from "./types";

// --- Roster ---

const SQUAD: [number, string, PlayerPosition][] = [
  [1, "Courtois", "G"],
  [13, "Lunin", "G"],
  [4, "Huijsen", "DC"],
  [16, "Konaté", "DC"],
  [2, "Asencio", "DC"],
  [3, "Militão", "DC"],
  [22, "Rüdiger", "DC"],
  [17, "Cucurella", "DG"],
  [18, "Carreras", "DG"],
  [23, "Mendy", "DG"],
  [12, "Trent", "DD"],
  [24, "Dumfries", "DD"],
  [14, "Tchouaméni", "MDC"],
  [8, "Valverde", "MC"],
  [6, "Camavinga", "MC"],
  [27, "Pitarch", "MC"],
  [29, "Cestero", "MC"],
  [5, "Bellingham", "MOC"],
  [15, "Güler", "MOC"],
  [20, "Bernardo", "MOC"],
  [7, "Vini Jr.", "AG"],
  [25, "Diomande", "AD"],
  [11, "Rodrygo", "AD"],
  [21, "Brahim", "AD"],
  [10, "Mbappé", "BU"],
  [9, "Endrick", "BU"],
  [19, "Espí", "BU"],
];

// --- Main compo: 4-3-3 ---

// Slot order of the "4-3-3" template (formations.ts).
const HOME = ["GK", "RB", "RCB", "LCB", "LB", "RCM", "CDM", "LCM", "RW", "ST", "LW"] as const;
type Home = (typeof HOME)[number];

const XI: Record<Home, [starter: number, sub?: number]> = {
  GK: [1, 13],
  RB: [12, 24],
  RCB: [3, 22],
  LCB: [4, 16],
  LB: [18, 23],
  RCM: [8, 6],
  CDM: [14, 27],
  LCM: [5, 15],
  RW: [11, 21],
  ST: [10, 9],
  LW: [7, 25],
};

// En possession : 3-2-5, Trent rentre à côté de Tchouaméni.
const ATTACK: Record<Home, Pos> = {
  GK: { x: 50, y: 84 },
  RB: { x: 60, y: 50 },
  RCB: { x: 72, y: 66 },
  LCB: { x: 46, y: 70 },
  LB: { x: 22, y: 62 },
  RCM: { x: 66, y: 28 },
  CDM: { x: 42, y: 52 },
  LCM: { x: 34, y: 28 },
  RW: { x: 88, y: 22 },
  ST: { x: 50, y: 15 },
  LW: { x: 12, y: 22 },
};

// Sans ballon : bloc médian 4-4-2, Mbappé et Vini devant.
const DEFENSE: Record<Home, Pos> = {
  GK: { x: 50, y: 93 },
  RB: { x: 80, y: 76 },
  RCB: { x: 60, y: 80 },
  LCB: { x: 40, y: 80 },
  LB: { x: 20, y: 76 },
  RCM: { x: 60, y: 62 },
  CDM: { x: 40, y: 62 },
  LCM: { x: 18, y: 58 },
  RW: { x: 82, y: 58 },
  ST: { x: 58, y: 40 },
  LW: { x: 40, y: 42 },
};

// Opponents, same label order as OPPONENT_FORMATION: low 4-4-2 block when we
// attack, building up from the back in a 4-3-3 when we defend.
const OPP_LABELS = ["1", "2", "3", "4", "5", "6", "8", "7", "9", "10", "11"];
const OPP_ATTACK: Pos[] = [
  { x: 50, y: 5 }, { x: 80, y: 18 }, { x: 60, y: 20 }, { x: 40, y: 20 }, { x: 20, y: 18 },
  { x: 58, y: 33 }, { x: 22, y: 32 }, { x: 78, y: 32 }, { x: 56, y: 45 }, { x: 40, y: 34 }, { x: 44, y: 46 },
];
const OPP_DEFENSE: Pos[] = [
  { x: 50, y: 8 }, { x: 86, y: 34 }, { x: 64, y: 22 }, { x: 36, y: 22 }, { x: 14, y: 34 },
  { x: 50, y: 34 }, { x: 34, y: 46 }, { x: 66, y: 46 }, { x: 50, y: 62 }, { x: 22, y: 60 }, { x: 78, y: 60 },
];

// --- Sequence builder ---
// Actors are named by role ("RB", "ST"…) for our team and "o" + label ("o9")
// for theirs; a step lists only who moves, everyone else stays put.

type Ref = string | Pos;

interface ArrowSpec {
  kind: AnnKind; // pass (actor → actor), or a movement: run / deep / dribble / press
  from: Ref;
  to: Ref;
  curve?: Pos;
}

interface ShapeSpec {
  kind: AnnKind; // zone / space / playerZone / playerLine / circle / label / line
  at: Ref[];
  text?: string;
  color?: string;
  curve?: Pos;
  fill?: SeqAnnotation["fill"];
  steps?: number; // stays visible this many steps after its own (default 0)
}

interface StepSpec {
  name?: string;
  caption?: string;
  chapter?: string;
  moves?: Record<string, Pos>;
  ball: Ref;
  arrows?: ArrowSpec[];
  shapes?: ShapeSpec[];
  focus?: string[];
  dim?: boolean;
  ghosts?: boolean;
  effect?: { kind: StepEffect; text?: string };
  transitionMs?: number;
  holdMs?: number;
}

interface SeqSpec {
  name: string;
  home: Record<Home, Pos>;
  away: Record<string, Pos>; // label → spot
  steps: StepSpec[];
  // Overrides of the default look (vertical 9:16, shirt numbers, house theme).
  look?: Partial<Pick<Sequence, "format" | "orient" | "discMode" | "subtitle" | "idle">>;
  theme?: Partial<SeqTheme>;
}

// Pull a movement arrow's ends off the discs so the head stays visible.
function trim(a: Pos, b: Pos, start: number, end: number): [Pos, Pos] {
  const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / d;
  const uy = (b.y - a.y) / d;
  return [
    { x: a.x + ux * start, y: a.y + uy * start },
    { x: b.x - ux * end, y: b.y - uy * end },
  ];
}

function buildSequence(lineup: Lineup, spec: SeqSpec): Sequence {
  const actors: SeqActor[] = [];
  const ids: Record<string, string> = {};
  const start: Record<string, Pos> = {};
  HOME.forEach((key, i) => {
    const id = sid("act");
    ids[key] = id;
    actors.push({ id, team: "home", slotId: lineup.slots[i].id, gk: key === "GK" });
    start[id] = spec.home[key];
  });
  Object.entries(spec.away).forEach(([label, pos]) => {
    const id = sid("act");
    ids[`o${label}`] = id;
    actors.push({ id, team: "away", label, gk: label === "1" });
    start[id] = pos;
  });

  const theme = { ...DEFAULT_THEME, ...spec.theme };
  const steps: SeqStep[] = [];
  const annotations: SeqAnnotation[] = [];
  const lasting: [SeqAnnotation, number][] = [];
  let positions = start;

  spec.steps.forEach((s, i) => {
    const prev = positions;
    positions = { ...prev };
    Object.entries(s.moves ?? {}).forEach(([key, pos]) => {
      positions[ids[key]] = pos;
    });
    const at = (ref: Ref, where = positions): Pos =>
      typeof ref === "string" ? where[ids[ref]] : ref;
    const anchor = (ref: Ref): Anchor =>
      typeof ref === "string" ? { actorId: ids[ref] } : { pos: ref };

    const step: SeqStep = {
      id: sid("step"),
      name: s.name,
      positions,
      ball: typeof s.ball === "string" ? { carrierId: ids[s.ball] } : { pos: s.ball },
      camera: { ...DEFAULT_CAMERA },
      caption: s.caption,
      chapter: s.chapter,
      focusIds: s.focus?.map((k) => ids[k]),
      dimOthers: s.dim,
      ghosts: s.ghosts,
      effect: s.effect?.kind,
      effectText: s.effect?.text,
      transitionMs: s.transitionMs ?? (i === 0 ? 800 : 1400),
      holdMs: s.holdMs ?? 2200,
      easing: "easeInOut",
    };
    steps.push(step);

    s.arrows?.forEach((a) => {
      // Passes link the two players; a movement is drawn from where the
      // player stood to where they end up.
      const anchors: Anchor[] =
        a.kind === "pass"
          ? [anchor(a.from), anchor(a.to)]
          : trim(at(a.from, prev), at(a.to), 2.2, 3.4).map((pos) => ({ pos }));
      annotations.push({
        id: sid("ann"),
        kind: a.kind,
        anchors,
        control: a.curve,
        color: defaultAnnColor(a.kind, theme),
        fromStep: step.id,
        toStep: step.id,
      });
    });
    s.shapes?.forEach((sh) => {
      const ann: SeqAnnotation = {
        id: sid("ann"),
        kind: sh.kind,
        anchors: sh.at.map(anchor),
        control: sh.curve,
        text: sh.text,
        color: sh.color ?? defaultAnnColor(sh.kind, theme),
        fromStep: step.id,
        toStep: step.id,
        fill: sh.fill,
      };
      annotations.push(ann);
      // A shape that outlives its step gets its last step once that exists.
      if (sh.steps) lasting.push([ann, i + sh.steps]);
    });
  });
  lasting.forEach(([ann, last]) => {
    ann.toStep = steps[Math.min(steps.length - 1, last)].id;
  });

  return {
    id: sid("seq"),
    name: spec.name,
    format: "9:16",
    orient: "portrait",
    discMode: "number",
    title: "Real Madrid",
    subtitle: spec.name,
    showNames: true,
    idle: 1,
    ...spec.look,
    theme,
    actors,
    steps,
    annotations,
  };
}

// Our team set up for each sequence, then what happens step by step.
const awayAt = (spots: Pos[]) =>
  Object.fromEntries(OPP_LABELS.map((l, i) => [l, spots[i]]));

const SORTIE_A_3: SeqSpec = {
  name: "Sortie à 3",
  home: {
    GK: { x: 50, y: 92 },
    RB: { x: 86, y: 70 },
    RCB: { x: 64, y: 82 },
    LCB: { x: 36, y: 82 },
    LB: { x: 14, y: 70 },
    RCM: { x: 68, y: 54 },
    CDM: { x: 50, y: 66 },
    LCM: { x: 32, y: 54 },
    RW: { x: 86, y: 36 },
    ST: { x: 50, y: 30 },
    LW: { x: 14, y: 36 },
  },
  // 4-4-2 adverse qui presse avec ses deux attaquants.
  away: awayAt([
    { x: 50, y: 8 }, { x: 80, y: 40 }, { x: 60, y: 42 }, { x: 40, y: 42 }, { x: 20, y: 40 },
    { x: 58, y: 58 }, { x: 22, y: 56 }, { x: 78, y: 56 }, { x: 58, y: 72 }, { x: 42, y: 72 }, { x: 42, y: 58 },
  ]),
  steps: [
    {
      name: "Situation initiale",
      chapter: "Sortie à 3",
      caption: "Courtois relance, l'adversaire presse avec ses deux attaquants.",
      ball: "GK",
    },
    {
      name: "Le 6 décroche",
      caption: "Tchouaméni décroche entre les centraux : 3 contre 2 à la relance.",
      moves: {
        CDM: { x: 50, y: 81 },
        RCB: { x: 76, y: 79 },
        LCB: { x: 24, y: 79 },
        RB: { x: 88, y: 56 },
        LB: { x: 12, y: 56 },
        o9: { x: 60, y: 74 },
        o10: { x: 40, y: 74 },
      },
      ball: "GK",
      arrows: [
        { kind: "run", from: "CDM", to: "CDM" },
        { kind: "run", from: "RCB", to: "RCB" },
        { kind: "run", from: "LCB", to: "LCB" },
        { kind: "deep", from: "RB", to: "RB" },
        { kind: "deep", from: "LB", to: "LB" },
      ],
      shapes: [{ kind: "playerLine", at: ["LCB", "CDM", "RCB"], steps: 1 }],
      focus: ["CDM", "RCB", "LCB"],
      ghosts: true,
    },
    {
      name: "Relance sur Huijsen",
      caption: "Le 10 adverse ne peut pas fermer Huijsen et Tchouaméni à la fois.",
      moves: { o10: { x: 34, y: 76 }, o8: { x: 26, y: 62 } },
      ball: "LCB",
      arrows: [
        { kind: "pass", from: "GK", to: "LCB" },
        { kind: "press", from: "o10", to: "o10" },
      ],
    },
    {
      name: "Huijsen conduit",
      caption: "Personne ne sort sur lui : Huijsen avance balle au pied.",
      moves: {
        LCB: { x: 26, y: 67 },
        o10: { x: 30, y: 71 },
        LCM: { x: 36, y: 58 },
        o7: { x: 40, y: 60 },
      },
      ball: "LCB",
      arrows: [
        { kind: "dribble", from: "LCB", to: "LCB" },
        { kind: "run", from: "LCM", to: "LCM" },
      ],
      shapes: [{ kind: "space", at: [{ x: 28, y: 50 }, { x: 46, y: 50 }, { x: 46, y: 60 }, { x: 28, y: 60 }] }],
    },
    {
      name: "Bellingham entre les lignes",
      caption: "Bellingham reçoit entre les lignes : le pressing est éliminé.",
      moves: { LCM: { x: 36, y: 52 }, o8: { x: 30, y: 58 }, LW: { x: 12, y: 30 }, ST: { x: 46, y: 28 } },
      ball: "LCM",
      arrows: [{ kind: "pass", from: "LCB", to: "LCM" }],
      focus: ["LCM"],
      dim: true,
      effect: { kind: "bigText", text: "PRESSING ÉLIMINÉ" },
      holdMs: 2600,
    },
  ],
};

const RENVERSEMENT: SeqSpec = {
  name: "Renversement",
  home: {
    GK: { x: 50, y: 88 },
    RB: { x: 78, y: 46 },
    RCB: { x: 62, y: 64 },
    LCB: { x: 38, y: 64 },
    LB: { x: 20, y: 42 },
    RCM: { x: 58, y: 38 },
    CDM: { x: 44, y: 50 },
    LCM: { x: 30, y: 32 },
    RW: { x: 90, y: 26 },
    ST: { x: 42, y: 18 },
    LW: { x: 12, y: 28 },
  },
  // Bloc adverse attiré côté gauche.
  away: awayAt([
    { x: 48, y: 5 }, { x: 62, y: 18 }, { x: 46, y: 19 }, { x: 30, y: 19 }, { x: 14, y: 20 },
    { x: 44, y: 32 }, { x: 18, y: 32 }, { x: 58, y: 33 }, { x: 54, y: 48 }, { x: 30, y: 34 }, { x: 40, y: 48 },
  ]),
  steps: [
    {
      name: "Surcharge à gauche",
      chapter: "Renversement",
      caption: "Vini, Carreras et Bellingham attirent tout le bloc côté gauche.",
      ball: "LW",
      shapes: [
        { kind: "playerZone", at: ["LW", "LCM", "LB"], steps: 1 },
        { kind: "space", at: [{ x: 68, y: 10 }, { x: 97, y: 10 }, { x: 97, y: 40 }, { x: 68, y: 40 }], steps: 3 },
        { kind: "label", at: [{ x: 80, y: 13 }], text: "Côté faible", steps: 3 },
      ],
    },
    {
      name: "Remise",
      caption: "Une passe en retrait vers Tchouaméni, l'adversaire reste collé au ballon.",
      moves: { o8: { x: 22, y: 36 }, o10: { x: 34, y: 40 }, CDM: { x: 42, y: 47 } },
      ball: "CDM",
      arrows: [{ kind: "pass", from: "LW", to: "CDM" }],
    },
    {
      name: "Renversement",
      caption: "Changement d'aile : Rodrygo reçoit seul face à son latéral.",
      moves: {
        RW: { x: 88, y: 22 },
        o2: { x: 72, y: 19 },
        o7: { x: 66, y: 31 },
        RB: { x: 84, y: 38 },
      },
      ball: "RW",
      arrows: [
        { kind: "pass", from: "CDM", to: "RW", curve: { x: 70, y: 20 } },
        { kind: "deep", from: "RB", to: "RB" },
      ],
      effect: { kind: "flash" },
      transitionMs: 1600,
    },
    {
      name: "Attaque du côté faible",
      caption: "Trent dédouble, Mbappé attaque le premier poteau.",
      moves: {
        RB: { x: 92, y: 12 },
        RW: { x: 80, y: 16 },
        ST: { x: 56, y: 9 },
        RCM: { x: 66, y: 24 },
        o2: { x: 82, y: 15 },
        o3: { x: 58, y: 13 },
      },
      ball: "RW",
      arrows: [
        { kind: "deep", from: "RB", to: "RB" },
        { kind: "dribble", from: "RW", to: "RW" },
        { kind: "deep", from: "ST", to: "ST" },
      ],
      focus: ["RW", "RB", "ST"],
      holdMs: 2600,
    },
  ],
};

const LATERAL_INTERIEUR: SeqSpec = {
  name: "Latéral intérieur",
  home: {
    GK: { x: 50, y: 88 },
    RB: { x: 86, y: 62 },
    RCB: { x: 64, y: 74 },
    LCB: { x: 36, y: 74 },
    LB: { x: 16, y: 62 },
    RCM: { x: 66, y: 44 },
    CDM: { x: 48, y: 58 },
    LCM: { x: 34, y: 40 },
    RW: { x: 88, y: 34 },
    ST: { x: 50, y: 24 },
    LW: { x: 12, y: 30 },
  },
  away: awayAt([
    { x: 50, y: 6 }, { x: 80, y: 26 }, { x: 60, y: 24 }, { x: 40, y: 24 }, { x: 20, y: 26 },
    { x: 58, y: 42 }, { x: 24, y: 42 }, { x: 76, y: 46 }, { x: 56, y: 56 }, { x: 40, y: 44 }, { x: 80, y: 56 },
  ]),
  steps: [
    {
      name: "Situation initiale",
      chapter: "Latéral intérieur",
      caption: "Militão a le ballon, Trent est collé à la ligne.",
      ball: "RCB",
    },
    {
      name: "Le latéral rentre",
      caption: "Trent rentre dans l'axe : double pivot avec Tchouaméni.",
      moves: {
        RB: { x: 62, y: 57 },
        CDM: { x: 44, y: 58 },
        RW: { x: 92, y: 32 },
        RCM: { x: 70, y: 36 },
        o11: { x: 74, y: 58 },
      },
      ball: "RCB",
      arrows: [
        { kind: "run", from: "RB", to: "RB", curve: { x: 76, y: 54 } },
        { kind: "run", from: "RCM", to: "RCM" },
      ],
      shapes: [
        { kind: "playerLine", at: ["CDM", "RB"], steps: 1 },
        { kind: "label", at: ["o11"], text: "Qui suivre ?" },
      ],
      focus: ["RB"],
      ghosts: true,
    },
    {
      name: "Passe à l'intérieur",
      caption: "L'ailier adverse hésite : Militão trouve Trent dans l'axe.",
      moves: { o11: { x: 70, y: 60 }, o9: { x: 54, y: 60 } },
      ball: "RB",
      arrows: [{ kind: "pass", from: "RCB", to: "RB" }],
    },
    {
      name: "Passe verticale",
      caption: "Depuis l'axe, il casse deux lignes pour Valverde dans le demi-espace.",
      moves: {
        RCM: { x: 70, y: 22 },
        ST: { x: 48, y: 16 },
        o2: { x: 82, y: 22 },
        o7: { x: 72, y: 40 },
      },
      ball: "RCM",
      arrows: [
        { kind: "deep", from: "RCM", to: "RCM" },
        { kind: "pass", from: "RB", to: "RCM" },
      ],
      shapes: [{ kind: "space", at: [{ x: 62, y: 18 }, { x: 80, y: 18 }, { x: 80, y: 32 }, { x: 62, y: 32 }] }],
      focus: ["RB", "RCM"],
    },
    {
      name: "Centre en retrait",
      caption: "Valverde centre en retrait, Mbappé conclut.",
      moves: { RCM: { x: 74, y: 10 }, ST: { x: 52, y: 12 }, o3: { x: 62, y: 10 } },
      ball: "ST",
      arrows: [
        { kind: "dribble", from: "RCM", to: "RCM" },
        { kind: "pass", from: "RCM", to: "ST" },
      ],
      transitionMs: 1600,
    },
    {
      name: "But",
      ball: { x: 46, y: 1 },
      effect: { kind: "bigText", text: "BUT" },
      focus: ["ST"],
      transitionMs: 700,
      holdMs: 2000,
    },
  ],
};

const PRESSING_HAUT: SeqSpec = {
  name: "Pressing haut",
  home: {
    GK: { x: 50, y: 86 },
    RB: { x: 80, y: 56 },
    RCB: { x: 60, y: 62 },
    LCB: { x: 40, y: 62 },
    LB: { x: 20, y: 56 },
    RCM: { x: 62, y: 36 },
    CDM: { x: 50, y: 44 },
    LCM: { x: 40, y: 36 },
    RW: { x: 70, y: 26 },
    ST: { x: 50, y: 24 },
    LW: { x: 30, y: 26 },
  },
  // L'adversaire relance court depuis son gardien.
  away: awayAt([
    { x: 50, y: 6 }, { x: 88, y: 24 }, { x: 66, y: 14 }, { x: 34, y: 14 }, { x: 12, y: 24 },
    { x: 50, y: 28 }, { x: 36, y: 38 }, { x: 64, y: 38 }, { x: 50, y: 52 }, { x: 16, y: 46 }, { x: 84, y: 46 },
  ]),
  steps: [
    {
      name: "Relance adverse",
      chapter: "Pressing haut",
      caption: "Mbappé se place dans la ligne de passe du 6 : l'axe est fermé.",
      ball: "o1",
      shapes: [{ kind: "circle", at: ["o6"] }],
    },
    {
      name: "Déclencheur",
      caption: "Passe vers le central : c'est le signal, Vini presse en courbe.",
      moves: {
        LW: { x: 30, y: 16 },
        ST: { x: 46, y: 22 },
        LCM: { x: 36, y: 33 },
        o4: { x: 32, y: 16 },
      },
      ball: "o4",
      arrows: [
        { kind: "pass", from: "o1", to: "o4" },
        { kind: "press", from: "LW", to: "LW", curve: { x: 22, y: 22 } },
      ],
      focus: ["LW", "ST"],
    },
    {
      name: "Piège sur le côté",
      caption: "Le latéral reçoit dos à la ligne : trois joueurs se referment sur lui.",
      moves: {
        o5: { x: 12, y: 28 },
        LW: { x: 18, y: 22 },
        LCM: { x: 20, y: 32 },
        LB: { x: 16, y: 40 },
        CDM: { x: 38, y: 36 },
        o10: { x: 14, y: 42 },
      },
      ball: "o5",
      arrows: [
        { kind: "pass", from: "o4", to: "o5" },
        { kind: "press", from: "LCM", to: "LCM" },
        { kind: "press", from: "LB", to: "LB" },
      ],
      shapes: [{ kind: "playerZone", at: ["LW", "LCM", "LB"], color: "#ff4d4f" }],
      ghosts: true,
    },
    {
      name: "Récupération",
      caption: "Bellingham récupère haut, le but est à 30 mètres.",
      moves: { LCM: { x: 14, y: 28 }, o5: { x: 10, y: 31 }, ST: { x: 40, y: 16 } },
      ball: "LCM",
      focus: ["LCM"],
      effect: { kind: "bigText", text: "RÉCUPÉRATION" },
      transitionMs: 900,
      holdMs: 2400,
    },
  ],
};

// Sortie à 3 with the right back stepping into midfield: a 4-man box in the
// middle against a 4-2-3-1. Square landscape format, discs showing positions.
const RED = "#ff4d4f";
const WHITE = "#ffffff";
const CARRE_MILIEU: SeqSpec = {
  name: "Sortie à 3 + milieu carré",
  look: {
    format: "1:1",
    orient: "landscape",
    discMode: "role",
    subtitle: "Sortie à 3 avec milieu carré",
    idle: 3,
  },
  theme: { homeGk: "#b388ff", awayColor: "#3f8fe0", awayText: "#ffffff", awayGk: "#3ee06a" },
  home: {
    GK: { x: 50, y: 92 },
    RB: { x: 92, y: 77 },
    RCB: { x: 65, y: 83 },
    LCB: { x: 32, y: 83 },
    LB: { x: 7, y: 75 },
    RCM: { x: 70, y: 55 },
    CDM: { x: 51, y: 70 },
    LCM: { x: 30, y: 55 },
    RW: { x: 93, y: 41 },
    ST: { x: 51, y: 37 },
    LW: { x: 7, y: 42 },
  },
  away: awayAt([
    { x: 50, y: 7 }, { x: 92, y: 34 }, { x: 69, y: 32 }, { x: 34, y: 32 }, { x: 9, y: 36 },
    { x: 31, y: 50 }, { x: 50, y: 64 }, { x: 12, y: 68 }, { x: 51, y: 76 }, { x: 70, y: 50 }, { x: 90, y: 70 },
  ]),
  steps: [
    {
      name: "Situation initiale",
      chapter: "Milieu carré",
      caption: "Position de base : 4-3-3 contre 4-2-3-1.",
      ball: "GK",
      shapes: [
        { kind: "playerLine", at: ["LB", "LCB", "RCB", "RB"], color: WHITE },
        { kind: "playerLine", at: ["LCM", "CDM", "RCM"], color: WHITE },
        { kind: "playerLine", at: ["LW", "ST", "RW"], color: WHITE },
      ],
      focus: ["GK"],
      transitionMs: 0,
      holdMs: 3000,
    },
    {
      caption: "Pas de supériorité : marquage un pour un.",
      ball: "GK",
      shapes: [
        { kind: "marking", at: ["LB", "o7"] },
        { kind: "marking", at: ["RB", "o11"] },
        { kind: "marking", at: ["o8", "CDM"] },
        { kind: "marking", at: ["o6", "LCM"] },
        { kind: "marking", at: ["o10", "RCM"] },
        { kind: "marking", at: ["o2", "RW"] },
        { kind: "marking", at: ["o5", "LW"] },
      ],
      focus: ["GK"],
      transitionMs: 0,
      holdMs: 3000,
    },
    {
      caption: "Le latéral droit s'insère au milieu, la défense glisse sur une base à 3.",
      moves: {
        RB: { x: 66, y: 68 },
        RCB: { x: 83, y: 83 },
        LCB: { x: 50, y: 83 },
        LB: { x: 17, y: 83 },
        CDM: { x: 32, y: 67 },
        o8: { x: 51, y: 61 },
        o7: { x: 18, y: 78 },
        o9: { x: 51, y: 79 },
        o10: { x: 70, y: 49 },
        o11: { x: 85, y: 78 },
      },
      ball: "GK",
      ghosts: true,
      transitionMs: 2000,
      holdMs: 3000,
    },
    {
      caption: "Le numéro 8 a maintenant deux joueurs à marquer : il ne sait pas qui prendre.",
      ball: "GK",
      shapes: [
        { kind: "marking", at: ["o8", "CDM"] },
        { kind: "marking", at: ["o8", "RB"] },
      ],
      focus: ["o8"],
      transitionMs: 1200,
      holdMs: 3000,
    },
    {
      caption:
        "4 contre 3 au milieu. L'ailier droit peut décrocher chercher le ballon, un milieu du carré se projette dans son dos.",
      moves: {
        RB: { x: 68, y: 69 },
        RCM: { x: 69, y: 53 },
        CDM: { x: 30, y: 69 },
        LCM: { x: 30, y: 53 },
      },
      ball: "RCB",
      shapes: [
        { kind: "playerZone", at: ["CDM", "LCM", "RCM", "RB"], fill: "hatch" },
        { kind: "pass", at: ["GK", { x: 79, y: 84 }] },
        { kind: "deep", at: [{ x: 94, y: 43 }, { x: 90, y: 63 }], color: RED },
        { kind: "deep", at: ["RCM", { x: 84, y: 24 }], color: RED },
        { kind: "space", at: [{ x: 82, y: 6 }, { x: 98, y: 6 }, { x: 98, y: 29 }, { x: 82, y: 29 }] },
      ],
      focus: ["RCB"],
      transitionMs: 1200,
      holdMs: 3000,
    },
    {
      caption:
        "Un espace se libère au milieu : un milieu du bas du carré peut s'y projeter, ou l'avant-centre décrocher.",
      moves: {
        RCM: { x: 87, y: 28 },
        RW: { x: 88, y: 63 },
        o2: { x: 90, y: 56 },
        o10: { x: 84, y: 33 },
      },
      ball: "RW",
      shapes: [
        { kind: "space", at: [{ x: 58, y: 60 }, { x: 79, y: 60 }, { x: 79, y: 40 }, { x: 58, y: 40 }] },
        { kind: "press", at: ["RB", { x: 69, y: 51 }] },
        { kind: "press", at: ["ST", { x: 68, y: 48 }] },
      ],
      focus: ["ST", "RB"],
      transitionMs: 1200,
      holdMs: 3000,
    },
    {
      caption: "Le défenseur central est aspiré, un grand espace s'ouvre à l'opposé.",
      moves: { ST: { x: 67, y: 49 }, o3: { x: 66, y: 42 }, o4: { x: 56, y: 34 } },
      ball: "ST",
      shapes: [
        { kind: "pass", at: ["RW", "ST"] },
        { kind: "space", at: [{ x: 20, y: 42 }, { x: 48, y: 42 }, { x: 48, y: 21 }, { x: 20, y: 21 }] },
        { kind: "press", at: ["LW", { x: 35, y: 33 }] },
      ],
      focus: ["ST"],
      transitionMs: 1200,
      holdMs: 3000,
    },
    {
      caption: "L'ailier gauche attaque l'espace entre les deux défenseurs, ou lance le milieu projeté.",
      moves: { LW: { x: 28, y: 35 }, o4: { x: 44, y: 32 }, o5: { x: 21, y: 32 } },
      ball: "ST",
      shapes: [
        { kind: "pass", at: ["ST", "LW"], curve: { x: 47, y: 54 } },
        { kind: "dribble", at: ["LW", { x: 36, y: 20 }] },
        { kind: "pass", at: ["ST", { x: 85, y: 26 }] },
      ],
      focus: ["RCM", "LW"],
      transitionMs: 1200,
      holdMs: 3000,
    },
    {
      caption: "Face-à-face avec le gardien.",
      moves: {
        RB: { x: 67, y: 52 },
        RCB: { x: 83, y: 74 },
        LCB: { x: 51, y: 75 },
        LB: { x: 19, y: 74 },
        RCM: { x: 89, y: 21 },
        CDM: { x: 30, y: 53 },
        LCM: { x: 33, y: 42 },
        RW: { x: 79, y: 48 },
        ST: { x: 64, y: 30 },
        LW: { x: 38, y: 12 },
        o1: { x: 43, y: 7 },
        o2: { x: 78, y: 43 },
        o3: { x: 65, y: 26 },
        o4: { x: 46, y: 15 },
        o5: { x: 30, y: 13 },
        o6: { x: 35, y: 38 },
        o8: { x: 50, y: 50 },
        o7: { x: 20, y: 69 },
        o9: { x: 51, y: 71 },
        o10: { x: 84, y: 19 },
        o11: { x: 83, y: 70 },
      },
      ball: "LW",
      focus: ["LW"],
      transitionMs: 1200,
      holdMs: 3000,
    },
    {
      ball: { x: 53, y: -1 },
      focus: ["LW"],
      effect: { kind: "bigText", text: "BUT !" },
      transitionMs: 1200,
      holdMs: 3000,
    },
  ],
};

// --- Set pieces (half pitch: y 0 = goal line, 100 = halfway line) ---

function setPiece(
  name: string,
  type: SetPiece["type"],
  ball: Record<SetPieceState, Pos>,
  tokens: [playerId: string, start: Pos, mid: Pos, end: Pos][],
  opponents: [label: string, start: Pos, mid: Pos, end: Pos][],
): SetPiece {
  const triple = (start: Pos, mid: Pos, end: Pos) => ({ start, mid, end });
  return {
    id: sid("sp"),
    name,
    type,
    ball,
    tokens: tokens.map(([playerId, a, b, c]) => ({
      id: sid("spt"),
      playerId,
      positions: triple(a, b, c),
    })),
    opponents: opponents.map(([label, a, b, c]) => ({
      id: sid("spo"),
      label,
      positions: triple(a, b, c),
    })),
  };
}

// --- Project ---

function compo(
  name: string,
  formation: string,
  xi: [number, number?][],
  idOf: Map<number, string>,
): Lineup {
  const slots = buildSlots(formation).map((s, i) => ({
    ...s,
    starterId: idOf.get(xi[i][0]) ?? null,
    subId: xi[i][1] != null ? (idOf.get(xi[i][1]!) ?? null) : null,
  }));
  return { id: sid("lineup"), name, formation, slots, setPieces: [] };
}

export function createDemoProject(): Project {
  const players: Player[] = SQUAD.map(([number, name, position]) => ({
    id: sid("p"),
    name,
    number,
    position,
  }));
  const idOf = new Map(players.map((p) => [p.number!, p.id]));
  const pid = (n: number) => idOf.get(n)!;

  // 4-3-3 with its tuned phases and opponents.
  const main = compo("Real Madrid · 4-3-3", "4-3-3", HOME.map((k) => XI[k]), idOf);
  main.slots = main.slots.map((s, i) => ({
    ...s,
    positions: { ...s.positions, attack: ATTACK[HOME[i]], defense: DEFENSE[HOME[i]] },
  }));
  main.opponents = OPP_LABELS.map(
    (label, i): Opponent => ({
      id: sid("opp"),
      label,
      positions: { attack: OPP_ATTACK[i], defense: OPP_DEFENSE[i] },
    }),
  );

  main.setPieces = [
    setPiece(
      "Corner · 1er poteau",
      "corner",
      { start: { x: 98, y: 1 }, mid: { x: 62, y: 9 }, end: { x: 47, y: 1 } },
      [
        [pid(12), { x: 97, y: 2 }, { x: 94, y: 4 }, { x: 92, y: 8 }], // tireur
        [pid(3), { x: 46, y: 22 }, { x: 56, y: 12 }, { x: 60, y: 8 }], // déviation 1er poteau
        [pid(4), { x: 58, y: 26 }, { x: 46, y: 16 }, { x: 47, y: 7 }], // reprise au centre
        [pid(5), { x: 34, y: 22 }, { x: 38, y: 12 }, { x: 41, y: 7 }], // 2e poteau
        [pid(10), { x: 68, y: 20 }, { x: 52, y: 18 }, { x: 52, y: 15 }], // point de penalty
        [pid(14), { x: 50, y: 38 }, { x: 50, y: 30 }, { x: 50, y: 28 }], // retour
        [pid(8), { x: 26, y: 38 }, { x: 32, y: 32 }, { x: 34, y: 30 }], // second ballon
      ],
      [
        ["1", { x: 50, y: 2 }, { x: 52, y: 3 }, { x: 50, y: 2 }],
        ["2", { x: 57, y: 6 }, { x: 58, y: 7 }, { x: 59, y: 7 }],
        ["3", { x: 47, y: 19 }, { x: 54, y: 13 }, { x: 58, y: 10 }],
        ["4", { x: 57, y: 22 }, { x: 47, y: 15 }, { x: 49, y: 9 }],
        ["5", { x: 35, y: 18 }, { x: 40, y: 13 }, { x: 43, y: 9 }],
        ["9", { x: 64, y: 14 }, { x: 64, y: 14 }, { x: 64, y: 14 }],
      ],
    ),
    setPiece(
      "Coup franc · décalage",
      "free-kick",
      { start: { x: 36, y: 25 }, mid: { x: 44, y: 29 }, end: { x: 54, y: 1 } },
      [
        [pid(7), { x: 34, y: 27 }, { x: 34, y: 25 }, { x: 34, y: 22 }], // décale
        [pid(8), { x: 46, y: 34 }, { x: 44, y: 30 }, { x: 44, y: 28 }], // frappe
        [pid(5), { x: 52, y: 18 }, { x: 50, y: 10 }, { x: 52, y: 7 }],
        [pid(10), { x: 62, y: 16 }, { x: 60, y: 9 }, { x: 58, y: 6 }],
        [pid(3), { x: 56, y: 22 }, { x: 46, y: 10 }, { x: 46, y: 7 }],
      ],
      [
        ["1", { x: 52, y: 2 }, { x: 50, y: 2 }, { x: 54, y: 2 }],
        ["4", { x: 41, y: 13 }, { x: 41, y: 13 }, { x: 43, y: 11 }],
        ["6", { x: 44, y: 13 }, { x: 44, y: 13 }, { x: 46, y: 11 }],
        ["8", { x: 47, y: 13 }, { x: 47, y: 13 }, { x: 47, y: 13 }],
        ["3", { x: 52, y: 15 }, { x: 50, y: 11 }, { x: 52, y: 9 }],
        ["5", { x: 62, y: 13 }, { x: 59, y: 10 }, { x: 58, y: 8 }],
      ],
    ),
  ];
  main.setPieces[1].drawings = {
    mid: [
      {
        id: sid("draw"),
        tool: "dashed",
        color: "#f4c531",
        points: [{ x: 36, y: 25 }, { x: 44, y: 29 }],
      },
    ],
    end: [
      {
        id: sid("draw"),
        tool: "dashed",
        color: "#f4c531",
        points: [{ x: 44, y: 29 }, { x: 54, y: 1 }],
      },
    ],
  };

  main.sequences = [SORTIE_A_3, RENVERSEMENT, LATERAL_INTERIEUR, PRESSING_HAUT, CARRE_MILIEU].map(
    (spec) => buildSequence(main, spec),
  );

  // Plan B: 4-2-3-1 with Güler between the lines (slot order of the template).
  const planB = compo(
    "Plan B · 4-2-3-1",
    "4-2-3-1",
    [[1, 13], [24, 12], [22, 3], [4, 16], [23, 18], [8, 6], [14, 27], [15, 11], [5, 20], [7, 25], [10, 9]],
    idOf,
  );

  return {
    id: sid("proj"),
    name: "Démo · Real Madrid",
    players,
    attributeDefs: [],
    lineups: [main, planB],
    currentLineupId: main.id,
  };
}
