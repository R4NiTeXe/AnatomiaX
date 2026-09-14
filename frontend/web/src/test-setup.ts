// Global jsdom polyfills for deterministic parallel execution.
// STEP 8.20.9.1: Canvas/ResizeObserver contention under parallel workers
// caused the /human dynamic import to exceed the 5s timeout. This setup
// runs before every test file (setupFiles) so heavy three/R3F imports do
// not race the per-test timeout window and jsdom missing APIs do not hang.

if (typeof window !== 'undefined') {
  // ResizeObserver — required by @react-three/fiber <Canvas> and drei <Bounds>
  // Original reliability test set this in beforeAll; moving to setup makes it
  // deterministic regardless of test order / worker reuse.
  if (!(window as unknown as { ResizeObserver?: unknown }).ResizeObserver) {
    class RO {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    (window as unknown as Record<string, unknown>).ResizeObserver = RO;
    (globalThis as unknown as Record<string, unknown>).ResizeObserver = RO;
  }
  if (!(globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver) {
    (globalThis as unknown as Record<string, unknown>).ResizeObserver = (
      window as unknown as Record<string, unknown>
    ).ResizeObserver;
  }

  // jsdom: HTMLCanvasElement.getContext is "Not implemented" and throws.
  // R3F/Canvas and drei probe it synchronously during import; throwing
  // inside ts-jest transform under parallel load amplified the timeout.
  // Provide a minimal stub that never throws.
  const canvasProto = (
    globalThis as unknown as { HTMLCanvasElement?: { prototype: { getContext?: unknown } } }
  ).HTMLCanvasElement?.prototype as unknown as Record<string, unknown> | undefined;
  if (canvasProto) {
    const original = canvasProto.getContext as ((...args: unknown[]) => unknown) | undefined;
    canvasProto.getContext = function (this: unknown, ...args: unknown[]) {
      if (original) {
        try {
          const result = (original as (...a: unknown[]) => unknown).apply(this, args);
          if (result) return result;
        } catch {
          // fall through to stub
        }
      }
      // Minimal WebGL-like stub — enough for fiber/drei import to succeed.
      return {
        canvas: this,
        getExtension: () => null,
        getParameter: () => null,
        getContextAttributes: () => ({}),
        isContextLost: () => false,
      } as unknown;
    } as unknown as typeof canvasProto.getContext;
  }

  // matchMedia — used by some UI libs; jsdom lacks it.
  if (!(window as unknown as { matchMedia?: unknown }).matchMedia) {
    (window as unknown as Record<string, unknown>).matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }

  // IntersectionObserver — used by drei/Bounds; stub to avoid ReferenceError.
  if (!(window as unknown as { IntersectionObserver?: unknown }).IntersectionObserver) {
    class IO {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
      takeRecords(): unknown[] {
        return [];
      }
    }
    (window as unknown as Record<string, unknown>).IntersectionObserver = IO;
    (globalThis as unknown as Record<string, unknown>).IntersectionObserver = IO;
  }
}
