import { forwardRef, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import type { Player } from "../types";

interface Props {
  players: Player[]; // bench players (not on pitch)
  onAdd: (name: string, number?: number) => void;
  onRename: (playerId: string, name: string) => void;
  onSetNumber: (playerId: string, number: number | null) => void;
  onRemove: (playerId: string) => void;
  onDropToPitch: (playerId: string, point: { x: number; y: number }) => void;
  onDragStateChange?: (active: boolean) => void;
  canDrag: boolean; // roster drag only allowed in the "base" phase
  onImportCsv: () => void;
  footer?: ReactNode; // pinned section at the bottom (e.g. influence controls)
}

const Bench = forwardRef<HTMLElement, Props>(function Bench(
  {
    players,
    onAdd,
    onRename,
    onSetNumber,
    onRemove,
    onDropToPitch,
    onDragStateChange,
    canDrag,
    onImportCsv,
    footer,
  },
  ref,
) {
  const [name, setName] = useState("");
  const [num, setNum] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    const n = parseInt(num.trim(), 10);
    onAdd(v, Number.isNaN(n) ? undefined : n);
    setName("");
    setNum("");
  }

  return (
    <aside className="bench glass" ref={ref}>
      <header className="panel__header">
        <h2>Effectif</h2>
        <span className="chip">{players.length}</span>
      </header>

      <form className="bench__add" onSubmit={submit}>
        {canDrag && (
          <input
            className="bench__num"
            value={num}
            onChange={(e) =>
              setNum(e.target.value.replace(/\D/g, "").slice(0, 2))
            }
            inputMode="numeric"
            placeholder="N°"
            aria-label="Numéro (optionnel)"
          />
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ajouter un joueur…"
          aria-label="Nom du joueur"
        />
        <button type="submit" aria-label="Ajouter">
          +
        </button>
      </form>

      <button className="bench__csv" onClick={onImportCsv}>
        Importer une liste (CSV)
      </button>

      <div className="bench__list">
        {players.length === 0 && (
          <p className="bench__empty">
            Ajoute des joueurs, puis glisse-les sur le terrain.
          </p>
        )}
        {players.map((p) => (
          <BenchItem
            key={p.id}
            player={p}
            onRename={onRename}
            onSetNumber={onSetNumber}
            onRemove={onRemove}
            onDropToPitch={onDropToPitch}
            onDragStateChange={onDragStateChange}
            canDrag={canDrag}
          />
        ))}
      </div>

      {footer && <div className="bench__footer">{footer}</div>}
    </aside>
  );
});

export default Bench;

function BenchItem({
  player,
  onRename,
  onSetNumber,
  onRemove,
  onDropToPitch,
  onDragStateChange,
  canDrag,
}: {
  player: Player;
  onRename: (id: string, name: string) => void;
  onSetNumber: (id: string, number: number | null) => void;
  onRemove: (id: string) => void;
  onDropToPitch: (id: string, point: { x: number; y: number }) => void;
  onDragStateChange?: (active: boolean) => void;
  canDrag: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(player.name);
  const [numEditing, setNumEditing] = useState(false);
  const [numVal, setNumVal] = useState(
    player.number != null ? String(player.number) : "",
  );
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef({ startX: 0, startY: 0, active: false });

  function commit() {
    setEditing(false);
    const v = val.trim();
    if (v && v !== player.name) onRename(player.id, v);
    else setVal(player.name);
  }

  function commitNum() {
    setNumEditing(false);
    const n = parseInt(numVal.trim(), 10);
    onSetNumber(player.id, Number.isNaN(n) ? null : n);
  }

  // Manual pointer-drag: framer's `drag` translates the element in place, which
  // the scrollable bench list clips — so the user saw nothing leave the panel.
  // Instead we keep the chip put and float a portal "ghost" under the cursor.
  function handlePointerDown(e: React.PointerEvent) {
    if (editing || e.button !== 0 || !canDrag) return;
    drag.current = { startX: e.clientX, startY: e.clientY, active: false };

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - drag.current.startX;
      const dy = ev.clientY - drag.current.startY;
      if (!drag.current.active && Math.hypot(dx, dy) < 6) return; // threshold
      if (!drag.current.active) {
        drag.current.active = true;
        onDragStateChange?.(true);
      }
      setGhost({ x: ev.clientX, y: ev.clientY });
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (drag.current.active) {
        onDropToPitch(player.id, {
          x: ev.clientX + window.scrollX,
          y: ev.clientY + window.scrollY,
        });
        onDragStateChange?.(false);
      }
      drag.current.active = false;
      setGhost(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <motion.div
      layout
      className={`bench__item ${ghost ? "bench__item--dragging" : ""} ${
        canDrag ? "" : "bench__item--locked"
      }`}
      onPointerDown={handlePointerDown}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      {numEditing ? (
        <input
          className="bench__num"
          autoFocus
          value={numVal}
          onChange={(e) =>
            setNumVal(e.target.value.replace(/\D/g, "").slice(0, 2))
          }
          onBlur={commitNum}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitNum();
            if (e.key === "Escape") {
              setNumVal(player.number != null ? String(player.number) : "");
              setNumEditing(false);
            }
          }}
          inputMode="numeric"
          aria-label="Numéro"
        />
      ) : (
        canDrag && (
          <button
            className={`bench__numchip ${
              player.number == null ? "bench__numchip--empty" : ""
            }`}
            onClick={() => setNumEditing(true)}
            title="Numéro (optionnel)"
          >
            {player.number ?? "#"}
          </button>
        )
      )}
      {editing ? (
        <input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setVal(player.name);
              setEditing(false);
            }
          }}
        />
      ) : (
        <button className="bench__name" onClick={() => setEditing(true)}>
          {player.name}
        </button>
      )}
      <button
        className="bench__remove"
        onClick={() => onRemove(player.id)}
        aria-label="Retirer"
      >
        ×
      </button>

      {ghost &&
        createPortal(
          <div
            className="drag-ghost"
            style={{ left: ghost.x, top: ghost.y }}
          >
            <span className="bench__avatar" aria-hidden="true">
              {player.name.slice(0, 1).toUpperCase()}
            </span>
            <span className="drag-ghost__name">{player.name}</span>
          </div>,
          document.body,
        )}
    </motion.div>
  );
}
