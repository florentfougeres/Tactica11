import type { Lineup, Phase, Player, Project, StudioSettings } from "../types";
import { DEFAULT_STUDIO_SETTINGS, STUDIO_DISC_COLORS } from "../types";
import StudioPoster from "../studio/StudioPoster";
import { exportPosterPng } from "../studio/exportPoster";
import ColorSwatches from "./ColorSwatches";
import TeamColorField from "./TeamColorField";
import Switch from "./Switch";
import RotatePitchButton from "./RotatePitchButton";
import Icon from "./Icon";

interface Props {
  lineup: Lineup;
  phase: Phase; // the poster shows this phase's positions
  project: Project;
  playerById: (id: string | null) => Player | null;
  settings: StudioSettings;
  onPatchSettings: (patch: Partial<StudioSettings>) => void;
  onClose: () => void;
}

// A row of mutually exclusive choices.
function Choice<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (v: T) => void;
}) {
  return (
    <div className="studio-choice">
      <span className="studio-choice__label">{label}</span>
      <div className="studio-segmented" role="group" aria-label={label}>
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            className={`studio-segmented__btn ${value === v ? "is-active" : ""}`}
            aria-pressed={value === v}
            onClick={() => onChange(v)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, unit, onChange }: { label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="pitch-ctl__slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={1} value={value} aria-label={label} onChange={(e) => onChange(Number(e.target.value))} />
      <span>
        {value}
        {unit}
      </span>
    </div>
  );
}

export default function StudioView({ lineup, phase, project, playerById, settings: st, onPatchSettings: patch, onClose }: Props) {
  const title = st.title || project.name;
  const subtitle = st.subtitle || lineup.formation;
  const poster = { lineup, phase, playerById, settings: st, title, subtitle };

  const handleExport = async () => {
    try {
      await exportPosterPng(poster, lineup.name);
    } catch {
      alert("Échec de l'export en image.");
    }
  };

  return (
    <div className="studio-overlay">
      <div className="studio-panel glass">
        <div className="studio-panel__head">
          <h2 className="studio-panel__title">Studio</h2>
          <button type="button" className="studio-exit" onClick={onClose} title="Fermer le Studio (Échap)">
            <Icon name="close" /> Fermer
          </button>
        </div>

        <section className="studio-section">
          <span className="influence-ctl__label">Rendu</span>
          <Choice label="Vue" value={st.camera} options={[["perspective", "Perspective 3D"], ["flat", "À plat"]]} onChange={(camera) => patch({ camera })} />
          {st.camera === "perspective" && <Slider label="Angle" value={st.tilt} min={20} max={60} unit="°" onChange={(tilt) => patch({ tilt })} />}
          <Choice label="Terrain" value={st.pitchStyle} options={[["grass", "Gazon"], ["lines", "Tableau"]]} onChange={(pitchStyle) => patch({ pitchStyle })} />
          <Choice label="Fond" value={st.theme} options={[["dark", "Sombre"], ["light", "Clair"]]} onChange={(theme) => patch({ theme })} />
          <Switch label="Lignes du terrain" checked={st.showLines} onChange={(showLines) => patch({ showLines })} />
        </section>

        <section className="studio-section">
          <span className="influence-ctl__label">Joueurs</span>
          <Choice label="Jetons" value={st.discStyle} options={[["circle", "Palets"], ["jersey", "Maillots"]]} onChange={(discStyle) => patch({ discStyle })} />
          <TeamColorField
            label="Couleur de l'équipe"
            showLabel
            colors={STUDIO_DISC_COLORS}
            value={st.discColor}
            onChange={(discColor) => patch({ discColor })}
            value2={st.discColor2}
            onChange2={(discColor2) => patch({ discColor2 })}
          />
          <ColorSwatches label="Couleur des numéros" colors={STUDIO_DISC_COLORS} value={st.numberColor} onChange={(numberColor) => patch({ numberColor })} />
          <Slider label="Taille" value={st.discSize} min={5} max={18} unit="%" onChange={(discSize) => patch({ discSize })} />
        </section>

        <section className="studio-section">
          <span className="influence-ctl__label">Textes</span>
          <Choice label="Noms" value={st.labelStyle} options={[["plate", "Bandeau"], ["text", "Texte seul"]]} onChange={(labelStyle) => patch({ labelStyle })} />
          <Switch label="Noms" checked={st.showName} onChange={(showName) => patch({ showName })} />
          <Switch label="Postes" checked={st.showRole} onChange={(showRole) => patch({ showRole })} />
          <Switch label="Numéros" checked={st.showNumber} onChange={(showNumber) => patch({ showNumber })} />
          <Switch label="Liste des joueurs" checked={st.showList} onChange={(showList) => patch({ showList })} />
          <Slider label="Police" value={st.nameFontSize} min={8} max={24} unit="" onChange={(nameFontSize) => patch({ nameFontSize })} />
          <input type="text" className="studio-input" placeholder={project.name} value={st.title} onChange={(e) => patch({ title: e.target.value })} aria-label="Titre" />
          <input type="text" className="studio-input" placeholder={lineup.formation} value={st.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} aria-label="Sous-titre" />
        </section>

        <section className="studio-section">
          <Choice label="Format" value={st.aspect} options={[["portrait", "Portrait 4:5"], ["landscape", "Paysage 16:10"]]} onChange={(aspect) => patch({ aspect })} />
        </section>

        <button type="button" className="pitch-ctl__btn" onClick={() => patch(DEFAULT_STUDIO_SETTINGS)}>
          <Icon name="reset" /> Réinitialiser
        </button>
      </div>

      <div className="studio-stage">
        <div className={`studio-frame studio-frame--${st.aspect}`}>
          <StudioPoster {...poster} className="studio-poster" />
          <RotatePitchButton orient={st.aspect} onToggle={() => patch({ aspect: st.aspect === "portrait" ? "landscape" : "portrait" })} />
        </div>
        <button type="button" className="btn btn--primary" onClick={handleExport}>
          Télécharger PNG
        </button>
      </div>
    </div>
  );
}
