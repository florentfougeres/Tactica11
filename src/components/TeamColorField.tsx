// A team's kit colour, wherever one is picked (adversaires in Compo / Phase
// arrêtée, both teams of a Séquence, Studio tokens).
//
//   [● Gauche]  [● Droite ×]      ← the kit's two halves (the selected one…)
//   ● ● ● ● ● ● ◌                 ← …is set from this one palette
//
// A plain kit shows a dashed "+ Bicolore" chip instead of the second colour.
// The split itself is drawn by each board (see colors.ts).
import { useState } from "react";
import { isDark, luminance } from "../colors";
import ColorSwatches from "./ColorSwatches";

// The second colour's palette: the team palette, plus white and black when
// it has nothing close (most two-colour kits pair with one of them).
function secondPalette(colors: string[]): string[] {
  const out = [...colors];
  if (!colors.some((c) => luminance(c) > 230)) out.push("#ffffff");
  if (!colors.some((c) => luminance(c) < 40)) out.push("#101418");
  return out;
}

// Default second colour: the palette colour that stands out most from the
// main one (its lightest on a dark kit, its darkest on a light one).
function contrasting(colors: string[], color: string): string {
  const byLum = [...colors].sort((a, b) => luminance(a) - luminance(b));
  return isDark(color) ? byLum[byLum.length - 1] : byLum[0];
}

export default function TeamColorField({
  label,
  showLabel = false,
  colors,
  value,
  onChange,
  value2,
  onChange2,
}: {
  label: string; // names the field (screen readers)
  showLabel?: boolean; // also shown above it (panels without their own field label)
  colors: string[];
  value: string;
  onChange: (c: string) => void;
  value2: string | undefined; // second colour (two-colour kit), if any
  onChange2: (c: string | undefined) => void;
}) {
  const [picked, setPicked] = useState<1 | 2>(1);
  const editing2 = picked === 2 && !!value2;
  const colors2 = secondPalette(colors);

  const field = (
    <div className="kit" role="group" aria-label={label}>
      <div className="kit__row">
        <button
          type="button"
          className={`kit__slot ${!editing2 ? "is-active" : ""}`}
          onClick={() => setPicked(1)}
          aria-pressed={!editing2}
        >
          <span className="kit__dot" style={{ background: value }} />
          <span className="kit__name">{value2 ? "Gauche" : "Couleur"}</span>
        </button>
        {value2 ? (
          <span className={`kit__slot kit__slot--second ${editing2 ? "is-active" : ""}`}>
            <button type="button" className="kit__slot-pick" onClick={() => setPicked(2)} aria-pressed={editing2}>
              <span className="kit__dot" style={{ background: value2 }} />
              <span className="kit__name">Droite</span>
            </button>
            <button
              type="button"
              className="kit__slot-remove"
              onClick={() => {
                onChange2(undefined);
                setPicked(1);
              }}
              title="Revenir à une couleur unie"
              aria-label="Retirer la deuxième couleur"
            >
              ×
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="kit__slot kit__slot--add"
            onClick={() => {
              onChange2(contrasting(colors2, value));
              setPicked(2);
            }}
            title="Maillot à deux couleurs (moitié gauche / moitié droite)"
          >
            + Bicolore
          </button>
        )}
      </div>
      {editing2 ? (
        <ColorSwatches ariaLabel={`${label} : deuxième couleur`} colors={colors2} value={value2} onChange={onChange2} />
      ) : (
        <ColorSwatches ariaLabel={label} colors={colors} value={value} onChange={onChange} />
      )}
    </div>
  );
  if (!showLabel) return field;
  return (
    <div className="swatch-field">
      <span className="swatch-field__label">{label}</span>
      {field}
    </div>
  );
}
