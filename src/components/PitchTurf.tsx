// The pitch itself — striped grass apron, line markings and goals — shared
// by the Séquence stage (embedded in its SVG) and the Compo / Phase arrêtée
// boards (as a layer over their field box), so every tab shows the same
// pitch, light or dark with the app theme.
//
// Drawn in pitch-local units: the field of play is (0, 0, w, h); the grass
// apron reaches APRON_M beyond it on every side (5% of the field's own
// width / length, as in the sequence editor), with the goals in it.
import { useId } from "react";
import type { Orient } from "../types";
import PitchMarkings from "./PitchMarkings";

export type TurfLook = "dark" | "light";

export const TURF: Record<TurfLook, { grassA: string; grassB: string; line: string }> = {
  dark: { grassA: "#1b3a24", grassB: "#1f4229", line: "rgba(255,255,255,0.42)" },
  light: { grassA: "#3f8b53", grassB: "#46945b", line: "rgba(255,255,255,0.72)" },
};

// Apron margin as a fraction of the full field (width across, length along).
export const APRON_M = 0.05;

const STRIPES = 12; // over the full pitch's apron length

export function PitchTurf({
  orient,
  look,
  w,
  h,
  half = false,
  goals = true,
  clipId,
}: {
  orient: Orient;
  look: TurfLook;
  w: number; // field box size, pitch-local units
  h: number;
  half?: boolean; // top half only (opponent goal → halfway line), portrait
  goals?: boolean;
  clipId: string;
}) {
  const C = TURF[look];
  const portrait = orient === "portrait";
  // Full field length / width in local units (a half board is cut at halfway).
  const across = portrait ? w : h;
  const along = half ? h * 2 : portrait ? h : w;
  const mx = (portrait ? across : along) * APRON_M;
  const my = (portrait ? along : across) * APRON_M;
  const u = across / 100;
  // A half board keeps a side-sized margin under its halfway cut.
  const apron = { x: -mx, y: -my, w: w + 2 * mx, h: h + my + (half ? mx : my) };

  const s = (along * (1 + 2 * APRON_M)) / STRIPES;
  const n = Math.ceil((portrait ? apron.h : apron.w) / s);
  const stripes = Array.from({ length: n }, (_, i) => (
    <rect
      key={i}
      x={portrait ? apron.x : apron.x + i * s}
      y={portrait ? apron.y + i * s : apron.y}
      width={portrait ? apron.w : s + 0.01 * along}
      height={portrait ? s + 0.01 * along : apron.h}
      fill={i % 2 ? C.grassA : C.grassB}
    />
  ));

  // Goals outside the goal lines: real 7.32 m wide, 2.2 m deep.
  const goalW = (7.32 / 68) * across;
  const goalD = (2.2 / 105) * along;
  const goalRects = !goals
    ? []
    : portrait
      ? [
          { x: w / 2 - goalW / 2, y: -goalD, w: goalW, h: goalD },
          ...(half ? [] : [{ x: w / 2 - goalW / 2, y: h, w: goalW, h: goalD }]),
        ]
      : [
          { x: w, y: h / 2 - goalW / 2, w: goalD, h: goalW },
          { x: -goalD, y: h / 2 - goalW / 2, w: goalD, h: goalW },
        ];

  return (
    <g>
      <clipPath id={clipId}>
        <rect x={apron.x} y={apron.y} width={apron.w} height={apron.h} rx={u * 2} />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>{stripes}</g>
      <PitchMarkings orient={orient} half={half} frame={{ x: 0, y: 0, w, h }} line={C.line} lineWidth={0.28} />
      {goalRects.map((g, i) => (
        <rect
          key={i}
          x={g.x}
          y={g.y}
          width={g.w}
          height={g.h}
          fill="rgba(255,255,255,0.18)"
          stroke="rgba(255,255,255,0.8)"
          strokeWidth={0.4 * u}
        />
      ))}
    </g>
  );
}

// Layer for the HTML boards: an SVG placed in .pitch__field (the field of
// play box) and spilling over its grass margin — the .pitch padding must
// match the apron (see pitch-controls.css). Units are metres.
export default function PitchTurfLayer({
  orient = "portrait",
  look,
  half = false,
  goals = true,
}: {
  orient?: Orient;
  look: TurfLook;
  half?: boolean;
  goals?: boolean;
}) {
  const clipId = `turf${useId().replace(/:/g, "")}`;
  const land = orient === "landscape";
  const w = land ? 105 : 68;
  const h = half ? 52.5 : land ? 68 : 105;
  const mx = (land ? 105 : 68) * APRON_M;
  const my = (land ? 68 : 105) * APRON_M;
  const bottom = half ? mx : my;
  const pct = (v: number, of: number) => `${(-v / of) * 100}%`;
  return (
    <svg
      className="pitch-turf"
      style={{ left: pct(mx, w), right: pct(mx, w), top: pct(my, h), bottom: pct(bottom, h) }}
      viewBox={`${-mx} ${-my} ${w + 2 * mx} ${h + my + bottom}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <PitchTurf orient={orient} look={look} w={w} h={h} half={half} goals={goals} clipId={clipId} />
    </svg>
  );
}
