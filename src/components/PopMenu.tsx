// Button opening a small floating menu (portalled, fixed, so a scrolling
// panel or the top bar can't clip it). Clicking an item closes it, except
// inside [data-keep].
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDismiss } from "../hooks/useDismiss";
import Icon from "./Icon";

interface Props {
  button: ReactNode;
  title: string;
  className: string;
  active?: boolean;
  chevron?: boolean;
  align?: "left" | "right";
  children: ReactNode;
}

const MENU_W = 220;

type Pos = { top: number; left?: number; right?: number };

export default function PopMenu({ button, title, className, active, chevron = true, align = "left", children }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Pos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    // Right-aligned menus are anchored by their right edge, so a menu wider
    // than expected still opens under its button instead of off-screen.
    if (align === "right") setPos({ right: Math.max(8, window.innerWidth - r.right), top: r.bottom + 6 });
    else setPos({ left: Math.max(8, Math.min(r.left, window.innerWidth - MENU_W)), top: r.bottom + 6 });
  }, [open, align]);
  useDismiss(open, () => setOpen(false), [btnRef, menuRef], { floating: true });
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={`${className} ${active ? "is-active" : ""}`}
        onClick={() => setOpen((o) => !o)}
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {button}
        {chevron && <i className="seq-tool__chev" aria-hidden="true"><Icon name="chevron-down" size={12} /></i>}
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="seq-menu"
            role="menu"
            style={pos}
            onClick={(e) => {
              if (!(e.target as HTMLElement).closest("[data-keep]")) setOpen(false);
            }}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
