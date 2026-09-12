/**
 * Platform-neutral camera-focus math on plain vectors — no Three.js, no DOM.
 * Web (`anatomyFocus.ts`) and future mobile wrap these with their own
 * scene/camera types; the formulas here are the single implementation.
 */

export interface FocusVec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * Calculates suitable camera distance from a bounding sphere radius + camera FOV.
 * Uses perspective geometry: distance = (radius / sin(fov/2)) * padding.
 * Adds sensible padding so structure is clearly visible with margin.
 * Handles small/large bounds, finite outputs, and degenerate FOV.
 */
export function computeFocusDistance(radius: number, fovDegrees: number, padding = 1.35): number {
  if (!Number.isFinite(radius) || radius <= 0) return 0;
  if (!Number.isFinite(padding) || padding <= 0) padding = 1.35;
  if (!Number.isFinite(fovDegrees) || fovDegrees <= 0 || fovDegrees >= 180) {
    const fallback = radius * 2 * padding;
    return Number.isFinite(fallback) ? fallback : radius * 2;
  }
  const halfFovRad = (fovDegrees * 0.5 * Math.PI) / 180;
  const sin = Math.sin(halfFovRad);
  if (!Number.isFinite(sin) || sin <= 1e-6) {
    return radius * 2 * padding;
  }
  const distance = (radius / sin) * padding;
  if (!Number.isFinite(distance) || distance <= 0) {
    return radius * 2 * padding;
  }
  // Ensure tiny structures remain visible and avoid camera clipping inside mesh.
  const minDistance = Math.max(radius * 3, 0.15);
  return Math.max(distance, minDistance);
}

/**
 * Calculates new camera position given a target center, current camera/target,
 * and desired distance along the existing view direction.
 * Preserves direction; falls back to +Z when direction is degenerate.
 * No hardcoded anatomy coordinates — direction derived from current view.
 */
export function computeCameraPosition(
  targetCenter: FocusVec3,
  currentCameraPosition: FocusVec3,
  currentTarget: FocusVec3,
  distance: number
): FocusVec3 {
  const dx = currentCameraPosition.x - currentTarget.x;
  const dy = currentCameraPosition.y - currentTarget.y;
  const dz = currentCameraPosition.z - currentTarget.z;
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  let nx = 0;
  let ny = 0;
  let nz = 1;
  if (Number.isFinite(len) && len >= 1e-6) {
    nx = dx / len;
    ny = dy / len;
    nz = dz / len;
  }
  if (!Number.isFinite(distance) || distance <= 0) {
    return { x: targetCenter.x, y: targetCenter.y, z: targetCenter.z };
  }
  return {
    x: targetCenter.x + nx * distance,
    y: targetCenter.y + ny * distance,
    z: targetCenter.z + nz * distance,
  };
}
