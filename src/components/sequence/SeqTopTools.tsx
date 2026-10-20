// Séquence toolbar (portalled into the app's top bar): tool groups, their
// labels / shortcuts / hints, icons, and the compact dropdown fallback.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import PopMenu from "../PopMenu";
import type { AnnKind } from "../../sequence/types";
import { ANN_LABEL, ARROW_KINDS } from "../../sequence/types";

export type SeqTool = "select" | AnnKind | "camera";

export const TOOL_GROUPS: { label: string; tools: SeqTool[] }[] = [
  { label: "", tools: ["select"] },
  { label: "Flèches", tools: ARROW_KINDS },
  { label: "Formes", tools: ["zone", "space", "playerZone", "playerLine", "marking", "circle", "line", "label"] },
  { label: "", tools: ["camera"] },
];

export const TOOL_LABEL: Record<SeqTool, string> = { ...ANN_LABEL, select: "Sélection", camera: "Caméra" };
export const TOOL_KEY: Partial<Record<SeqTool, string>> = { select: "V", camera: "C", pass: "P", run: "R", label: "T" };

export const TOOL_HINT: Record<SeqTool, string> = {
  select: "Clic : sélectionner · ⇧ : ajouter · glisser le fond : sélection rectangle · glisser le ballon sur un joueur : le lui donner",
  pass: "Glisser d'un joueur vers un autre (ou un point). Le ballon suivra la passe si le porteur change à l'étape suivante.",
  run: "Glisser depuis un joueur vers sa destination",
  dribble: "Glisser : course avec ballon",
  deep: "Glisser : appel en profondeur",
  press: "Glisser : déplacement défensif / pressing",
  zone: "Glisser pour un rectangle · ou cliquer pour poser les sommets · Entrée ou clic sur le 1er point pour fermer · Échap pour annuler",
  space: "Glisser pour un rectangle · ou cliquer pour poser les sommets de l'espace libre · Entrée pour fermer",
  playerZone: "Cliquer sur 3 joueurs ou plus · Entrée pour fermer. La zone suit les joueurs",
  playerLine: "Cliquer sur des joueurs dans l'ordre · Entrée pour terminer",
  marking: "Cliquer sur un joueur puis sur son vis-à-vis",
  circle: "Cliquer sur un joueur ou un point",
  line: "Glisser pour tracer une ligne (⇧ : horizontale)",
  label: "Cliquer sur un joueur ou un point, puis saisir le texte",
  camera: "Glisser pour déplacer le cadrage de l'étape · zoom avec le curseur « Zoom » de l'onglet Étape",
};

const toolTitle = (t: SeqTool) => `${TOOL_LABEL[t]}${TOOL_KEY[t] ? ` (${TOOL_KEY[t]})` : ""} : ${TOOL_HINT[t]}`;

const GRID_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M9 3v18M15 3v18M3 9h18M3 15h18" strokeDasharray="2 2" />
  </svg>
);

interface TopToolsProps {
  slot: HTMLElement;
  tool: SeqTool;
  onTool: (t: SeqTool) => void;
  showGrid: boolean;
  onGrid: () => void;
  zoomPct: number;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onZoomIn: () => void;
  onPreview: () => void;
}

// Séquence tools, portalled into the app's top bar. When they don't fit, the
// arrow/shape groups collapse into dropdowns and view/export go into a "⋯"
// menu (Aperçu stays visible; export is the top bar's Partager menu); they expand again once there's room.
export default function SeqTopTools(p: TopToolsProps) {
  // 0 = icons + labels, 1 = icons only, 2 = icons only with grid / zoom in
  // the "⋯" menu (every drawing tool stays one tap away), 3 = dropdown
  // menus. Step down while
  // the tools overflow; step back up once the width the previous level
  // needed is available again.
  const [level, setLevel] = useState(0);
  const widths = useRef<number[]>([]);
  useLayoutEffect(() => {
    const el = p.slot;
    const check = () => {
      if (level < 3 && el.scrollWidth > el.clientWidth + 1) {
        widths.current[level] = el.scrollWidth;
        setLevel(level + 1);
      } else if (level > 0 && el.clientWidth >= widths.current[level - 1]) setLevel(level - 1);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [p.slot, level]);
  const compact = level === 3;
  const viewInMenu = level >= 2;

  const toolBtn = (t: SeqTool, inMenu = false) => (
    <button
      key={t}
      type="button"
      className={`${inMenu ? "seq-menu__item" : "seq-tool"} seq-tool--${t} ${p.tool === t ? "is-active" : ""}`}
      onClick={() => p.onTool(t)}
      title={toolTitle(t)}
      aria-pressed={p.tool === t}
    >
      <ToolIcon tool={t} />
      <span>{TOOL_LABEL[t]}</span>
    </button>
  );
  const groups = TOOL_GROUPS.slice(0, -1);
  const gridBtn = (cls: string) => (
    <button type="button" className={`${cls} ${p.showGrid ? "is-active" : ""}`} onClick={p.onGrid} aria-pressed={p.showGrid}
      title="Afficher la grille positionnelle (couloirs et zones, comme sur l'onglet Compo), visible aussi dans la vidéo">
      {GRID_ICON}
      <span>Grille</span>
    </button>
  );
  const zoom = (
    <>
      <button type="button" className="seq-tool" onClick={p.onZoomOut} title="Dézoomer la vue" aria-label="Dézoomer">−</button>
      <button type="button" className="seq-tool seq-tool--pct" onClick={p.onZoomFit} title="Ajuster la vue">{p.zoomPct}%</button>
      <button type="button" className="seq-tool" onClick={p.onZoomIn} title="Zoomer la vue" aria-label="Zoomer">+</button>
    </>
  );
  const preview = (
    // Not the green call to action any more: that's "Partager", in the same
    // place as on Compo and Phase arrêtée.
    <button type="button" className="seq-tool" onClick={p.onPreview} title="Aperçu plein écran, sans l'interface">
      ▶ <span>Aperçu</span>
    </button>
  );

  const viewMenu = (
    <ToolMenu title="Vue" button={<span className="seq-tool__more">⋯</span>}>
      {gridBtn("seq-menu__item")}
      <div className="seq-menu__row" data-keep>{zoom}</div>
    </ToolMenu>
  );

  return createPortal(
    compact ? (
      <div className="seq-toolbar seq-toolbar--top" role="toolbar" aria-label="Outils">
        <div className="seq-toolbar__group">
          {groups.map((g, gi) => {
            if (g.tools.length === 1) return toolBtn(g.tools[0]);
            const cur = g.tools.includes(p.tool) ? p.tool : null;
            return (
              <ToolMenu key={gi} active={!!cur} title={g.label} button={<ToolIcon tool={cur ?? g.tools[0]} />}>
                {g.tools.map((t) => toolBtn(t, true))}
              </ToolMenu>
            );
          })}
          {toolBtn("camera")}
        </div>
        <div className="seq-toolbar__group">
          {preview}
          {viewMenu}
        </div>
      </div>
    ) : (
      <div className={`seq-toolbar seq-toolbar--top ${level ? "seq-toolbar--icons" : ""}`} role="toolbar" aria-label="Outils">
        {groups.map((g, gi) => (
          <div key={gi} className="seq-toolbar__group">
            {g.label && <span className="seq-toolbar__label">{g.label}</span>}
            {g.tools.map((t) => toolBtn(t))}
          </div>
        ))}
        <div className="seq-toolbar__group">{toolBtn("camera")}</div>
        {!viewInMenu && (
          <div className="seq-toolbar__group">
            {gridBtn("seq-tool")}
            {zoom}
          </div>
        )}
        <div className="seq-toolbar__group">
          {preview}
          {viewInMenu && viewMenu}
        </div>
      </div>
    ),
    p.slot,
  );
}

function ToolMenu({ button, title, active, children }: { button: ReactNode; title: string; active?: boolean; children: ReactNode }) {
  return (
    <PopMenu button={button} title={title} active={active} className="seq-tool seq-tool--menu">
      {children}
    </PopMenu>
  );
}

// Small inline icons for the toolbar (also used by the Phase arrêtée drawing
// bar, so the same tool looks the same everywhere).
export function ToolIcon({ tool }: { tool: SeqTool }) {
  const s = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (tool) {
    case "select":
      return <svg {...s}><path d="M5 3l14 8-6 2-3 6z" /></svg>;
    case "pass":
      return <svg {...s}><path d="M4 18L18 6" strokeDasharray="3 3" /><path d="M12 6h6v6" /></svg>;
    case "run":
      return <svg {...s}><path d="M4 18L18 6" /><path d="M12 6h6v6" /></svg>;
    case "dribble":
      return <svg {...s}><path d="M3 17c2-3 4 1 6-2s4 1 6-2 2-3 3-4" /><path d="M14 6h5v5" /></svg>;
    case "deep":
      return <svg {...s} strokeWidth={3}><path d="M12 21V5" /><path d="M6 10l6-6 6 6" /></svg>;
    case "press":
      return <svg {...s} stroke="#ff4d4f"><path d="M4 12h13" /><path d="M13 7l5 5-5 5" /></svg>;
    case "zone":
      return <svg {...s}><path d="M5 18L8 5l11 4-3 10z" fill="currentColor" fillOpacity={0.2} /></svg>;
    case "space":
      return <svg {...s} strokeDasharray="3 2"><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 19L18 9M4 15L14 5" strokeDasharray="" /></svg>;
    case "playerZone":
      return <svg {...s}><path d="M6 17L12 5l6 12z" fill="currentColor" fillOpacity={0.2} /><circle cx="6" cy="17" r="2" /><circle cx="12" cy="5" r="2" /><circle cx="18" cy="17" r="2" /></svg>;
    case "playerLine":
      return <svg {...s}><path d="M3 14l6-2 6 2 6-2" /><circle cx="3" cy="14" r="1.6" /><circle cx="9" cy="12" r="1.6" /><circle cx="15" cy="14" r="1.6" /><circle cx="21" cy="12" r="1.6" /></svg>;
    case "marking":
      return <svg {...s}><circle cx="6" cy="16" r="3" /><circle cx="18" cy="8" r="3" /><path d="M8.5 14.5l7-5" strokeDasharray="2 2" /></svg>;
    case "circle":
      return <svg {...s}><circle cx="12" cy="12" r="8" /></svg>;
    case "line":
      return <svg {...s} strokeDasharray="4 3"><path d="M3 12h18" /></svg>;
    case "label":
      return <svg {...s}><path d="M5 6h14M12 6v13" /></svg>;
    case "camera":
      return <svg {...s}><path d="M3 8V5h3M21 8V5h-3M3 16v3h3M21 16v3h-3" /><circle cx="12" cy="12" r="3" /></svg>;
  }
}
