// @ts-nocheck
import * as THREE from 'three';
import {
  computeCameraPosition,
  computeFocusDistance,
  getBoundingSphereRadius,
  getWorldBoundingBox,
  getWorldBoundingBoxCenter,
  computeFocusMetrics,
} from '../anatomyFocus';

describe('anatomyFocus — pure focus calculation', () => {
  describe('getWorldBoundingBox / center — world-space bounds', () => {
    it('computes world-space center for single mesh at origin', () => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
      mesh.position.set(0, 0, 0);
      mesh.updateWorldMatrix(true, false);
      const box = getWorldBoundingBox([mesh]);
      const center = getWorldBoundingBoxCenter(box);
      expect(center.x).toBeCloseTo(0, 5);
      expect(center.y).toBeCloseTo(0, 5);
      expect(center.z).toBeCloseTo(0, 5);
    });

    it('computes world-space center with parent transform', () => {
      const parent = new THREE.Group();
      parent.position.set(5, 0, 0);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      mesh.position.set(1, 0, 0);
      parent.add(mesh);
      parent.updateWorldMatrix(true, true);
      const box = getWorldBoundingBox([mesh]);
      const center = getWorldBoundingBoxCenter(box);
      // Mesh world position = parent 5 + local 1 = 6
      expect(center.x).toBeCloseTo(6, 5);
      expect(center.y).toBeCloseTo(0, 5);
    });

    it('combines multiple meshes — unions bounds for shared structure', () => {
      const a = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      a.position.set(-2, 0, 0);
      const b = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
      b.position.set(2, 0, 0);
      a.updateWorldMatrix(true, false);
      b.updateWorldMatrix(true, false);
      const box = getWorldBoundingBox([a, b]);
      const center = getWorldBoundingBoxCenter(box);
      const radius = getBoundingSphereRadius(box);
      expect(center.x).toBeCloseTo(0, 5);
      expect(radius).toBeGreaterThan(2);
      // Box should span at least 4 units + half extents
      const size = box.getSize(new THREE.Vector3());
      expect(size.x).toBeGreaterThan(4);
    });

    it('returns zero center for empty box', () => {
      const box = new THREE.Box3().makeEmpty();
      const center = getWorldBoundingBoxCenter(box);
      expect(center.x).toBe(0);
      expect(center.y).toBe(0);
      expect(center.z).toBe(0);
    });
  });

  describe('computeFocusDistance — distance from radius, FOV, padding', () => {
    it('distance increases with radius', () => {
      const dSmall = computeFocusDistance(0.1, 50, 1.35);
      const dLarge = computeFocusDistance(1.0, 50, 1.35);
      expect(dLarge).toBeGreaterThan(dSmall);
      expect(Number.isFinite(dSmall)).toBe(true);
      expect(Number.isFinite(dLarge)).toBe(true);
    });

    it('FOV influences distance — larger FOV needs smaller distance', () => {
      const radius = 0.5;
      const dNarrow = computeFocusDistance(radius, 30, 1.35);
      const dWide = computeFocusDistance(radius, 90, 1.35);
      expect(dWide).toBeLessThan(dNarrow);
    });

    it('padding increases distance — more padding = further', () => {
      const radius = 0.5;
      // Use narrow FOV so minDistance does not clamp and ratio stays linear
      const d1 = computeFocusDistance(radius, 20, 1.0);
      const d2 = computeFocusDistance(radius, 20, 2.0);
      expect(d2).toBeGreaterThan(d1);
      expect(d2).toBeCloseTo(d1 * 2, 2);
    });

    it('handles small bounds — finite and above minimum', () => {
      // Very small structure like cervix fragment
      const radius = 0.02;
      const d = computeFocusDistance(radius, 50, 1.35);
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeGreaterThan(0);
      // Minimum clamp ensures visibility
      expect(d).toBeGreaterThanOrEqual(0.15);
      expect(d).toBeGreaterThan(radius * 2);
    });

    it('handles large bounds — full body', () => {
      // Large structure like skin full body
      const radius = 1.0;
      const d = computeFocusDistance(radius, 50, 1.35);
      expect(Number.isFinite(d)).toBe(true);
      expect(d).toBeGreaterThan(2);
      // Should be similar to initial camera distance ~3.5 with padding
      expect(d).toBeLessThan(6);
    });

    it('returns finite for degenerate inputs', () => {
      expect(Number.isFinite(computeFocusDistance(0.5, 0, 1.35))).toBe(true);
      expect(Number.isFinite(computeFocusDistance(0.5, 180, 1.35))).toBe(true);
      expect(Number.isFinite(computeFocusDistance(0.5, NaN, 1.35))).toBe(true);
      expect(computeFocusDistance(0, 50, 1.35)).toBe(0);
      expect(Number.isFinite(computeFocusDistance(-1, 50, 1.35))).toBe(true);
    });

    it('all computed distances are finite', () => {
      for (const r of [0.01, 0.1, 0.5, 1.5]) {
        for (const f of [30, 50, 75]) {
          for (const p of [1.2, 1.35, 1.5]) {
            const d = computeFocusDistance(r, f, p);
            expect(Number.isFinite(d)).toBe(true);
            expect(d).toBeGreaterThan(0);
          }
        }
      }
    });
  });

  describe('computeCameraPosition — world-space target', () => {
    it('positions camera along existing view direction', () => {
      const target = new THREE.Vector3(1, 0, 0);
      const camPos = new THREE.Vector3(1, 0, 5);
      const controlsTarget = new THREE.Vector3(1, 0, 0);
      const newPos = computeCameraPosition(target, camPos, controlsTarget, 2);
      // Direction was +Z, so newPos = target + (0,0,1)*2
      expect(newPos.x).toBeCloseTo(1, 5);
      expect(newPos.y).toBeCloseTo(0, 5);
      expect(newPos.z).toBeCloseTo(2, 5);
    });

    it('preserves direction from camera to target', () => {
      const target = new THREE.Vector3(0, 0, 0);
      const camPos = new THREE.Vector3(0, 1, 3);
      const ctrl = new THREE.Vector3(0, 0, 0);
      const dir = new THREE.Vector3().subVectors(camPos, ctrl).normalize();
      const distance = 2;
      const newPos = computeCameraPosition(target, camPos, ctrl, distance);
      const expected = target.clone().addScaledVector(dir, distance);
      expect(newPos.distanceTo(expected)).toBeLessThan(1e-6);
    });

    it('returns finite camera values', () => {
      const target = new THREE.Vector3(0.5, -0.2, 1.1);
      const camPos = new THREE.Vector3(0, 1.2, 3.5);
      const ctrl = new THREE.Vector3(0, 0, 0);
      const pos = computeCameraPosition(target, camPos, ctrl, 1.5);
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
      expect(Number.isFinite(pos.z)).toBe(true);
    });

    it('handles degenerate direction (camera == target)', () => {
      const target = new THREE.Vector3(0, 0, 0);
      const camPos = new THREE.Vector3(0, 0, 0);
      const ctrl = new THREE.Vector3(0, 0, 0);
      const pos = computeCameraPosition(target, camPos, ctrl, 1);
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(pos.z).toBeCloseTo(1, 5);
    });
  });

  describe('computeFocusMetrics — integration', () => {
    it('produces finite center/radius/distance for arbitrary box', () => {
      const box = new THREE.Box3(
        new THREE.Vector3(-0.1, -0.1, -0.1),
        new THREE.Vector3(0.1, 0.1, 0.1)
      );
      const { center, radius, distance } = computeFocusMetrics(box, 50, 1.35);
      expect(Number.isFinite(center.x)).toBe(true);
      expect(Number.isFinite(radius)).toBe(true);
      expect(Number.isFinite(distance)).toBe(true);
      expect(radius).toBeGreaterThan(0);
      expect(distance).toBeGreaterThan(radius);
    });

    it('handles parent-transformed meshes', () => {
      const parent = new THREE.Group();
      parent.position.set(0, 1, 0);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.2));
      parent.add(mesh);
      parent.updateWorldMatrix(true, true);
      const box = getWorldBoundingBox([mesh]);
      const { center, radius, distance } = computeFocusMetrics(box, 50, 1.35);
      expect(center.y).toBeCloseTo(1, 5);
      expect(Number.isFinite(distance)).toBe(true);
    });
  });

  describe('no hardcoded anatomy coordinates', () => {
    it('source does not contain hardcoded heart/ovary coordinates', () => {
      // This test ensures the implementation uses world-space bounds, not literals.
      // We check that the pure function works for arbitrary inputs, not specific anatomy.
      const arbitraryBox1 = new THREE.Box3(
        new THREE.Vector3(10, 20, 30),
        new THREE.Vector3(11, 21, 31)
      );
      const arbitraryBox2 = new THREE.Box3(
        new THREE.Vector3(-5, -5, -5),
        new THREE.Vector3(-4, -4, -4)
      );
      const m1 = computeFocusMetrics(arbitraryBox1, 50, 1.35);
      const m2 = computeFocusMetrics(arbitraryBox2, 50, 1.35);
      expect(m1.center.x).not.toBeCloseTo(m2.center.x, 2);
      expect(Number.isFinite(m1.distance)).toBe(true);
      expect(Number.isFinite(m2.distance)).toBe(true);
      // Ensure padding and FOV affect output, not hardcoded values
      const mNoPad = computeFocusMetrics(arbitraryBox1, 50, 1.0);
      const mPad = computeFocusMetrics(arbitraryBox1, 50, 2.0);
      expect(mPad.distance).toBeGreaterThan(mNoPad.distance);
    });

    it('anatomyFocus source contains no literal heart/ovary positions', () => {
      const fs = require('fs');
      const path = require('path');
      // Resolve via __dirname relative to test file location
      let src = '';
      try {
        const p = path.join(__dirname, '../anatomyFocus.ts');
        src = fs.readFileSync(p, 'utf8');
      } catch {
        // Fallback to require.resolve
        src = fs.readFileSync(require.resolve('../anatomyFocus'), 'utf8');
      }
      // Check for suspicious hardcoded vectors that would imply anatomy coordinates
      // We allow generic constants like 0,1,1.35 etc but not specific anatomy coords
      expect(src).not.toMatch(/heart/i);
      expect(src).not.toMatch(/ovary/i);
      expect(src).not.toMatch(/cervix/i);
      expect(src).not.toMatch(/VH_M_heart/);
      expect(src).not.toMatch(/VH_F_ovary/);
      // Ensure it uses Box3 / bounding sphere / FOV — not literals
      expect(src).toMatch(/Box3/);
      expect(src).toMatch(/getBoundingSphere|computeFocusDistance/);
      expect(src).toMatch(/fov/i);
    });
  });
});
