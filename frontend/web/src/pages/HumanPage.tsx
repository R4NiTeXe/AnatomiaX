import { useState } from 'react';
import AnatomyViewer from '@/components/anatomy/AnatomyViewer';
import AnatomySystemPanel from '@/components/anatomy/AnatomySystemPanel';
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

function HumanViewer({ resetSignal }: { resetSignal: number }): JSX.Element {
  const { status } = useAnatomyState();

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      <div className="relative min-h-[55vh] flex-1 overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
        <AnatomyViewer resetSignal={resetSignal} />

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

export default function HumanPage(): JSX.Element {
  const [resetSignal, setResetSignal] = useState(0);

  return (
    <AnatomyStateProvider>
      <main className="flex h-screen min-h-screen flex-col bg-slate-950 text-slate-100">
        <header className="border-b border-slate-900 px-4 py-3 sm:px-6">
          <p className="text-xs uppercase tracking-widest text-slate-500">AnatomiaX</p>
          <h1 className="mt-1 text-lg font-bold tracking-tight sm:text-xl">Human anatomy</h1>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden sm:p-6">
          <section className="order-1 flex min-h-0 flex-1 flex-col lg:order-2">
            <HumanViewer resetSignal={resetSignal} />
          </section>
          <aside className="order-2 w-full shrink-0 lg:order-1 lg:w-72 lg:overflow-y-auto">
            <AnatomySystemPanel onResetCamera={() => setResetSignal(n => n + 1)} />
          </aside>
        </div>
      </main>
    </AnatomyStateProvider>
  );
}
