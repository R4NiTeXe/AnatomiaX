/**
 * Slow-load notice (8.19.36). Pure timer object (no React) so the threshold
 * behavior is unit-testable; the stage wires it to state.
 */

export const SLOW_LOAD_MS = 8000;

export interface SlowNotice {
  start(): void;
  settle(): void;
}

export function createSlowNotice(
  onSlow: () => void,
  thresholdMs = SLOW_LOAD_MS,
  schedule: (callback: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout,
  clear: (handle: ReturnType<typeof setTimeout>) => void = clearTimeout
): SlowNotice {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    start(): void {
      if (timer !== null) clear(timer);
      timer = schedule(onSlow, thresholdMs);
    },
    settle(): void {
      if (timer !== null) {
        clear(timer);
        timer = null;
      }
    },
  };
}
