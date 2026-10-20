import { useEffect, useRef, type RefObject } from "react";

interface Options {
  // Also close when the page scrolls (except inside one of the refs, e.g. a
  // scrollable menu) or the window is resized: for menus positioned with
  // `position: fixed`, which would otherwise float away from their button.
  floating?: boolean;
}

// Shared behaviour of every popover / dropdown: while `open`, a pointer down
// outside all of `refs` or Escape calls `close`.
export function useDismiss(
  open: boolean,
  close: () => void,
  refs: RefObject<HTMLElement | null>[],
  { floating = false }: Options = {},
) {
  const closeRef = useRef(close);
  const refsRef = useRef(refs);
  useEffect(() => {
    closeRef.current = close;
    refsRef.current = refs;
  });

  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) => refsRef.current.some((r) => r.current?.contains(t as Node));
    const onDown = (e: PointerEvent) => {
      if (!inside(e.target)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    const onScroll = (e: Event) => {
      if (!inside(e.target)) closeRef.current();
    };
    const onResize = () => closeRef.current();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    if (floating) {
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", onResize);
    }
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, floating]);
}
