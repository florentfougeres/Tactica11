import type {
  Sequence,
} from "../../../sequence/types";
import FmSelect from "../../FmSelect";

import { Switch, Swatches, type Props } from "./shared";

export default function SettingsTab({ seq, actions }: Props) {
  const id = seq.id;
  const patch = (p: Partial<Sequence>) => actions.patchSeq(id, p);
  const theme = (k: keyof Sequence["theme"], v: string) => patch({ theme: { ...seq.theme, [k]: v } });
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
      {(
        <div className="seq-field">
          <span>Couleur des traînées</span>
          <Swatches value={seq.trailColor || seq.theme.accent} onPick={(c) => patch({ trailColor: c })} colors={["#f4c531", "#d7ff3a", "#3effa0", "#3fd8ff", "#ff4fd8", "#ffffff"]} />
        </div>
      )}
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
        <Swatches value={seq.theme.homeColor} onPick={(c) => theme("homeColor", c)} />
      </div>
      <div className="seq-field">
        <span>Adversaire</span>
        <Swatches value={seq.theme.awayColor} onPick={(c) => theme("awayColor", c)} />
      </div>
      <div className="seq-field-row">
        <label className="seq-field">
          <span>Gardien (nous)</span>
          <input type="color" className="seq-color seq-color--wide" value={seq.theme.homeGk} onChange={(e) => theme("homeGk", e.target.value)} />
        </label>
        <label className="seq-field">
          <span>Gardien (adv.)</span>
          <input type="color" className="seq-color seq-color--wide" value={seq.theme.awayGk} onChange={(e) => theme("awayGk", e.target.value)} />
        </label>
      </div>
      <div className="seq-field-row">
        <label className="seq-field">
          <span>Texte (nous)</span>
          <input type="color" className="seq-color seq-color--wide" value={seq.theme.homeText} onChange={(e) => theme("homeText", e.target.value)} />
        </label>
        <label className="seq-field">
          <span>Texte (adv.)</span>
          <input type="color" className="seq-color seq-color--wide" value={seq.theme.awayText} onChange={(e) => theme("awayText", e.target.value)} />
        </label>
      </div>
      <div className="seq-field">
        <span>Accent (mise en avant, sous-titres)</span>
        <Swatches value={seq.theme.accent} onPick={(c) => theme("accent", c)} />
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
