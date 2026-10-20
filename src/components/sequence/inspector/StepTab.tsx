import type {
  SeqStep,
  StepEffect,
} from "../../../sequence/types";
import FmSelect from "../../FmSelect";

import { Switch, Swatches, sec, type Props } from "./shared";

export default function StepTab({
  seq,
  step,
  stepIndex,
  editable,
  selActors,
  propagate,
  actions,
  onPropagate,
  onGoToStep,
  onFrameSelection,
  onResetCamera,
}: Props) {
  const id = seq.id;
  const patch = (p: Partial<SeqStep>) => actions.patchStep(id, stepIndex, p);
  return (
    <div className="seq-form">
      <div className="seq-form__title seq-stepnav">
        <button type="button" className="seq-stepnav__btn" disabled={stepIndex === 0} onClick={() => onGoToStep(stepIndex - 1)} title="Étape précédente (←)" aria-label="Étape précédente">
          ‹
        </button>
        <span>Étape {stepIndex + 1} / {seq.steps.length}</span>
        <button type="button" className="seq-stepnav__btn" disabled={stepIndex >= seq.steps.length - 1} onClick={() => onGoToStep(stepIndex + 1)} title="Étape suivante (→)" aria-label="Étape suivante">
          ›
        </button>
        {!editable && <span className="seq-badge">lecture seule</span>}
      </div>
      <label className="seq-field">
        <span>Nom</span>
        <input className="seq-input" value={step.name ?? ""} placeholder={`Étape ${stepIndex + 1}`} onChange={(e) => patch({ name: e.target.value })} />
      </label>
      <div className="seq-field-row">
        <label className="seq-field">
          <span>Transition (s)</span>
          <input
            className="seq-input"
            type="number"
            min={0}
            max={20}
            step={0.1}
            title={stepIndex === 0 ? "Sur la première étape : intro, ses flèches et formes se dessinent pendant cette durée." : undefined}
            value={sec(step.transitionMs)}
            onChange={(e) => patch({ transitionMs: Math.max(0, Number(e.target.value) * 1000) })}
          />
        </label>
        <label className="seq-field">
          <span>Maintien (s)</span>
          <input className="seq-input" type="number" min={0} max={30} step={0.1} value={sec(step.holdMs)} onChange={(e) => patch({ holdMs: Math.max(0, Number(e.target.value) * 1000) })} />
        </label>
      </div>
      <div className="seq-field">
        <span>Mouvement</span>
        <FmSelect<SeqStep["easing"]>
          value={step.easing}
          options={[
            { value: "easeInOut", label: "Fluide (accélère / ralentit)" },
            { value: "linear", label: "Linéaire" },
          ]}
          onChange={(v) => patch({ easing: v })}
          ariaLabel="Mouvement"
        />
      </div>
      <Switch label="Fantômes (positions précédentes)" checked={!!step.ghosts} onChange={(v) => patch({ ghosts: v })} />

      <div className="seq-form__title">Mise en avant</div>
      <div className="seq-btn-row">
        <button type="button" className="pitch-ctl__btn" disabled={!selActors.size} onClick={() => patch({ focusIds: [...selActors] })}>
          Mettre en avant la sélection
        </button>
        <button type="button" className="pitch-ctl__btn" disabled={!step.focusIds?.length} onClick={() => patch({ focusIds: [] })}>
          Tout retirer
        </button>
      </div>
      <Switch label="Atténuer les autres joueurs" checked={!!step.dimOthers} onChange={(v) => patch({ dimOthers: v })} />
      <div className="seq-field">
        <span>Effet</span>
        <FmSelect<StepEffect>
          value={step.effect ?? "none"}
          options={[
            { value: "none", label: "Aucun" },
            { value: "flash", label: "Flash de couleur (danger)" },
            { value: "bigText", label: "Mot géant" },
          ]}
          onChange={(v) => patch({ effect: v })}
          ariaLabel="Effet"
        />
      </div>
      {step.effect === "bigText" && (
        <label className="seq-field">
          <span>Texte</span>
          <input className="seq-input" value={step.effectText ?? ""} placeholder="GÉNIE" onChange={(e) => patch({ effectText: e.target.value })} />
        </label>
      )}
      {step.effect && step.effect !== "none" && (
        <Swatches value={step.effectColor || (step.effect === "flash" ? "#ff2d3a" : seq.theme.accent)} onPick={(c) => patch({ effectColor: c })} />
      )}

      <div className="seq-form__title">Caméra</div>
      <label className="seq-field">
        <span>Zoom ×{step.camera.zoom.toFixed(2)}</span>
        <input type="range" min={0.6} max={4} step={0.05} value={step.camera.zoom} onChange={(e) => patch({ camera: { ...step.camera, zoom: Number(e.target.value) } })} />
      </label>
      <div className="seq-btn-row">
        <button type="button" className="pitch-ctl__btn" onClick={onFrameSelection} title="Cadre sur les joueurs sélectionnés (ou tous)">
          Cadrer {selActors.size ? "la sélection" : "tout"}
        </button>
        <button type="button" className="pitch-ctl__btn" onClick={onResetCamera}>
          Terrain entier
        </button>
      </div>

      <div className="seq-form__title">Positions</div>
      <div className="seq-btn-row">
        <button type="button" className="pitch-ctl__btn" onClick={() => actions.applyPhase(seq.id, stepIndex, "base")} title="Replace nos joueurs selon la formation de base de la compo">
          Base
        </button>
        <button type="button" className="pitch-ctl__btn" onClick={() => actions.applyPhase(seq.id, stepIndex, "attack")}>
          Attaque
        </button>
        <button type="button" className="pitch-ctl__btn" onClick={() => actions.applyPhase(seq.id, stepIndex, "defense")}>
          Défense
        </button>
        <button type="button" className="pitch-ctl__btn" onClick={() => actions.mirrorStep(seq.id, stepIndex)} title="Inverser gauche / droite">
          ⇄
        </button>
      </div>
      <Switch label="Propager aux étapes suivantes" checked={propagate} onChange={onPropagate} />

      <div className="seq-btn-row seq-btn-row--end">
        <button type="button" className="pitch-ctl__btn" disabled={stepIndex === 0} onClick={() => { actions.moveStep(seq.id, stepIndex, stepIndex - 1); onGoToStep(stepIndex - 1); }}>
          ← Avancer
        </button>
        <button type="button" className="pitch-ctl__btn" disabled={stepIndex === seq.steps.length - 1} onClick={() => { actions.moveStep(seq.id, stepIndex, stepIndex + 1); onGoToStep(stepIndex + 1); }}>
          Reculer →
        </button>
        <button
          type="button"
          className="pitch-ctl__btn seq-danger"
          disabled={seq.steps.length <= 1}
          onClick={() => {
            actions.deleteStep(seq.id, stepIndex);
            onGoToStep(Math.max(0, stepIndex - 1));
          }}
        >
          Supprimer l'étape
        </button>
      </div>
      <details className="seq-collapse" open={!!(step.caption || step.chapter) || undefined}>
        <summary className="seq-form__title">Sous-titre et chapitre</summary>
        <label className="seq-field" title="Visible à l'aperçu et à l'export">
          <span>Sous-titre / commentaire</span>
          <textarea className="seq-input" rows={3} value={step.caption ?? ""} placeholder="Ce que dit la voix off à ce moment…" onChange={(e) => patch({ caption: e.target.value })} />
        </label>
        <Switch label="Karaoké (mot par mot)" checked={!!step.karaoke} onChange={(v) => patch({ karaoke: v })} />
        <label className="seq-field" title="Visible à l'export">
          <span>Nouveau chapitre ici</span>
          <input className="seq-input" value={step.chapter ?? ""} placeholder="ex. LE DILEMME" onChange={(e) => patch({ chapter: e.target.value })} />
        </label>
      </details>
    </div>
  );
}
