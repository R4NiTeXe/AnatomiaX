import * as THREE from 'three';

/**
 * Computes world-space bounding box for a set of objects.
 * Ensures world matrices are up to date before expansion.
 * Pure geometry helper — no anatomy semantics, no hardcoded coordinates.
 */
export function getWorldBoundingBox(objects: THREE.Object3D[]): THREE.Box3 {
  const box = new THREE.Box3().makeEmpty();
  for (const obj of objects) {
    obj.updateWorldMatrix(true, false);
    box.expandByObject(obj);
  }
  return box;
}

/**
 * Derives a world-space center from a Box3.
 * Returns zero vector when box is empty.
 */
export function getWorldBoundingBoxCenter(box: THREE.Box3): THREE.Vector3 {
  if (box.isEmpty()) return new THREE.Vector3(0, 0, 0);
  return box.getCenter(new THREE.Vector3());
}

/**
 * Computes bounding sphere radius for a Box3.
 * Returns 0 for empty boxes.
 */
export function getBoundingSphereRadius(box: THREE.Box3): number {
  if (box.isEmpty()) return 0;
  const sphere = new THREE.Sphere();
  box.getBoundingSphere(sphere);
  if (!Number.isFinite(sphere.radius) || sphere.radius <= 0) {
    const size = box.getSize(new THREE.Vector3());
    return size.length() * 0.5;
  }
  return sphere.radius;
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
  const halfFovRad = THREE.MathUtils.degToRad(fovDegrees * 0.5);
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
 * Combines center + distance calculation for a focus operation.
 * Pure — no side effects, no hardcoded anatomy coordinates.
 */
export function computeFocusMetrics(
  box: THREE.Box3,
  fovDegrees: number,
  padding = 1.35
): { center: THREE.Vector3; radius: number; distance: number } {
  const center = getWorldBoundingBoxCenter(box);
  const radius = getBoundingSphereRadius(box);
  const distance = computeFocusDistance(radius, fovDegrees, padding);
  return { center, radius, distance };
}

/**
 * Calculates new camera position given a target center, current camera/target,
 * and desired distance along the existing view direction.
 * Preserves direction; falls back to +Z when direction is degenerate.
 * No hardcoded anatomy coordinates — direction derived from current view.
 */
export function computeCameraPosition(
  targetCenter: THREE.Vector3,
  currentCameraPosition: THREE.Vector3,
  currentTarget: THREE.Vector3,
  distance: number
): THREE.Vector3 {
  const dir = new THREE.Vector3().subVectors(currentCameraPosition, currentTarget);
  const len = dir.length();
  if (!Number.isFinite(len) || len < 1e-6) {
    dir.set(0, 0, 1);
  } else {
    dir.divideScalar(len);
  }
  if (!Number.isFinite(distance) || distance <= 0) {
    return targetCenter.clone();
  }
  return new THREE.Vector3().copy(targetCenter).addScaledVector(dir, distance);
}
