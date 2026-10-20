import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useDismiss } from "../hooks/useDismiss";

export interface FmOption<V extends string> {
  value: V;
  label: string;
  group?: string; // optional section header shown above the first option of a group
}

interface Props<V extends string> {
  value: V;
  options: FmOption<V>[];
  onChange: (v: V) => void;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
}

// Dropdown with the same look as the formation picker ("Système", .fmselect),
// for places where a native <select> would clash with the app. The menu is
// portalled to <body> with fixed positioning so scrolling side panels
// (overflow: auto) can't clip it.
export default function FmSelect<V extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  disabled,
  className = "",
}: Props<V>) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; width: number; maxH: number; up: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const current = options.find((o) => o.value === value);

  // Place the menu under the button (or above it when there's no room).
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 220 && above > below;
    setRect({
      left: r.left,
      top: up ? r.top - 6 : r.bottom + 6,
      width: r.width,
      maxH: Math.max(140, Math.min(360, up ? above : below)),
      up,
    });
  }, [open]);

  // Close on outside click, Escape, scroll or resize; keep the active option in view.
  useDismiss(open, () => setOpen(false), [btnRef, menuRef], { floating: true });
  useEffect(() => {
    if (open) menuRef.current?.querySelector(".is-active")?.scrollIntoView({ block: "nearest" });
  }, [open, rect]);

  return (
    <div className={`fmselect fmselect--block ${className}`}>
      <button
        ref={btnRef}
        type="button"
        className="fmselect__btn"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
      >
        <span className="fmselect__value">{current?.label ?? ""}</span>
        <span className="fmselect__chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open &&
        rect &&
        createPortal(
          <ul
            ref={menuRef}
            className="fmselect__menu fmselect__menu--floating"
            role="listbox"
            aria-label={ariaLabel}
            style={{
              left: rect.left,
              width: rect.width,
              maxHeight: rect.maxH,
              ...(rect.up ? { top: "auto", bottom: window.innerHeight - rect.top } : { top: rect.top, bottom: "auto" }),
            }}
          >
            {options.map((o, i) => (
              <li key={`${o.group ?? ""}:${o.value}`}>
                {o.group && o.group !== options[i - 1]?.group && (
                  <div className="fmselect__group">{o.group}</div>
                )}
                <button
                  type="button"
                  role="option"
                  aria-selected={o.value === value}
                  className={o.value === value ? "is-active" : ""}
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
