import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useBounds } from '@react-three/drei';

// ---------------------------------------------------------------------------
// Vertical camera handler — lives INSIDE <Canvas> + <Bounds>.
// Kept in its own module (separate from the DOM slider UI in
// AnatomyVerticalNavigator) because it requires a live R3F Canvas: it is
// covered by Playwright in a real browser (human-model-switch spec), not by
// jsdom unit tests.
// ---------------------------------------------------------------------------

type VerticalCameraHandlerProps = {
  normalized: number; // 0 = top, 0.5 = center, 1 = bottom
};

export function VerticalCameraHandler({ normalized }: VerticalCameraHandlerProps): null {
  const { camera, controls } = useThree() as unknown as {
    camera: THREE.PerspectiveCamera;
    controls: InstanceType<typeof import('three-stdlib').OrbitControls> & {
      target: THREE.Vector3;
      update: () => void;
    };
  };
  const api = useBounds();

  const baseCenterRef = useRef<THREE.Vector3 | null>(null);
  const basePositionRef = useRef<THREE.Vector3 | null>(null);
  const rangeRef = useRef<number>(1.5);

  // Capture base center/position and range once after initial fit
  useEffect(() => {
    const init = () => {
      try {
        const box: THREE.Box3 | null =
          (api as unknown as { getBox: () => THREE.Box3 }).getBox?.() ?? null;
        let height = 1.6;
        let centerY = 0;
        if (box && !box.isEmpty()) {
          const size = box.getSize(new THREE.Vector3());
          height = size.y;
          centerY = box.getCenter(new THREE.Vector3()).y;
        } else if ((api as unknown as { bounds?: THREE.Box3 }).bounds) {
          const b = (api as unknown as { bounds: THREE.Box3 }).bounds;
          if (b && !b.isEmpty()) {
            const size = b.getSize(new THREE.Vector3());
            height = size.y;
            centerY = b.getCenter(new THREE.Vector3()).y;
          }
        }
        // Reasonable vertical range: ~70% of body height, enough to bring head/feet to center when zoomed
        rangeRef.current = Math.max(0.8, height * 0.7);
        if (!baseCenterRef.current) {
          baseCenterRef.current = new THREE.Vector3(0, centerY, 0);
          if (controls?.target) baseCenterRef.current.copy(controls.target);
          else baseCenterRef.current.set(0, centerY, 0);
        }
        if (!basePositionRef.current && camera) {
          basePositionRef.current = camera.position.clone();
        }
      } catch {
        rangeRef.current = 1.5;
      }
    };
    // Delay to allow Bounds fit to complete
    const t = setTimeout(init, 800);
    return () => clearTimeout(t);
  }, [api, camera, controls]);

  useEffect(() => {
    if (!controls || !camera || !baseCenterRef.current || !basePositionRef.current) return;
    const offsetY = (0.5 - normalized) * rangeRef.current;
    const baseCenter = baseCenterRef.current;
    const basePos = basePositionRef.current;
    controls.target.y = baseCenter.y + offsetY;
    camera.position.y = basePos.y + offsetY;
    controls.update();
  }, [normalized, controls, camera]);

  return null;
}
