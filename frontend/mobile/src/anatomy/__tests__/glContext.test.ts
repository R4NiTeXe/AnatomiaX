import { withHiddenWebGL1Global } from '../glContext';

describe('stage GL context helper (8.19.35)', () => {
  it('hides the v1 global during construction and restores it after', () => {
    const host = globalThis as Record<string, unknown>;
    const real = host.WebGLRenderingContext;
    class FakeV1 {}
    host.WebGLRenderingContext = FakeV1;
    try {
      let seen: string | undefined;
      withHiddenWebGL1Global(() => {
        seen = typeof (globalThis as Record<string, unknown>).WebGLRenderingContext;
      });
      expect(seen).toBe('undefined');
      expect(host.WebGLRenderingContext).toBe(FakeV1);
    } finally {
      host.WebGLRenderingContext = real;
    }
  });

  it('restores the global even when construction throws', () => {
    const host = globalThis as Record<string, unknown>;
    const real = host.WebGLRenderingContext;
    expect(() =>
      withHiddenWebGL1Global(() => {
        throw new Error('renderer boom');
      })
    ).toThrow('renderer boom');
    expect(host.WebGLRenderingContext).toBe(real);
  });
});
