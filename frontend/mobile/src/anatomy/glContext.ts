import * as THREE from 'three';

/**
 * GL context helpers (8.19.35). The expo-gl context object satisfies BOTH the
 * WebGLRenderingContext and WebGL2RenderingContext shims, so three r163+
 * refuses it as "WebGL 1". Hiding the v1 global during construction lets the
 * WebGL2 path through (three hardcodes capabilities.isWebGL2 afterwards).
 * Proven by the 8.19.29–31 spike.
 */

/** Runs `fn` with the WebGL1 global hidden, then restores it (even on throw). */
export function withHiddenWebGL1Global<T>(fn: () => T): T {
  const host = globalThis as Record<string, unknown>;
  const real = host.WebGLRenderingContext;
  host.WebGLRenderingContext = undefined;
  try {
    return fn();
  } finally {
    host.WebGLRenderingContext = real;
  }
}

/** Minimal canvas stub — three only needs size + listener hooks here. */
export function createStageRenderer(
  gl: unknown,
  drawingBufferWidth: number,
  drawingBufferHeight: number
): THREE.WebGLRenderer {
  const canvasStub = {
    width: drawingBufferWidth,
    height: drawingBufferHeight,
    style: {},
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    getContext: () => gl,
  };
  return withHiddenWebGL1Global(
    () =>
      new THREE.WebGLRenderer({
        context: gl as unknown as WebGLRenderingContext,
        canvas: canvasStub as unknown as HTMLCanvasElement,
        antialias: true,
      })
  );
}
