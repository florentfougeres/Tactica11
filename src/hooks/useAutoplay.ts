import { useCallback, useEffect, useRef, useState } from "react";

// Hands-free "walkthrough" for a 0..1 blend slider (défense↔attaque, or a
// set piece's début↔fin): once playing, pings back and forth between the two
// ends on its own so a coach can talk through the shape without touching the
// slider. Any manual drag on the slider should call `stop()` to hand control
// back. A full 0→1 sweep takes SWEEP_S seconds at speed=1.
const SWEEP_S = 2.5;
export const AUTOPLAY_SPEEDS = [0.5, 1, 1.5, 2] as const;

export function useAutoplay(value: number, onChange: (v: number) => void) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);

  const dirRef = useRef<1 | -1>(1);
  const valueRef = useRef(value);
  const lastRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  valueRef.current = value;

  useEffect(() => {
    if (!playing) {
      lastRef.current = null;
      return;
    }
    // Head toward whichever end is farther, so resuming near an edge doesn't
    // immediately bounce back.
    dirRef.current = valueRef.current >= 1 ? -1 : valueRef.current <= 0 ? 1 : dirRef.current;

    const tick = (t: number) => {
      if (lastRef.current == null) lastRef.current = t;
      const dt = (t - lastRef.current) / 1000;
      lastRef.current = t;
      let v = valueRef.current + (dirRef.current * dt * speed) / SWEEP_S;
      if (v >= 1) {
        v = 1;
        dirRef.current = -1;
      } else if (v <= 0) {
        v = 0;
        dirRef.current = 1;
      }
      onChange(v);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // onChange is a fresh closure each render (App state setters) — only
    // playing/speed should restart the loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed]);

  const stop = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const cycleSpeed = useCallback(() => {
    setSpeed((s) => {
      const i = AUTOPLAY_SPEEDS.indexOf(s as (typeof AUTOPLAY_SPEEDS)[number]);
      return AUTOPLAY_SPEEDS[(i + 1) % AUTOPLAY_SPEEDS.length];
    });
  }, []);

  return { playing, toggle, stop, speed, cycleSpeed };
}
