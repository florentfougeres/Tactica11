import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import type {
  InfluenceMode,
  Opponent,
  Orient,
  Phase,
  Player,
  Slot,
  ZoneRadii,
} from "../types";
import { DEFAULT_ZONE, OPPONENT_COLORS, posToPx } from "../types";
import PitchMarkings from "./PitchMarkings";
import PositionalGrid from "./PositionalGrid";
import PhaseToggle from "./PhaseToggle";
import PitchToken, { TOKEN_SIZE } from "./PitchToken";
import OpponentToken from "./OpponentToken";
import HeatmapOverlay from "./HeatmapOverlay";
import InfluenceHandles from "./InfluenceHandles";
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
  opponents: Opponent[];
  opponentMode: boolean;
  opponentColor: string;
  onToggleOpponentMode: () => void;
  onMoveOpponent: (id: string, pos: { x: number; y: number }) => void;
  onLabelOpponent: (id: string, label: string) => void;
  onSetOpponentColor: (color: string) => void;
  influenceControls: ReactNode;
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
    opponents,
    opponentMode,
    opponentColor,
    onToggleOpponentMode,
    onMoveOpponent,
    onLabelOpponent,
    onSetOpponentColor,
    influenceControls,
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
  // Slider scrub between Défense (0) and Attaque (1). Mid-values = a read-only
  // preview where tokens interpolate between the two dispositions.
  const [blend, setBlend] = useState(phase === "attack" ? 1 : 0);
  const [scrubbing, setScrubbing] = useState(false);
  // Juego de posición overlay — the 5 vertical corridors (off by default).
  const [showGrid, setShowGrid] = useState(false);
  // Which toolbar popover is open (influence options / opponent colours).
  const [openTool, setOpenTool] = useState<"influence" | "colors" | null>(null);

  const handleBlend = (v: number) => {
    setBlend(v);
    if (v === 0) onPhase("defense");
    else if (v === 1) onPhase("attack");
  };

  // Keep the slider in sync when the phase is set from the toggle buttons.
  useEffect(() => {
    if (phase === "attack") setBlend(1);
    else if (phase === "defense") setBlend(0);
  }, [phase]);

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
        t?.closest(".influence-ctl") ||
        t?.closest(".zone-handles") ||
        t?.closest(".pitch-toolbar")
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

  // Close a toolbar popover when clicking outside the toolbar.
  useEffect(() => {
    if (!openTool) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t?.closest(".pitch-toolbar")) setOpenTool(null);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [openTool]);

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
          ⤢
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

      <div className={`pitch-toolbar pitch-toolbar--${orient}`}>
        {phase !== "base" && (
          <div className="ptool-slider">
            <span>Déf</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={blend}
              aria-label="Transition Défense → Attaque"
              onPointerDown={() => setScrubbing(true)}
              onPointerUp={() => setScrubbing(false)}
              onChange={(e) => handleBlend(Number(e.target.value))}
            />
            <span>Att</span>
          </div>
        )}

        <div className="ptool-row">
          {phase !== "base" && (
            <div className="ptool-item">
              <button
                type="button"
                className={`ptool-btn ${influenceMode !== "none" ? "is-active" : ""}`}
                onClick={() =>
                  setOpenTool((o) => (o === "influence" ? null : "influence"))
                }
                aria-pressed={openTool === "influence"}
                title="Zones d'influence"
              >
                Zones
              </button>
              {openTool === "influence" && (
                <div className="ptool-pop">{influenceControls}</div>
              )}
            </div>
          )}

          <button
            type="button"
            className={`ptool-btn ${showGrid ? "is-active" : ""}`}
            onClick={() => setShowGrid((g) => !g)}
            aria-pressed={showGrid}
            title="Afficher la grille de position"
          >
            Grille
          </button>

          {phase !== "base" && (
            <div className="ptool-item ptool-item--opp">
              <button
                type="button"
                className={`ptool-btn ${opponentMode ? "is-active" : ""}`}
                onClick={onToggleOpponentMode}
                aria-pressed={opponentMode}
                title="Positionner les 11 adversaires"
              >
                Adv
              </button>
              {opponentMode && (
                <>
                  <button
                    type="button"
                    className="ptool-color"
                    style={{ background: opponentColor }}
                    onClick={() =>
                      setOpenTool((o) => (o === "colors" ? null : "colors"))
                    }
                    aria-label="Couleur des adversaires"
                    title="Couleur des adversaires"
                  />
                  {openTool === "colors" && (
                    <div className="ptool-pop ptool-pop--colors">
                      {OPPONENT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={`opp-swatch ${
                            c === opponentColor ? "is-active" : ""
                          }`}
                          style={{ background: c }}
                          onClick={() => {
                            onSetOpponentColor(c);
                            setOpenTool(null);
                          }}
                          aria-label={`Couleur ${c}`}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
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
