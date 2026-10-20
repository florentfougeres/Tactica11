import { useEffect, useRef, useState } from "react";
import {
  FOOT_LABEL,
  LINE_LABEL,
  POSITIONS,
  STATUS_LABEL,
  type AttributeDef,
  type Foot,
  type Player,
  type PlayerPosition,
  type PlayerStatus,
} from "../../types";
import FmSelect, { type FmOption } from "../FmSelect";
import { NumberBadge } from "./RosterBits";
import { positionInfo, displayName } from "./rosterModel";

interface Props {
  player: Player;
  attributeDefs: AttributeDef[];
  autoFocusName?: boolean;
  onPatch: (patch: Partial<Omit<Player, "id">>) => void;
  onSetAttribute: (attrId: string, value: string | number | null) => void;
  onDelete: () => void;
  onClose: () => void;
  onManageColumns: () => void;
}

// A text field that only writes on blur / Entrée, so typing a name doesn't
// rewrite the whole project on every keystroke. Mounted per player (keyed by
// the parent), so switching players resets the draft.
function Field({
  label,
  value,
  onCommit,
  numeric,
  autoFocus,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  numeric?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.select();
  }, [autoFocus]);
  return (
    <label className="sheet-field">
      <span>{label}</span>
      <input
        ref={ref}
        autoFocus={autoFocus}
        value={draft}
        inputMode={numeric ? "numeric" : undefined}
        placeholder={placeholder}
        onChange={(e) => setDraft(numeric ? e.target.value.replace(/[^\d.,-]/g, "") : e.target.value)}
        onBlur={() => draft !== value && onCommit(draft)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setDraft(value);
        }}
      />
    </label>
  );
}

const POSITION_OPTIONS: FmOption<PlayerPosition | "">[] = [
  { value: "", label: "À définir" },
  ...POSITIONS.map((p) => ({
    value: p.code,
    label: `${p.code} · ${p.label}`,
    group: LINE_LABEL[p.line],
  })),
];

const STATUS_OPTIONS: FmOption<PlayerStatus>[] = (
  Object.keys(STATUS_LABEL) as PlayerStatus[]
).map((s) => ({ value: s, label: STATUS_LABEL[s] }));

export default function PlayerSheet({
  player,
  attributeDefs,
  autoFocusName,
  onPatch,
  onSetAttribute,
  onDelete,
  onClose,
  onManageColumns,
}: Props) {
  const pos = positionInfo(player.position);

  return (
    <aside className="player-sheet glass" aria-label={`Fiche de ${displayName(player)}`}>
      <header className="player-sheet__head">
        <NumberBadge player={player} large />
        <div className="player-sheet__title">
          <strong>{displayName(player)}</strong>
          <span>{pos?.label ?? "Poste à définir"}</span>
        </div>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Fermer la fiche">
          ×
        </button>
      </header>

      <div className="player-sheet__body">
        <Field
          label="Nom"
          value={player.name}
          autoFocus={autoFocusName}
          placeholder="Nom du joueur"
          onCommit={(v) => onPatch({ name: v.trim() })}
        />
        <div className="player-sheet__row">
          <Field
            label="Numéro"
            numeric
            value={player.number != null ? String(player.number) : ""}
            onCommit={(v) => {
              const n = parseInt(v.replace(/\D/g, "").slice(0, 2), 10);
              onPatch({ number: Number.isNaN(n) ? undefined : n });
            }}
          />
          <div className="sheet-field">
            <span>Poste</span>
            <FmSelect<PlayerPosition | "">
              value={player.position ?? ""}
              options={POSITION_OPTIONS}
              onChange={(v) => onPatch({ position: v || undefined })}
              ariaLabel="Poste"
            />
          </div>
        </div>

        <div className="sheet-field">
          <span>Pied fort</span>
          <div className="seg" role="group" aria-label="Pied fort">
            {(Object.keys(FOOT_LABEL) as Foot[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`seg__btn${player.foot === f ? " is-active" : ""}`}
                aria-pressed={player.foot === f}
                onClick={() => onPatch({ foot: player.foot === f ? undefined : f })}
              >
                {FOOT_LABEL[f]}
              </button>
            ))}
          </div>
        </div>

        <div className="sheet-field">
          <span>Statut</span>
          <FmSelect<PlayerStatus>
            value={player.status ?? "available"}
            options={STATUS_OPTIONS}
            onChange={(s) => onPatch({ status: s === "available" ? undefined : s })}
            ariaLabel="Statut"
          />
        </div>

        <section className="player-sheet__section">
          <h4>Infos</h4>
          {attributeDefs.length === 0 && (
            <p className="player-sheet__hint">Ajoute tes propres infos (taille, âge, contrat…).</p>
          )}
          {attributeDefs.map((a) => {
            const raw = player.attributes?.[a.id];
            return (
              <Field
                key={a.id}
                label={a.name || "Sans nom"}
                numeric={a.type === "number"}
                value={raw != null ? String(raw) : ""}
                onCommit={(v) => {
                  const t = v.trim();
                  if (!t) onSetAttribute(a.id, null);
                  else if (a.type === "number") {
                    const n = Number(t.replace(",", "."));
                    onSetAttribute(a.id, Number.isFinite(n) ? n : null);
                  } else onSetAttribute(a.id, t);
                }}
              />
            );
          })}
          <button type="button" className="player-sheet__link" onClick={onManageColumns}>
            Gérer les infos
          </button>
        </section>

      </div>

      <footer className="player-sheet__foot">
        <button type="button" className="player-sheet__delete" onClick={onDelete}>
          Supprimer le joueur
        </button>
      </footer>
    </aside>
  );
}
