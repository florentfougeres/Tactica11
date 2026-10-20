import { useEffect, useRef } from "react";
import type { Player } from "../../../types";
import type {
  AnnKind,
  SeqAnnotation,
  Team,
} from "../../../sequence/types";
import { ANN_LABEL, ARROW_KINDS, isArrow } from "../../../sequence/types";
import FmSelect from "../../FmSelect";

import { Switch, Swatches, type Props } from "./shared";

export default function SelectionTab(props: Props) {
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
          {!!seq.idle && (
            <Switch label="Micro-mouvements" checked={single.idle !== false} onChange={(v) => actions.patchActor(seq.id, single.id, { idle: v })} />
          )}
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
