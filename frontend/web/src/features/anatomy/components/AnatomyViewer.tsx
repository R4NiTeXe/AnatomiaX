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
  const assets = useMemo(
    () => Object.values(ANATOMY_BODY_MODELS[selectedBodyModel].systems),
    [selectedBodyModel]
  );

  useEffect(() => {
    for (const asset of assets) {
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
