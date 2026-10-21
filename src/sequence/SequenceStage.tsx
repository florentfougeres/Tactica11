// The one renderer of the Séquence mode: a pure SVG drawing of a FrameState.
// No hooks, no animation library — every pixel is a function of the frame —
// so the editor, the fullscreen preview and the video export (which renders
// this component to static markup frame by frame) are guaranteed identical.
import type { ReactNode, Ref } from "react";
import type { Pos } from "../types";
import { PitchTurf } from "../components/PitchTurf";
import Ball from "../components/Ball";
import { contrastColor, darken, isDark } from "../colors";
import PositionalGrid from "../components/PositionalGrid";
import type { AnnFrame, FrameState } from "./engine";
import { anchorPos } from "./engine";
import type { FrameLayout } from "./layout";
import { cameraTransform, toLocal } from "./layout";
import type { SeqActor, Sequence } from "./types";
import { discScale, isArrow } from "./types";
import { FONT, measure, textW, wrap } from "./text";

// The stage follows the app's light / dark theme ("cinéma sombre" / "clair").
export type SeqLook = "dark" | "light";

interface Palette {
  bg: [string, string, string];
  gridLine: string;
  gridTint: string;
  ink: string; // header / caption text
  inkStroke: string;
  shade: string; // backing gradients behind header / captions
  accentText: (accent: string) => string;
}

const PALETTE: Record<SeqLook, Palette> = {
  dark: {
    bg: ["#173823", "#0b1d12", "#050c08"],
    gridLine: "rgba(255,255,255,0.28)",
    gridTint: "rgba(244,197,49,0.08)",
    ink: "#ffffff",
    inkStroke: "#05080b",
    shade: "#000000",
    accentText: (a) => a,
  },
  light: {
    bg: ["#fbfcf8", "#eef2ea", "#dde5d8"],
    gridLine: "rgba(255,255,255,0.42)",
    gridTint: "rgba(255,255,255,0.12)",
    ink: "#0b0f14",
    inkStroke: "#ffffff",
    shade: "#ffffff",
    // The bright gold accent is unreadable as text on a light background.
    accentText: (a) => darken(a, 0.38),
  },
};

export interface ActorInfo {
  disc: string;
  name: string;
}

export interface StageOverlay {
  selectedActors?: Set<string>;
  selectedAnn?: string | null;
  draft?: AnnFrame | null; // annotation being drawn
  marquee?: { a: Pos; b: Pos } | null; // pitch-percent selection rectangle
  safeZones?: boolean;
  editable?: boolean; // show handles
}

interface Props {
  seq: Sequence;
  frame: FrameState;
  layout: FrameLayout;
  info: Record<string, ActorInfo>;
  background?: "normal" | "chroma";
  look?: SeqLook;
  // Published look (preview / export): header, captions and effects, with the
  // pitch clipped to its own area. Off in the editor: the pitch alone.
  chrome?: boolean;
  idPrefix?: string;
  overlay?: StageOverlay;
  cameraRef?: Ref<SVGGElement>;
  svgRef?: Ref<SVGSVGElement>;
  className?: string;
  pixelSize?: { w: number; h: number }; // rendered size (export); viewBox stays L.W×L.H
  // Editor-only: pointer plumbing (the stage tags elements with data-* attrs).
  onPointerDown?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerMove?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onPointerUp?: (e: React.PointerEvent<SVGSVGElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<SVGSVGElement>) => void;
  onWheel?: (e: React.WheelEvent<SVGSVGElement>) => void;
}

// Exactly the app's font stack (index.css), so the board reads like the Terrain tab.
type P = { x: number; y: number };
const f = (n: number) => n.toFixed(1);

// Sample an arrow as a polyline: straight or quadratic, trimmed at both ends
// (so it starts/stops at a disc's edge) and cut at `progress` (draw-in).
function arrowPoints(a: P, b: P, c: P | null, trimA: number, trimB: number, progress: number, wavy: number) {
  const N = 40;
  const at = (t: number): P => {
    if (!c) return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    };
  };
  let len = 0;
  let prev = at(0);
  for (let i = 1; i <= N; i++) {
    const p = at(i / N);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  if (len < 1) return [];
  const t0 = Math.min(0.45, trimA / len);
  const t1 = Math.max(0.55, 1 - trimB / len);
  const tEnd = t0 + (t1 - t0) * Math.max(0, Math.min(1, progress));
  const pts: P[] = [];
  const steps = Math.max(2, Math.round(N * (tEnd - t0)) + 1);
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((tEnd - t0) * i) / steps;
    pts.push(at(t));
  }
  if (wavy > 0 && pts.length > 2) {
    // Dribble: a sine wiggle along the path, fading out near the head.
    const out: P[] = [];
    let s = 0;
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) s += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
      const j = Math.min(pts.length - 1, i + 1);
      const k = Math.max(0, i - 1);
      const dx = pts[j].x - pts[k].x;
      const dy = pts[j].y - pts[k].y;
      const dl = Math.hypot(dx, dy) || 1;
      const fade = i > pts.length - 4 ? 0 : 1;
      const off = Math.sin(s / (wavy * 2.2)) * wavy * fade;
      out.push({ x: pts[i].x + (-dy / dl) * off, y: pts[i].y + (dx / dl) * off });
    }
    return out;
  }
  return pts;
}

function head(pts: P[], size: number) {
  if (pts.length < 2) return null;
  const b = pts[pts.length - 1];
  const a = pts[Math.max(0, pts.length - 4)];
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const sp = 0.5;
  const p1 = { x: b.x - size * Math.cos(ang - sp), y: b.y - size * Math.sin(ang - sp) };
  const p2 = { x: b.x - size * Math.cos(ang + sp), y: b.y - size * Math.sin(ang + sp) };
  return `M${f(p1.x)},${f(p1.y)} L${f(b.x)},${f(b.y)} L${f(p2.x)},${f(p2.y)} Z`;
}

const poly = (pts: P[]) => pts.map((p) => `${f(p.x)},${f(p.y)}`).join(" ");

export default function SequenceStage({
  seq,
  frame,
  layout: L,
  info,
  background = "normal",
  look = "dark",
  chrome = true,
  idPrefix = "seq",
  overlay,
  cameraRef,
  svgRef,
  className,
  pixelSize,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDoubleClick,
  onWheel,
}: Props) {
  const PAL = PALETTE[look];
  const T = seq.theme;
  const u = L.u;
  const R = 3.2 * u; // base disc radius (ball, hit areas)
  const actorById = new Map(seq.actors.map((a) => [a.id, a]));
  // Radius of one actor's disc (per-team size slider).
  const rOf = (id: string) => R * discScale(seq, actorById.get(id));
  const rAnchor = (an: { actorId: string } | { pos: Pos }) => ("actorId" in an ? rOf(an.actorId) : R);
  const pw = L.pitch.w;
  const ph = L.pitch.h;
  const loc = (p: Pos) => toLocal(L, p);
  const pos = frame.positions;
  const pid = (s: string) => `${idPrefix}-${s}`;

  // ----- colours of the board -----
  const bg = background === "chroma" ? "#00b140" : `url(#${pid("bg")})`;
  // ----- annotations -----
  const annNode = (af: AnnFrame, draft = false): ReactNode => {
    const { ann, visibility, progress } = af;
    const sel = overlay?.selectedAnn === ann.id;
    const op = visibility;
    const color = ann.color;
    const common = {
      "data-ann": draft ? undefined : ann.id,
      opacity: op,
      style: overlay?.editable ? { cursor: "pointer" } : undefined,
    };
    const pts = ann.anchors
      .map((a) => anchorPos(a, pos))
      .filter((p): p is Pos => p != null)
      .map(loc);

    if (isArrow(ann.kind)) {
      if (pts.length < 2) return null;
      const [a, b] = pts;
      const c = ann.control ? loc(ann.control) : null;
      const trimA = "actorId" in ann.anchors[0] ? rAnchor(ann.anchors[0]) * 1.15 : 0;
      const trimB = ann.anchors[1] && "actorId" in ann.anchors[1] ? rAnchor(ann.anchors[1]) * 1.25 : 0;
      const k = ann.kind;
      const w = (k === "deep" ? 0.95 : k === "pass" ? 0.55 : k === "press" ? 0.8 : 0.68) * u;
      const line = arrowPoints(a, b, c, trimA, trimB, progress, k === "dribble" ? 0.75 * u : 0);
      if (line.length < 2) return null;
      const hd = head(line, w * 3.6);
      return (
        <g key={ann.id} {...common}>
          {/* wide invisible hit area for selection */}
          {overlay?.editable && (
            <polyline points={poly(line)} fill="none" stroke="transparent" strokeWidth={R * 1.2} />
          )}
          {sel && <polyline points={poly(line)} {...SEL_GLOW} strokeWidth={w + 1.6 * u} />}
          {k === "deep" && (
            <polyline
              points={poly(line)}
              fill="none"
              stroke={color}
              strokeOpacity={0.25}
              strokeWidth={w * 2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          <polyline
            points={poly(line)}
            fill="none"
            stroke={color}
            strokeWidth={w}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={k === "pass" ? `${f(w * 2.4)} ${f(w * 2.2)}` : undefined}
          />
          {hd && <path d={hd} fill={color} stroke={color} strokeWidth={w * 0.6} strokeLinejoin="round" />}
        </g>
      );
    }

    if (ann.kind === "zone" || ann.kind === "space" || ann.kind === "playerZone") {
      if (pts.length < 3) return null;
      const hatch = ann.fill ? ann.fill === "hatch" : ann.kind === "space";
      return (
        <g key={ann.id} {...common}>
          {hatch && (
            <defs>
              <pattern
                id={pid(`hatch-${ann.id}`)}
                width={u * 1.6}
                height={u * 1.6}
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width={u * 0.55} height={u * 1.6} fill={color} fillOpacity={0.45} />
              </pattern>
            </defs>
          )}
          {sel && <polygon points={poly(pts)} {...SEL_GLOW} strokeWidth={1.6 * u} />}
          <polygon
            points={poly(pts)}
            fill={hatch ? `url(#${pid(`hatch-${ann.id}`)})` : color}
            fillOpacity={hatch ? 1 : ann.kind === "playerZone" ? 0.26 : 0.2}
            stroke={color}
            strokeWidth={0.38 * u}
            strokeOpacity={0.95}
            strokeLinejoin="round"
            strokeDasharray={ann.kind === "space" ? `${f(u)} ${f(u * 0.8)}` : undefined}
          />
          {ann.text && <Pill x={centroid(pts).x} y={centroid(pts).y} text={ann.text} fs={2.1 * u} bg={color} fg="#0b0f14" />}
        </g>
      );
    }

    if (ann.kind === "playerLine" || ann.kind === "marking") {
      if (pts.length < 2) return null;
      const w = (ann.kind === "marking" ? 0.36 : 0.62) * u;
      return (
        <g key={ann.id} {...common}>
          {overlay?.editable && (
            <polyline points={poly(pts)} fill="none" stroke="transparent" strokeWidth={R} />
          )}
          {sel && <polyline points={poly(pts)} {...SEL_GLOW} strokeWidth={w + 1.6 * u} />}
          <polyline
            points={poly(pts)}
            fill="none"
            stroke={color}
            strokeWidth={w}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={ann.kind === "marking" ? `${f(u * 1.1)} ${f(u * 0.9)}` : undefined}
          />
          {ann.text && (
            <Pill x={(pts[0].x + pts[pts.length - 1].x) / 2} y={(pts[0].y + pts[pts.length - 1].y) / 2} text={ann.text} fs={2 * u} bg={color} fg="#0b0f14" />
          )}
        </g>
      );
    }

    if (ann.kind === "circle") {
      if (!pts.length) return null;
      const r = rAnchor(ann.anchors[0]) * 1.55 * (ann.size ?? 1);
      return (
        <g key={ann.id} {...common}>
          {sel && <circle cx={pts[0].x} cy={pts[0].y} r={r} {...SEL_GLOW} strokeWidth={1.8 * u} />}
          <circle cx={pts[0].x} cy={pts[0].y} r={r} fill={color} fillOpacity={0.12} stroke={color} strokeWidth={0.5 * u} />
          {ann.text && <Pill x={pts[0].x} y={pts[0].y - r - 2.2 * u} text={ann.text} fs={2 * u} bg={color} fg="#0b0f14" />}
        </g>
      );
    }

    if (ann.kind === "line") {
      if (pts.length < 2) return null;
      const [a, b] = pts;
      return (
        <g key={ann.id} {...common}>
          {overlay?.editable && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={R} />}
          {sel && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} {...SEL_GLOW} strokeWidth={1.8 * u} />}
          <line
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke={color}
            strokeWidth={0.4 * u}
            strokeDasharray={`${f(u * 1.4)} ${f(u * 1)}`}
            strokeLinecap="round"
          />
          {ann.text && (
            <Pill x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 2.2 * u} text={ann.text} fs={1.9 * u} bg="rgba(8,12,18,0.85)" fg={color} />
          )}
        </g>
      );
    }

    if (ann.kind === "label") {
      if (!pts.length) return null;
      const onActor = "actorId" in ann.anchors[0];
      const x = pts[0].x;
      const scale = ann.size ?? 1;
      // Just above the disc (the player's name sits below it).
      const y = onActor ? pts[0].y - rAnchor(ann.anchors[0]) - 1.4 * u - 1.8 * u * scale : pts[0].y;
      return (
        <g key={ann.id} {...common}>
          <Pill
            x={x}
            y={y}
            text={(ann.text || "Texte").toUpperCase()}
            fs={2.3 * u * scale}
            bg={color}
            fg={isDark(color) ? "#ffffff" : "#0b0f14"}
            upper
            outline={sel ? "#21d07a" : undefined}
            hit
          />
        </g>
      );
    }
    return null;
  };

  // ----- actors -----
  const actorNode = (a: SeqActor) => {
    const p = pos[a.id];
    if (!p) return null;
    const R = rOf(a.id); // this disc's own radius (shadows the base one)
    const c = loc(p);
    const focus = frame.focus[a.id] ?? 0;
    const opacity = 1 - 0.72 * frame.dim * (1 - focus);
    const home = a.team === "home";
    const kit2 = home ? T.homeColor2 : T.awayColor2;
    const fill = a.gk
      ? home ? T.homeGk : T.awayGk
      : kit2 ? `url(#${pid(home ? "kit-home" : "kit-away")})` : home ? T.homeColor : T.awayColor;
    const textColor = a.gk ? "#0b0f14" : home ? T.homeText : T.awayText;
    const inf = info[a.id] ?? { disc: "", name: "" };
    const sel = overlay?.selectedActors?.has(a.id);
    const discFill = focus > 0.5 ? T.accent : fill;
    const discText = focus > 0.5 ? "#0b0f14" : textColor;
    const relief = !!seq.discRelief;
    // A relief disc's face is a bit smaller than the disc: text scaled to it.
    const fs = (inf.disc.length > 2 ? R * 0.62 : R * 0.74) * (relief ? 0.9 : 1);
    const showName = seq.showNames && inf.name;
    const nameFs = 2.15 * u * (seq.nameScale ?? 1);
    return (
      <g key={a.id} data-actor={a.id} opacity={opacity} style={overlay?.editable ? { cursor: "grab" } : undefined}>
        {focus > 0 && (
          <>
            <circle cx={c.x} cy={c.y} r={R * 1.75} fill={T.accent} fillOpacity={0.22 * focus} />
            <circle cx={c.x} cy={c.y} r={R * 1.38} fill="none" stroke={T.accent} strokeWidth={0.45 * u} strokeOpacity={focus} />
          </>
        )}
        {relief ? (
          <>
            <circle cx={c.x} cy={c.y + R * 0.16} r={R} fill="#000" fillOpacity={0.35} />
            <circle cx={c.x} cy={c.y} r={R} fill={discFill} stroke="rgba(0,0,0,0.45)" strokeWidth={0.2 * u} />
          </>
        ) : (
          // Flat discs = the Compo tab's tokens (styles/token.css): soft drop
          // shadow, thin white inner ring, and our team's diagonal sheen.
          <>
            <circle cx={c.x} cy={c.y + R * 0.3} r={R * 1.25} fill={`url(#${pid("disc-drop")})`} />
            <circle cx={c.x} cy={c.y} r={R} fill={discFill} />
            {home && <circle cx={c.x} cy={c.y} r={R} fill={`url(#${pid("disc-sheen")})`} />}
            <circle cx={c.x} cy={c.y} r={R * 0.947} fill="none" stroke="#fff" strokeOpacity={home ? 0.5 : 0.45} strokeWidth={R * 0.105} />
          </>
        )}
        {relief && (
          // Puck seen from above, silhouette kept perfectly round: the outer
          // ring is its edge (shaded, darker below), the face a slightly
          // smaller disc nudged up, lit from the top.
          <>
            <circle cx={c.x} cy={c.y} r={R} fill={`url(#${pid("disc-edge")})`} />
            <circle cx={c.x} cy={c.y - R * 0.05} r={R * 0.84} fill={discFill} />
            <circle cx={c.x} cy={c.y - R * 0.05} r={R * 0.84} fill={`url(#${pid("disc-face")})`} stroke={`url(#${pid("disc-lip")})`} strokeWidth={R * 0.06} />
          </>
        )}
        {sel && <circle cx={c.x} cy={c.y} r={R + 0.75 * u} fill="none" stroke="#21d07a" strokeWidth={0.55 * u} />}
        {inf.disc && (
          <text
            x={c.x}
            y={relief ? c.y - R * 0.05 : c.y}
            dy="0.35em"
            textAnchor="middle"
            fontFamily={FONT}
            fontWeight={home ? 700 : 800}
            fontSize={fs}
            fill={discText}
            // On a two-colour disc the text straddles both halves: a halo
            // keeps it readable on either.
            {...(kit2 && focus <= 0.5 && !a.gk
              ? { stroke: contrastColor(discText), strokeWidth: fs * 0.16, strokeOpacity: 0.85, paintOrder: "stroke" }
              : {})}
          >
            {inf.disc}
          </text>
        )}
        {showName && (
          <Pill
            x={c.x}
            // Halo: its top edge sits just under the disc. Bare text: the
            // capitals do (no half-pill of padding above them).
            y={c.y + R + 0.8 * u + (seq.nameHalo === false ? 0.4 : 0.7) * nameFs}
            text={inf.name}
            fs={nameFs}
            bg={seq.nameHalo === false ? undefined : focus > 0.5 ? T.accent : T.nameHalo}
            bgOpacity={focus > 0.5 ? 1 : 0.85}
            fg={focus > 0.5 && seq.nameHalo !== false ? "#0b0f14" : T.nameText}
            weight={seq.nameBold === false ? 500 : 700}
            round
          />
        )}
      </g>
    );
  };

  // Draw order: away first (under), then home; focused actors on top.
  const actorsSorted = [...seq.actors].sort((a, b) => {
    const fa = frame.focus[a.id] ?? 0;
    const fb = frame.focus[b.id] ?? 0;
    if (fa !== fb) return fa - fb;
    return a.team === b.team ? 0 : a.team === "away" ? -1 : 1;
  });

  const ballC = loc(frame.ball);
  const marquee = overlay?.marquee;

  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox={`0 0 ${L.W} ${L.H}`}
      width={pixelSize?.w ?? L.W}
      height={pixelSize?.h ?? L.H}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      onWheel={onWheel}
      style={{ touchAction: "none", userSelect: "none" }}
    >
      <defs>
        {/* Two-colour discs: left half main colour, right half the second. */}
        {[
          ["home", T.homeColor, T.homeColor2],
          ["away", T.awayColor, T.awayColor2],
        ].map(([team, c1, c2]) =>
          c2 ? (
            <linearGradient key={team} id={pid(`kit-${team}`)} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0.5" stopColor={c1} />
              <stop offset="0.5" stopColor={c2} />
            </linearGradient>
          ) : null,
        )}
        {/* Flat discs (Compo look): blurred shadow, done with a gradient
            rather than a filter so the video export stays fast. */}
        {!seq.discRelief && (
          <>
            <radialGradient id={pid("disc-drop")}>
              <stop offset="0.45" stopColor="#000" stopOpacity={0.5} />
              <stop offset="0.75" stopColor="#000" stopOpacity={0.16} />
              <stop offset="1" stopColor="#000" stopOpacity={0} />
            </radialGradient>
            {/* CSS linear-gradient(150deg, #f4f7fb, #c7d2e0), as a shade over the kit colour. */}
            <linearGradient id={pid("disc-sheen")} x1="0.16" y1="-0.09" x2="0.84" y2="1.09">
              <stop offset="0" stopColor="#ffffff" stopOpacity={0.12} />
              <stop offset="1" stopColor="#1c2c44" stopOpacity={0.22} />
            </linearGradient>
          </>
        )}
        {/* Relief discs (puck): shaded edge ring, gently lit flat face, and
            a lip bright on top / dark below — all laid over the disc's own
            fill (plain or two-colour alike). */}
        {seq.discRelief && (
          <>
            <linearGradient id={pid("disc-edge")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#000" stopOpacity={0.08} />
              <stop offset="1" stopColor="#000" stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id={pid("disc-face")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity={0.18} />
              <stop offset="0.55" stopColor="#fff" stopOpacity={0} />
              <stop offset="1" stopColor="#000" stopOpacity={0.06} />
            </linearGradient>
            <linearGradient id={pid("disc-lip")} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#fff" stopOpacity={0.6} />
              <stop offset="0.5" stopColor="#fff" stopOpacity={0.1} />
              <stop offset="1" stopColor="#000" stopOpacity={0.15} />
            </linearGradient>
          </>
        )}
        <radialGradient id={pid("bg")} cx="50%" cy="38%" r="75%">
          <stop offset="0%" stopColor={PAL.bg[0]} />
          <stop offset="65%" stopColor={PAL.bg[1]} />
          <stop offset="100%" stopColor={PAL.bg[2]} />
        </radialGradient>
        <linearGradient id={pid("top")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PAL.shade} stopOpacity={0.75} />
          <stop offset="100%" stopColor={PAL.shade} stopOpacity={0} />
        </linearGradient>
        <linearGradient id={pid("bottom")} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={PAL.shade} stopOpacity={0.7} />
          <stop offset="100%" stopColor={PAL.shade} stopOpacity={0} />
        </linearGradient>
        <radialGradient id={pid("flash")} cx="50%" cy="50%" r="72%">
          <stop offset="45%" stopColor={frame.effect?.color ?? "#ff2d3a"} stopOpacity={0} />
          <stop offset="100%" stopColor={frame.effect?.color ?? "#ff2d3a"} stopOpacity={0.9} />
        </radialGradient>
      </defs>

      <rect data-bg="1" x={0} y={0} width={L.W} height={L.H} fill={bg} />

      {/* ---------- camera: everything that lives on the pitch ---------- */}
      {/* The editor clips only a half pitch: the other half stays hidden there too. */}
      {(chrome || seq.half) && (
        <clipPath id={pid("area")}>
          <rect x={L.view.x - L.view.w * 0.05} y={L.view.y - L.view.h * 0.05} width={L.view.w * 1.1} height={L.view.h * 1.1} rx={u * 2} />
        </clipPath>
      )}
      <g clipPath={chrome || seq.half ? `url(#${pid("area")})` : undefined}>
      <g ref={cameraRef} transform={cameraTransform(L, frame.camera)}>
        <PitchTurf orient={L.orient} look={look} w={pw} h={ph} clipId={pid("apron")} />
        {seq.showGrid && (
          <PositionalGrid
            orient={L.orient}
            frame={{ x: 0, y: 0, w: pw, h: ph }}
            line={PAL.gridLine}
            tint={PAL.gridTint}
          />
        )}

        {/* zones under everything else */}
        {frame.annotations
          .filter((af) => ["zone", "space", "playerZone"].includes(af.ann.kind))
          .map((af) => annNode(af))}

        {/* trails: highlighter stroke along the path just travelled */}
        {frame.trails.map((tr) => {
          const a = loc(tr.from);
          const b = loc(tr.to);
          const id = pid(`trail-${tr.actorId}`);
          const color = seq.trailColor || T.accent;
          const w = rOf(tr.actorId) * 1.35;
          return (
            <g key={`trail-${tr.actorId}`} opacity={tr.opacity} pointerEvents="none">
              <defs>
                <linearGradient id={id} gradientUnits="userSpaceOnUse" x1={a.x} y1={a.y} x2={b.x} y2={b.y}>
                  <stop offset="0%" stopColor={color} stopOpacity={0} />
                  <stop offset="35%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={color} stopOpacity={0.62} />
                </linearGradient>
              </defs>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={`url(#${id})`} strokeWidth={w} strokeLinecap="round" />
            </g>
          );
        })}

        {/* ghosts: where moved players came from */}
        {frame.ghosts.map((g) => {
          const a = loc(g.from);
          const b = loc(g.to);
          const rg = rOf(g.actorId);
          const line = arrowPoints(a, b, null, rg * 1.05, rg * 1.25, 1, 0);
          const hd = head(line, u * 1.8);
          return (
            <g key={`ghost-${g.actorId}`} opacity={g.opacity * 0.85}>
              <circle cx={a.x} cy={a.y} r={rg} fill="none" stroke="#ffffff" strokeOpacity={0.7} strokeWidth={0.3 * u} strokeDasharray={`${f(u * 0.8)} ${f(u * 0.7)}`} />
              {line.length > 1 && (
                <>
                  <polyline points={poly(line)} fill="none" stroke={T.accent} strokeWidth={0.4 * u} strokeDasharray={`${f(u * 1)} ${f(u * 0.9)}`} strokeLinecap="round" />
                  {hd && <path d={hd} fill={T.accent} />}
                </>
              )}
            </g>
          );
        })}

        {frame.annotations
          .filter((af) => !["zone", "space", "playerZone", "label"].includes(af.ann.kind))
          .map((af) => annNode(af))}

        {actorsSorted.map(actorNode)}

        {/* ball */}
        <Ball x={ballC.x} y={ballC.y} r={R * 0.5} id={pid("ball")} editable={overlay?.editable} />

        {/* labels on top of the players */}
        {frame.annotations.filter((af) => af.ann.kind === "label").map((af) => annNode(af))}

        {overlay?.draft && annNode(overlay.draft, true)}

        {/* editor handles */}
        {overlay?.editable && overlay.selectedAnn && (() => {
          // Only for a graphic shown at this instant (a selection can outlive
          // its steps, e.g. once playback stops on the last step).
          const ann = frame.annotations.find((af) => af.ann.id === overlay.selectedAnn)?.ann;
          if (!ann) return null;
          const hs: ReactNode[] = [];
          const numbered = ann.kind === "playerLine" || ann.kind === "playerZone";
          let n = 0;
          ann.anchors.forEach((an, i) => {
            if ("actorId" in an) {
              const p = pos[an.actorId];
              if (!p) return;
              const c = loc(p);
              const R = rOf(an.actorId);
              n += 1;
              hs.push(
                <g key={`r${i}`} pointerEvents="none">
                  <circle cx={c.x} cy={c.y} r={R + 1.1 * u} fill="none" stroke="#21d07a" strokeWidth={0.55 * u} strokeDasharray={`${f(u * 1.1)} ${f(u * 0.7)}`} />
                  {numbered && (
                    <>
                      <circle cx={c.x + R * 0.95} cy={c.y - R * 0.95} r={1.3 * u} fill="#21d07a" />
                      <text x={c.x + R * 0.95} y={c.y - R * 0.95} dy="0.35em" textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={1.5 * u} fill="#06130c">
                        {n}
                      </text>
                    </>
                  )}
                </g>,
              );
            }
            if ("pos" in an) {
              const c = loc(an.pos);
              hs.push(<circle key={`h${i}`} data-handle={`a${i}`} cx={c.x} cy={c.y} r={1.25 * u} fill="#ffffff" stroke="#21d07a" strokeWidth={0.4 * u} style={{ cursor: "move" }} />);
            }
          });
          if (isArrow(ann.kind) && ann.anchors.length === 2) {
            const a = anchorPos(ann.anchors[0], pos);
            const b = anchorPos(ann.anchors[1], pos);
            if (a && b) {
              const cp = ann.control ?? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
              const c = loc(cp);
              hs.push(<rect key="ctl" data-handle="ctl" x={c.x - 1.1 * u} y={c.y - 1.1 * u} width={2.2 * u} height={2.2 * u} transform={`rotate(45 ${f(c.x)} ${f(c.y)})`} fill="#21d07a" stroke="#ffffff" strokeWidth={0.3 * u} style={{ cursor: "move" }} />);
            }
          }
          return <g>{hs}</g>;
        })()}

        {marquee && (() => {
          const a = loc(marquee.a);
          const b = loc(marquee.b);
          return (
            <rect
              x={Math.min(a.x, b.x)}
              y={Math.min(a.y, b.y)}
              width={Math.abs(a.x - b.x)}
              height={Math.abs(a.y - b.y)}
              fill="rgba(33,208,122,0.12)"
              stroke="#21d07a"
              strokeWidth={0.3 * u}
              strokeDasharray={`${f(u)} ${f(u * 0.7)}`}
            />
          );
        })()}
      </g>

      </g>

      {/* ---------- screen-space overlays (published look only) ---------- */}
      {chrome && (
        <>
      {L.header && (
        <rect x={0} y={0} width={L.W} height={L.header.y + L.header.h + L.pad} fill={`url(#${pid("top")})`} pointerEvents="none" />
      )}
      {/* Overlaid captions (9:16) rely on their outline, no dark band over the pitch. */}
      {L.caption && !L.caption.overlay && (
        <rect
          x={0}
          y={L.caption.y - L.pad * 0.5}
          width={L.W}
          height={L.H - (L.caption.y - L.pad * 0.5)}
          fill={`url(#${pid("bottom")})`}
          pointerEvents="none"
        />
      )}

      <Header seq={seq} frame={frame} L={L} pal={PAL} />
      <Caption seq={seq} frame={frame} L={L} pal={PAL} />

      {frame.effect?.kind === "flash" && frame.effect.strength > 0 && (
        <rect x={0} y={0} width={L.W} height={L.H} fill={`url(#${pid("flash")})`} opacity={frame.effect.strength} pointerEvents="none" />
      )}
      {frame.effect?.kind === "bigText" && frame.effect.strength > 0 && (
        <text
          x={L.W / 2}
          y={L.view.y + L.view.h * (seq.half ? 0.2 : 0.12)}
          textAnchor="middle"
          dy="0.35em"
          fontFamily={FONT}
          fontWeight={900}
          fontSize={bigTextFs(frame.effect.text, L.W) * (0.85 + 0.15 * frame.effect.strength)}
          fill={frame.effect.color}
          stroke="#0b0f14"
          strokeWidth={L.W * 0.006}
          paintOrder="stroke"
          opacity={frame.effect.strength}
          letterSpacing={bigTextFs(frame.effect.text, L.W) * (0.85 + 0.15 * frame.effect.strength) * 0.04}
          pointerEvents="none"
        >
          {frame.effect.text.toUpperCase()}
        </text>
      )}

        </>
      )}

      {overlay?.safeZones && <SafeZones L={L} format={seq.format} />}
    </svg>
  );
}

// Selection glow, drawn *under* the shape so its own colour stays visible.
const SEL_GLOW = {
  fill: "none",
  stroke: "#21d07a",
  strokeOpacity: 0.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  pointerEvents: "none" as const,
};

// Big effect text: 12% of the frame width, shrunk so the word(s) fit in
// 90% of it (a long word in 16:9 used to run off both edges).
function bigTextFs(text: string, W: number) {
  const fs = W * 0.12;
  return fs * Math.min(1, (W * 0.9) / Math.max(1, textW(text, fs, true, 900)));
}

function centroid(pts: P[]): P {
  const s = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / pts.length, y: s.y / pts.length };
}

function Pill({
  x,
  y,
  text,
  fs,
  bg,
  bgOpacity,
  fg,
  upper = false,
  outline,
  weight = 700,
  round = false,
  hit = false,
}: {
  x: number;
  y: number;
  text: string;
  fs: number;
  bg?: string; // no background: bare text
  bgOpacity?: number;
  fg: string;
  upper?: boolean;
  outline?: string;
  weight?: number;
  round?: boolean; // fully rounded, like the Terrain tab's name pills
  hit?: boolean; // catches clicks (texts are picked by their bubble)
}) {
  const h = fs * (round ? 1.4 : 1.55);
  // Even padding around the measured text; a round pill's caps add h/2.
  const w = textW(text, fs, upper, weight) + (round ? h * 0.75 : fs * 1.1);
  const m = measure(upper ? text.toUpperCase() : text, weight);
  return (
    <g pointerEvents={hit ? undefined : "none"}>
      {bg && (
        <rect x={x - w / 2} y={y - h / 2} width={w} height={h} rx={round ? h / 2 : fs * 0.32} fill={bg} fillOpacity={bgOpacity} stroke={outline} strokeWidth={outline ? fs * 0.12 : undefined} />
      )}
      <text
        x={x + (m && !upper ? m.inkDx * fs : 0)}
        y={y + (m ? m.capDy : 0.36) * fs}
        textAnchor="middle"
        fontFamily={FONT}
        fontWeight={weight}
        fontSize={fs}
        fill={fg}
        letterSpacing={upper ? fs * 0.04 : undefined}
      >
        {text}
      </text>
    </g>
  );
}

function Header({ seq, frame, L, pal }: { seq: Sequence; frame: FrameState; L: FrameLayout; pal: Palette }) {
  const box = L.header;
  if (!box) return null;
  const T = seq.theme;
  const accentText = pal.accentText(T.accent);
  const base = L.base;
  const title = seq.title.trim();
  const sub = seq.subtitle.trim();
  const chapters = frame.chapters.length
    ? frame.chapters
    : [{ title: "", start: 0, end: frame.duration }];
  const fillOf = (c: { start: number; end: number }) =>
    Math.min(1, Math.max(0, (frame.time - c.start) / Math.max(1, c.end - c.start)));

  if (box.mode === "line") {
    // Wide frames: title and subtitle (or current chapter) on one line, the
    // segmented progress bar right under it. Shrunk to fit if too long.
    const label = (frame.chapterIndex >= 0 ? frame.chapters[frame.chapterIndex].title : "") || sub;
    const gapX = base * 0.9;
    const titleW = title ? textW(title, base * 1.05, true, 900) : 0;
    const labelW = label ? base * 0.85 + textW(label, base * 0.85, true, 800) : 0;
    const k = Math.min(1, box.w / Math.max(1, titleW + (title && label ? gapX : 0) + labelW));
    const y = box.y + base * 0.95;
    const labelX = box.x + (title ? (titleW + gapX) * k : 0);
    const barY = box.y + base * 1.55;
    const gap = base * 0.35;
    const n = chapters.length;
    const segW = (box.w - gap * (n - 1)) / n;
    return (
      <g pointerEvents="none">
        {title && (
          <text x={box.x} y={y} fontFamily={FONT} fontWeight={900} fontSize={base * 1.05 * k} fill={pal.ink} letterSpacing={base * 1.05 * k * 0.04}>
            {title.toUpperCase()}
          </text>
        )}
        {label && (
          <g>
            <rect x={labelX} y={y - base * 0.6 * k} width={base * 0.5 * k} height={base * 0.5 * k} fill={T.accent} />
            <text x={labelX + base * 0.85 * k} y={y} fontFamily={FONT} fontWeight={800} fontSize={base * 0.85 * k} fill={accentText} letterSpacing={base * 0.85 * k * 0.04}>
              {label.toUpperCase()}
            </text>
          </g>
        )}
        {chapters.map((c, i) => {
          const fill = fillOf(c);
          const x = box.x + i * (segW + gap);
          return (
            <g key={i}>
              <rect x={x} y={barY} width={segW} height={base * 0.24} rx={base * 0.12} fill={pal.ink} fillOpacity={0.18} />
              {fill > 0 && <rect x={x} y={barY} width={segW * fill} height={base * 0.24} rx={base * 0.12} fill={T.accent} />}
            </g>
          );
        })}
      </g>
    );
  }

  // ----- stacked band (tall frames) -----
  const pad = box.x;
  // Cinema: brand line, segmented progress bar (one segment per chapter, or
  // a single bar), current chapter label.
  const barY = box.y + base * 1.6;
  const gap = base * 0.35;
  const n = chapters.length;
  const segW = (box.w - gap * (n - 1)) / n;
  const chapterTitle =
    frame.chapterIndex >= 0 ? frame.chapters[frame.chapterIndex].title : sub;
  return (
    <g pointerEvents="none">
      {title && (
        <text x={pad} y={box.y + base * 0.9} fontFamily={FONT} fontWeight={900} fontSize={base * 1.05} fill={pal.ink} letterSpacing={base * 0.08}>
          {title.toUpperCase()}
        </text>
      )}
      {chapters.map((c, i) => {
        const fill = fillOf(c);
        const x = pad + i * (segW + gap);
        return (
          <g key={i}>
            <rect x={x} y={barY} width={segW} height={base * 0.24} rx={base * 0.12} fill={pal.ink} fillOpacity={0.18} />
            {fill > 0 && <rect x={x} y={barY} width={segW * fill} height={base * 0.24} rx={base * 0.12} fill={T.accent} />}
          </g>
        );
      })}
      {chapterTitle && (
        <g>
          <rect x={pad} y={barY + base * 0.95} width={base * 0.5} height={base * 0.5} fill={T.accent} />
          <text x={pad + base * 0.85} y={barY + base * 1.42} fontFamily={FONT} fontWeight={800} fontSize={base * 0.78} fill={accentText} letterSpacing={base * 0.08}>
            {chapterTitle.toUpperCase()}
          </text>
        </g>
      )}
    </g>
  );
}

function Caption({ seq, frame, L, pal }: { seq: Sequence; frame: FrameState; L: FrameLayout; pal: Palette }) {
  const cap = frame.caption;
  if (!cap) return null;
  const accent = pal.accentText(seq.theme.accent);
  const upper = false;
  const words = cap.text.split(/\s+/).filter(Boolean).map((w) => (upper ? w.toUpperCase() : w));
  const box = L.caption;
  if (!box) return null;
  // The band holds two lines: a longer caption is set smaller to fit.
  let fs = L.captionFs;
  let lines = wrap(words, fs, box.w, upper);
  while (lines.length > 2 && fs > L.captionFs * 0.5) {
    fs *= 0.92;
    lines = wrap(words, fs, box.w, upper);
  }
  const lineH = fs * 1.35;
  // Overlay: lines grow upward from the anchor; band: centred vertically.
  const bottom = box.overlay ? box.y : box.y + box.h / 2 + ((lines.length - 1) * lineH) / 2;
  const y0 = bottom - (lines.length - 1) * lineH;
  // Karaoke: the highlight sweeps across the words over ~85% of the step.
  const current = cap.karaoke ? Math.floor(Math.min(0.999, cap.t / 0.85) * words.length) : -1;

  // One <text> per line with a <tspan> per word, so the browser does the
  // spacing (no width guessing); karaoke recolours the spoken words.
  return (
    <g opacity={cap.opacity} pointerEvents="none">
      {lines.map((li, k) => (
        <text
          key={k}
          x={box.x + box.w / 2}
          y={y0 + k * lineH}
          dy="0.32em"
          textAnchor="middle"
          fontFamily={FONT}
          fontWeight={800}
          fontSize={fs}
          fill={pal.ink}
          stroke={pal.inkStroke}
          strokeOpacity={0.75}
          strokeWidth={fs * 0.12}
          strokeLinejoin="round"
          paintOrder="stroke"
        >
          {li.map((i, n) => {
            const spoken = cap.karaoke && i < current;
            const isCur = cap.karaoke && i === current;
            return (
              <tspan key={i} fill={isCur || spoken ? accent : pal.ink} fillOpacity={spoken && !isCur ? 0.85 : 1}>
                {(n ? " " : "") + words[i]}
              </tspan>
            );
          })}
        </text>
      ))}
    </g>
  );
}

// Areas hidden by the TikTok / Reels UI (approximate), shown in the editor only.
function SafeZones({ L, format }: { L: FrameLayout; format: Sequence["format"] }) {
  if (format !== "9:16") return null;
  return (
    <g pointerEvents="none" fill="rgba(255,60,60,0.12)" stroke="rgba(255,60,60,0.6)" strokeDasharray="10 8" strokeWidth={3}>
      <rect x={0} y={0} width={L.W} height={L.H * 0.075} />
      <rect x={0} y={L.H * 0.8} width={L.W} height={L.H * 0.2} />
      <rect x={L.W * 0.86} y={L.H * 0.35} width={L.W * 0.14} height={L.H * 0.45} />
    </g>
  );
}
