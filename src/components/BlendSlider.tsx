import AutoplayControl from "./AutoplayControl";

// Transition slider between two states of the pitch, with its walkthrough
// play button: Déf ↔ Att on Compo, Début ↔ Fin on Phase arrêtée. One
// component so both read and behave the same.
interface Props {
  from: string;
  to: string;
  value: number;
  onChange: (v: number) => void;
  onScrub: (active: boolean) => void;
  autoplay: {
    playing: boolean;
    toggle: () => void;
    stop: () => void;
    speed: number;
    cycleSpeed: () => void;
  };
}

export default function BlendSlider({ from, to, value, onChange, onScrub, autoplay }: Props) {
  return (
    <div className="pitch-ctl__slider">
      <span>{from}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.02}
        value={value}
        aria-label={`Transition ${from} → ${to}`}
        onPointerDown={() => {
          autoplay.stop();
          onScrub(true);
        }}
        onPointerUp={() => onScrub(false)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span>{to}</span>
      <AutoplayControl
        playing={autoplay.playing}
        onToggle={autoplay.toggle}
        speed={autoplay.speed}
        onCycleSpeed={autoplay.cycleSpeed}
        label={`la transition ${from} → ${to}`}
      />
    </div>
  );
}
