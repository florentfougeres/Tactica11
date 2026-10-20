import type {
  Sequence,
} from "../../../sequence/types";
import FmSelect from "../../FmSelect";

import { Switch, type Props } from "./shared";
import ColorSwatches from "../../ColorSwatches";
import TeamColorField from "../../TeamColorField";
import { SEQ_COLORS } from "../../../sequence/types";

const TRAIL_COLORS = ["#f4c531", "#d7ff3a", "#3effa0", "#3fd8ff", "#ff4fd8", "#ffffff"];

export default function SettingsTab({ seq, actions }: Props) {
  const id = seq.id;
  const patch = (p: Partial<Sequence>) => actions.patchSeq(id, p);
  const theme = (k: keyof Sequence["theme"], v: string | undefined) => patch({ theme: { ...seq.theme, [k]: v } });
  return (
    <div className="seq-form">
      <label className="seq-field">
        <span>Titre (en-tête)</span>
        <input className="seq-input" value={seq.title} onChange={(e) => patch({ title: e.target.value })} placeholder="ex. PSG · LUIS ENRIQUE" />
      </label>
      <label className="seq-field">
        <span>Sous-titre</span>
        <input className="seq-input" value={seq.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} placeholder="ex. 4-3-3" />
      </label>
      <Switch label="Noms des joueurs" checked={seq.showNames} onChange={(v) => patch({ showNames: v })} />
      {seq.showNames && (
        <>
          <div className="seq-field">
            <span>Couleur des noms</span>
            <ColorSwatches ariaLabel="Couleur des noms" colors={SEQ_COLORS} value={seq.theme.nameText} onChange={(c) => theme("nameText", c)} />
          </div>
          <label className="seq-field">
            <span>Taille des noms ×{(seq.nameScale ?? 1).toFixed(2)}</span>
            <input type="range" min={0.6} max={1.8} step={0.05} value={seq.nameScale ?? 1} onChange={(e) => patch({ nameScale: Number(e.target.value) })} />
          </label>
          <Switch label="Noms en gras" checked={seq.nameBold !== false} onChange={(v) => patch({ nameBold: v })} />
          <Switch label="Halo derrière les noms" checked={seq.nameHalo !== false} onChange={(v) => patch({ nameHalo: v })} />
          {seq.nameHalo !== false && (
            <div className="seq-field">
              <span>Couleur du halo</span>
              <ColorSwatches ariaLabel="Couleur du halo" colors={SEQ_COLORS} value={seq.theme.nameHalo} onChange={(c) => theme("nameHalo", c)} />
            </div>
          )}
        </>
      )}
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
      <div className="seq-field">
        <span>Couleur des traînées</span>
        <ColorSwatches ariaLabel="Couleur des traînées" value={seq.trailColor || seq.theme.accent} onChange={(c) => patch({ trailColor: c })} colors={TRAIL_COLORS} />
      </div>
      <label className="seq-field">
        <span>Taille des disques, nous ×{(seq.homeDiscScale ?? 1).toFixed(2)}</span>
        <input type="range" min={0.6} max={1.8} step={0.05} value={seq.homeDiscScale ?? 1} onChange={(e) => patch({ homeDiscScale: Number(e.target.value) })} />
      </label>
      <label className="seq-field">
        <span>Taille des disques, adversaires ×{(seq.awayDiscScale ?? 1).toFixed(2)}</span>
        <input type="range" min={0.6} max={1.8} step={0.05} value={seq.awayDiscScale ?? 1} onChange={(e) => patch({ awayDiscScale: Number(e.target.value) })} />
      </label>
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

      <div className="seq-form__title">Couleurs</div>
      <div className="seq-field">
        <span>Nous</span>
        <TeamColorField
          label="Couleur de mon équipe"
          colors={SEQ_COLORS}
          value={seq.theme.homeColor}
          onChange={(c) => theme("homeColor", c)}
          value2={seq.theme.homeColor2}
          onChange2={(c) => theme("homeColor2", c)}
        />
      </div>
      <div className="seq-field">
        <span>Adversaire</span>
        <TeamColorField
          label="Couleur de l'adversaire"
          colors={SEQ_COLORS}
          value={seq.theme.awayColor}
          onChange={(c) => theme("awayColor", c)}
          value2={seq.theme.awayColor2}
          onChange2={(c) => theme("awayColor2", c)}
        />
      </div>
      <div className="seq-field">
        <span>Gardien (nous)</span>
        <ColorSwatches ariaLabel="Couleur du gardien (nous)" colors={SEQ_COLORS} value={seq.theme.homeGk} onChange={(c) => theme("homeGk", c)} />
      </div>
      <div className="seq-field">
        <span>Gardien (adv.)</span>
        <ColorSwatches ariaLabel="Couleur du gardien (adversaire)" colors={SEQ_COLORS} value={seq.theme.awayGk} onChange={(c) => theme("awayGk", c)} />
      </div>
      <div className="seq-field">
        <span>Texte dans les disques (nous)</span>
        <ColorSwatches ariaLabel="Couleur du texte des disques (nous)" colors={SEQ_COLORS} value={seq.theme.homeText} onChange={(c) => theme("homeText", c)} />
      </div>
      <div className="seq-field">
        <span>Texte dans les disques (adv.)</span>
        <ColorSwatches ariaLabel="Couleur du texte des disques (adversaire)" colors={SEQ_COLORS} value={seq.theme.awayText} onChange={(c) => theme("awayText", c)} />
      </div>
      <div className="seq-field">
        <span>Accent (mise en avant, sous-titres)</span>
        <ColorSwatches ariaLabel="Couleur d'accent" colors={SEQ_COLORS} value={seq.theme.accent} onChange={(c) => theme("accent", c)} />
      </div>
      <div className="seq-btn-row">
        <button type="button" className="pitch-ctl__btn" onClick={() => actions.resetTheme(id)}>
          Couleurs par défaut
        </button>
      </div>
    </div>
  );
}

// Bind one of our discs to a roster player (name + number follow the roster).
