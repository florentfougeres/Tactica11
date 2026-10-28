// Interface icons: one 16px grid, 1.6 stroke, currentColor. Replaces the
// Unicode glyphs (▾ ✕ ▶ …) the chrome used to draw icons with.
export type IconName =
  | "chevron-down"
  | "chevron-up"
  | "chevron-right"
  | "close"
  | "check"
  | "plus"
  | "play"
  | "pause"
  | "skip-start"
  | "step-back"
  | "step-forward"
  | "search"
  | "swap"
  | "settings"
  | "duplicate"
  | "reset";

const PATHS: Record<IconName, string> = {
  "chevron-down": "M4.5 6.5 8 10l3.5-3.5",
  "chevron-up": "M4.5 9.5 8 6l3.5 3.5",
  "chevron-right": "M6.5 4.5 10 8l-3.5 3.5",
  close: "M4.5 4.5l7 7M11.5 4.5l-7 7",
  check: "M3.5 8.5 6.5 11.5 12.5 5",
  plus: "M8 3.5v9M3.5 8h9",
  play: "M5.5 3.8v8.4L12 8Z",
  pause: "M5.5 4v8M10.5 4v8",
  "skip-start": "M4.5 4v8M12 4 6.5 8l5.5 4Z",
  "step-back": "M11 4 5.5 8l5.5 4Z",
  "step-forward": "M5 4l5.5 4L5 12ZM12 4v8",
  search: "M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9ZM10.3 10.3 13.5 13.5",
  swap: "M3 5.5h9.5M10 3l2.5 2.5L10 8M13 10.5H3.5M6 8l-2.5 2.5L6 13",
  settings:
    "M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1",
  duplicate: "M5.5 5.5h7v7h-7ZM3.5 10.5v-7h7",
  reset: "M3.5 8a4.5 4.5 0 1 0 1.3-3.2M3.5 3v2.3h2.3",
};

const FILLED = new Set<IconName>(["play", "skip-start", "step-back", "step-forward"]);

export default function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const filled = FILLED.has(name);
  return (
    <svg
      className="icon"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      aria-hidden="true"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
