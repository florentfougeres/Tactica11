import { forwardRef, useEffect, useRef, useState } from "react";
import type { Phase, Player, Slot } from "../types";
import PitchMarkings from "./PitchMarkings";
import PhaseToggle from "./PhaseToggle";
import PitchToken, { TOKEN_SIZE } from "./PitchToken";
import HeatmapOverlay from "./HeatmapOverlay";

interface Props {
  slots: Slot[];
  phase: Phase;
  playerById: (id: string | null) => Player | null;
  selectedSlot: string | null;
  dropActive?: boolean;
  onPhase: (phase: Phase) => void;
  onSelect: (slotId: string | null) => void;
  onMove: (slotId: string, pos: { x: number; y: number }) => void;
  onPlayerDrop: (slotId: string, point: { x: number; y: number }) => void;
  onRemoveStarter: (slotId: string) => void;
  onRemoveSub: (slotId: string) => void;
  onSwap: (slotId: string) => void;
}

const Pitch = forwardRef<HTMLDivElement, Props>(function Pitch(
  {
    slots,
    phase,
    playerById,
    selectedSlot,
    dropActive,
    onPhase,
    onSelect,
    onMove,
    onPlayerDrop,
    onRemoveStarter,
    onRemoveSub,
    onSwap,
  },
  ref,
) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // True while a token is being dragged — lets the token escape the pitch's
  // overflow:hidden (e.g. when dragging onto the bench) and float above it.
  const [tokenDragging, setTokenDragging] = useState(false);
  // Influence-heatmap view (attack/defense only) + live centre while dragging.
  const [influenceOn, setInfluenceOn] = useState(false);
  const [liveCenter, setLiveCenter] = useState<{ x: number; y: number } | null>(
    null,
  );

  const showInfluence = phase !== "base" && influenceOn;

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

  // Close the popover on any click outside it (and outside the filled tokens,
  // so tapping another token re-selects instead of just closing), or Escape.
  useEffect(() => {
    if (!selectedSlot) return;
    function onDown(e: PointerEvent) {
      const t = e.target as HTMLElement | null;
      if (
        t?.closest(".slot-pop") ||
        t?.closest(".token--filled") ||
        t?.closest(".influence-switch")
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
    <div className="pitch-col">
      <div className="pitch-bar">
        <PhaseToggle phase={phase} onPhase={onPhase} />
      </div>

      <div
        className={`pitch-wrap ${tokenDragging ? "pitch-wrap--dragging" : ""}`}
        ref={ref}
      >
        <div
          className={`pitch ${dropActive ? "pitch--drop" : ""} ${
            tokenDragging ? "pitch--dragging" : ""
          }`}
          ref={innerRef}
        >
          <div className="pitch__grass" />
          <PitchMarkings />

          {showInfluence && selected && selectedStarter && size.w > 0 && (
            <HeatmapOverlay
              cx={liveCenter ? liveCenter.x : (selected.positions[phase].x / 100) * size.w}
              cy={liveCenter ? liveCenter.y : (selected.positions[phase].y / 100) * size.h}
              size={size}
            />
          )}

        {dropActive && (
          <div className="pitch__drop-hint">Dépose le joueur sur un poste</div>
        )}

        {size.w > 0 &&
          slots.map((slot) => (
            <PitchToken
              key={slot.id}
              slot={slot}
              starter={playerById(slot.starterId)}
              sub={playerById(slot.subId)}
              phase={phase}
              size={size}
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
            onRemoveStarter={onRemoveStarter}
            onRemoveSub={onRemoveSub}
            onSwap={onSwap}
          />
        )}
        </div>
      </div>

      <div className="pitch-foot">
        {phase === "base" ? (
          <span className="pitch__hint">
            Glisse les joueurs entre postes et effectif
          </span>
        ) : (
          <label className="influence-switch">
            <span>Zones d'influence</span>
            <span className="switch">
              <input
                type="checkbox"
                checked={influenceOn}
                onChange={(e) => setInfluenceOn(e.target.checked)}
              />
              <span className="switch__track" />
              <span className="switch__thumb" />
            </span>
          </label>
        )}
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
  onRemoveStarter,
  onRemoveSub,
  onSwap,
}: {
  slot: Slot;
  starter: Player;
  sub: Player | null;
  size: { w: number; h: number };
  phase: Phase;
  onRemoveStarter: (slotId: string) => void;
  onRemoveSub: (slotId: string) => void;
  onSwap: (slotId: string) => void;
}) {
  const pos = slot.positions[phase];
  const cx = (pos.x / 100) * size.w;
  const cy = (pos.y / 100) * size.h;
  // Place the popover below the token, flipping above near the bottom edge.
  const below = cy < size.h - 150;
  const top = below ? cy + TOKEN_SIZE / 2 + 18 : cy - TOKEN_SIZE / 2 - 18;

  // Outer wrapper owns positioning (so framer-motion's transform on the inner
  // node doesn't clobber our centring translate).
  return (
    <div
      className="slot-pop-anchor"
      style={{
        left: cx,
        top,
        transform: `translate(-50%, ${below ? "0" : "-100%"})`,
      }}
    >
      <div className="slot-pop glass" onPointerDown={(e) => e.stopPropagation()}>
      <div className="slot-pop__row">
        <span className="slot-pop__tag slot-pop__tag--starter">Titulaire</span>
        <span className="slot-pop__name">{starter.name}</span>
        <button
          className="slot-pop__btn"
          onClick={() => onRemoveStarter(slot.id)}
          title="Renvoyer au vivier"
        >
          ↩
        </button>
      </div>

      {sub ? (
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
      ) : (
        <div className="slot-pop__hint">
          Glisse un 2ᵉ joueur ici pour un remplaçant.
        </div>
      )}
      </div>
    </div>
  );
}
