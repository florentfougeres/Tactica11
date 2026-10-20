import { DEFAULT_OPPONENT_COLOR, OPPONENT_COLORS } from "../types";
import Switch from "./Switch";
import TeamColorField from "./TeamColorField";

// "Adversaires" switch + their colour, shared by Compo and Phase arrêtée.
interface Props {
  on: boolean;
  onToggle: (on: boolean) => void;
  color: string | undefined;
  onColor: (c: string) => void;
  color2: string | undefined; // second colour (two-colour discs)
  onColor2: (c: string | undefined) => void;
  onAdd?: () => void; // Phase arrêtée places opponents one by one
}

export default function OpponentControls({ on, onToggle, color, onColor, color2, onColor2, onAdd }: Props) {
  const current = color ?? DEFAULT_OPPONENT_COLOR;
  return (
    <>
      <Switch label="Adversaires" checked={on} onChange={onToggle} />
      {on && (
        <TeamColorField
          label="Couleur des adversaires"
          colors={OPPONENT_COLORS}
          value={current}
          onChange={onColor}
          value2={color2}
          onChange2={onColor2}
        />
      )}
      {on && onAdd && (
        <button type="button" className="pitch-ctl__btn" onClick={onAdd}>
          + Adversaire
        </button>
      )}
    </>
  );
}
