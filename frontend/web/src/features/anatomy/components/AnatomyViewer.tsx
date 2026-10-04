import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls, useBounds } from '@react-three/drei';
import { useAnatomyState } from './AnatomyStateContext';
import AnatomySystemSlot from './AnatomySystem';
import { ANATOMY_BODY_MODELS } from './anatomySystems';
import { VerticalCameraHandler } from './VerticalCameraHandler';
import AnatomyFocusController from './AnatomyFocusController';

function FitController({ resetSignal }: { resetSignal: number }): null {
  const api = useBounds();
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    api.refresh().fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fit on resetSignal only; api identity is not semantic
  }, [resetSignal]);
  return null;
}

function AnatomySystems(): JSX.Element {
  const { visibleSystems, status, setSystemStatus, attempts, selectedBodyModel, hasSystemScene } =
    useAnatomyState();
  // STEP 8.20.9: memoize asset list — Object.values() creates a new array
  // every render, which previously retriggered the status effect on each
  // hover/selection update. Stable reference limits effect runs to real changes.
  const assets = useMemo(
    () => Object.values(ANATOMY_BODY_MODELS[selectedBodyModel].systems),
    [selectedBodyModel]
  );

  useEffect(() => {
    for (const asset of assets) {
      // STEP 8.45: skip systems whose scene already arrived (same commit as
      // a model-switch reset). Marking them 'loading' here would clobber the
      // mount's 'loaded' with a stale read and strand cached scenes forever.
      if (
        visibleSystems[asset.key] &&
        asset.available &&
        status[asset.key] === 'idle' &&
        !hasSystemScene(asset.key)
      ) {
        setSystemStatus(asset.key, 'loading');
      }
    }
  }, [visibleSystems, status, setSystemStatus, assets, hasSystemScene]);

  return (
    <>
      {assets
        .filter(asset => asset.available && visibleSystems[asset.key])
        .map(asset => (
          // STEP 8.45: identity includes the body model so each model gets a
          // deterministic remount. Reusing one slot instance across an
          // asset-path change left the mount effect with an unchanged
          // [scene, asset.key] identity on cached scenes, so 'loaded' never
          // re-fired after a switch-back.
          <AnatomySystemSlot
            key={`${selectedBodyModel}:${asset.key}:${attempts[asset.key]}`}
            asset={asset}
          />
        ))}
    </>
  );
}

type AnatomyViewerProps = {
  resetSignal: number;
  vertical: number;
};

export default function AnatomyViewer({ resetSignal, vertical }: AnatomyViewerProps): JSX.Element {
  const { selectStructure } = useAnatomyState();
  // STEP 8.20.9: stable miss handler avoids recreating Canvas props on every
  // context update (hover/selection). Canvas frameloop stays default "always":
  // OrbitControls damping, Bounds observe, and the 380ms focus animation all
  // require continuous frames; demand mode would need manual invalidate()
  // wiring across controls/focus/highlight and risks freezing required motion.
  const handlePointerMissed = useCallback(() => selectStructure(null), [selectStructure]);

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{ fov: 50, position: [0, 1.2, 3.5] }}
      onPointerMissed={handlePointerMissed}
      style={{ touchAction: 'none' }}
    >
      <color attach="background" args={['#0b1220']} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, 5, 4]} intensity={1.1} />
      <directionalLight position={[-4, -2, -3]} intensity={0.35} />
      <Bounds fit clip observe margin={1.15}>
        <FitController resetSignal={resetSignal} />
        <VerticalCameraHandler normalized={vertical} />
        <Suspense fallback={null}>
          <AnatomySystems />
        </Suspense>
      </Bounds>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableZoom
        enableRotate
        panSpeed={1.6}
      />
      <AnatomyFocusController />
    </Canvas>
  );
}
