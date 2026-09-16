import { BACKDROP_FRAGMENT, BACKDROP_VERTEX } from './atmosphereShader';

export interface BackdropOptions {
  /** Frozen composed frame, no loop — for prefers-reduced-motion. */
  reducedMotion: boolean;
  /** 0..1 master scale for every effect term (mobile/weak-device scaling). */
  intensity: number;
}

export interface BackdropHandle {
  setPaused(paused: boolean): void;
  setIntensity(intensity: number): void;
  dispose(): void;
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('WebGL shader allocation failed');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`WebGL shader compile failed: ${log ?? 'unknown'}`);
  }
  return shader;
}

/**
 * Minimal raw-WebGL backdrop renderer (STEP 8.30).
 * One fullscreen triangle, three uniforms, zero per-frame allocations.
 * Any failure (no context, compile error, missing entry points such as the
 * jsdom test stub) throws — the React wrapper catches it and renders the
 * static CSS fallback instead. Returns null only for a missing context so
 * call sites can distinguish "unsupported" from "broken".
 */
export function createBackdropRenderer(
  canvas: HTMLCanvasElement,
  options: BackdropOptions
): BackdropHandle | null {
  let gl: WebGLRenderingContext | null = null;
  try {
    gl =
      canvas.getContext('webgl', {
        alpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: true,
        powerPreference: 'low-power',
      }) ?? (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
  } catch {
    return null;
  }
  if (!gl) return null;

  const context: WebGLRenderingContext = gl;
  const parent = canvas.parentElement;

  const vertex = compileShader(context, context.VERTEX_SHADER, BACKDROP_VERTEX);
  const fragment = compileShader(context, context.FRAGMENT_SHADER, BACKDROP_FRAGMENT);
  const program = context.createProgram();
  if (!program) throw new Error('WebGL program allocation failed');
  context.attachShader(program, vertex);
  context.attachShader(program, fragment);
  context.linkProgram(program);
  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    throw new Error('WebGL program link failed');
  }
  context.useProgram(program);

  const positionLocation = context.getAttribLocation(program, 'a_position');
  const resolutionLocation = context.getUniformLocation(program, 'u_resolution');
  const timeLocation = context.getUniformLocation(program, 'u_time');
  const intensityLocation = context.getUniformLocation(program, 'u_intensity');
  if (resolutionLocation === null || timeLocation === null || intensityLocation === null) {
    throw new Error('WebGL uniform lookup failed');
  }

  const buffer = context.createBuffer();
  context.bindBuffer(context.ARRAY_BUFFER, buffer);
  // Single fullscreen triangle — covers the viewport in 3 vertices.
  context.bufferData(
    context.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    context.STATIC_DRAW
  );
  context.enableVertexAttribArray(positionLocation);
  context.vertexAttribPointer(positionLocation, 2, context.FLOAT, false, 0, 0);

  let intensity = options.intensity;
  let paused = false;
  let rafId = 0;
  let disposed = false;
  const startTime = performance.now();

  const resize = (): void => {
    if (disposed || !parent) return;
    const rect = parent.getBoundingClientRect();
    // Cap pixel ratio: 1 on small screens, 1.5 max elsewhere.
    const dpr = Math.min(window.devicePixelRatio || 1, rect.width < 640 ? 1 : 1.5);
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      context.viewport(0, 0, width, height);
    }
  };

  const render = (timeSeconds: number): void => {
    context.uniform2f(resolutionLocation, canvas.width, canvas.height);
    context.uniform1f(timeLocation, timeSeconds);
    context.uniform1f(intensityLocation, intensity);
    context.clearColor(0, 0, 0, 0);
    context.clear(context.COLOR_BUFFER_BIT);
    context.drawArrays(context.TRIANGLES, 0, 3);
  };

  const STATIC_TIME = 6.0;

  const loop = (): void => {
    if (disposed || paused) return;
    if (document.hidden) {
      rafId = window.requestAnimationFrame(loop);
      return;
    }
    render((performance.now() - startTime) / 1000);
    rafId = window.requestAnimationFrame(loop);
  };

  const onVisibility = (): void => {
    if (disposed || paused || options.reducedMotion) return;
    window.cancelAnimationFrame(rafId);
    rafId = window.requestAnimationFrame(loop);
  };

  resize();
  const resizeObserver =
    typeof ResizeObserver !== 'undefined' && parent ? new ResizeObserver(resize) : null;
  if (resizeObserver && parent) resizeObserver.observe(parent);
  document.addEventListener('visibilitychange', onVisibility);

  if (options.reducedMotion) {
    // One composed static frame, then the GPU idles — no loop is scheduled.
    render(STATIC_TIME);
  } else {
    rafId = window.requestAnimationFrame(loop);
  }

  return {
    setPaused(next: boolean): void {
      if (paused === next || disposed) return;
      paused = next;
      window.cancelAnimationFrame(rafId);
      if (!paused && !options.reducedMotion) rafId = window.requestAnimationFrame(loop);
    },
    setIntensity(next: number): void {
      intensity = Math.min(1, Math.max(0, next));
      if (options.reducedMotion && !disposed) render(STATIC_TIME);
    },
    dispose(): void {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      resizeObserver?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      try {
        const lose = context.getExtension('WEBGL_lose_context');
        lose?.loseContext();
      } catch {
        // Context release is best-effort only.
      }
    },
  };
}
