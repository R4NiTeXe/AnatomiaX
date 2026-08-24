import { Suspense, Component, type ReactNode, lazy } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import TestObject from './TestObject';
import CameraControls from './CameraControls';
import LoadingState from './LoadingState';
import ModelError from './ModelError';
import { getAnatomyAsset } from './anatomyAssets';
import type { AnatomyModelKey } from './anatomyAssets';

const AnatomyModel = lazy(() => import('./AnatomyModel'));

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class CanvasErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

type ModelAreaProps = {
  selectedModel: AnatomyModelKey | null;
};

function ModelArea({ selectedModel }: ModelAreaProps): JSX.Element {
  if (!selectedModel) {
    return <TestObject />;
  }

  const asset = getAnatomyAsset(selectedModel);

  if (!asset || !asset.available) {
    return <TestObject />;
  }

  return (
    <CanvasErrorBoundary fallback={<ModelError message="Selected model is not yet available." />}>
      <Suspense
        fallback={
          <mesh>
            <boxGeometry args={[0.1, 0.1, 0.1]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
        }
      >
        <AnatomyModel asset={asset} />
      </Suspense>
    </CanvasErrorBoundary>
  );
}

function Scene({ selectedModel }: { selectedModel: AnatomyModelKey | null }): JSX.Element {
  return (
    <>
      <color attach="background" args={['#0b1220']} />
      <PerspectiveCamera makeDefault position={[2.2, 1.8, 3.5]} fov={50} near={0.1} far={100} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 6, 3]} intensity={1.0} />
      <directionalLight position={[-3, -2, -4]} intensity={0.3} />
      <ModelArea selectedModel={selectedModel} />
      <CameraControls />
      <gridHelper args={[10, 10, '#1e293b', '#0f172a']} position={[0, -1.2, 0]} />
    </>
  );
}

type AnatomyCanvasProps = {
  selectedModel?: AnatomyModelKey | null;
};

export default function AnatomyCanvas({ selectedModel = null }: AnatomyCanvasProps): JSX.Element {
  return (
    <div
      className="relative h-[60vh] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 sm:h-[65vh] lg:h-[70vh]"
      style={{
        height: '60vh',
        backgroundColor: '#020617',
        border: '1px solid #1e293b',
        borderRadius: '0.75rem',
      }}
    >
      <CanvasErrorBoundary
        fallback={
          <div className="flex h-full w-full items-center justify-center bg-slate-950 p-6 text-center">
            <p className="max-w-md text-sm leading-6 text-slate-400">
              3D canvas is not available in this browser or device. Please try a modern browser with
              WebGL support.
            </p>
          </div>
        }
      >
        <Suspense
          fallback={
            <div className="flex h-full w-full items-center justify-center bg-slate-950">
              <LoadingState />
            </div>
          }
        >
          <Canvas
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: false }}
            onCreated={({ gl }) => {
              gl.setClearColor('#0b1220');
            }}
          >
            <Scene selectedModel={selectedModel} />
          </Canvas>
        </Suspense>
      </CanvasErrorBoundary>

      <div className="pointer-events-none absolute bottom-3 left-3 rounded bg-slate-900/80 px-2 py-1 text-xs tracking-widest text-slate-400">
        DRAG TO ROTATE • SCROLL TO ZOOM • RIGHT-DRAG TO PAN
      </div>
    </div>
  );
}
