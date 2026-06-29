import type { DrawTool } from "../types";

interface Props {
  tool: DrawTool;
  color: string;
  colors: string[];
  canUndo: boolean;
  canClear: boolean;
  onTool: (t: DrawTool) => void;
  onColor: (c: string) => void;
  onUndo: () => void;
  onClear: () => void;
}

const TOOLS: { key: DrawTool; glyph: string; label: string }[] = [
  { key: "arrow", glyph: "→", label: "Flèche (course)" },
  { key: "dashed", glyph: "⇢", label: "Flèche pointillée (passe)" },
  { key: "free", glyph: "✎", label: "Main levée" },
  { key: "zone", glyph: "▱", label: "Zone (clic pour placer les sommets)" },
];

// Floating palette over the pitch, shown only while drawing mode is on.
export default function DrawToolbar({
  tool,
  color,
  colors,
  canUndo,
  canClear,
  onTool,
  onColor,
  onUndo,
  onClear,
}: Props) {
  return (
    <div className="draw-bar glass" role="toolbar" aria-label="Outils de dessin">
      {TOOLS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`draw-bar__tool ${tool === t.key ? "is-active" : ""}`}
          onClick={() => onTool(t.key)}
          title={t.label}
          aria-label={t.label}
          aria-pressed={tool === t.key}
        >
          {t.glyph}
        </button>
      ))}

      <span className="draw-bar__sep" />

      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={`draw-bar__swatch ${c === color ? "is-active" : ""}`}
          style={{ background: c }}
          onClick={() => onColor(c)}
          title="Couleur du tracé"
          aria-label={`Couleur ${c}`}
          aria-pressed={c === color}
        />
      ))}

      <span className="draw-bar__sep" />

      <button
        type="button"
        className="draw-bar__tool"
        onClick={onUndo}
        disabled={!canUndo}
        title="Effacer le dernier tracé"
        aria-label="Effacer le dernier tracé"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <button
        type="button"
        className="draw-bar__tool draw-bar__tool--danger"
        onClick={onClear}
        disabled={!canClear}
        title="Tout effacer"
        aria-label="Tout effacer"
      >
        ✕
      </button>
    </div>
  );
}
