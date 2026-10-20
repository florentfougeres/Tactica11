// The app's one colour picker: a row of preset swatches plus a "custom"
// swatch (rainbow) that opens the browser's native colour picker through a
// transparent <input type="color"> laid over it. Used by every colour setting
// (teams, Studio, Séquence graphics). Optional label above the row.
interface Props {
  value: string;
  colors: string[];
  onChange: (color: string) => void;
  label?: string; // visible label; also names the group for screen readers
  ariaLabel?: string; // group name when there's no visible label
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export default function ColorSwatches({ value, colors, onChange, label, ariaLabel }: Props) {
  const name = label ?? ariaLabel ?? "Couleur";
  const isCustom = !colors.some((c) => same(c, value));
  const row = (
    <div className="swatch-row" role="group" aria-label={name}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={`swatch ${same(c, value) ? "is-active" : ""}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          aria-label={`Couleur ${c}`}
          aria-pressed={same(c, value)}
        />
      ))}
      <label
        className={`swatch swatch--custom ${isCustom ? "is-active" : ""}`}
        style={isCustom ? { background: value } : undefined}
        title="Couleur personnalisée"
      >
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${name} : couleur personnalisée`}
        />
      </label>
    </div>
  );
  if (!label) return row;
  return (
    <div className="swatch-field">
      <span className="swatch-field__label">{label}</span>
      {row}
    </div>
  );
}
