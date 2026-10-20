import { useEffect, useRef, useState } from "react";
import type { Lineup, Phase, Player } from "../../types";
import type { SequenceActions } from "../../hooks/useSequenceActions";
import type {
  AnnKind,
  SeqAnnotation,
  SeqStep,
  Sequence,
  StepEffect,
  Team,
} from "../../sequence/types";
import { ANN_LABEL, ARROW_KINDS, SEQ_COLORS, isArrow } from "../../sequence/types";
import FmSelect from "../FmSelect";
import type { ActorInfo } from "../../sequence/SequenceStage";

type Tab = "step" | "selection" | "settings";

interface Props {
  seq: Sequence;
  sequences: Sequence[];
  lineup: Lineup;
  players: Player[]; // project roster
  playerById: (id: string | null) => Player | null;
  step: SeqStep;
  stepIndex: number;
  editable: boolean;
  info: Record<string, ActorInfo>;
  selActors: Set<string>;
  selAnn: string | null;
  propagate: boolean;
  focusLabel: number;
  actions: SequenceActions;
  onSeqId: (id: string | null) => void;
  onCreated: (id: string) => void; // new / duplicated sequence → open + rename
  autoRename: boolean;
  onRenameDone: () => void;
  onSelectActors: (s: Set<string>) => void;
  onSelectAnn: (id: string | null) => void;
  onPropagate: (v: boolean) => void;
  onGoToStep: (i: number) => void;
  onFrameSelection: () => void;
  onResetCamera: () => void;
  onAddActor: (team: Team) => void;
  onDeleteSelection: () => void;
}

const sec = (ms: number) => Math.round(ms / 100) / 10;

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="pitch-ctl__row">
      <span>{label}</span>
      <span className="switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="switch__track" />
        <span className="switch__thumb" />
      </span>
    </label>
  );
}

function Swatches({ value, onPick, colors = SEQ_COLORS }: { value: string; onPick: (c: string) => void; colors?: string[] }) {
  return (
    <div className="seq-swatches">
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          className={`opp-swatch ${c.toLowerCase() === value.toLowerCase() ? "is-active" : ""}`}
          style={{ background: c }}
          onClick={() => onPick(c)}
          aria-label={`Couleur ${c}`}
        />
      ))}
      <input type="color" className="seq-color" value={value} onChange={(e) => onPick(e.target.value)} aria-label="Couleur personnalisée" />
    </div>
  );
}

export default function SequenceInspector(props: Props) {
  const { seq, sequences, selActors, selAnn, actions, onSeqId, onCreated, autoRename, onRenameDone } = props;
  const [tab, setTab] = useState<Tab>("step");
  const [renaming, setRenaming] = useState(autoRename);
  const stopRenaming = () => {
    setRenaming(false);
    onRenameDone();
  };
  const [newOpen, setNewOpen] = useState(false);

  // Jump to the selection tab whenever something gets selected.
  const selKey = `${[...selActors].join(",")}|${selAnn ?? ""}`;
  const [prevSelKey, setPrevSelKey] = useState(selKey);
  if (selKey !== prevSelKey) {
    setPrevSelKey(selKey);
    if (selActors.size || selAnn) setTab("selection");
  }

  const create = (phase: Phase) => {
    setNewOpen(false);
    onCreated(actions.createSeq(phase));
  };

  return (
    <aside className="bench glass seq-panel">
      <header className="panel__header">
        <h2>Séquence</h2>
        <span className="chip">{sequences.length}</span>
      </header>

      <div className="seq-panel__picker">
        {renaming ? (
          <input
            className="seq-input seq-panel__rename"
            autoFocus
            value={seq.name}
            placeholder="Nom de la séquence"
            aria-label="Nom de la séquence"
            onFocus={(e) => e.target.select()}
            onChange={(e) => actions.patchSeq(seq.id, { name: e.target.value })}
            onBlur={stopRenaming}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") (e.target as HTMLInputElement).blur();
            }}
          />
        ) : (
          <div className="seq-panel__picker-row">
            <FmSelect
              value={seq.id}
              options={sequences.map((q) => ({ value: q.id, label: q.name || "Sans nom" }))}
              onChange={(id) => onSeqId(id)}
              ariaLabel="Séquence affichée"
            />
            <button type="button" className="seq-tbtn" onClick={() => setRenaming(true)} title="Renommer la séquence" aria-label="Renommer la séquence">
              ✎
            </button>
          </div>
        )}
        <div className="seq-panel__picker-actions">
          <button type="button" className="pitch-ctl__btn" onClick={() => setNewOpen((o) => !o)} aria-expanded={newOpen}>
            + Nouvelle
          </button>
          <button
            type="button"
            className="pitch-ctl__btn"
            onClick={() => {
              const id = actions.duplicateSeq(seq.id);
              if (id) onCreated(id);
            }}
          >
            Dupliquer
          </button>
          <button
            type="button"
            className="pitch-ctl__btn seq-danger"
            onClick={() => {
              if (!confirm(`Supprimer « ${seq.name} » ?`)) return;
              const rest = sequences.filter((q) => q.id !== seq.id);
              actions.deleteSeq(seq.id);
              onSeqId(rest[0]?.id ?? null);
            }}
          >
            Supprimer
          </button>
        </div>
        {newOpen && (
          <div className="seq-panel__new">
            <span>À partir de :</span>
            <button type="button" className="pitch-ctl__btn" onClick={() => create("base")}>Base</button>
            <button type="button" className="pitch-ctl__btn" onClick={() => create("attack")}>Attaque</button>
            <button type="button" className="pitch-ctl__btn" onClick={() => create("defense")}>Défense</button>
          </div>
        )}
      </div>

      <div className="seg seq-panel__tabs" role="tablist">
        {(
          [
            ["step", "Étape"],
            ["selection", "Sélection"],
            ["settings", "Réglages"],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`seg__btn ${tab === t ? "is-active" : ""}`} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      <div className="seq-panel__body">
        {tab === "step" && <StepTab {...props} />}
        {tab === "selection" && <SelectionTab {...props} />}
        {tab === "settings" && <SettingsTab {...props} />}
      </div>
    </aside>
  );
}

function StepTab({
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
      <div className="seq-form__title">
        Étape {stepIndex + 1} / {seq.steps.length}
        {!editable && <span className="seq-badge">lecture seule</span>}
      </div>
      <label className="seq-field">
        <span>Nom</span>
        <input className="seq-input" value={step.name ?? ""} placeholder={`Étape ${stepIndex + 1}`} onChange={(e) => patch({ name: e.target.value })} />
      </label>
      <label className="seq-field">
        <span>Sous-titre / commentaire <em className="seq-hint-inline">— visible à l'aperçu et à l'export</em></span>
        <textarea className="seq-input" rows={3} value={step.caption ?? ""} placeholder="Ce que dit la voix off à ce moment…" onChange={(e) => patch({ caption: e.target.value })} />
      </label>
      <Switch label="Karaoké (mot par mot)" checked={!!step.karaoke} onChange={(v) => patch({ karaoke: v })} />
      <label className="seq-field">
        <span>Nouveau chapitre ici <em className="seq-hint-inline">— à l'export</em></span>
        <input className="seq-input" value={step.chapter ?? ""} placeholder="ex. LE DILEMME" onChange={(e) => patch({ chapter: e.target.value })} />
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
            disabled={stepIndex === 0}
            value={stepIndex === 0 ? 0 : sec(step.transitionMs)}
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
    </div>
  );
}

function SelectionTab(props: Props) {
  const { seq, step, stepIndex, selActors, selAnn, info, actions, editable, onAddActor, onDeleteSelection, onSelectActors } = props;
  const ann = selAnn ? seq.annotations.find((a) => a.id === selAnn) : null;

  if (ann) return <AnnotationForm {...props} ann={ann} />;

  const ids = [...selActors];
  const addRow = (
    <div className="seq-btn-row">
      <button type="button" className="pitch-ctl__btn" onClick={() => onAddActor("home")}>
        + Joueur (nous)
      </button>
      <button type="button" className="pitch-ctl__btn" onClick={() => onAddActor("away")}>
        + Adversaire
      </button>
    </div>
  );

  if (!ids.length)
    return (
      <div className="seq-form">
        <p className="seq-muted">
          Clique sur un joueur, une flèche ou une forme pour la modifier. ⇧+clic ou un rectangle de
          sélection pour en prendre plusieurs.
        </p>
        <div className="seq-form__title">Ballon</div>
        <p className="seq-muted">
          {"carrierId" in step.ball
            ? `Au pied de ${info[step.ball.carrierId]?.name || info[step.ball.carrierId]?.disc || "un joueur"}.`
            : "Ballon libre."}{" "}
          Glisse-le sur un joueur pour le lui donner : s'il change de porteur à l'étape suivante, il
          suit la passe.
        </p>
        <div className="seq-form__title">Ajouter</div>
        {addRow}
      </div>
    );

  const single = ids.length === 1 ? seq.actors.find((a) => a.id === ids[0]) : null;
  const carrier = "carrierId" in step.ball ? step.ball.carrierId : null;
  return (
    <div className="seq-form">
      <div className="seq-form__title">
        {ids.length} joueur{ids.length > 1 ? "s" : ""} sélectionné{ids.length > 1 ? "s" : ""}
      </div>
      {single && (
        <>
          {single.team === "home" && <PlayerPicker {...props} actorId={single.id} />}
          <div className="seq-field-row">
            <label className="seq-field">
              <span>Disque</span>
              <input
                className="seq-input"
                value={single.label ?? ""}
                placeholder={info[single.id]?.disc || "n°"}
                maxLength={3}
                onChange={(e) => actions.patchActor(seq.id, single.id, { label: e.target.value === "" && (single.slotId || single.playerId) ? undefined : e.target.value })}
              />
            </label>
            <label className="seq-field seq-field--grow">
              <span>Nom</span>
              <input
                className="seq-input"
                value={single.name ?? ""}
                placeholder={info[single.id]?.name || "Nom"}
                onChange={(e) => actions.patchActor(seq.id, single.id, { name: e.target.value === "" && (single.slotId || single.playerId) ? undefined : e.target.value })}
              />
            </label>
          </div>
          <div className="seg">
            {(["home", "away"] as Team[]).map((t) => (
              <button key={t} type="button" className={`seg__btn ${single.team === t ? "is-active" : ""}`} onClick={() => actions.patchActor(seq.id, single.id, { team: t })}>
                {t === "home" ? "Nous" : "Adversaire"}
              </button>
            ))}
          </div>
          <Switch label="Gardien" checked={!!single.gk} onChange={(v) => actions.patchActor(seq.id, single.id, { gk: v })} />
          <Switch label="Traînée de mouvement" checked={!!single.trail} onChange={(v) => actions.patchActor(seq.id, single.id, { trail: v })} />
          <div className="seq-btn-row">
            <button
              type="button"
              className="pitch-ctl__btn"
              disabled={!editable}
              onClick={() =>
                actions.setBall(
                  seq.id,
                  stepIndex,
                  carrier === single.id
                    ? { pos: { x: (step.positions[single.id]?.x ?? 50) + 3, y: (step.positions[single.id]?.y ?? 50) - 3 } }
                    : { carrierId: single.id },
                )
              }
            >
              {carrier === single.id ? "Lâcher le ballon" : "Lui donner le ballon"}
            </button>
          </div>
        </>
      )}
      <div className="seq-btn-row">
        {(() => {
          // Toggle: highlighted players can be un-highlighted from here too.
          const focused = new Set(step.focusIds ?? []);
          const allFocused = ids.every((i) => focused.has(i));
          return (
            <button
              type="button"
              className={`pitch-ctl__btn ${allFocused ? "is-on" : ""}`}
              disabled={!editable}
              onClick={() =>
                actions.patchStep(seq.id, stepIndex, {
                  focusIds: allFocused
                    ? [...focused].filter((i) => !ids.includes(i))
                    : [...new Set([...focused, ...ids])],
                })
              }
            >
              {allFocused ? "Retirer la mise en avant" : "Mettre en avant"}
            </button>
          );
        })()}
        <button type="button" className="pitch-ctl__btn" onClick={() => onSelectActors(new Set())}>
          Désélectionner
        </button>
      </div>
      <div className="seq-btn-row seq-btn-row--end">
        <button type="button" className="pitch-ctl__btn seq-danger" onClick={onDeleteSelection} title="Retire ces joueurs de la séquence (la compo n'est pas modifiée)">
          Retirer de la séquence
        </button>
      </div>
      <div className="seq-form__title">Ajouter</div>
      {addRow}
    </div>
  );
}

function AnnotationForm({ seq, ann, actions, focusLabel, onSelectAnn, info }: Props & { ann: SeqAnnotation }) {
  const id = seq.id;
  const patch = (p: Partial<SeqAnnotation>) => actions.patchAnnotation(id, ann.id, p);
  const textRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ann.kind === "label" && focusLabel > 0) {
      textRef.current?.focus();
      textRef.current?.select();
    }
  }, [focusLabel]); // eslint-disable-line react-hooks/exhaustive-deps
  const fromIdx = seq.steps.findIndex((s) => s.id === ann.fromStep);
  const stepOptions = seq.steps.map((s, i) => ({ value: s.id, label: s.name ? `${i + 1} · ${s.name}` : String(i + 1) }));
  const toIdx = seq.steps.findIndex((s) => s.id === ann.toStep);
  const hasText = ["label", "line", "zone", "space", "playerZone", "playerLine", "circle", "marking"].includes(ann.kind);
  const minAnchors = ann.kind === "playerZone" ? 3 : 2;
  const actorAnchors = ann.anchors
    .map((an, i) => ("actorId" in an ? { i, id: an.actorId } : null))
    .filter((x): x is { i: number; id: string } => x != null);
  const listPlayers = ["playerZone", "playerLine", "marking"].includes(ann.kind) || (isArrow(ann.kind) && actorAnchors.length > 0);
  const label = (id: string) => info[id]?.name || info[id]?.disc || "?";
  return (
    <div className="seq-form">
      <div className="seq-form__title">
        <span className="seq-swatch-dot" style={{ background: ann.color }} />
        {ANN_LABEL[ann.kind]}
      </div>
      {listPlayers && (
        <div className="seq-field">
          <span>{isArrow(ann.kind) ? "Reliée à" : "Joueurs (dans l'ordre)"}</span>
          <div className="seq-chips">
            {actorAnchors.map(({ i, id: aid }, n) => (
              <span key={i} className="seq-chip">
                {!isArrow(ann.kind) && <b>{n + 1}</b>}
                {isArrow(ann.kind) && <b>{i === 0 ? "De" : "Vers"}</b>}
                {label(aid)}
                {!isArrow(ann.kind) && ann.anchors.length > minAnchors && (
                  <button
                    type="button"
                    aria-label={`Retirer ${label(aid)}`}
                    onClick={() => patch({ anchors: ann.anchors.filter((_, k) => k !== i) })}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>
          {!isArrow(ann.kind) && (
            <span className="seq-muted">Les joueurs reliés sont entourés en vert sur le terrain.</span>
          )}
        </div>
      )}
      {isArrow(ann.kind) && (
        <>
          <div className="seq-kinds">
            {ARROW_KINDS.map((k) => (
              <button key={k} type="button" className={`seq-kind ${ann.kind === k ? "is-active" : ""}`} onClick={() => patch({ kind: k as AnnKind })}>
                {ANN_LABEL[k]}
              </button>
            ))}
          </div>
          <div className="seq-btn-row">
            <button
              type="button"
              className="pitch-ctl__btn"
              onClick={() => {
                if (ann.control) patch({ control: undefined });
                else {
                  // Bend it: push the control point sideways from the midpoint.
                  const a = ann.anchors[0];
                  const b = ann.anchors[1];
                  const pa = "pos" in a ? a.pos : null;
                  const pbb = "pos" in b ? b.pos : null;
                  const posOf = (an: typeof a) => ("pos" in an ? an.pos : seq.steps.find((s) => s.id === ann.fromStep)?.positions[an.actorId]);
                  const A = pa ?? posOf(a);
                  const B = pbb ?? posOf(b);
                  if (!A || !B) return;
                  const mx = (A.x + B.x) / 2;
                  const my = (A.y + B.y) / 2;
                  patch({ control: { x: mx + (B.y - A.y) * 0.25, y: my - (B.x - A.x) * 0.25 } });
                }
              }}
            >
              {ann.control ? "Rendre droite" : "Courber"}
            </button>
          </div>
          {ann.control && <p className="seq-muted">Glisse le losange vert pour régler la courbe.</p>}
        </>
      )}
      {hasText && (
        <label className="seq-field">
          <span>Texte</span>
          <input ref={textRef} className="seq-input" value={ann.text ?? ""} placeholder={ann.kind === "label" ? "4 CONTRE 3" : "Optionnel"} onChange={(e) => patch({ text: e.target.value })} />
        </label>
      )}
      {(ann.kind === "zone" || ann.kind === "space" || ann.kind === "playerZone") && (
        <div className="seq-field">
          <span>Remplissage</span>
          <div className="seg">
            {(
              [
                ["solid", "Aplat"],
                ["hatch", "Hachures"],
              ] as const
            ).map(([v, label]) => (
              <button
                key={v}
                type="button"
                className={`seg__btn ${(ann.fill ?? (ann.kind === "space" ? "hatch" : "solid")) === v ? "is-active" : ""}`}
                onClick={() => patch({ fill: v })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
      {(ann.kind === "circle" || ann.kind === "label") && (
        <label className="seq-field">
          <span>Taille ×{(ann.size ?? 1).toFixed(1)}</span>
          <input type="range" min={0.5} max={3} step={0.1} value={ann.size ?? 1} onChange={(e) => patch({ size: Number(e.target.value) })} />
        </label>
      )}
      <div className="seq-field">
        <span>Couleur</span>
        <Swatches value={ann.color} onPick={(c) => patch({ color: c })} />
      </div>
      <div className="seq-field-row">
        <div className="seq-field">
          <span>Visible de l'étape</span>
          <FmSelect
            value={ann.fromStep}
            options={stepOptions}
            onChange={(v) => {
              const i = seq.steps.findIndex((s) => s.id === v);
              patch({ fromStep: v, ...(i > toIdx ? { toStep: v } : {}) });
            }}
            ariaLabel="Visible à partir de l'étape"
          />
        </div>
        <div className="seq-field">
          <span>à l'étape</span>
          <FmSelect
            value={ann.toStep}
            options={stepOptions}
            onChange={(v) => {
              const i = seq.steps.findIndex((s) => s.id === v);
              patch({ toStep: v, ...(i < fromIdx ? { fromStep: v } : {}) });
            }}
            ariaLabel="Visible jusqu'à l'étape"
          />
        </div>
      </div>
      <div className="seq-btn-row">
        <button type="button" className="pitch-ctl__btn" onClick={() => patch({ toStep: seq.steps[seq.steps.length - 1].id })}>
          Jusqu'à la fin
        </button>
      </div>
      <div className="seq-btn-row seq-btn-row--end">
        <button type="button" className="pitch-ctl__btn" onClick={() => onSelectAnn(null)}>
          Désélectionner
        </button>
        <button
          type="button"
          className="pitch-ctl__btn seq-danger"
          onClick={() => {
            actions.removeAnnotation(id, ann.id);
            onSelectAnn(null);
          }}
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}

function SettingsTab({ seq, actions }: Props) {
  const id = seq.id;
  const patch = (p: Partial<Sequence>) => actions.patchSeq(id, p);
  const theme = (k: keyof Sequence["theme"], v: string) => patch({ theme: { ...seq.theme, [k]: v } });
  return (
    <div className="seq-form">
      <label className="seq-field">
        <span>Nom de la séquence</span>
        <input className="seq-input" value={seq.name} onChange={(e) => patch({ name: e.target.value })} />
      </label>

      <div className="seq-field">
        <span>Terrain</span>
        <div className="seg">
          {(["portrait", "landscape"] as const).map((o) => (
            <button key={o} type="button" className={`seg__btn ${seq.orient === o ? "is-active" : ""}`} onClick={() => patch({ orient: o })}>
              {o === "portrait" ? "Vertical" : "Paysage"}
            </button>
          ))}
        </div>
      </div>

      <p className="seq-muted">
        Le rendu suit le thème de l'app : cinéma sombre en mode sombre, cinéma clair en mode clair.
        Le format (9:16, 16:9, 1:1) se choisit à l'aperçu et à l'export ; le titre, les chapitres
        et les sous-titres n'apparaissent qu'à ce moment-là, autour du terrain.
      </p>

      <label className="seq-field">
        <span>Titre (en-tête)</span>
        <input className="seq-input" value={seq.title} onChange={(e) => patch({ title: e.target.value })} placeholder="ex. PSG · LUIS ENRIQUE" />
      </label>
      <label className="seq-field">
        <span>Sous-titre</span>
        <input className="seq-input" value={seq.subtitle} onChange={(e) => patch({ subtitle: e.target.value })} placeholder="ex. 4-3-3" />
      </label>
      <Switch label="Noms des joueurs" checked={seq.showNames} onChange={(v) => patch({ showNames: v })} />
      <Switch label="Grille positionnelle" checked={!!seq.showGrid} onChange={(v) => patch({ showGrid: v })} />
      {(
        <div className="seq-field">
          <span>Couleur des traînées</span>
          <Swatches value={seq.trailColor || seq.theme.accent} onPick={(c) => patch({ trailColor: c })} colors={["#f4c531", "#d7ff3a", "#3effa0", "#3fd8ff", "#ff4fd8", "#ffffff"]} />
        </div>
      )}
      <label className="seq-field">
        <span>Taille des disques — nous ×{(seq.homeDiscScale ?? 1).toFixed(2)}</span>
        <input type="range" min={0.6} max={1.8} step={0.05} value={seq.homeDiscScale ?? 1} onChange={(e) => patch({ homeDiscScale: Number(e.target.value) })} />
      </label>
      <label className="seq-field">
        <span>Taille des disques — adversaires ×{(seq.awayDiscScale ?? 1).toFixed(2)}</span>
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
function PlayerPicker({ seq, lineup, players, actions, actorId }: Props & { actorId: string }) {
  const actor = seq.actors.find((a) => a.id === actorId);
  if (!actor) return null;
  const starterIds = new Set(lineup.slots.map((s) => s.starterId).filter(Boolean) as string[]);
  const starters = players.filter((p) => starterIds.has(p.id));
  const others = players.filter((p) => !starterIds.has(p.id));
  const slot = actor.slotId ? lineup.slots.find((s) => s.id === actor.slotId) : null;
  const label = (p: Player) => `${p.number != null ? `${p.number} · ` : ""}${p.name}`;
  const options = [
    { value: "", label: slot ? `Titulaire du poste (${slot.role})` : "Aucun (texte libre)" },
    ...starters.map((p) => ({ value: p.id, label: label(p), group: "Titulaires de la compo" })),
    ...others.map((p) => ({ value: p.id, label: label(p), group: "Reste de l'effectif" })),
  ];
  return (
    <div className="seq-field">
      <span>Joueur de l'effectif</span>
      <FmSelect
        value={actor.playerId ?? ""}
        options={options}
        onChange={(v) =>
          actions.patchActor(seq.id, actor.id, {
            playerId: v || undefined,
            // Let the roster drive name / number once a player is picked.
            name: undefined,
            label: undefined,
          })
        }
        ariaLabel="Joueur de l'effectif"
      />
      {players.length === 0 && (
        <span className="seq-muted">Ajoute des joueurs dans l'onglet Effectif pour afficher leurs noms.</span>
      )}
    </div>
  );
}
