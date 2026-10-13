/**
 * A tiny in-memory signal for stamp presses, so scene effects (the living office, ink marks,
 * combo text) can react to a stamp without the stamp button knowing about each of them.
 */
export interface StampEvent {
  /** A golden stamp paid ten times the click power. */
  golden: boolean;
  /** Taps in the current combo, 1 for a lone stamp. */
  combo: number;
}

type Listener = (e: StampEvent) => void;
const listeners = new Set<Listener>();

export function onStamp(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function emitStamp(e: StampEvent): void {
  for (const fn of listeners) fn(e);
}
