import { evaluateSpike, formatDuration } from '../spikeReport';

describe('spike verdict (8.19.29)', () => {
  it('is GO only when every gate passes', () => {
    const verdict = evaluateSpike({
      webgl2: true,
      rendererCreated: true,
      decoded: true,
      rendered: true,
      disposed: true,
    });
    expect(verdict.gate).toBe('GO');
    expect(verdict.reasons).toHaveLength(5);
  });

  it('is NO-GO when any gate fails', () => {
    expect(
      evaluateSpike({
        webgl2: false,
        rendererCreated: true,
        decoded: true,
        rendered: true,
        disposed: true,
      }).gate
    ).toBe('NO-GO');
    expect(
      evaluateSpike({
        webgl2: true,
        rendererCreated: true,
        decoded: false,
        rendered: false,
        disposed: false,
      }).gate
    ).toBe('NO-GO');
  });

  it('is NO-GO on fatal architecture-invalidating failures', () => {
    const verdict = evaluateSpike({ fatal: 'three-stdlib incompatible with Hermes' });
    expect(verdict.gate).toBe('NO-GO');
    expect(verdict.reasons.join(' ')).toContain('three-stdlib incompatible with Hermes');
  });

  it('is INCOMPLETE while gates are still pending', () => {
    const verdict = evaluateSpike({ webgl2: true, rendererCreated: true });
    expect(verdict.gate).toBe('INCOMPLETE');
    expect(verdict.reasons.join(' ')).toContain('Asset renders');
  });

  it('formats durations without leaking internals', () => {
    expect(formatDuration(250)).toBe('250ms');
    expect(formatDuration(2500)).toBe('2.50s');
    expect(formatDuration(Number.NaN)).toBe('n/a');
  });
});
