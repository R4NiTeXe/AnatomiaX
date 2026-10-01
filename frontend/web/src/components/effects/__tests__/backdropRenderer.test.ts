import { createBackdropRenderer } from '../createBackdropRenderer';

function makeGL(overrides: Record<string, unknown> = {}) {
  return {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    FLOAT: 7,
    TRIANGLES: 8,
    COLOR_BUFFER_BIT: 9,
    createShader: jest.fn(() => ({})),
    shaderSource: jest.fn(),
    compileShader: jest.fn(),
    getShaderParameter: jest.fn(() => true),
    getShaderInfoLog: jest.fn(() => ''),
    deleteShader: jest.fn(),
    createProgram: jest.fn(() => ({})),
    attachShader: jest.fn(),
    linkProgram: jest.fn(),
    getProgramParameter: jest.fn(() => true),
    useProgram: jest.fn(),
    getAttribLocation: jest.fn(() => 0),
    getUniformLocation: jest.fn(() => ({})),
    createBuffer: jest.fn(() => ({})),
    bindBuffer: jest.fn(),
    bufferData: jest.fn(),
    enableVertexAttribArray: jest.fn(),
    vertexAttribPointer: jest.fn(),
    uniform2f: jest.fn(),
    uniform1f: jest.fn(),
    clearColor: jest.fn(),
    clear: jest.fn(),
    drawArrays: jest.fn(),
    viewport: jest.fn(),
    getExtension: jest.fn(() => null),
    ...overrides,
  };
}

function makeCanvas(gl: unknown) {
  const host = document.createElement('div');
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  document.body.appendChild(host);
  jest.spyOn(canvas, 'getContext').mockImplementation(() => gl as WebGLRenderingContext);
  return { host, canvas };
}

describe('createBackdropRenderer', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    jest.restoreAllMocks();
  });

  it('returns null when no WebGL context exists', () => {
    const { canvas } = makeCanvas(null);
    expect(createBackdropRenderer(canvas, { reducedMotion: false, intensity: 1 })).toBeNull();
  });

  it('returns null when getContext throws', () => {
    const host = document.createElement('div');
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    jest.spyOn(canvas, 'getContext').mockImplementation(() => {
      throw new Error('nope');
    });
    expect(createBackdropRenderer(canvas, { reducedMotion: false, intensity: 1 })).toBeNull();
  });

  it('builds the program and starts the loop', () => {
    const gl = makeGL();
    const { canvas } = makeCanvas(gl);
    const rafs: Array<() => void> = [];
    const rafSpy = jest
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        rafs.push(() => cb(16));
        return rafs.length;
      });
    const handle = createBackdropRenderer(canvas, { reducedMotion: false, intensity: 0.5 });
    expect(handle).not.toBeNull();
    expect(gl.compileShader).toHaveBeenCalledTimes(2);
    expect(gl.linkProgram).toHaveBeenCalledTimes(1);
    expect(rafSpy).toHaveBeenCalled();
    handle?.dispose();
  });

  it('renders one static frame for reduced motion without scheduling a loop', () => {
    const gl = makeGL();
    const { canvas } = makeCanvas(gl);
    const rafSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const handle = createBackdropRenderer(canvas, { reducedMotion: true, intensity: 1 });
    expect(handle).not.toBeNull();
    expect(gl.drawArrays).toHaveBeenCalledTimes(1);
    expect(rafSpy).not.toHaveBeenCalled();
    handle?.dispose();
  });

  it('pauses, resumes, adjusts intensity, and disposes idempotently', () => {
    const gl = makeGL();
    const { canvas } = makeCanvas(gl);
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 1);
    const cancelSpy = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    const handle = createBackdropRenderer(canvas, { reducedMotion: false, intensity: 1 });
    expect(handle).not.toBeNull();
    handle?.setPaused(true);
    expect(cancelSpy).toHaveBeenCalled();
    handle?.setPaused(true);
    handle?.setPaused(false);
    handle?.setIntensity(2);
    handle?.setIntensity(-1);
    expect(() => handle?.dispose()).not.toThrow();
    expect(() => handle?.dispose()).not.toThrow();
    expect(() => handle?.setPaused(true)).not.toThrow();
  });

  it('runs the render loop until paused, resumes, and reacts to visibility', () => {
    const gl = makeGL();
    const { canvas } = makeCanvas(gl);
    const queue: FrameRequestCallback[] = [];
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      queue.push(cb);
      return queue.length;
    });
    const cancelSpy = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    const draws = gl.drawArrays as jest.Mock;
    const drawsBefore = draws.mock.calls.length;
    const handle = createBackdropRenderer(canvas, { reducedMotion: false, intensity: 1 });
    expect(handle).not.toBeNull();
    queue[queue.length - 1](100);
    expect(draws.mock.calls.length).toBeGreaterThan(drawsBefore);
    const afterFrame = queue.length;
    handle?.setPaused(true);
    expect(cancelSpy).toHaveBeenCalled();
    handle?.setPaused(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(queue.length).toBeGreaterThan(afterFrame);
    handle?.dispose();
  });

  it('throws on shader compile failure', () => {
    const gl = makeGL({ getShaderParameter: jest.fn(() => false) });
    const { canvas } = makeCanvas(gl);
    expect(() => createBackdropRenderer(canvas, { reducedMotion: false, intensity: 1 })).toThrow(
      /shader compile failed/
    );
  });

  it('throws when uniforms are missing or the program cannot be created', () => {
    const noUniforms = makeGL({ getUniformLocation: jest.fn(() => null) });
    expect(() =>
      createBackdropRenderer(makeCanvas(noUniforms).canvas, {
        reducedMotion: false,
        intensity: 1,
      })
    ).toThrow(/uniform lookup failed/);
    const noProgram = makeGL({ createProgram: jest.fn(() => null) });
    expect(() =>
      createBackdropRenderer(makeCanvas(noProgram).canvas, {
        reducedMotion: false,
        intensity: 1,
      })
    ).toThrow(/program allocation failed/);
  });
});
