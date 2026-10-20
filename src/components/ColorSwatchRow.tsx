interface Props {
  value: string;
  colors: string[];
  onChange: (color: string) => void;
  label: string;
}

// A row of preset colour swatches plus a "custom" swatch that opens the
// browser's native colour picker via a fully transparent <input type="color">
// overlaid on top of a rainbow-gradient circle. Reused across every Studio
// colour setting (disc, number, label, solid background).
export default function ColorSwatchRow({ value, colors, onChange, label }: Props) {
  const isCustom = !colors.includes(value);
  return (
    <div className="studio-swatch-field">
      <span className="studio-swatch-field__label">{label}</span>
      <div className="studio-swatch-row" role="group" aria-label={label}>
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            className={`studio-swatch ${c === value ? "is-active" : ""}`}
            style={{ background: c }}
            onClick={() => onChange(c)}
            aria-label={`Couleur ${c}`}
          />
        ))}
        <label
          className={`studio-swatch studio-swatch--custom ${isCustom ? "is-active" : ""}`}
          style={isCustom ? { background: value } : undefined}
          title="Couleur personnalisée"
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            aria-label={`${label} : couleur personnalisée`}
          />
        </label>
      </div>
    </div>
  );
}
