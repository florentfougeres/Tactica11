import { useRef } from "react";
import type { Lineup, Player, Project, StudioSettings } from "../types";
import { DEFAULT_STUDIO_SETTINGS, STUDIO_DISC_COLORS } from "../types";
import { exportPitchPng } from "../exportImage";
import PitchMarkings from "./PitchMarkings";
import StudioToken from "./StudioToken";
import ColorSwatchRow from "./ColorSwatchRow";
import Switch from "./Switch";

interface Props {
  lineup: Lineup;
  project: Project;
  playerById: (id: string | null) => Player | null;
  settings: StudioSettings;
  onPatchSettings: (patch: Partial<StudioSettings>) => void;
  onClose: () => void;
}

const DISC_STYLES: { value: StudioSettings["discStyle"]; label: string }[] = [
  { value: "circle", label: "Rond" },
  { value: "jersey", label: "Maillot" },
];

const BACKGROUNDS: { value: StudioSettings["background"]; label: string }[] = [
  { value: "2d", label: "2D" },
  { value: "3d", label: "3D" },
];

const ASPECTS: { value: StudioSettings["aspect"]; label: string }[] = [
  { value: "portrait", label: "Portrait" },
  { value: "landscape", label: "Paysage" },
];

export default function StudioView({
  lineup,
  project,
  playerById,
  settings,
  onPatchSettings,
  onClose,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleExport = async () => {
    const el = canvasRef.current;
    if (!el) return;
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    try {
      await exportPitchPng(el, lineup.name, "studio");
    } catch {
      alert("Échec de l'export en image.");
    }
  };

  const is3D = settings.background === "3d";

  const title = settings.title || project.name;
  const subtitle = settings.subtitle || lineup.formation;
  const hasCaption = Boolean(title || subtitle);

  const canvasClassName = `studio-canvas studio-canvas--${settings.aspect} ${
    is3D ? "studio-canvas--3d" : ""
  }`;

  return (
    <div className="studio-overlay">
      <button
        type="button"
        className="studio-exit"
        onClick={onClose}
        title="Fermer le Studio"
      >
        ✕ Fermer
      </button>

      <div className="studio-panel glass">
        <h2 className="studio-panel__title">Studio</h2>

        <section className="studio-section">
          <span className="influence-ctl__label">Jetons</span>
          <div className="studio-segmented" role="group" aria-label="Style des jetons">
            {DISC_STYLES.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`studio-segmented__btn ${
                  settings.discStyle === o.value ? "is-active" : ""
                }`}
                onClick={() => onPatchSettings({ discStyle: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
          <ColorSwatchRow
            label="Couleur du maillot/rond"
            colors={STUDIO_DISC_COLORS}
            value={settings.discColor}
            onChange={(c) => onPatchSettings({ discColor: c })}
          />
          <ColorSwatchRow
            label="Couleur des numéros"
            colors={STUDIO_DISC_COLORS}
            value={settings.numberColor}
            onChange={(c) => onPatchSettings({ numberColor: c })}
          />
          <div className="pitch-ctl__slider">
            <span>Taille</span>
            <input
              type="range"
              min={3}
              max={26}
              step={1}
              value={settings.discSize}
              aria-label="Taille des jetons"
              onChange={(e) =>
                onPatchSettings({ discSize: Number(e.target.value) })
              }
            />
            <span>{settings.discSize}%</span>
          </div>
        </section>

        <section className="studio-section">
          <span className="influence-ctl__label">Fond</span>
          <div className="studio-segmented" role="group" aria-label="Fond">
            {BACKGROUNDS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`studio-segmented__btn ${
                  settings.background === o.value ? "is-active" : ""
                }`}
                onClick={() => onPatchSettings({ background: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
          <Switch label="Afficher les lignes du terrain" checked={settings.showLines} onChange={(v) => onPatchSettings({ showLines: v })} />
        </section>

        <section className="studio-section">
          <span className="influence-ctl__label">Affichage</span>
          <Switch label="Postes" checked={settings.showRole} onChange={(v) => onPatchSettings({ showRole: v })} />
          <Switch label="Noms" checked={settings.showName} onChange={(v) => onPatchSettings({ showName: v })} />
          <Switch label="Numéros" checked={settings.showNumber} onChange={(v) => onPatchSettings({ showNumber: v })} />
          <div className="pitch-ctl__slider">
            <span>Police</span>
            <input
              type="range"
              min={8}
              max={28}
              step={1}
              value={settings.nameFontSize}
              aria-label="Taille du texte des noms/postes"
              onChange={(e) =>
                onPatchSettings({ nameFontSize: Number(e.target.value) })
              }
            />
            <span>{settings.nameFontSize}px</span>
          </div>
        </section>

        <section className="studio-section">
          <span className="influence-ctl__label">Texte</span>
          <input
            type="text"
            className="studio-input"
            placeholder={project.name}
            value={settings.title}
            onChange={(e) => onPatchSettings({ title: e.target.value })}
            aria-label="Titre"
          />
          <input
            type="text"
            className="studio-input"
            placeholder={lineup.formation}
            value={settings.subtitle}
            onChange={(e) => onPatchSettings({ subtitle: e.target.value })}
            aria-label="Sous-titre"
          />
        </section>

        <section className="studio-section">
          <span className="influence-ctl__label">Format</span>
          <div className="studio-segmented" role="group" aria-label="Format">
            {ASPECTS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`studio-segmented__btn ${
                  settings.aspect === o.value ? "is-active" : ""
                }`}
                onClick={() => onPatchSettings({ aspect: o.value })}
              >
                {o.label}
              </button>
            ))}
          </div>
        </section>

        <button
          type="button"
          className="pitch-ctl__btn"
          onClick={() => onPatchSettings(DEFAULT_STUDIO_SETTINGS)}
        >
          ↺ Réinitialiser
        </button>
      </div>

      <div className="studio-stage">
        <div ref={canvasRef} className={canvasClassName}>
          <div className="pitch__grass studio-canvas__bg-grass" />
          {/* Its own row above the pitch (canvas grows to fit it) — never
              overlaid on the grass, so it can never collide with a player
              and never shrinks the pitch to make room for itself. */}
          {hasCaption && (
            <div className="studio-caption" style={{ color: settings.labelColor }}>
              {title && <h2 className="studio-caption__title">{title}</h2>}
              {subtitle && <p className="studio-caption__subtitle">{subtitle}</p>}
            </div>
          )}
          <div className="studio-canvas__field-wrap">
            <div
              className={`studio-canvas__field ${
                settings.aspect === "landscape" ? "studio-canvas__field--landscape" : ""
              }`}
            >
              {settings.showLines && <PitchMarkings orient={settings.aspect} />}
              {lineup.slots
                .filter((slot) => slot.starterId)
                .map((slot) => (
                  <StudioToken
                    key={slot.id}
                    slot={slot}
                    starter={playerById(slot.starterId)}
                    discStyle={settings.discStyle}
                    discColor={settings.discColor}
                    numberColor={settings.numberColor}
                    labelColor={settings.labelColor}
                    discSize={settings.discSize}
                    nameFontSize={settings.nameFontSize}
                    showRole={settings.showRole}
                    showName={settings.showName}
                    showNumber={settings.showNumber}
                    orient={settings.aspect}
                  />
                ))}
            </div>
          </div>
        </div>
        <button type="button" className="btn btn--primary" onClick={handleExport}>
          Télécharger PNG
        </button>
      </div>
    </div>
  );
}
