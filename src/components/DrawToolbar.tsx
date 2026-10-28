import type { ReactNode } from "react";
import type { DrawTool } from "../types";
import { ToolIcon } from "./sequence/SeqTopTools";
import Icon from "./Icon";

interface Props {
  drawing: boolean; // false: the "Déplacer" tool, tokens can be dragged
  onDrawing: (on: boolean) => void;
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

// Same names and icons as the Séquence tools.
const FREE_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <path d="M4 17c3-6 5 2 8-4s4 2 8-6" />
  </svg>
);
const TOOLS: { key: DrawTool; icon: ReactNode; label: string }[] = [
  { key: "arrow", icon: <ToolIcon tool="run" />, label: "Course" },
  { key: "dashed", icon: <ToolIcon tool="pass" />, label: "Passe" },
  { key: "free", icon: FREE_ICON, label: "Main levée" },
  { key: "zone", icon: <ToolIcon tool="zone" />, label: "Zone (clic pour placer les sommets)" },
];

// Tool bar under the pitch, always there: "Déplacer" moves the players, the
// other tools draw (no separate "Dessin" switch to find first).
export default function DrawToolbar({
  drawing,
  onDrawing,
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
      <button
        type="button"
        className={`draw-bar__tool ${!drawing ? "is-active" : ""}`}
        onClick={() => onDrawing(false)}
        title="Déplacer les joueurs et le ballon"
        aria-label="Déplacer"
        aria-pressed={!drawing}
      >
        <ToolIcon tool="select" />
      </button>
      <span className="draw-bar__sep" />
      {TOOLS.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`draw-bar__tool ${drawing && tool === t.key ? "is-active" : ""}`}
          onClick={() => {
            onTool(t.key);
            onDrawing(true);
          }}
          title={t.label}
          aria-label={t.label}
          aria-pressed={drawing && tool === t.key}
        >
          {t.icon}
        </button>
      ))}

      <span className="draw-bar__sep" />

      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={`swatch ${c === color ? "is-active" : ""}`}
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
        <Icon name="close" />
      </button>
    </div>
  );
}
