import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useBounds } from '@react-three/drei';

type VerticalCameraHandlerProps = {
  normalized: number;
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
