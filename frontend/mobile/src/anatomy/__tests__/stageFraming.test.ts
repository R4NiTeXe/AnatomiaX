import { frameSelection } from '../stageFraming';

describe('stage framing (8.19.35)', () => {
  it('frames along the current view direction at a sane distance', () => {
    const framing = frameSelection({
      center: { x: 0, y: 1, z: 0 },
      radius: 0.5,
      fovDegrees: 50,
      cameraPosition: { x: 0, y: 1, z: 5 },
      controlsTarget: { x: 0, y: 1, z: 0 },
    });
    expect(framing.distance).toBeGreaterThan(1.5);
    expect(framing.position.x).toBeCloseTo(0, 8);
    expect(framing.position.y).toBeCloseTo(1, 8);
    expect(framing.position.z).toBeCloseTo(0 + framing.distance, 8);
  });

  it('handles degenerate inputs without NaN', () => {
    const framing = frameSelection({
      center: { x: 1, y: 2, z: 3 },
      radius: 0,
      fovDegrees: 50,
      cameraPosition: { x: 1, y: 2, z: 3 },
      controlsTarget: { x: 1, y: 2, z: 3 },
    });
    expect(Number.isFinite(framing.distance)).toBe(true);
    expect(Number.isFinite(framing.position.x)).toBe(true);
  });
});
