import * as THREE from 'three';
import {
  computeCameraPosition as computeCameraPositionCore,
  computeFocusDistance as computeFocusDistanceCore,
  type FocusVec3,
} from '@anatomiax/anatomy-core';

export function getWorldBoundingBox(objects: THREE.Object3D[]): THREE.Box3 {
  const box = new THREE.Box3().makeEmpty();
  for (const obj of objects) {
    obj.updateWorldMatrix(true, false);
    box.expandByObject(obj);
  }
  return box;
}

export function getWorldBoundingBoxCenter(box: THREE.Box3): THREE.Vector3 {
  if (box.isEmpty()) return new THREE.Vector3(0, 0, 0);
  return box.getCenter(new THREE.Vector3());
}

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

export function computeFocusDistance(radius: number, fovDegrees: number, padding = 1.35): number {
  return computeFocusDistanceCore(radius, fovDegrees, padding);
}

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
