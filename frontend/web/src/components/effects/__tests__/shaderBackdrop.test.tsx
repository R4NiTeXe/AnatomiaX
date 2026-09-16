import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ShaderBackdrop } from '../index';
import { BACKDROP_FRAGMENT } from '../atmosphereShader';

function mockReducedMotion(matches: boolean) {
  const mq = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
  return jest.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList);
}

describe('ShaderBackdrop (8.30)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('falls back to the static CSS layer when WebGL setup fails', async () => {
    // jsdom canvas has no real GL entry points, so the renderer throws and
    // the wrapper must degrade to the static fallback instead of crashing.
    mockReducedMotion(true);
    render(<ShaderBackdrop testId="fx" />);
    expect(await screen.findByTestId('fx-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('fx-canvas')).not.toBeInTheDocument();
  });

  it('renders a non-blocking decorative canvas while offscreen gating applies', () => {
    mockReducedMotion(false);
    const { container, unmount } = render(<ShaderBackdrop testId="fx" />);
    const host = screen.getByTestId('fx');
    expect(host).toHaveAttribute('aria-hidden', 'true');
    expect(host.className).toMatch(/pointer-events-none/);
    expect(screen.getByTestId('fx-canvas')).toBeInTheDocument();
    expect(container.querySelector('canvas')).not.toBeNull();
    unmount();
  });

  it('marks the reduced-motion frame as static for QA probing', async () => {
    mockReducedMotion(true);
    // Force the failure path off: patch the prototype with a minimal working
    // GL surface so the static-frame branch is what renders the canvas.
    const proto = HTMLCanvasElement.prototype as unknown as {
      getContext: (...args: unknown[]) => unknown;
    };
    const original = proto.getContext;
    const glStub = {
      createShader: () => ({}),
      shaderSource: () => {},
      compileShader: () => {},
      getShaderParameter: () => true,
      createProgram: () => ({}),
      attachShader: () => {},
      linkProgram: () => {},
      getProgramParameter: () => true,
      useProgram: () => {},
      getAttribLocation: () => 0,
      getUniformLocation: () => ({}),
      createBuffer: () => ({}),
      bindBuffer: () => {},
      bufferData: () => {},
      enableVertexAttribArray: () => {},
      vertexAttribPointer: () => {},
      uniform2f: () => {},
      uniform1f: () => {},
      clearColor: () => {},
      clear: () => {},
      drawArrays: () => {},
      getExtension: () => null,
      viewport: () => {},
      COLOR_BUFFER_BIT: 16384,
      ARRAY_BUFFER: 34962,
      STATIC_DRAW: 35044,
      FLOAT: 5126,
      VERTEX_SHADER: 35633,
      FRAGMENT_SHADER: 35632,
      COMPILE_STATUS: 35713,
      LINK_STATUS: 35714,
      TRIANGLES: 4,
    };
    proto.getContext = () => glStub;
    try {
      render(<ShaderBackdrop testId="fx" />);
      await waitFor(() => expect(screen.getByTestId('fx-canvas')).toBeInTheDocument());
      expect(screen.getByTestId('fx-canvas')).toHaveAttribute('data-static', 'true');
    } finally {
      proto.getContext = original;
    }
  });

  it('keeps the shader procedural and restrained', () => {
    expect(BACKDROP_FRAGMENT).toMatch(/precision mediump float/);
    expect(BACKDROP_FRAGMENT).toMatch(/u_resolution/);
    expect(BACKDROP_FRAGMENT).toMatch(/u_time/);
    expect(BACKDROP_FRAGMENT).toMatch(/u_intensity/);
    // No textures, no postprocessing-style kernels — procedural only.
    expect(BACKDROP_FRAGMENT).not.toMatch(/sampler|texture2D|bloom/i);
  });
});
