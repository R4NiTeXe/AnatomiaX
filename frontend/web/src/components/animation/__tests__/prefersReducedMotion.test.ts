import { act, renderHook } from '@testing-library/react';
import usePrefersReducedMotion from '../usePrefersReducedMotion';

function mockMatchMedia(
  matches: boolean,
  capture?: { handler?: (event: { matches: boolean }) => void }
) {
  const mq = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: (_type: string, handler: (event: { matches: boolean }) => void) => {
      if (capture) capture.handler = handler;
    },
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
  return jest.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList);
}

describe('usePrefersReducedMotion', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns true when the OS prefers reduced motion', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(true);
  });

  it('returns false otherwise', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
  });

  it('updates when the OS preference changes', () => {
    const state = { matches: false };
    const capture: { handler?: () => void } = {};
    const mq = {
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_type: string, handler: () => void) => {
        capture.handler = handler;
      },
      removeEventListener: () => {},
      dispatchEvent: () => false,
    };
    Object.defineProperty(mq, 'matches', {
      configurable: true,
      get: () => state.matches,
    });
    jest.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);
    state.matches = true;
    act(() => {
      capture.handler?.();
    });
    expect(result.current).toBe(true);
  });
});
