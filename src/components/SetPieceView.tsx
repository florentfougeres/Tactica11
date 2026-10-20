import { useEffect } from "react";
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
import { useAutoplay } from "../hooks/useAutoplay";
import AutoplayControl from "./AutoplayControl";
import SetPieceList, { type OnPitchPlayer } from "./SetPieceList";
import SetPiecePitch from "./SetPiecePitch";
import SetPieceStateToggle from "./SetPieceStateToggle";
import Switch from "./Switch";

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
// for the main "Compo" view.
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

  // The blend slider and the Début/Intermédiaire/Fin toggle always stay in
  // sync: dragging is only enabled exactly on the three anchors, and each
  // anchor edits its own state.
  const STATE_BLEND: Record<SetPieceState, number> = {
    start: 0,
    mid: 0.5,
    end: 1,
  };
  const nearestState = (v: number): SetPieceState =>
    v <= 0.25 ? "start" : v >= 0.75 ? "end" : "mid";
  const handleBlend = (v: number) => {
    onBlend(v);
    onStateChange(nearestState(v));
  };
  const handleState = (s: SetPieceState) => {
    autoplay.stop();
    onStateChange(s);
    onBlend(STATE_BLEND[s]);
  };

  // Hands-free walkthrough of the Début↔Fin slider (team-briefing mode),
  // cycling through the three anchors. While playing, treat it like an
  // active scrub so tokens track the blend 1:1 (see SetPiecePitch's
  // `instant`) instead of chasing it with a spring.
  const autoplay = useAutoplay(blend, handleBlend);
  useEffect(() => {
    onScrubbing(autoplay.playing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay.playing]);
  // Switching set pieces mid-playback would otherwise keep driving the new
  // one's slider from wherever the old one left off.
  useEffect(() => {
    autoplay.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // "Reprendre" copies the previous phase's positions into the one being
  // edited — a starting point so the user adjusts from there instead of
  // re-placing everyone. Only meaningful past "start", which has no previous
  // phase.
  const PREVIOUS_PHASE_LABEL: Partial<Record<SetPieceState, string>> = {
    mid: "Début",
    end: "Intermédiaire",
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
          onPointerDown={() => {
            autoplay.stop();
            onScrubbing(true);
          }}
          onPointerUp={() => onScrubbing(false)}
          onChange={(e) => handleBlend(Number(e.target.value))}
        />
        <span>Fin</span>
        <AutoplayControl
          playing={autoplay.playing}
          onToggle={autoplay.toggle}
          speed={autoplay.speed}
          onCycleSpeed={autoplay.cycleSpeed}
          label="la séquence début-fin"
        />
      </div>

      <SetPieceStateToggle state={state} onState={handleState} />

      {PREVIOUS_PHASE_LABEL[state] && (
        <button
          type="button"
          className="pitch-ctl__btn"
          onClick={() => sp.applyPreviousPhase(current.id, state)}
        >
          Reprendre « {PREVIOUS_PHASE_LABEL[state]} »
        </button>
      )}

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

      <Switch label="Afficher les numéros" checked={showNumbers} onChange={onShowNumbers} />

      <Switch label="Adversaires" checked={opponentMode} onChange={onOpponentMode} />
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

      <Switch label="Dessin" checked={drawMode} onChange={onDrawMode} />
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
          <p className="sp-empty__title">Prépare tes coups de pied arrêtés</p>
          <p>
            Place tes joueurs avant et après le ballon, et dessine les courses
            et les zones.
          </p>
          <div className="sp-empty__actions">
            <button type="button" className="btn btn--primary" onClick={() => sp.newSetPiece("corner")}>
              Créer un corner
            </button>
            <button type="button" className="btn" onClick={() => sp.newSetPiece("free-kick")}>
              Créer un coup franc
            </button>
          </div>
        </div>
      )}
    </>
  );
}
