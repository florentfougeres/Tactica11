import type { Orient } from "../types";

// The "pivoter le terrain" button floating at the top-right of the board —
// shared by the Compo tab and the Séquence mode so both look and act alike.
export default function RotatePitchButton({
  orient,
  onToggle,
}: {
  orient: Orient;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="pitch-rotate"
      onClick={onToggle}
      title={orient === "portrait" ? "Pivoter en paysage" : "Pivoter en portrait"}
      aria-label="Pivoter le terrain"
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4.5 9a7.5 7.5 0 0 1 12.7-3L20 8.5M19.5 15a7.5 7.5 0 0 1-12.7 3L4 15.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M20 4v4.5h-4.5M4 20v-4.5h4.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
