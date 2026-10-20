// "Calques" of a step: every graphic visible on it, topmost first, to pick
// one without hunting for it on the pitch (small marks, shapes under
// players…) and to take it off this step only.
import type { SeqAnnotation } from "../../../sequence/types";
import { ANN_LABEL, isArrow } from "../../../sequence/types";
import { type Props } from "./shared";

export default function StepLayers({ seq, step, stepIndex, selAnn, info, editable, actions, onSelectAnn }: Props) {
  const at = (id: string) => seq.steps.findIndex((s) => s.id === id);
  const layers = seq.annotations
    .filter((a) => at(a.fromStep) <= stepIndex && stepIndex <= at(a.toStep))
    .reverse();
  if (!layers.length) return <p className="seq-muted">Aucun dessin sur cette étape.</p>;

  const who = (an: SeqAnnotation["anchors"][number]) =>
    "actorId" in an ? info[an.actorId]?.name || info[an.actorId]?.disc || "?" : null;
  const detail = (a: SeqAnnotation): string => {
    if (a.text) return a.text;
    const names = a.anchors.map(who);
    if (isArrow(a.kind) || a.kind === "marking") {
      const [from, to] = names;
      if (from || to) return `${from ?? "·"} ${a.kind === "marking" ? "↔" : "→"} ${to ?? "·"}`;
    }
    if (a.kind === "playerZone" || a.kind === "playerLine") return `${a.anchors.length} joueurs`;
    if (a.kind === "circle" && names[0]) return names[0];
    return "";
  };
  const range = (a: SeqAnnotation) => {
    const f = at(a.fromStep) + 1;
    const t = at(a.toStep) + 1;
    return f === t ? null : `${f}→${t}`;
  };

  return (
    <ul className="seq-layers">
      {layers.map((a) => {
        const r = range(a);
        const d = detail(a);
        return (
          <li key={a.id} className={`seq-layer ${selAnn === a.id ? "is-active" : ""}`}>
            <button type="button" className="seq-layer__pick" onClick={() => onSelectAnn(a.id)} title="Sélectionner">
              <span className="seq-swatch-dot" style={{ background: a.color }} />
              <span className="seq-layer__kind">{ANN_LABEL[a.kind]}</span>
              {d && <span className="seq-layer__detail">{d}</span>}
              {r && (
                <span className="seq-layer__range" title={`Visible des étapes ${r.replace("→", " à ")}`}>
                  {r}
                </span>
              )}
            </button>
            {editable && (
              <button
                type="button"
                className="seq-layer__del"
                onClick={() => {
                  actions.removeAnnotationAtStep(seq.id, a.id, step.id);
                  if (selAnn === a.id) onSelectAnn(null);
                }}
                title={r ? "Retirer de cette étape (les autres la gardent)" : "Supprimer"}
                aria-label={`Retirer ${ANN_LABEL[a.kind]} de cette étape`}
              >
                ×
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
