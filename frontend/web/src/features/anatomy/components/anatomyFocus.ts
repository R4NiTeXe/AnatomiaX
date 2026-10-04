import * as THREE from 'three';
import {
  computeCameraPosition as computeCameraPositionCore,
  computeFocusDistance as computeFocusDistanceCore,
  type FocusVec3,
} from '@anatomiax/anatomy-core';

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
 * Delegates to the single @anatomiax/anatomy-core implementation.
 */
export function computeFocusDistance(radius: number, fovDegrees: number, padding = 1.35): number {
  return computeFocusDistanceCore(radius, fovDegrees, padding);
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
 * Delegates to the single @anatomiax/anatomy-core implementation.
 */
export function computeCameraPosition(
  targetCenter: THREE.Vector3,
  currentCameraPosition: THREE.Vector3,
  currentTarget: THREE.Vector3,
  distance: number
): THREE.Vector3 {
  const toVec = (v: THREE.Vector3): FocusVec3 => ({ x: v.x, y: v.y, z: v.z });
  const result = computeCameraPositionCore(
    toVec(targetCenter),
    toVec(currentCameraPosition),
    toVec(currentTarget),
    distance
  );
  return new THREE.Vector3(result.x, result.y, result.z);
}
