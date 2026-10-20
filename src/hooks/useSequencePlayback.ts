import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AUTOPLAY_SPEEDS } from "./useAutoplay";

// Linear playback of a sequence: a single time t (ms) advanced on rAF.
// Everything on the stage is derived from t (see sequence/engine.ts).
export function useSequencePlayback(duration: number, initial = 0) {
  const [time, setTimeRaw] = useState(initial);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<number>(1);
  const [loop, setLoop] = useState(false);

  const timeRef = useRef(initial);
  const durRef = useRef(duration);
  const loopRef = useRef(loop);
  useLayoutEffect(() => {
    durRef.current = duration;
    loopRef.current = loop;
  }, [duration, loop]);

  const setTime = useCallback((t: number) => {
    const c = Math.min(Math.max(0, t), durRef.current);
    timeRef.current = c;
    setTimeRaw(c);
  }, []);

  // Keep t inside the sequence when steps get shorter / removed.
  useEffect(() => {
    if (timeRef.current > duration) setTime(duration);
  }, [duration, setTime]);

  useEffect(() => {
    if (!playing) return;
    let last: number | null = null;
    let raf = 0;
    const tick = (now: number) => {
      if (last == null) last = now;
      const dt = (now - last) * speed;
      last = now;
      let t = timeRef.current + dt;
      if (t >= durRef.current) {
        if (loopRef.current && durRef.current > 0) t = 0;
        else {
          setTime(durRef.current);
          setPlaying(false);
          return;
        }
      }
      setTime(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, setTime]);

  const play = useCallback(() => {
    // Replay from the start when sitting at the very end.
    if (timeRef.current >= durRef.current) setTime(0);
    setPlaying(true);
  }, [setTime]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => {
    if (playing) setPlaying(false);
    else play();
  }, [playing, play]);
  const cycleSpeed = useCallback(() => {
    setSpeed((s) => {
      const i = AUTOPLAY_SPEEDS.indexOf(s as (typeof AUTOPLAY_SPEEDS)[number]);
      return AUTOPLAY_SPEEDS[(i + 1) % AUTOPLAY_SPEEDS.length];
    });
  }, []);

  return { time, setTime, playing, play, pause, toggle, speed, cycleSpeed, loop, setLoop };
}
