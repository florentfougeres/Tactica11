import { DEFAULT_OPPONENT_COLOR, OPPONENT_COLORS } from "../types";
import Switch from "./Switch";

// "Adversaires" switch + their colour, shared by Compo and Phase arrêtée.
interface Props {
  on: boolean;
  onToggle: (on: boolean) => void;
  color: string | undefined;
  onColor: (c: string) => void;
  onAdd?: () => void; // Phase arrêtée places opponents one by one
}

export default function OpponentControls({ on, onToggle, color, onColor, onAdd }: Props) {
  const current = color ?? DEFAULT_OPPONENT_COLOR;
  return (
    <>
      <Switch label="Adversaires" checked={on} onChange={onToggle} />
      {on && (
        <div className="opp-colors-row" role="group" aria-label="Couleur des adversaires">
          {OPPONENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`opp-swatch ${c === current ? "is-active" : ""}`}
              style={{ background: c }}
              onClick={() => onColor(c)}
              aria-label={`Couleur ${c}`}
            />
          ))}
        </div>
      )}
      {on && onAdd && (
        <button type="button" className="pitch-ctl__btn" onClick={onAdd}>
          + Adversaire
        </button>
      )}
    </>
  );
}
