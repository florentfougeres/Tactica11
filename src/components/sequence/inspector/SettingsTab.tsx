import type {
  Sequence,
} from "../../../sequence/types";
import FmSelect from "../../FmSelect";

import { Section, Switch, type Props } from "./shared";
import ColorSwatches from "../../ColorSwatches";
import TeamColorField from "../../TeamColorField";
import ColorRow from "./ColorRow";
import { SEQ_COLORS } from "../../../sequence/types";

const TRAIL_COLORS = ["#f4c531", "#d7ff3a", "#3effa0", "#3fd8ff", "#ff4fd8", "#ffffff"];

export default function SettingsTab({ seq, actions }: Props) {
  const id = seq.id;
  const patch = (p: Partial<Sequence>) => actions.patchSeq(id, p);
  const theme = (k: keyof Sequence["theme"], v: string | undefined) => patch({ theme: { ...seq.theme, [k]: v } });
  // A plain colour setting of the theme, as a compact row + popover palette.
  const themeColor = (k: keyof Sequence["theme"], label: string, popTitle?: string) => (
    <ColorRow label={label} popTitle={popTitle} value={seq.theme[k] ?? ""}>
      <ColorSwatches ariaLabel={label} colors={SEQ_COLORS} value={seq.theme[k] ?? ""} onChange={(c) => theme(k, c)} />
    </ColorRow>
  );
  return (
    <div className="seq-form">
      <Section title="Terrain" defaultOpen>
        <div className="seg">
          {(
            [
              [undefined, "Entier"],
              ["attack", "½ attaque"],
              ["defense", "½ défense"],
            ] as const
          ).map(([h, label]) => (
            <button key={label} type="button" className={`seg__btn ${seq.half === h ? "is-active" : ""}`} onClick={() => patch({ half: h })}>
              {label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="En-tête" defaultOpen>
        <label className="seq-field">
          <span>Titre</span>
          <input className="seq-input" value={seq.title} onChange={(e) => patch({ title: e.target.value })} placeholder="ex. PSG · LUIS ENRIQUE" />
        </label>
        <label className="seq-field">
          <span>Sous-titre</span>
          <input className="seq-input" value={seq.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} placeholder="ex. 4-3-3" />
        </label>
      </Section>

      <Section title="Disques" defaultOpen={false}>
        <div className="seq-field">
          <span>Dans les disques de mon équipe</span>
          <div className="seg">
            {(
              [
                ["role", "Poste"],
                ["number", "Numéro"],
                ["none", "Rien"],
              ] as const
            ).map(([m, label]) => (
              <button key={m} type="button" className={`seg__btn ${(seq.discMode ?? "role") === m ? "is-active" : ""}`} onClick={() => patch({ discMode: m })}>
                {label}
              </button>
            ))}
          </div>
          {seq.discMode === "number" && (
            <span className="seq-muted">Un joueur sans numéro dans l'Effectif aura un disque vide.</span>
          )}
        </div>
        <Switch label="Disques en relief" checked={!!seq.discRelief} onChange={(v) => patch({ discRelief: v })} />
        <label className="seq-field">
          <span>Taille, nous ×{(seq.homeDiscScale ?? 1).toFixed(2)}</span>
          <input type="range" min={0.6} max={1.8} step={0.05} value={seq.homeDiscScale ?? 1} onChange={(e) => patch({ homeDiscScale: Number(e.target.value) })} />
        </label>
        <label className="seq-field">
          <span>Taille, adversaires ×{(seq.awayDiscScale ?? 1).toFixed(2)}</span>
          <input type="range" min={0.6} max={1.8} step={0.05} value={seq.awayDiscScale ?? 1} onChange={(e) => patch({ awayDiscScale: Number(e.target.value) })} />
        </label>
      </Section>

      <Section title="Noms des joueurs" defaultOpen={false}>
        <Switch label="Afficher les noms" checked={seq.showNames} onChange={(v) => patch({ showNames: v })} />
        {seq.showNames && (
          <>
            <label className="seq-field">
              <span>Taille ×{(seq.nameScale ?? 1).toFixed(2)}</span>
              <input type="range" min={0.6} max={1.8} step={0.05} value={seq.nameScale ?? 1} onChange={(e) => patch({ nameScale: Number(e.target.value) })} />
            </label>
            <Switch label="En gras" checked={seq.nameBold !== false} onChange={(v) => patch({ nameBold: v })} />
            <Switch label="Halo derrière les noms" checked={seq.nameHalo !== false} onChange={(v) => patch({ nameHalo: v })} />
            {themeColor("nameText", "Couleur des noms")}
            {seq.nameHalo !== false && themeColor("nameHalo", "Couleur du halo")}
          </>
        )}
      </Section>

      <Section title="Animation" defaultOpen={false}>
        <div className="seq-field">
          <span>Joueurs vivants (micro-mouvements en lecture et à l'export)</span>
          <FmSelect
            ariaLabel="Micro-mouvements des joueurs"
            value={String(seq.idle ?? 0)}
            options={[
              { value: "0", label: "Aucun" },
              { value: "1", label: "Léger" },
              { value: "2", label: "Moyen" },
              { value: "3", label: "Fort" },
            ]}
            onChange={(v) => patch({ idle: Number(v) as 0 | 1 | 2 | 3 })}
          />
        </div>
        <ColorRow label="Couleur des traînées" value={seq.trailColor || seq.theme.accent}>
          <ColorSwatches ariaLabel="Couleur des traînées" value={seq.trailColor || seq.theme.accent} onChange={(c) => patch({ trailColor: c })} colors={TRAIL_COLORS} />
        </ColorRow>
      </Section>

      <Section title="Couleurs" defaultOpen={false}>
        <div className="seq-color-group">
          <span className="seq-color-group__title">Mon équipe</span>
          <ColorRow label="Maillot" popTitle="Maillot de mon équipe" value={seq.theme.homeColor} value2={seq.theme.homeColor2}>
            <TeamColorField
              label="Couleur de mon équipe"
              colors={SEQ_COLORS}
              value={seq.theme.homeColor}
              onChange={(c) => theme("homeColor", c)}
              value2={seq.theme.homeColor2}
              onChange2={(c) => theme("homeColor2", c)}
            />
          </ColorRow>
          {themeColor("homeText", "Texte", "Texte des disques de mon équipe")}
          {themeColor("homeGk", "Gardien", "Gardien de mon équipe")}
        </div>
        <div className="seq-color-group">
          <span className="seq-color-group__title">Adversaire</span>
          <ColorRow label="Maillot" popTitle="Maillot de l'adversaire" value={seq.theme.awayColor} value2={seq.theme.awayColor2}>
            <TeamColorField
              label="Couleur de l'adversaire"
              colors={SEQ_COLORS}
              value={seq.theme.awayColor}
              onChange={(c) => theme("awayColor", c)}
              value2={seq.theme.awayColor2}
              onChange2={(c) => theme("awayColor2", c)}
            />
          </ColorRow>
          {themeColor("awayText", "Texte", "Texte des disques de l'adversaire")}
          {themeColor("awayGk", "Gardien", "Gardien de l'adversaire")}
        </div>
        <div className="seq-color-group">
          <span className="seq-color-group__title">Général</span>
          {themeColor("accent", "Accent", "Accent : mise en avant, sous-titres")}
        </div>
        <div className="seq-btn-row">
          <button type="button" className="pitch-ctl__btn" onClick={() => actions.resetTheme(id)}>
            Couleurs par défaut
          </button>
        </div>
      </Section>
    </div>
  );
}

// Bind one of our discs to a roster player (name + number follow the roster).
