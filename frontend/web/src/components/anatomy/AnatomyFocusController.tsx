import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useAnatomyState } from './AnatomyStateContext';
import {
  computeCameraPosition,
  computeFocusDistance,
  getBoundingSphereRadius,
  getWorldBoundingBox,
  getWorldBoundingBoxCenter,
} from './anatomyFocus';

type OrbitControlsLike = {
  target: THREE.Vector3;
  update: () => void;
  enabled: boolean;
};

export default function AnatomyFocusController(): null {
  const { selectedStructure, visibleSystems, getMeshesForStructure } = useAnatomyState();
  const { camera, controls } = useThree() as unknown as {
    camera: THREE.PerspectiveCamera;
    controls: OrbitControlsLike | null;
  };

  const animationRef = useRef<number | null>(null);
  const lastFocusedKeyRef = useRef<string | null>(null);

  // Expose camera/controls for real-browser E2E validation (no architecture change)
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__ANATOMIA_CAMERA = camera;
    (window as unknown as Record<string, unknown>).__ANATOMIA_CONTROLS = controls;
  }, [camera, controls]);

  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // No selection — clear last key so next selection can refocus
    if (!selectedStructure) {
      lastFocusedKeyRef.current = null;
      return;
    }

    // Do not focus hidden system
    if (!visibleSystems[selectedStructure.systemKey]) {
      return;
    }

    if (!camera || !controls) return;
    if (!(camera as THREE.PerspectiveCamera).isPerspectiveCamera) return;

    const meshes = getMeshesForStructure(selectedStructure);
    if (!meshes || meshes.length === 0) return;

    // Compute combined world-space bounds
    const box = getWorldBoundingBox(meshes);
    if (box.isEmpty()) return;

    const center = getWorldBoundingBoxCenter(box);
    const radius = getBoundingSphereRadius(box);
    if (!Number.isFinite(radius) || radius <= 0) return;

    const fov = (camera as THREE.PerspectiveCamera).fov ?? 50;
    const distance = computeFocusDistance(radius, fov, 1.35);
    if (!Number.isFinite(distance) || distance <= 0) return;
    if (!Number.isFinite(center.x) || !Number.isFinite(center.y) || !Number.isFinite(center.z))
      return;

    const startTarget = (controls as OrbitControlsLike).target.clone();
    const startPosition = camera.position.clone();
    const endTarget = center.clone();
    const endPosition = computeCameraPosition(
      center,
      camera.position,
      (controls as OrbitControlsLike).target,
      distance
    );

    if (
      !Number.isFinite(endPosition.x) ||
      !Number.isFinite(endPosition.y) ||
      !Number.isFinite(endPosition.z)
    )
      return;

    // Cancel any in-flight animation
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    lastFocusedKeyRef.current = selectedStructure.structureKey;

    // E2E observability: log focus with world-space metrics (no hardcoded coords)
    console.log(
      `[Focus] ${selectedStructure.structureKey} center ${center.x.toFixed(3)},${center.y.toFixed(3)},${center.z.toFixed(3)} radius ${radius.toFixed(3)} distance ${distance.toFixed(3)} fov ${fov}`
    );
    (window as unknown as Record<string, unknown>).__ANATOMIA_LAST_FOCUS = {
      structureKey: selectedStructure.structureKey,
      center: { x: center.x, y: center.y, z: center.z },
      radius,
      distance,
      fov,
      endTarget: { x: endTarget.x, y: endTarget.y, z: endTarget.z },
      endPosition: { x: endPosition.x, y: endPosition.y, z: endPosition.z },
      time: Date.now(),
    };

    const duration = 380;
    const startTime = performance.now();

    const animate = (now: number): void => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / duration);
      // easeInOutQuad
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

      // Interpolate target and camera position
      (controls as OrbitControlsLike).target.lerpVectors(startTarget, endTarget, eased);
      camera.position.lerpVectors(startPosition, endPosition, eased);
      (controls as OrbitControlsLike).update();

      if (t < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [selectedStructure, visibleSystems, getMeshesForStructure, camera, controls]);

  return null;
}
