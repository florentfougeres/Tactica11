import { useState, type ReactNode } from "react";
import type { SetPiece, SetPieceType } from "../types";

const TYPE_LABEL: Record<SetPieceType, string> = {
  corner: "Corner",
  "free-kick": "Coup franc",
};

// A player eligible for this set piece: this compo's on-pitch starters (plus
// anyone already placed on the current set piece, even if since benched).
export interface OnPitchPlayer {
  id: string;
  name: string;
  number?: number;
  role: string;
}

interface Props {
  setPieces: SetPiece[];
  currentSetPiece: SetPiece | null;
  players: OnPitchPlayer[];
  onSelect: (id: string) => void;
  onNew: (type: SetPieceType) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleToken: (playerId: string) => void;
  footer?: ReactNode;
}

export default function SetPieceList({
  setPieces,
  currentSetPiece,
  players,
  onSelect,
  onNew,
  onRename,
  onDuplicate,
  onDelete,
  onToggleToken,
  footer,
}: Props) {
  const placedIds = new Set(currentSetPiece?.tokens.map((t) => t.playerId));

  return (
    <aside className="bench glass sp-list">
      <header className="panel__header">
        <h2>Phases arrêtées</h2>
        <span className="chip">{setPieces.length}</span>
      </header>

      <div className="sp-list__new">
        <button
          type="button"
          className="sp-list__newbtn"
          onClick={() => onNew("corner")}
        >
          + Corner
        </button>
        <button
          type="button"
          className="sp-list__newbtn"
          onClick={() => onNew("free-kick")}
        >
          + Coup franc
        </button>
      </div>

      <div className="sp-list__items">
        {setPieces.length === 0 && (
          <p className="bench__empty">
            Crée un corner ou un coup franc pour commencer.
          </p>
        )}
        {setPieces.map((sp) => (
          <SetPieceRow
            key={sp.id}
            setPiece={sp}
            active={sp.id === currentSetPiece?.id}
            onSelect={() => onSelect(sp.id)}
            onRename={(name) => onRename(sp.id, name)}
            onDuplicate={() => onDuplicate(sp.id)}
            onDelete={() => onDelete(sp.id)}
          />
        ))}
      </div>

      {currentSetPiece && (
        <div className="sp-roster">
          <div className="sp-roster__header">Titulaires de cette compo</div>
          <div className="sp-roster__list">
            {players.length === 0 && (
              <p className="bench__empty">
                Place des titulaires sur le terrain (onglet Terrain) pour
                pouvoir les ajouter ici.
              </p>
            )}
            {players.map((p) => {
              const placed = placedIds.has(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`sp-roster__item ${placed ? "is-placed" : ""}`}
                  onClick={() => onToggleToken(p.id)}
                  title={placed ? "Retirer du terrain" : "Ajouter au terrain"}
                >
                  <span className="sp-roster__num">{p.number ?? "#"}</span>
                  <span className="sp-roster__name">{p.name}</span>
                  {p.role && <span className="sp-roster__role">{p.role}</span>}
                  <span className="sp-roster__mark" aria-hidden="true">
                    {placed ? "✓" : "+"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {footer && <div className="bench__footer">{footer}</div>}
    </aside>
  );
}

function SetPieceRow({
  setPiece,
  active,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
}: {
  setPiece: SetPiece;
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(setPiece.name);

  function commit() {
    setEditing(false);
    const v = val.trim();
    if (v && v !== setPiece.name) onRename(v);
    else setVal(setPiece.name);
  }

  return (
    <div
      className={`sp-item ${active ? "is-active" : ""}`}
      onClick={onSelect}
    >
      <span className={`sp-item__type sp-item__type--${setPiece.type}`}>
        {TYPE_LABEL[setPiece.type]}
      </span>
      {editing ? (
        <input
          className="sp-item__name-input"
          autoFocus
          value={val}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setVal(setPiece.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="sp-item__name"
          onClick={(e) => {
            e.stopPropagation();
            setVal(setPiece.name);
            setEditing(true);
          }}
        >
          {setPiece.name}
        </button>
      )}
      <div className="sp-item__actions">
        <button
          type="button"
          className="sp-item__action"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate();
          }}
          title="Dupliquer"
          aria-label="Dupliquer"
        >
          ⧉
        </button>
        <button
          type="button"
          className="sp-item__action sp-item__action--danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          title="Supprimer"
          aria-label="Supprimer"
        >
          ×
        </button>
      </div>
    </div>
  );
}
