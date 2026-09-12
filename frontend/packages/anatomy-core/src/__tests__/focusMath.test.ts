import { computeCameraPosition, computeFocusDistance } from '../focusMath';

describe('computeFocusDistance', () => {
  it('scales with radius and narrows with FOV', () => {
    const dSmall = computeFocusDistance(0.1, 50, 1.35);
    const dLarge = computeFocusDistance(1.0, 50, 1.35);
    expect(dLarge).toBeGreaterThan(dSmall);
    expect(dSmall).toBeGreaterThanOrEqual(Math.max(0.1 * 3, 0.15));
    // (1 / sin(25°)) * 1.35 ≈ 3.19
    expect(computeFocusDistance(1, 50, 1.35)).toBeCloseTo(3.194, 2);
  });

  it('handles degenerate inputs finitely', () => {
    expect(computeFocusDistance(0, 50, 1.35)).toBe(0);
    expect(Number.isFinite(computeFocusDistance(0.5, 0, 1.35))).toBe(true);
    expect(Number.isFinite(computeFocusDistance(0.5, 180, 1.35))).toBe(true);
    expect(Number.isFinite(computeFocusDistance(0.5, Number.NaN, 1.35))).toBe(true);
    expect(Number.isFinite(computeFocusDistance(-1, 50, 1.35))).toBe(true);
  });
});

describe('computeCameraPosition', () => {
  const target = { x: 0, y: 1, z: 0 };

  it('moves along the existing view direction', () => {
    const pos = computeCameraPosition(target, { x: 0, y: 1, z: 5 }, { x: 0, y: 1, z: 0 }, 2);
    expect(pos.x).toBeCloseTo(0, 10);
    expect(pos.y).toBeCloseTo(1, 10);
    expect(pos.z).toBeCloseTo(2, 10);
  });

  it('falls back to +Z on degenerate direction and to target on bad distance', () => {
    const pos = computeCameraPosition(target, { x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }, 1.5);
    expect(pos).toEqual({ x: 0, y: 1, z: 1.5 });
    expect(computeCameraPosition(target, { x: 1, y: 1, z: 1 }, { x: 0, y: 0, z: 0 }, -2)).toEqual(
      target
    );
  });
});
