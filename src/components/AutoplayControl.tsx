// Play/pause + speed cycle for a walkthrough slider (see useAutoplay). Kept
// tiny and dumb — all the animation logic lives in the hook.
interface Props {
  playing: boolean;
  onToggle: () => void;
  speed: number;
  onCycleSpeed: () => void;
  label: string; // what's being played, for the aria-label
}

export default function AutoplayControl({
  playing,
  onToggle,
  speed,
  onCycleSpeed,
  label,
}: Props) {
  return (
    <div className="autoplay-ctl">
      <button
        type="button"
        className={`autoplay-ctl__play ${playing ? "is-playing" : ""}`}
        onClick={onToggle}
        aria-label={playing ? `Mettre en pause ${label}` : `Lire ${label}`}
        title={playing ? "Pause" : "Lecture automatique"}
      >
        {playing ? "⏸" : "▶"}
      </button>
      <button
        type="button"
        className="autoplay-ctl__speed"
        onClick={onCycleSpeed}
        title="Vitesse de lecture"
      >
        {speed}×
      </button>
    </div>
  );
}
