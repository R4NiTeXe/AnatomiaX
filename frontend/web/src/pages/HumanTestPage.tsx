import { useCallback, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useProgress } from '@react-three/drei';
import * as THREE from 'three';
import OptimizedModelStage, {
  type OptimizedModelInfo,
} from '@/components/anatomy/OptimizedModelStage';

interface TestAsset {
  key: 'skin' | 'nervous';
  label: string;
  url: string;
}

const TEST_ASSETS: TestAsset[] = [
  { key: 'skin', label: 'Skin', url: '/models-dev/skin-meshopt.glb' },
  { key: 'nervous', label: 'Nervous System', url: '/models-dev/nervous-meshopt.glb' },
];

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export default function HumanTestPage(): JSX.Element {
  const [selected, setSelected] = useState<TestAsset | null>(null);
  const [state, setState] = useState<LoadState>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [info, setInfo] = useState<OptimizedModelInfo | null>(null);
  const [loadDurationMs, setLoadDurationMs] = useState(0);
  const [resetSignal, setResetSignal] = useState(0);
  const { active } = useProgress();

  const selectAsset = useCallback((asset: TestAsset) => {
    setSelected(asset);
    setInfo(null);
    setErrorMessage('');
    setLoadDurationMs(0);
    setState('loading');
    window.performance.mark(`anatomiax-load-start-${asset.key}`);
    console.info(
      `[AnatomiaX test] requesting ${asset.label} (${asset.url}) — THREE r${THREE.REVISION}`
    );
  }, []);

  const handleLoaded = useCallback((modelInfo: OptimizedModelInfo) => {
    setInfo(modelInfo);
    setLoadDurationMs(prev => {
      void prev;
      try {
        const mark = window.performance
          .getEntriesByName('anatomiax-load-start-skin')
          .concat(window.performance.getEntriesByName('anatomiax-load-start-nervous'))
          .pop();
        return mark ? Math.round(window.performance.now() - mark.startTime) : 0;
      } catch {
        return 0;
      }
    });
    console.info('[AnatomiaX test] loaded:', modelInfo);
    setState('loaded');
  }, []);

  const handleError = useCallback((message: string) => {
    if (!message) return;
    setErrorMessage(message);
    setState('error');
    console.error('[AnatomiaX test]', message);
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <p className="text-xs uppercase tracking-widest text-slate-500">Development test</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Human asset test</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          Anatomy asset browser test — verifies that the Meshopt-optimized NIH/HRA GLB files load
          and render correctly in React Three Fiber. Temporary local copies are served from
          <code className="mx-1 rounded bg-slate-900 px-1.5 py-0.5 text-xs">/models-dev/</code>
          (git-ignored).
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {TEST_ASSETS.map(asset => (
            <button
              key={asset.key}
              type="button"
              onClick={() => selectAsset(asset)}
              className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                selected?.key === asset.key
                  ? 'border-teal-500 bg-teal-500/10 text-teal-300'
                  : 'border-slate-800 text-slate-300 hover:bg-slate-900 hover:text-white'
              }`}
            >
              {asset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setResetSignal(n => n + 1)}
            disabled={!selected}
            className="rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-900 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset camera
          </button>
        </div>

        <div className="relative mt-4 h-[60vh] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950 sm:h-[65vh] lg:h-[70vh]">
          <Canvas dpr={[1, 2]} gl={{ antialias: true }} camera={{ fov: 50 }}>
            <color attach="background" args={['#0b1220']} />
            <ambientLight intensity={0.85} />
            <directionalLight position={[3, 5, 4]} intensity={1.1} />
            <directionalLight position={[-4, -2, -3]} intensity={0.35} />
            <OptimizedModelStage
              url={selected?.url ?? null}
              onLoaded={handleLoaded}
              onError={handleError}
              resetSignal={resetSignal}
            />
            <gridHelper args={[10, 10, '#1e293b', '#0f172a']} position={[0, -1.05, 0]} />
          </Canvas>

          {selected && state === 'loading' && !errorMessage && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/60">
              <p className="text-sm text-slate-300">
                Loading {selected.label}… {active ? '' : '(fetching)'}
              </p>
            </div>
          )}

          {state === 'error' && (
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="max-w-md rounded-lg border border-red-900 bg-red-950/60 p-4 text-sm text-red-200">
                <p className="font-semibold">Failed to load asset</p>
                <p className="mt-1 leading-6">{errorMessage}</p>
              </div>
            </div>
          )}

          {!selected && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-slate-500">Select an asset to begin.</p>
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-2 text-xs leading-5 text-slate-400">
          <p>
            Status:{' '}
            <span
              className={
                state === 'error'
                  ? 'text-red-400'
                  : state === 'loaded'
                    ? 'text-emerald-400'
                    : 'text-slate-300'
              }
            >
              {state}
            </span>
            {info && (
              <>
                {' '}
                · meshes: {info.meshes} · materials: {info.materials} · vertices:{' '}
                {info.vertices.toLocaleString()} · triangles: {info.triangles.toLocaleString()} ·
                size (m): {info.size.map(v => v.toFixed(3)).join(' × ')} · load ≈ {loadDurationMs}{' '}
                ms
              </>
            )}
          </p>
          <p>Rotate: drag · Zoom: scroll · Pan: right-drag</p>
        </div>
      </div>
    </main>
  );
}
