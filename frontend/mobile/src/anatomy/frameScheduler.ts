/**
 * Single-slot animation-frame scheduler (8.19.36). Guarantees at most one
 * outstanding frame callback: scheduling replaces any pending callback, so a
 * focus tween can never pile up frames or degenerate into a render loop.
 * The render loop is idle whenever nothing is pending.
 */

export type FrameCallback = () => void;
export type RequestFrame = (callback: FrameCallback) => number;
export type CancelFrame = (handle: number) => void;

export interface FrameScheduler {
  schedule(callback: FrameCallback): void;
  cancel(): void;
  readonly pending: boolean;
}

export function createFrameScheduler(
  requestFrame: RequestFrame,
  cancelFrame: CancelFrame
): FrameScheduler {
  let handle: number | null = null;
  return {
    schedule(callback: FrameCallback): void {
      if (handle !== null) {
        cancelFrame(handle);
        handle = null;
      }
      handle = requestFrame(() => {
        handle = null;
        callback();
      });
    },
    cancel(): void {
      if (handle !== null) {
        cancelFrame(handle);
        handle = null;
      }
    },
    get pending(): boolean {
      return handle !== null;
    },
  };
}
