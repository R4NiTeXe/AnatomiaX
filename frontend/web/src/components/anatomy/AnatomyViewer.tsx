import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls, useBounds } from '@react-three/drei';
import { useAnatomyState } from './AnatomyStateContext';
import AnatomySystemSlot from './AnatomySystem';
import { ANATOMY_BODY_MODELS } from './anatomySystems';
import { VerticalCameraHandler } from './AnatomyVerticalNavigator';
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
  }, [resetSignal]);
  return null;
}

function AnatomySystems(): JSX.Element {
  const { visibleSystems, status, setSystemStatus, attempts, selectedBodyModel } =
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
      if (visibleSystems[asset.key] && asset.available && status[asset.key] === 'idle') {
        setSystemStatus(asset.key, 'loading');
      }
    }
  }, [visibleSystems, status, setSystemStatus, assets]);

  return (
    <>
      {assets
        .filter(asset => asset.available && visibleSystems[asset.key])
        .map(asset => (
          <AnatomySystemSlot key={`${asset.key}:${attempts[asset.key]}`} asset={asset} />
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
