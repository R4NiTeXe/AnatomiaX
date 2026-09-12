import { SLOW_LOAD_MS, createSlowNotice } from '../slowNotice';

type Timer = ReturnType<typeof setTimeout>;

function fakeHandle(id: number): Timer {
  return { __fakeTimerId: id } as unknown as Timer;
}

describe('slow-load notice (8.19.36)', () => {
  it('fires once the threshold elapses and stays silent when settled first', () => {
    expect(SLOW_LOAD_MS).toBe(8000);
    const pending = new Map<Timer, () => void>();
    let nextId = 0;
    const schedule = jest.fn((callback: () => void) => {
      nextId += 1;
      const handle = fakeHandle(nextId);
      pending.set(handle, callback);
      return handle;
    });
    const clear = jest.fn((handle: Timer) => {
      pending.delete(handle);
    });
    let fired = 0;
    const notice = createSlowNotice(
      () => {
        fired += 1;
      },
      8000,
      schedule,
      clear
    );
    notice.start();
    expect(schedule).toHaveBeenCalledWith(expect.any(Function), 8000);
    for (const callback of [...pending.values()]) callback();
    expect(fired).toBe(1);

    fired = 0;
    notice.start();
    notice.settle();
    expect(clear).toHaveBeenCalled();
    for (const callback of [...pending.values()]) callback();
    expect(fired).toBe(0);
  });

  it('restarts cleanly, replacing the previous timer', () => {
    const cleared: Timer[] = [];
    let nextId = 0;
    const notice = createSlowNotice(
      () => undefined,
      8000,
      () => {
        nextId += 1;
        return fakeHandle(nextId);
      },
      handle => {
        cleared.push(handle);
      }
    );
    notice.start();
    notice.start();
    expect(cleared).toHaveLength(1);
  });
});
