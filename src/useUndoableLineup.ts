import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { Lineup } from "./types";

type Updater = Lineup | ((prev: Lineup) => Lineup);

// Lineup state with undo/redo. Rapid bursts (a token drag fires dozens of
// updates) collapse into a single history step via a debounced commit.
export function useUndoableLineup(initial: Lineup) {
  const [lineup, setRaw] = useState(initial);
  const lineupRef = useRef(initial);
  const past = useRef<Lineup[]>([]);
  const future = useRef<Lineup[]>([]);
  const checkpoint = useRef<Lineup>(initial); // last state recorded in history
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    lineupRef.current = lineup;
  }, [lineup]);

  // Record the current state as a history checkpoint (if it changed).
  const commit = useCallback(() => {
    clearTimeout(timer.current);
    const cur = lineupRef.current;
    if (cur !== checkpoint.current) {
      past.current.push(checkpoint.current);
      if (past.current.length > 100) past.current.shift();
      future.current = [];
      checkpoint.current = cur;
      bump();
    }
  }, []);

  const setLineup = useCallback(
    (updater: Updater) => {
      setRaw(updater);
      clearTimeout(timer.current);
      timer.current = setTimeout(commit, 350);
    },
    [commit],
  );

  const undo = useCallback(() => {
    commit(); // fold any pending edit into history first
    if (past.current.length === 0) return;
    future.current.push(lineupRef.current);
    const prev = past.current.pop() as Lineup;
    checkpoint.current = prev;
    lineupRef.current = prev;
    setRaw(prev);
    bump();
  }, [commit]);

  const redo = useCallback(() => {
    if (future.current.length === 0) return;
    past.current.push(lineupRef.current);
    const next = future.current.pop() as Lineup;
    checkpoint.current = next;
    lineupRef.current = next;
    setRaw(next);
    bump();
  }, []);

  // Switch to a different lineup (new compo) with a fresh history.
  const reset = useCallback((next: Lineup) => {
    clearTimeout(timer.current);
    past.current = [];
    future.current = [];
    checkpoint.current = next;
    lineupRef.current = next;
    setRaw(next);
    bump();
  }, []);

  return {
    lineup,
    setLineup,
    undo,
    redo,
    reset,
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
  };
}
