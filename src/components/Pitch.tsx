import { forwardRef, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type {
  DrawTool,
  Drawing,
  InfluenceMode,
  Opponent,
  Orient,
  Phase,
  Player,
  Slot,
  ZoneRadii,
} from "../types";
import { DEFAULT_ZONE, posToPx } from "../types";
import PitchMarkings from "./PitchMarkings";
import PositionalGrid from "./PositionalGrid";
import PhaseToggle from "./PhaseToggle";
import PitchToken, { TOKEN_SIZE } from "./PitchToken";
import OpponentToken from "./OpponentToken";
import HeatmapOverlay from "./HeatmapOverlay";
import InfluenceHandles from "./InfluenceHandles";
import DrawingLayer from "./DrawingLayer";
import DrawToolbar from "./DrawToolbar";
interface Props {
  slots: Slot[];
  phase: Phase;
  playerById: (id: string | null) => Player | null;
  selectedSlot: string | null;
  dropActive?: boolean;
  influenceMode: InfluenceMode;
  orient: Orient;
  onToggleOrient: () => void;
  onPhase: (phase: Phase) => void;
  onSelect: (slotId: string | null) => void;
  onMove: (slotId: string, pos: { x: number; y: number }) => void;
  onPlayerDrop: (slotId: string, point: { x: number; y: number }) => void;
  onRemoveStarter: (slotId: string) => void;
  onRemoveSub: (slotId: string) => void;
  onSwap: (slotId: string) => void;
  onSetNumber: (playerId: string, number: number | null) => void;
  onInfluence: (slotId: string, radii: ZoneRadii) => void;
  blend: number; // Défense(0) ↔ Attaque(1) scrub, owned by App
  scrubbing: boolean; // user is dragging the scrub → follow it 1:1
  showGrid: boolean; // positional-grid overlay
  opponents: Opponent[];
  opponentMode: boolean;
  opponentColor: string;
  onMoveOpponent: (id: string, pos: { x: number; y: number }) => void;
  onLabelOpponent: (id: string, label: string) => void;
  drawMode: boolean;
  drawTool: DrawTool;
  drawColor: string;
  drawColors: string[];
  drawings: Drawing[];
  onAddDrawing: (d: Drawing) => void;
  onDrawTool: (t: DrawTool) => void;
  onDrawColor: (c: string) => void;
  onUndoDrawing: () => void;
  onClearDrawings: () => void;
}

const Pitch = forwardRef<HTMLDivElement, Props>(function Pitch(
  {
    slots,
    phase,
    playerById,
    selectedSlot,
    dropActive,
    influenceMode,
    orient,
    onToggleOrient,
    onPhase,
    onSelect,
    onMove,
    onPlayerDrop,
    onRemoveStarter,
    onRemoveSub,
    onSwap,
    onSetNumber,
    onInfluence,
    blend,
    scrubbing,
    showGrid,
    opponents,
    opponentMode,
    opponentColor,
    onMoveOpponent,
    onLabelOpponent,
    drawMode,
    drawTool,
    drawColor,
    drawColors,
    drawings,
    onAddDrawing,
    onDrawTool,
    onDrawColor,
    onUndoDrawing,
    onClearDrawings,
  },
  ref,
) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // True while a token is being dragged — lets the token escape the pitch's
  // overflow:hidden (e.g. when dragging onto the bench) and float above it.
  const [tokenDragging, setTokenDragging] = useState(false);
  // Live centre while dragging a token (so the heatmap follows it).
  const [liveCenter, setLiveCenter] = useState<{ x: number; y: number } | null>(
    null,
  );
  // blend / scrubbing / showGrid are owned by App (the controls live in the
  // Effectif panel) and arrive as props.
  const atEndpoint = blend === 0 || blend === 1;
  const frozen = phase !== "base" && !atEndpoint;

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const displayPos = (slot: Slot) =>
    phase === "base"
      ? slot.positions.base
      : {
          x: lerp(slot.positions.defense.x, slot.positions.attack.x, blend),
          y: lerp(slot.positions.defense.y, slot.positions.attack.y, blend),
        };

  // Opponents have no base disposition; lerp between defense (0) and attack (1)
  // so they scrub along with our tokens.
  const displayOppPos = (o: Opponent) => ({
    x: lerp(o.positions.defense.x, o.positions.attack.x, blend),
    y: lerp(o.positions.defense.y, o.positions.attack.y, blend),
  });

  const onPitch = phase !== "base";
  const showPlayer = onPitch && !frozen && influenceMode === "player";
  const showTeam = onPitch && !frozen && influenceMode === "team";

  const handleDragActive = (active: boolean) => {
    setTokenDragging(active);
    if (!active) setLiveCenter(null);
  };
  const handleDragMove = (slotId: string, center: { x: number; y: number }) => {
    if (slotId === selectedSlot) setLiveCenter(center);
  };

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

  const selected = slots.find((s) => s.id === selectedSlot) ?? null;
  const selectedStarter = selected ? playerById(selected.starterId) : null;
  const radii = selected?.influence?.[phase] ?? DEFAULT_ZONE;
  const staticCenter = selected
    ? posToPx(selected.positions[phase], size, orient)
    : { x: 0, y: 0 };
  const staticCx = staticCenter.x;
  const staticCy = staticCenter.y;

  // Close the popover on any click outside it (and outside the filled tokens,
  // so tapping another token re-selects instead of just closing), or Escape.
  useEffect(() => {
    if (!selectedSlot) return;
    function onDown(e: PointerEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t?.closest(".slot-pop") ||
        t?.closest(".token--filled") ||
        t?.closest(".bench__footer") ||
        t?.closest(".zone-handles")
      )
        return;
      onSelect(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onSelect(null);
    }
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [selectedSlot, onSelect]);

  return (
    <div className={`pitch-col pitch-col--${orient}`}>
      <div className="pitch-bar">
        <PhaseToggle phase={phase} onPhase={onPhase} />
        <button
          type="button"
          className="pitch-rotate"
          onClick={onToggleOrient}
          title={
            orient === "portrait"
              ? "Pivoter en paysage"
              : "Pivoter en portrait"
          }
          aria-label="Pivoter le terrain"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4.5 9a7.5 7.5 0 0 1 12.7-3L20 8.5M19.5 15a7.5 7.5 0 0 1-12.7 3L4 15.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M20 4v4.5h-4.5M4 20v-4.5h4.5"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div
        className={`pitch-wrap ${
          tokenDragging && phase === "base" ? "pitch-wrap--dragging" : ""
        }`}
        ref={ref}
      >
        <div
          className={`pitch ${dropActive ? "pitch--drop" : ""} ${
            tokenDragging && phase === "base" ? "pitch--dragging" : ""
          } ${orient === "landscape" ? "pitch--landscape" : ""}`}
        >
          <div className="pitch__field" ref={innerRef}>
          <div className="pitch__grass" />
          <PitchMarkings orient={orient} />
          {showGrid && <PositionalGrid orient={orient} />}

          {size.w > 0 && (
            <DrawingLayer
              size={size}
              orient={orient}
              drawings={drawings}
              active={drawMode}
              tool={drawTool}
              color={drawColor}
              onCommit={onAddDrawing}
            />
          )}

          {showTeam &&
            size.w > 0 &&
            slots
              .filter((s) => s.starterId)
              .map((s) => {
                const c = posToPx(s.positions[phase], size, orient);
                return (
                  <HeatmapOverlay
                    key={s.id}
                    cx={c.x}
                    cy={c.y}
                    size={size}
                    radii={s.influence?.[phase] ?? DEFAULT_ZONE}
                    orient={orient}
                    intensity={0.42}
                    animated={false}
                  />
                );
              })}

          {showPlayer && selected && selectedStarter && size.w > 0 && (
            <HeatmapOverlay
              cx={liveCenter ? liveCenter.x : staticCx}
              cy={liveCenter ? liveCenter.y : staticCy}
              size={size}
              radii={radii}
              orient={orient}
            />
          )}

          {showPlayer &&
            selected &&
            selectedStarter &&
            size.w > 0 &&
            !tokenDragging && (
              <InfluenceHandles
                cx={staticCx}
                cy={staticCy}
                size={size}
                radii={radii}
                orient={orient}
                pitchRef={innerRef}
                onChange={(next) => onInfluence(selected.id, next)}
              />
            )}

        {dropActive && (
          <div className="pitch__drop-hint">Dépose le joueur sur un poste</div>
        )}

        {opponentMode &&
          phase !== "base" &&
          size.w > 0 &&
          opponents.map((o) => (
            <OpponentToken
              key={o.id}
              opponent={o}
              pos={displayOppPos(o)}
              size={size}
              orient={orient}
              color={opponentColor}
              editable={!frozen}
              instant={scrubbing}
              onMove={onMoveOpponent}
              onLabel={onLabelOpponent}
            />
          ))}

        {size.w > 0 &&
          slots.map((slot) => (
            <PitchToken
              key={slot.id}
              slot={slot}
              starter={playerById(slot.starterId)}
              sub={playerById(slot.subId)}
              phase={phase}
              pos={displayPos(slot)}
              frozen={frozen}
              instant={scrubbing}
              size={size}
              orient={orient}
              selected={selectedSlot === slot.id}
              onSelect={onSelect}
              onMove={onMove}
              onPlayerDrop={onPlayerDrop}
              onDragActiveChange={handleDragActive}
              onDragMove={handleDragMove}
            />
          ))}

        {selected && selectedStarter && size.w > 0 && phase === "base" && (
          <SlotPopover
            key={selected.id}
            slot={selected}
            starter={selectedStarter}
            sub={playerById(selected.subId)}
            size={size}
            phase={phase}
            orient={orient}
            fieldRef={innerRef}
            onRemoveStarter={onRemoveStarter}
            onRemoveSub={onRemoveSub}
            onSwap={onSwap}
            onSetNumber={onSetNumber}
          />
        )}
          </div>
        </div>

      </div>

      {drawMode && (
        <DrawToolbar
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
      )}
    </div>
  );
});

export default Pitch;

function SlotPopover({
  slot,
  starter,
  sub,
  size,
  phase,
  orient,
  fieldRef,
  onRemoveStarter,
  onRemoveSub,
  onSwap,
  onSetNumber,
}: {
  slot: Slot;
  starter: Player;
  sub: Player | null;
  size: { w: number; h: number };
  phase: Phase;
  orient: Orient;
  fieldRef: React.RefObject<HTMLDivElement | null>;
  onRemoveStarter: (slotId: string) => void;
  onRemoveSub: (slotId: string) => void;
  onSwap: (slotId: string) => void;
  onSetNumber: (playerId: string, number: number | null) => void;
}) {
  const [numVal, setNumVal] = useState(
    starter.number != null ? String(starter.number) : "",
  );

  function commitNum() {
    const n = parseInt(numVal.trim(), 10);
    onSetNumber(starter.id, Number.isNaN(n) ? null : n);
  }

  const c = posToPx(slot.positions[phase], size, orient);
  // Anchor against the field's on-screen rect so the popover can live in a body
  // portal — escaping the pitch's overflow:hidden (which used to clip it).
  const rect = fieldRef.current?.getBoundingClientRect();
  if (!rect) return null;
  const cx = rect.left + c.x;
  const cyTop = rect.top + c.y;
  // Place the popover below the token, flipping above near the bottom edge.
  const below = c.y < size.h - 150;
  const top = below
    ? cyTop + TOKEN_SIZE / 2 + 18
    : cyTop - TOKEN_SIZE / 2 - 18;
  // Keep it on screen horizontally (half its max width = 115px).
  const left = Math.min(Math.max(cx, 123), window.innerWidth - 123);

  return createPortal(
    <div
      className="slot-pop-anchor"
      style={{
        position: "fixed",
        left,
        top,
        transform: `translate(-50%, ${below ? "0" : "-100%"})`,
      }}
    >
      <div className="slot-pop glass" onPointerDown={(e) => e.stopPropagation()}>
        <div className="slot-pop__row">
          <span className="slot-pop__tag slot-pop__tag--starter">
            Titulaire
          </span>
          <span className="slot-pop__name">{starter.name}</span>
          <input
            className="slot-pop__num"
            value={numVal}
            onChange={(e) =>
              setNumVal(e.target.value.replace(/\D/g, "").slice(0, 2))
            }
            onBlur={commitNum}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitNum();
            }}
            inputMode="numeric"
            placeholder="N°"
            title="Numéro (optionnel)"
            aria-label="Numéro du titulaire"
          />
          <button
            className="slot-pop__btn"
            onClick={() => onRemoveStarter(slot.id)}
            title="Renvoyer au vivier"
          >
            ↩
          </button>
        </div>

        {sub && (
          <div className="slot-pop__row">
            <span className="slot-pop__tag">Remplaçant</span>
            <span className="slot-pop__name">{sub.name}</span>
            <button
              className="slot-pop__btn"
              onClick={() => onSwap(slot.id)}
              title="Promouvoir titulaire"
            >
              ⇅
            </button>
            <button
              className="slot-pop__btn"
              onClick={() => onRemoveSub(slot.id)}
              title="Renvoyer au vivier"
            >
              ↩
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
