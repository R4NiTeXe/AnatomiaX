import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import AccountPanel from '@/components/auth/AccountPanel';
import AnatomyComparePanel from '@/components/anatomy/AnatomyComparePanel';
import AnatomyInformationPanel from '@/components/anatomy/AnatomyInformationPanel';
import AnatomyProgressSync from '@/components/anatomy/AnatomyProgressSync';
import HumanDeepLink from '@/components/anatomy/HumanDeepLink';
import AnatomyQuiz from '@/components/anatomy/AnatomyQuiz';
import AnatomySearchBox from '@/components/anatomy/AnatomySearchBox';
import AnatomySessionPanel from '@/components/anatomy/AnatomySessionPanel';
import AnatomyStructureExplorer from '@/components/anatomy/AnatomyStructureExplorer';
import AnatomyViewer from '@/components/anatomy/AnatomyViewer';
import AnatomySystemPanel from '@/components/anatomy/AnatomySystemPanel';
import AnatomyVerticalNavigator from '@/components/anatomy/AnatomyVerticalNavigator';
import { AnatomyStateProvider, useAnatomyState } from '@/components/anatomy/AnatomyStateContext';
import { SKIN_TONES } from '@/components/anatomy/skinTones';
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

// STEP 8.31: session-scoped tone control next to the body-model switch.
// Same segmented-button language; swatch + visible text label + ring so the
// selected state never relies on color alone.
function SkinToneSelector(): JSX.Element {
  const { skinTone, setSkinTone } = useAnatomyState();

  return (
    <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <p
        id="skin-tone-label"
        className="text-xs font-semibold uppercase tracking-widest text-slate-400"
      >
        Skin tone
      </p>
      <div
        role="group"
        aria-labelledby="skin-tone-label"
        className="mt-2 flex flex-wrap gap-2"
        data-testid="skin-tone-group"
      >
        {SKIN_TONES.map(preset => {
          const selected = skinTone === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-pressed={selected}
              aria-label={`Skin tone: ${preset.label}`}
              title={preset.label}
              data-testid={`skin-tone-${preset.id}`}
              onClick={() => setSkinTone(preset.id)}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
                selected
                  ? 'border-teal-500 bg-teal-500/20 font-semibold text-teal-200 ring-1 ring-inset ring-teal-400/60'
                  : 'border-slate-700 bg-slate-800/50 font-normal text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span
                aria-hidden="true"
                style={{ backgroundColor: preset.color }}
                className="h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-inset ring-white/25"
              />
              {preset.shortLabel}
            </button>
          );
        })}
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
      <AnatomyProgressSync />
      <HumanDeepLink />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex h-screen min-h-screen flex-col bg-slate-950 text-slate-100"
      >
        <header className="border-b border-slate-900 px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-slate-500">AnatomiaX</p>
              <h1 className="mt-1 text-lg font-bold tracking-tight sm:text-xl">Human anatomy</h1>
            </div>
            <nav
              aria-label="Primary"
              className="flex items-center gap-1 text-sm"
              data-testid="human-nav"
            >
              <Link
                to="/"
                className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                Home
              </Link>
              <Link
                to="/learn"
                className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                Progress
              </Link>
              <Link
                to="/account"
                className="rounded-lg px-3 py-2 text-slate-300 hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                Account
              </Link>
            </nav>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 lg:flex-row lg:overflow-hidden sm:p-6">
          {/* STEP 8.32: the section must never collapse to 0 height. In the
              scrollable mobile/tablet column, `flex-1 + min-h-0` shrank it to
              zero next to the tall sidebar, so the min-h-[55vh] viewer box
              overflowed visibly over the sidebar — and the positioned R3F
              canvas wrapper then won hit-testing over static sidebar buttons.
              `lg:min-h-0` preserves the original desktop row behavior. */}
          <section
            data-testid="human-viewer-section"
            className="order-1 flex min-h-[55vh] flex-1 flex-col lg:order-2 lg:min-h-0"
          >
            <HumanViewer
              resetSignal={resetSignal}
              vertical={vertical}
              onVerticalChange={setVertical}
            />
          </section>
          <aside className="order-2 flex w-full shrink-0 flex-col gap-4 lg:order-1 lg:w-72 lg:overflow-y-auto">
            <AnatomySearchBox />
            <BodyModelSelector onVerticalChange={setVertical} onResetCamera={handleResetCamera} />
            <SkinToneSelector />
            <AnatomyStructureExplorer />
            <AnatomyInformationPanel />
            <AnatomyComparePanel />
            <AnatomyQuiz />
            <AnatomySessionPanel />
            <AccountPanel />
            <AnatomySystemPanel onResetCamera={handleResetCamera} />
          </aside>
        </div>
      </main>
    </AnatomyStateProvider>
  );
}
