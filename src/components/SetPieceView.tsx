import type {
  Drawing,
  DrawTool,
  Lineup,
  Player,
  SetPieceState,
  SetPieceType,
} from "../types";
import { DEFAULT_OPPONENT_COLOR, DRAW_COLORS, OPPONENT_COLORS } from "../types";
import type { useSetPieceActions } from "../hooks/useSetPieceActions";
import SetPieceList, { type OnPitchPlayer } from "./SetPieceList";
import SetPiecePitch from "./SetPiecePitch";
import SetPieceStateToggle from "./SetPieceStateToggle";

type SetPieceActions = ReturnType<typeof useSetPieceActions>;

interface Props {
  lineup: Lineup;
  playerById: (id: string | null) => Player | null;
  sp: SetPieceActions;
  state: SetPieceState;
  onStateChange: (s: SetPieceState) => void;
  blend: number;
  onBlend: (v: number) => void;
  scrubbing: boolean;
  onScrubbing: (v: boolean) => void;
  opponentMode: boolean;
  onOpponentMode: (v: boolean) => void;
  showNumbers: boolean;
  onShowNumbers: (v: boolean) => void;
  drawMode: boolean;
  onDrawMode: (v: boolean) => void;
  drawTool: DrawTool;
  onDrawTool: (t: DrawTool) => void;
  drawColor: string;
  onDrawColor: (c: string) => void;
}

const TYPE_LABEL: Record<SetPieceType, string> = {
  corner: "Corner",
  "free-kick": "Coup franc",
};

// Composer for the "Coup de pied arrêté" view: pairs the set-piece list (left)
// with the half-pitch board (right), mirroring how App.tsx pairs Bench+Pitch
// for the main "Terrain" view.
export default function SetPieceView({
  lineup,
  playerById,
  sp,
  state,
  onStateChange,
  blend,
  onBlend,
  scrubbing,
  onScrubbing,
  opponentMode,
  onOpponentMode,
  showNumbers,
  onShowNumbers,
  drawMode,
  onDrawMode,
  drawTool,
  onDrawTool,
  drawColor,
  onDrawColor,
}: Props) {
  const current = sp.currentSetPiece;

  // Only this compo's on-pitch starters can be added — a set piece is tied to
  // the compo it was built for. A player already placed on the current set
  // piece stays listed (so they can still be removed) even if they've since
  // been benched from the starting XI.
  const roleFor = (playerId: string) =>
    lineup.slots.find((s) => s.starterId === playerId)?.role ?? "";
  const onPitchIds = new Set(
    lineup.slots.filter((s) => s.starterId).map((s) => s.starterId as string),
  );
  current?.tokens.forEach((t) => onPitchIds.add(t.playerId));
  const onPitchPlayers: OnPitchPlayer[] = [...onPitchIds]
    .map((id): OnPitchPlayer | null => {
      const p = playerById(id);
      return p
        ? {
            id: p.id,
            name: p.name,
            ...(p.number != null ? { number: p.number } : {}),
            role: roleFor(id),
          }
        : null;
    })
    .filter((p): p is OnPitchPlayer => p != null);

  // The blend slider and the Début/Fin toggle always stay in sync: dragging
  // is only enabled at the endpoints, and each endpoint edits its own state.
  const handleBlend = (v: number) => {
    onBlend(v);
    onStateChange(v === 0 ? "start" : "end");
  };
  const handleState = (s: SetPieceState) => {
    onStateChange(s);
    onBlend(s === "start" ? 0 : 1);
  };

  const footer = current && (
    <div className="pitch-ctl">
      <div className="pitch-ctl__slider">
        <span>Début</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={blend}
          aria-label="Transition Début → Fin"
          onPointerDown={() => onScrubbing(true)}
          onPointerUp={() => onScrubbing(false)}
          onChange={(e) => handleBlend(Number(e.target.value))}
        />
        <span>Fin</span>
      </div>

      <SetPieceStateToggle state={state} onState={handleState} />

      <div
        className="sp-type-switch"
        role="group"
        aria-label="Type de phase arrêtée"
      >
        {(["corner", "free-kick"] as SetPieceType[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`sp-type-switch__btn ${
              current.type === t ? "is-active" : ""
            }`}
            onClick={() => sp.setSetPieceType(current.id, t)}
          >
            {TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      <label className="pitch-ctl__row">
        <span>Afficher les numéros</span>
        <span className="switch">
          <input
            type="checkbox"
            checked={showNumbers}
            onChange={(e) => onShowNumbers(e.target.checked)}
          />
          <span className="switch__track" />
          <span className="switch__thumb" />
        </span>
      </label>

      <label className="pitch-ctl__row">
        <span>Adversaires</span>
        <span className="switch">
          <input
            type="checkbox"
            checked={opponentMode}
            onChange={(e) => onOpponentMode(e.target.checked)}
          />
          <span className="switch__track" />
          <span className="switch__thumb" />
        </span>
      </label>
      {opponentMode && (
        <button
          type="button"
          className="pitch-ctl__btn"
          onClick={() => sp.addOpponent(current.id)}
        >
          + Adversaire
        </button>
      )}
      {opponentMode && (
        <div
          className="opp-colors-row"
          role="group"
          aria-label="Couleur des adversaires"
        >
          {OPPONENT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`opp-swatch ${
                c === (current.opponentColor ?? DEFAULT_OPPONENT_COLOR)
                  ? "is-active"
                  : ""
              }`}
              style={{ background: c }}
              onClick={() => sp.setOpponentColor(current.id, c)}
              aria-label={`Couleur ${c}`}
            />
          ))}
        </div>
      )}

      <label className="pitch-ctl__row">
        <span>Dessin</span>
        <span className="switch">
          <input
            type="checkbox"
            checked={drawMode}
            onChange={(e) => onDrawMode(e.target.checked)}
          />
          <span className="switch__track" />
          <span className="switch__thumb" />
        </span>
      </label>
    </div>
  );

  return (
    <>
      <SetPieceList
        setPieces={lineup.setPieces}
        currentSetPiece={current}
        players={onPitchPlayers}
        onSelect={sp.selectSetPiece}
        onNew={sp.newSetPiece}
        onRename={sp.renameSetPiece}
        onDuplicate={sp.duplicateSetPiece}
        onDelete={sp.deleteSetPiece}
        onToggleToken={(playerId) => {
          if (!current) return;
          const existing = current.tokens.find((t) => t.playerId === playerId);
          if (existing) sp.removeToken(current.id, existing.id);
          else sp.addToken(current.id, playerId);
        }}
        footer={footer}
      />

      {current ? (
        <SetPiecePitch
          setPiece={current}
          playerById={playerById}
          roleFor={roleFor}
          showNumbers={showNumbers}
          state={state}
          blend={blend}
          scrubbing={scrubbing}
          opponentMode={opponentMode}
          drawMode={drawMode}
          drawTool={drawTool}
          drawColor={drawColor}
          drawColors={DRAW_COLORS}
          onMoveBall={(pos) => sp.moveBall(current.id, state, pos)}
          onMoveToken={(tokenId, pos) =>
            sp.moveToken(current.id, tokenId, state, pos)
          }
          onMoveOpponent={(oppId, pos) =>
            sp.moveOpponent(current.id, oppId, state, pos)
          }
          onLabelOpponent={(oppId, label) =>
            sp.labelOpponent(current.id, oppId, label)
          }
          onRemoveOpponent={(oppId) => sp.removeOpponent(current.id, oppId)}
          onAddDrawing={(d: Drawing) => sp.addDrawing(current.id, state, d)}
          onDrawTool={onDrawTool}
          onDrawColor={onDrawColor}
          onUndoDrawing={() => sp.undoDrawing(current.id, state)}
          onClearDrawings={() => sp.clearDrawings(current.id, state)}
        />
      ) : (
        <div className="sp-empty glass">
          <p>Crée un corner ou un coup franc pour commencer.</p>
        </div>
      )}
    </>
  );
}
