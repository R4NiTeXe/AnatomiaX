import { Suspense, useEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls, useBounds } from '@react-three/drei';
import { useAnatomyState } from './AnatomyStateContext';
import AnatomySystemSlot from './AnatomySystem';
import { maleAnatomyAssets } from './anatomyAssetConfig';
import { VerticalCameraHandler } from './AnatomyVerticalNavigator';

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
  const { visibleSystems, status, setSystemStatus, attempts } = useAnatomyState();

  useEffect(() => {
    for (const asset of maleAnatomyAssets) {
      if (visibleSystems[asset.key] && asset.available && status[asset.key] === 'idle') {
        setSystemStatus(asset.key, 'loading');
      }
    }
  }, [visibleSystems, status, setSystemStatus]);

  return (
    <>
      {maleAnatomyAssets
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

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true }}
      camera={{ fov: 50, position: [0, 1.2, 3.5] }}
      onPointerMissed={() => selectStructure(null)}
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
    </Canvas>
  );
}
