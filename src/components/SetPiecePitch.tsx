import { useEffect, useRef, useState } from "react";
import type {
  Drawing,
  DrawTool,
  Orient,
  Player,
  Pos,
  SetPiece,
  SetPieceState,
} from "../types";
import { DEFAULT_OPPONENT_COLOR } from "../types";
import PitchTurfLayer, { type TurfLook } from "./PitchTurf";
import BallToken from "./BallToken";
import SetPieceMarker from "./SetPieceMarker";
import DrawingLayer from "./DrawingLayer";
import DrawToolbar from "./DrawToolbar";

interface Props {
  setPiece: SetPiece;
  playerById: (id: string | null) => Player | null;
  roleFor: (playerId: string) => string;
  look: TurfLook; // follows the app theme
  showNumbers: boolean;
  state: SetPieceState;
  blend: number; // Début(0) ↔ Fin(1) scrub
  scrubbing: boolean; // user is dragging the scrub → follow it 1:1
  opponentMode: boolean;
  drawMode: boolean;
  onDrawMode: (on: boolean) => void;
  drawTool: DrawTool;
  drawColor: string;
  drawColors: string[];
  onMoveBall: (pos: { x: number; y: number }) => void;
  onMoveToken: (tokenId: string, pos: { x: number; y: number }) => void;
  onMoveOpponent: (oppId: string, pos: { x: number; y: number }) => void;
  onLabelOpponent: (oppId: string, label: string) => void;
  onRemoveOpponent: (oppId: string) => void;
  onAddDrawing: (d: Drawing) => void;
  onDrawTool: (t: DrawTool) => void;
  onDrawColor: (c: string) => void;
  onUndoDrawing: () => void;
  onClearDrawings: () => void;
}

// The board is always a half-pitch, portrait only — no rotate/landscape here.
const ORIENT: Orient = "portrait";

export default function SetPiecePitch({
  setPiece,
  playerById,
  roleFor,
  look,
  showNumbers,
  blend,
  scrubbing,
  opponentMode,
  drawMode,
  onDrawMode,
  drawTool,
  drawColor,
  drawColors,
  state,
  onMoveBall,
  onMoveToken,
  onMoveOpponent,
  onLabelOpponent,
  onRemoveOpponent,
  onAddDrawing,
  onDrawTool,
  onDrawColor,
  onUndoDrawing,
  onClearDrawings,
}: Props) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight });
    });
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Mid-scrub (blend strictly between two adjacent anchors) is a read-only
  // preview, exactly like the main pitch's défense↔attaque transition.
  // Editing is only allowed exactly on start(0) / mid(0.5) / end(1).
  const atEndpoint = blend === 0 || blend === 0.5 || blend === 1;
  const frozen = !atEndpoint;
  const editable = !frozen;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  // Three-point piecewise interpolation: 0→0.5 covers start→mid, 0.5→1
  // covers mid→end, so the slider scrubs across both segments in one pass.
  const lerpPos = (start: Pos, mid: Pos, end: Pos): Pos =>
    blend <= 0.5
      ? {
          x: lerp(start.x, mid.x, blend / 0.5),
          y: lerp(start.y, mid.y, blend / 0.5),
        }
      : {
          x: lerp(mid.x, end.x, (blend - 0.5) / 0.5),
          y: lerp(mid.y, end.y, (blend - 0.5) / 0.5),
        };

  const drawings = setPiece.drawings?.[state] ?? [];

  return (
    <div className="pitch-col pitch-col--portrait sp-pitch-col">
      <div className="pitch-wrap">
        <div className="pitch pitch--half">
          <div className="pitch__field" ref={innerRef}>
            {/* No shared goal: this board draws its own, more visible one. */}
            <PitchTurfLayer orient={ORIENT} look={look} half goals={false} />

            {/* The goal itself: drawn outside the field, in the grass margin
                above the goal line (real 7.32 m width) — not inside the pitch.
                Positioned as a % of the field's own box (not the SVG viewBox),
                so it stays correctly proportioned regardless of container size.
                Bright, opaque frame (not the faint pitch-line colour) + a
                visible net fill so it actually reads as a goal at a glance. */}
            <div className="sp-goal" aria-hidden="true">
              <svg
                viewBox="0 0 7.32 2"
                preserveAspectRatio="none"
                width="100%"
                height="100%"
              >
                <rect
                  x="0.05"
                  y="0"
                  width="7.22"
                  height="2"
                  fill="rgba(255,255,255,0.16)"
                />
                <g stroke="rgba(255,255,255,0.65)" strokeWidth="0.05">
                  <line x1="1.22" y1="0" x2="1.22" y2="2" />
                  <line x1="2.44" y1="0" x2="2.44" y2="2" />
                  <line x1="3.66" y1="0" x2="3.66" y2="2" />
                  <line x1="4.88" y1="0" x2="4.88" y2="2" />
                  <line x1="6.1" y1="0" x2="6.1" y2="2" />
                  <line x1="0" y1="0.66" x2="7.32" y2="0.66" />
                  <line x1="0" y1="1.33" x2="7.32" y2="1.33" />
                </g>
                <path
                  d="M 0.05 2 L 0.05 0.05 L 7.27 0.05 L 7.27 2"
                  fill="none"
                  stroke="#f5f6f4"
                  strokeWidth="0.42"
                  strokeLinecap="square"
                  strokeLinejoin="miter"
                />
              </svg>
            </div>

            {size.w > 0 && (
              <DrawingLayer
                size={size}
                orient={ORIENT}
                drawings={drawings}
                active={drawMode}
                tool={drawTool}
                color={drawColor}
                onCommit={onAddDrawing}
              />
            )}

            {opponentMode &&
              size.w > 0 &&
              setPiece.opponents.map((o) => (
                <SetPieceMarker
                  key={o.id}
                  id={o.id}
                  variant="opponent"
                  label={o.label}
                  color={setPiece.opponentColor ?? DEFAULT_OPPONENT_COLOR}
                  pos={lerpPos(o.positions.start, o.positions.mid, o.positions.end)}
                  size={size}
                  orient={ORIENT}
                  editable={editable}
                  instant={scrubbing}
                  onMove={onMoveOpponent}
                  onLabel={onLabelOpponent}
                  onRemove={onRemoveOpponent}
                />
              ))}

            {size.w > 0 &&
              setPiece.tokens.map((t) => (
                <SetPieceMarker
                  key={t.id}
                  id={t.id}
                  variant="team"
                  player={playerById(t.playerId)}
                  role={roleFor(t.playerId)}
                  showNumbers={showNumbers}
                  pos={lerpPos(t.positions.start, t.positions.mid, t.positions.end)}
                  size={size}
                  orient={ORIENT}
                  editable={editable}
                  instant={scrubbing}
                  onMove={onMoveToken}
                />
              ))}

            {size.w > 0 && (
              <BallToken
                pos={lerpPos(setPiece.ball.start, setPiece.ball.mid, setPiece.ball.end)}
                size={size}
                orient={ORIENT}
                editable={editable}
                instant={scrubbing}
                onMove={onMoveBall}
              />
            )}
          </div>
        </div>
      </div>

      <DrawToolbar
        drawing={drawMode}
        onDrawing={onDrawMode}
        tool={drawTool}
        color={drawColor}
        colors={drawColors}
        canUndo={drawings.length > 0}
        canClear={drawings.length > 0}
        onTool={onDrawTool}
        onColor={onDrawColor}
        onUndo={onUndoDrawing}
        onClear={onClearDrawings}
      />
    </div>
  );
}
