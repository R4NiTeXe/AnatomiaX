if (typeof window !== 'undefined') {
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
          // best-effort: fall through to the stub context below
        }
      }
      return {
        canvas: this,
        getExtension: () => null,
        getParameter: () => null,
        getContextAttributes: () => ({}),
        isContextLost: () => false,
      } as unknown;
    } as unknown as typeof canvasProto.getContext;
  }

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
