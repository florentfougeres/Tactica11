import { useEffect, useState, type RefObject } from "react";
import type { FrameLayout } from "../sequence/layout";

// Editor-only zoom / pan of the stage inside its wrapper (independent from the
// step camera): fits the frame, then zooms around a point.
export function useStageView(wrapRef: RefObject<HTMLDivElement | null>, L: FrameLayout) {
  const [wrapSize, setWrapSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWrapSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setWrapSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, [wrapRef]);
  const [viewZoom, setViewZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const fit = wrapSize.w ? Math.min(wrapSize.w / L.W, wrapSize.h / L.H) * 0.97 : 0.3;
  const scale = fit * viewZoom;
  const offX = (wrapSize.w - L.W * scale) / 2 + pan.x;
  const offY = (wrapSize.h - L.H * scale) / 2 + pan.y;
  const resetView = () => {
    setViewZoom(1);
    setPan({ x: 0, y: 0 });
  };
  const zoomViewAt = (factor: number, cx?: number, cy?: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return;
    const px = cx != null ? cx - r.left : r.width / 2;
    const py = cy != null ? cy - r.top : r.height / 2;
    const z1 = Math.min(6, Math.max(0.5, viewZoom * factor));
    const s0 = scale;
    const s1 = fit * z1;
    const fx = (px - offX) / s0;
    const fy = (py - offY) / s0;
    setViewZoom(z1);
    setPan({
      x: px - (wrapSize.w - L.W * s1) / 2 - fx * s1,
      y: py - (wrapSize.h - L.H * s1) / 2 - fy * s1,
    });
  };


  return { wrapSize, viewZoom, pan, setPan, scale, offX, offY, resetView, zoomViewAt };
}
