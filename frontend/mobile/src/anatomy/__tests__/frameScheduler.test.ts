import { createFrameScheduler } from '../frameScheduler';

describe('frame scheduler (8.19.36)', () => {
  it('runs the scheduled callback and goes idle', () => {
    const stored: Array<() => void> = [];
    const scheduler = createFrameScheduler(
      callback => {
        stored.push(callback);
        return 1;
      },
      () => undefined
    );
    expect(scheduler.pending).toBe(false);
    let ran = 0;
    scheduler.schedule(() => {
      ran += 1;
    });
    expect(scheduler.pending).toBe(true);
    stored[0]?.();
    expect(ran).toBe(1);
    expect(scheduler.pending).toBe(false);
  });

  it('replaces a pending callback so at most one frame is outstanding', () => {
    const cancelled: number[] = [];
    let nextId = 0;
    const pending = new Map<number, () => void>();
    const scheduler = createFrameScheduler(
      callback => {
        nextId += 1;
        pending.set(nextId, callback);
        return nextId;
      },
      handle => {
        cancelled.push(handle);
        pending.delete(handle);
      }
    );
    let first = 0;
    let second = 0;
    scheduler.schedule(() => {
      first += 1;
    });
    scheduler.schedule(() => {
      second += 1;
    });
    expect(cancelled).toEqual([1]);
    expect(scheduler.pending).toBe(true);
    for (const callback of [...pending.values()]) callback();
    expect(first).toBe(0);
    expect(second).toBe(1);
    expect(scheduler.pending).toBe(false);
  });

  it('cancels cleanly, including when idle', () => {
    const cancelled: number[] = [];
    const scheduler = createFrameScheduler(
      () => 7,
      handle => {
        cancelled.push(handle);
      }
    );
    expect(() => scheduler.cancel()).not.toThrow();
    scheduler.schedule(() => undefined);
    scheduler.cancel();
    expect(cancelled).toEqual([7]);
    expect(scheduler.pending).toBe(false);
  });
});
