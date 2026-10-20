// The Studio poster: one SVG drawn from the settings — header, pitch (flat
// or in real perspective), the XI as 3D pucks or shirts with their names,
// and an optional team sheet. The preview and the PNG export render this
// very component, so the download is exactly what's on screen.
import type { ReactNode } from "react";
import type { Lineup, Phase, Player, StudioSettings } from "../types";
import { darken, isDark } from "../colors";
import { TURF } from "../components/PitchTurf";
import { APRON, FIELD_W, GOAL_H, goals, makeCamera, markings, posToPlane, type P2 } from "./geometry";

const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

// Poster size (px): Instagram 4:5 upright, 16:10 sideways.
export function posterSize(aspect: StudioSettings["aspect"]) {
  return aspect === "portrait" ? { W: 1080, H: 1350 } : { W: 1600, H: 1000 };
}

interface Props {
  lineup: Lineup;
  phase: Phase;
  playerById: (id: string | null) => Player | null;
  settings: StudioSettings;
  title: string;
  subtitle: string;
  pixelSize?: { w: number; h: number }; // export: rasterised size
  className?: string;
}

// Colours of the poster per theme × pitch style.
function palette(theme: StudioSettings["theme"], pitch: StudioSettings["pitchStyle"]) {
  const dark = theme === "dark";
  const ink = dark ? "#ffffff" : "#0d1726";
  const dim = dark ? "rgba(255,255,255,0.62)" : "rgba(13,23,38,0.6)";
  if (pitch === "grass") {
    const t = TURF[theme];
    return {
      bg: dark ? ["#123323", "#06120b"] : ["#f4f7f2", "#dce6d6"],
      stripes: [t.grassA, t.grassB] as [string, string] | null,
      board: null as string | null,
      line: t.line,
      slab: darken(t.grassA, 0.45),
      ink,
      dim,
      onPitch: "#ffffff", // plain-text labels sit on grass either way
      net: "rgba(255,255,255,0.14)",
    };
  }
  if (dark) {
    // Night tactics board: flat navy, thin white lines.
    return {
      bg: ["#16284a", "#08111f"],
      stripes: null as [string, string] | null,
      board: "rgba(255,255,255,0.045)",
      line: "rgba(255,255,255,0.78)",
      slab: "#050b16",
      ink,
      dim,
      onPitch: ink,
      net: "rgba(255,255,255,0.1)",
    };
  }
  // Day tactics board: steel-blue bands, navy lines, darker edge — reads as
  // a board on the light poster (white pucks stay visible on it).
  return {
    bg: ["#ffffff", "#e3e9f1"],
    stripes: ["#c6d5e8", "#b9cae1"] as [string, string] | null,
    board: null as string | null,
    line: "rgba(16,37,66,0.7)",
    slab: "#7489a8",
    ink,
    dim,
    onPitch: ink,
    net: "rgba(16,37,66,0.1)",
  };
}

const f = (v: number) => v.toFixed(1);
const pts = (ps: P2[]) => ps.map((p) => `${f(p.x)},${f(p.y)}`).join(" ");
// Rough width of bold uppercase sans text — enough to size the name banners.
const textW = (t: string, fs: number) => t.length * fs * 0.64;

// Shirt silhouette in a 100 × 100 box (collar at the top, hem at the bottom).
const SHIRT =
  "M35 7 L21 11 L3 27 L12 44 L23 38 L23 94 Q50 99 77 94 L77 38 L88 44 L97 27 L79 11 L65 7 Q50 20 35 7 Z";
const COLLAR = "M35 7 Q50 20 65 7 L60 5.5 Q50 13.5 40 5.5 Z";
const CUFFS = "M3 27 L12 44 L15 42.4 L6.3 25.3 Z M97 27 L88 44 L85 42.4 L93.7 25.3 Z";

export default function StudioPoster({ lineup, phase, playerById, settings: st, title, subtitle, pixelSize, className }: Props) {
  const { W, H } = posterSize(st.aspect);
  const P = palette(st.theme, st.pitchStyle);
  const dark = st.theme === "dark";
  const tilt = st.camera === "perspective" ? st.tilt : 0;
  const cam = makeCamera(st.aspect, tilt);
  const pl = cam.plane;
  const pad = 56;
  const c1 = st.discColor;
  const c2 = st.discColor2;
  // Number drawn over two colours: outlined so it reads on both halves.
  const numStroke = c2 ? (isDark(st.numberColor) ? "#ffffff" : "#0b0f14") : undefined;

  const starters = lineup.slots
    .filter((s) => s.starterId)
    .map((slot) => ({ slot, player: playerById(slot.starterId), at: posToPlane(slot.positions[phase], st.aspect) }));

  // ----- layout: header, team sheet, pitch area -----
  const titleFs = st.aspect === "portrait" ? 62 : 56;
  const subFs = Math.round(titleFs * 0.46);
  const headH = title || subtitle ? (title ? titleFs * 1.1 : 0) + (subtitle ? subFs * 1.6 : 0) + 34 : 0;
  const list = st.showList ? [...starters].sort((a, b) => (a.player?.number ?? 99) - (b.player?.number ?? 99)) : [];
  const listFs = st.aspect === "portrait" ? 24 : 26;
  const listRow = listFs * 1.75;
  const listSide = st.showList && st.aspect === "landscape";
  const listBottom = st.showList && st.aspect === "portrait";
  const perCol = Math.ceil(list.length / 2);
  const listH = listBottom ? perCol * listRow + 28 : 0;
  const listW = listSide ? W * 0.24 : 0;
  const area = { x: pad + listW, y: pad + headH, w: W - 2 * pad - listW, h: H - 2 * pad - headH - listH };

  // ----- tokens (metres) -----
  const size = (st.discSize / 100) * FIELD_W;
  const puckR = size * 0.5;
  const puckH = puckR * 0.34;
  const shirtH = size * 1.45;
  const tokenTop = st.discStyle === "jersey" ? shirtH : puckH + puckR;
  const nameFs0 = st.nameFontSize * 1.55; // poster px at depth scale 1

  // ----- fit the projected pitch (and what stands on it) into the area -----
  const mx = pl.w * APRON;
  const my = pl.h * APRON;
  const apron: P2[] = [
    { x: -mx, y: -my },
    { x: pl.w + mx, y: -my },
    { x: pl.w + mx, y: pl.h + my },
    { x: -mx, y: pl.h + my },
  ];
  const slabT = 1.6; // pitch thickness shown in perspective, metres
  const probe = [
    ...apron.map((p) => cam.project(p)),
    ...(tilt > 0 ? apron.slice(2).map((p) => cam.project(p, -slabT)) : []),
    ...starters.map((s) => cam.project(s.at, tokenTop)),
  ];
  const minX = Math.min(...probe.map((p) => p.x));
  const maxX = Math.max(...probe.map((p) => p.x));
  const minY = Math.min(...probe.map((p) => p.y));
  const maxY = Math.max(...probe.map((p) => p.y));
  // Names hang below the nearest players: keep room for them.
  const labelRoom = st.showName || st.showRole ? nameFs0 * 3 : 0;
  const k = Math.min(area.w / (maxX - minX), (area.h - labelRoom) / (maxY - minY));
  const ox = area.x + (area.w - (maxX - minX) * k) / 2 - minX * k;
  const oy = area.y + (area.h - labelRoom - (maxY - minY) * k) / 2 - minY * k;
  const scr = (p: P2, h = 0) => {
    const q = cam.project(p, h);
    return { x: ox + q.x * k, y: oy + q.y * k, s: q.s };
  };
  const poly = (ps: P2[], h = 0) => pts(ps.map((p) => scr(p, h)));

  // ----- pitch -----
  const pitch: ReactNode[] = [];
  if (tilt > 0) {
    // Front face of the pitch "slab": gives the board its thickness.
    const [c, d] = [apron[2], apron[3]];
    pitch.push(<polygon key="slab" points={pts([scr(d), scr(c), scr(c, -slabT), scr(d, -slabT)])} fill={P.slab} />);
  }
  if (P.stripes) {
    const n = 12;
    const portrait = st.aspect === "portrait";
    const long = portrait ? pl.h + 2 * my : pl.w + 2 * mx;
    for (let i = 0; i < n; i++) {
      const a = (long * i) / n;
      const b = (long * (i + 1)) / n;
      const q: P2[] = portrait
        ? [{ x: -mx, y: -my + a }, { x: pl.w + mx, y: -my + a }, { x: pl.w + mx, y: -my + b }, { x: -mx, y: -my + b }]
        : [{ x: -mx + a, y: -my }, { x: -mx + b, y: -my }, { x: -mx + b, y: pl.h + my }, { x: -mx + a, y: pl.h + my }];
      const fill = P.stripes[i % 2];
      // Same-colour hairline stroke closes the anti-aliasing seams.
      pitch.push(<polygon key={`g${i}`} points={poly(q)} fill={fill} stroke={fill} strokeWidth={0.8} />);
    }
  } else if (P.board) {
    pitch.push(<polygon key="board" points={poly(apron)} fill={P.board} />);
  }
  const lineW = Math.max(1.6, 0.22 * k);
  if (st.showLines) {
    const mk = markings(st.aspect);
    mk.lines.forEach((l, i) =>
      pitch.push(<polyline key={`l${i}`} points={poly(l)} fill="none" stroke={P.line} strokeWidth={lineW} strokeLinejoin="round" strokeLinecap="round" />),
    );
    mk.spots.forEach((c, i) => {
      const ring = Array.from({ length: 16 }, (_, j) => ({
        x: c.x + 0.35 * Math.cos((j / 16) * 2 * Math.PI),
        y: c.y + 0.35 * Math.sin((j / 16) * 2 * Math.PI),
      }));
      pitch.push(<polygon key={`s${i}`} points={poly(ring)} fill={P.line} />);
    });
    goals(st.aspect).forEach((g, i) => {
      // Net (back and floor), then the frame: posts and crossbar.
      pitch.push(
        <g key={`goal${i}`} stroke={P.line} strokeWidth={lineW * 0.9} strokeLinejoin="round" fill="none">
          <polygon points={pts([scr(g.a, GOAL_H), scr(g.b, GOAL_H), scr(g.b2), scr(g.a2)])} fill={P.net} strokeOpacity={0.55} />
          <polyline points={pts([scr(g.a), scr(g.a2)])} strokeOpacity={0.55} />
          <polyline points={pts([scr(g.b), scr(g.b2)])} strokeOpacity={0.55} />
          <polyline points={pts([scr(g.a), scr(g.a, GOAL_H), scr(g.b, GOAL_H), scr(g.b)])} strokeWidth={lineW * 1.5} />
        </g>,
      );
    });
  }

  // ----- players, far to near so the nearer ones overlap; names apart -----
  const tokens = starters
    .map((t) => ({ ...t, g: scr(t.at) }))
    .sort((a, b) => a.g.y - b.g.y)
    .map(({ slot, player, at, g }) => {
      const s = g.s;
      const num = st.showNumber && player?.number != null ? String(player.number) : "";
      const parts: ReactNode[] = [];
      const label: ReactNode[] = [];
      let bottom: number; // screen y just under the token, where the name goes
      if (st.discStyle === "jersey") {
        const hpx = shirtH * k * s;
        const c = scr(at, shirtH * 0.5);
        const x0 = c.x - hpx / 2;
        const y0 = c.y - hpx / 2;
        // Soft shadow on the grass, cast a little to the right.
        parts.push(
          <ellipse key="sh" cx={g.x + hpx * 0.16} cy={g.y + hpx * 0.04} rx={hpx * 0.4} ry={hpx * (0.08 + 0.1 * cam.cos)} fill="#000" opacity={0.3} filter="url(#st-soft)" />,
        );
        parts.push(
          <g key="shirt" transform={`translate(${f(x0)} ${f(y0)}) scale(${(hpx / 100).toFixed(4)})`}>
            <path d={SHIRT} fill={c2 ? "url(#st-kit)" : c1} />
            <path d={SHIRT} fill="url(#st-shade)" />
            <path d={COLLAR} fill={c2 ?? st.numberColor} />
            <path d={CUFFS} fill={c2 ?? st.numberColor} opacity={0.9} />
            <path d={SHIRT} fill="none" stroke="rgba(0,0,0,0.28)" strokeWidth={1.2} strokeLinejoin="round" />
            {num && (
              <text x={50} y={58} textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={num.length > 1 ? 30 : 34} fill={st.numberColor} stroke={numStroke} strokeWidth={numStroke ? 3 : undefined} paintOrder="stroke">
                {num}
              </text>
            )}
          </g>,
        );
        bottom = y0 + hpx * 0.98;
      } else {
        // A puck lying on the grass: shadow, side band, then the top face.
        const rx = puckR * k * s;
        const ry = rx * Math.max(cam.cos, 0.02);
        const top = scr(at, puckH);
        parts.push(<ellipse key="sh" cx={g.x + rx * 0.12} cy={g.y + ry * 0.3 + 2} rx={rx * 1.06} ry={ry * 1.06 + 3} fill="#000" opacity={0.42} filter="url(#st-soft)" />);
        if (tilt > 0) {
          parts.push(
            <path
              key="side"
              d={`M${f(g.x - rx)} ${f(g.y)} A${f(rx)} ${f(ry)} 0 0 0 ${f(g.x + rx)} ${f(g.y)} L${f(top.x + rx)} ${f(top.y)} L${f(top.x - rx)} ${f(top.y)} Z`}
              fill={c2 ? "url(#st-kit-side)" : darken(c1, 0.4)}
            />,
          );
        }
        parts.push(<ellipse key="face" cx={top.x} cy={top.y} rx={rx} ry={ry} fill={c2 ? "url(#st-kit)" : c1} />);
        parts.push(<ellipse key="gloss" cx={top.x} cy={top.y} rx={rx} ry={ry} fill="url(#st-gloss)" />);
        parts.push(
          <ellipse key="rim" cx={top.x} cy={top.y} rx={rx * 0.88} ry={ry * 0.88} fill="none" stroke={isDark(c1) ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.16)"} strokeWidth={Math.max(1, rx * 0.05)} />,
        );
        if (num) {
          // Painted on the face: squashed like the face itself, never unreadably.
          const fs = rx * (num.length > 1 ? 0.95 : 1.1);
          parts.push(
            <text key="num" textAnchor="middle" dy="0.35em" fontFamily={FONT} fontWeight={800} fontSize={fs} fill={st.numberColor} stroke={numStroke} strokeWidth={numStroke ? fs * 0.08 : undefined} paintOrder="stroke" transform={`translate(${f(top.x)} ${f(top.y)}) scale(1 ${Math.max(cam.cos, 0.7).toFixed(3)})`}>
              {num}
            </text>,
          );
        }
        bottom = g.y + ry + 6 * s;
      }

      // ----- name / role -----
      const name = st.showName && player ? player.name : "";
      const role = st.showRole ? slot.role : "";
      if (name || role) {
        const fs = nameFs0 * Math.min(1.25, Math.max(0.8, s));
        const halo = P.onPitch === "#ffffff" ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.85)";
        if (st.labelStyle === "plate") {
          const main = (name || role).toUpperCase();
          const w = textW(main, fs) + fs * 1.2;
          const h = fs * 1.55;
          const y = bottom + 4 * s;
          label.push(
            <g key="plate">
              <rect x={g.x - w / 2} y={y} width={w} height={h} rx={h * 0.16} fill="#0b1424" fillOpacity={0.92} />
              <rect x={g.x - w / 2} y={y + h - Math.max(3, fs * 0.14)} width={w} height={Math.max(3, fs * 0.14)} fill={c2 ?? c1} />
              <text x={g.x} y={y + h / 2 - fs * 0.04} dy="0.36em" textAnchor="middle" fontFamily={FONT} fontWeight={800} fontSize={fs} letterSpacing={fs * 0.03} fill="#ffffff">
                {main}
              </text>
              {name && role && (
                <text x={g.x} y={y + h + fs * 0.95} textAnchor="middle" fontFamily={FONT} fontWeight={700} fontSize={fs * 0.7} letterSpacing={fs * 0.06} fill={P.onPitch} stroke={halo} strokeWidth={fs * 0.16} paintOrder="stroke">
                  {role}
                </text>
              )}
            </g>,
          );
        } else {
          label.push(
            <g key="txt" textAnchor="middle" fontFamily={FONT} fill={P.onPitch} stroke={halo} strokeWidth={fs * 0.18} paintOrder="stroke" strokeLinejoin="round">
              {name && (
                <text x={g.x} y={bottom + fs * 1.05} fontWeight={800} fontSize={fs}>
                  {name}
                </text>
              )}
              {role && (
                <text x={g.x} y={bottom + fs * (name ? 1.95 : 1.05)} fontWeight={600} fontSize={fs * (name ? 0.78 : 1)}>
                  {role}
                </text>
              )}
            </g>,
          );
        }
      }
      return { id: slot.id, token: <g key={slot.id}>{parts}</g>, label: <g key={slot.id}>{label}</g> };
    });

  // ----- header -----
  const header = (title || subtitle) && (
    <g textAnchor="middle" fontFamily={FONT}>
      {title && (
        <text x={W / 2} y={pad + titleFs * 0.85} fontWeight={900} fontSize={titleFs} fill={P.ink} letterSpacing={-0.5}>
          {title}
        </text>
      )}
      {subtitle && (
        <text x={W / 2} y={pad + (title ? titleFs * 1.1 : 0) + subFs * 1.15} fontWeight={700} fontSize={subFs} fill={P.dim} letterSpacing={subFs * 0.12}>
          {subtitle.toUpperCase()}
        </text>
      )}
      <rect x={W / 2 - 34} y={pad + headH - 22} width={68} height={5} rx={2.5} fill={c2 ?? c1} />
    </g>
  );

  // ----- team sheet: beside the pitch (landscape) or under it (portrait) -----
  const sheet = st.showList && (
    <g fontFamily={FONT}>
      {list.map(({ slot, player }, i) => {
        const col = listBottom ? Math.floor(i / perCol) : 0;
        const row = listBottom ? i % perCol : i;
        const colW = listSide ? listW : (W - 2 * pad) / 2;
        const y0 = listSide ? area.y + Math.max(0, (area.h - list.length * listRow) / 2) : H - pad - listH + 28;
        const x = pad + col * colW;
        const y = y0 + row * listRow;
        const bw = listFs * 1.7;
        return (
          <g key={slot.id}>
            <rect x={x} y={y} width={bw} height={listFs * 1.3} rx={listFs * 0.3} fill={c1} stroke={dark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.18)"} />
            <text x={x + bw / 2} y={y + listFs * 0.65} dy="0.36em" textAnchor="middle" fontWeight={800} fontSize={listFs * 0.8} fill={st.numberColor}>
              {player?.number ?? ""}
            </text>
            <text x={x + bw + listFs * 0.55} y={y + listFs * 0.65} dy="0.36em" fontWeight={700} fontSize={listFs} fill={P.ink}>
              {player?.name ?? ""}
              <tspan fill={P.dim} fontWeight={600} fontSize={listFs * 0.72}>{`  ${slot.role}`}</tspan>
            </text>
          </g>
        );
      })}
    </g>
  );

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${W} ${H}`}
      width={pixelSize?.w}
      height={pixelSize?.h}
      className={className}
      role="img"
      aria-label={title || "Composition"}
    >
      <defs>
        <radialGradient id="st-bg" cx="50%" cy="30%" r="85%">
          <stop offset="0%" stopColor={P.bg[0]} />
          <stop offset="100%" stopColor={P.bg[1]} />
        </radialGradient>
        <filter id="st-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={4} />
        </filter>
        <linearGradient id="st-kit" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.5" stopColor={c1} />
          <stop offset="0.5" stopColor={c2 ?? c1} />
        </linearGradient>
        <linearGradient id="st-kit-side" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0.5" stopColor={darken(c1, 0.4)} />
          <stop offset="0.5" stopColor={darken(c2 ?? c1, 0.4)} />
        </linearGradient>
        <linearGradient id="st-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.16} />
          <stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.18} />
        </linearGradient>
        <radialGradient id="st-gloss" cx="35%" cy="30%" r="75%">
          <stop offset="0" stopColor="#ffffff" stopOpacity={0.35} />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity={0} />
          <stop offset="1" stopColor="#000000" stopOpacity={0.15} />
        </radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#st-bg)" />
      {header}
      {sheet}
      <g>{pitch}</g>
      {/* All the players, then all the names: a name is never hidden by
          a nearer player standing in front of it. */}
      {tokens.map((t) => t.token)}
      {tokens.map((t) => t.label)}
    </svg>
  );
}
