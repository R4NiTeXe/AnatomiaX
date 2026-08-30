import { useCallback, useState } from 'react';
import AnatomySearchBox from '@/components/anatomy/AnatomySearchBox';
import AnatomyViewer from '@/components/anatomy/AnatomyViewer';
import AnatomySystemPanel from '@/components/anatomy/AnatomySystemPanel';
import AnatomyVerticalNavigator from '@/components/anatomy/AnatomyVerticalNavigator';
import { AnatomyStateProvider, useAnatomyState } from '@/components/anatomy/AnatomyStateContext';
import { getAnatomySystem } from '@/components/anatomy/anatomyAssetConfig';

function LoadingOverlays(): JSX.Element | null {
  const { status } = useAnatomyState();

  const loadingSystems = Object.entries(status)
    .filter(([, value]) => value === 'loading')
    .map(([key]) => getAnatomySystem(key as never).label);

  if (loadingSystems.length === 0) return null;

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 flex flex-col gap-1">
      {loadingSystems.map(label => (
        <span
          key={label}
          className="rounded bg-slate-900/80 px-2 py-1 text-xs text-slate-300"
          data-testid={`loading-${label.toLowerCase()}`}
        >
          Loading {label.toLowerCase()} system…
        </span>
      ))}
    </div>
  );
}

function HumanViewer({
  resetSignal,
  vertical,
  onVerticalChange,
}: {
  resetSignal: number;
  vertical: number;
  onVerticalChange: (value: number) => void;
}): JSX.Element {
  const { status } = useAnatomyState();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      <div
        className="relative min-h-[55vh] flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
        style={{ touchAction: 'none' }}
      >
        <AnatomyViewer resetSignal={resetSignal} vertical={vertical} />

        <div className="pointer-events-none absolute inset-y-0 right-2 z-10 flex items-center sm:right-3">
          <div className="pointer-events-auto">
            <AnatomyVerticalNavigator value={vertical} onChange={onVerticalChange} />
          </div>
        </div>

        {status.skin === 'loading' && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/50">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-teal-400" />
              <p className="text-sm tracking-wide text-slate-300" data-testid="loading-anatomy">
                Loading anatomy…
              </p>
            </div>
          </div>
        )}

        <LoadingOverlays />

        <div className="pointer-events-none absolute bottom-3 right-3 rounded bg-slate-900/80 px-2 py-1 text-xs tracking-widest text-slate-500">
          DRAG TO ROTATE • SCROLL TO ZOOM • RIGHT-DRAG TO PAN
        </div>
      </div>
    </div>
  );
}

function BodyModelSelector({
  onVerticalChange,
  onResetCamera,
}: {
  onVerticalChange: (value: number) => void;
  onResetCamera: () => void;
}): JSX.Element {
  const { selectedBodyModel, setSelectedBodyModel } = useAnatomyState();

  const handleBodyModelChange = useCallback(
    (model: 'male' | 'female') => {
      if (model === selectedBodyModel) return;
      setSelectedBodyModel(model);
      onVerticalChange(0.5);
      onResetCamera();
    },
    [selectedBodyModel, setSelectedBodyModel, onVerticalChange, onResetCamera]
  );

  return (
    <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Body model</p>
      <div className="mt-2 flex gap-2">
        {(['male', 'female'] as const).map(model => (
          <button
            key={model}
            type="button"
            aria-pressed={selectedBodyModel === model}
            data-testid={`body-model-${model}`}
            onClick={() => handleBodyModelChange(model)}
            className={`flex-1 rounded-lg border px-3 py-1.5 text-sm capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
              selectedBodyModel === model
                ? 'border-teal-500 bg-teal-500/20 text-teal-300'
                : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {model}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function HumanPage(): JSX.Element {
  const [resetSignal, setResetSignal] = useState(0);
  const [vertical, setVertical] = useState(0.5);

  const handleResetCamera = useCallback(() => {
    setVertical(0.5);
    setResetSignal(n => n + 1);
  }, []);

  return (
    <AnatomyStateProvider>
      <main className="flex h-screen min-h-screen flex-col bg-slate-950 text-slate-100">
        <header className="border-b border-slate-900 px-4 py-3 sm:px-6">
          <p className="text-xs uppercase tracking-widest text-slate-500">AnatomiaX</p>
          <h1 className="mt-1 text-lg font-bold tracking-tight sm:text-xl">Human anatomy</h1>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden sm:p-6">
          <section className="order-1 flex min-h-0 flex-1 flex-col lg:order-2">
            <HumanViewer
              resetSignal={resetSignal}
              vertical={vertical}
              onVerticalChange={setVertical}
            />
          </section>
          <aside className="order-2 flex w-full shrink-0 flex-col gap-4 lg:order-1 lg:w-72 lg:overflow-y-auto">
            <AnatomySearchBox />
            <BodyModelSelector onVerticalChange={setVertical} onResetCamera={handleResetCamera} />
            <AnatomySystemPanel onResetCamera={handleResetCamera} />
          </aside>
        </div>
      </main>
    </AnatomyStateProvider>
  );
}
