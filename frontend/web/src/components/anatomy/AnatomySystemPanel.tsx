import { useState } from 'react';
import { useGLTF } from '@react-three/drei';
import { useAnatomyState } from './AnatomyStateContext';
import { getAnatomySystem, maleAnatomyAssets } from './anatomyAssetConfig';

type AnatomySystemPanelProps = {
  onResetCamera: () => void;
};

export default function AnatomySystemPanel({
  onResetCamera,
}: AnatomySystemPanelProps): JSX.Element {
  const {
    visibleSystems,
    toggleSystem,
    systemOpacity,
    setSystemOpacity,
    isolatedSystem,
    isolateSystem,
    resetView,
    status,
    errorMessages,
    selectedStructure,
    selectStructure,
    retrySystem,
    setSystemStatus,
  } = useAnatomyState();

  const [openOpacityKey, setOpenOpacityKey] = useState<string | null>(null);

  const handleRetry = (key: (typeof maleAnatomyAssets)[number]['key']) => {
    useGLTF.clear(getAnatomySystem(key).path);
    retrySystem(key);
  };

  const handleToggle = (key: (typeof maleAnatomyAssets)[number]['key']) => {
    if (visibleSystems[key] && status[key] === 'loading') {
      setSystemStatus(key, 'idle');
    }
    toggleSystem(key);
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Anatomy layers
          </h2>
          <span className="text-xs text-slate-500">
            {Object.values(visibleSystems).filter(Boolean).length} visible
          </span>
        </div>

        <ul className="mt-3 flex flex-col gap-1">
          {maleAnatomyAssets.map(asset => {
            const rowStatus = status[asset.key];
            const errorMessage = errorMessages[asset.key];
            const isVisible = visibleSystems[asset.key];
            const opacity = systemOpacity[asset.key] ?? 1;
            const isIsolated = isolatedSystem === asset.key;
            const isOpacityOpen = openOpacityKey === asset.key;

            return (
              <li
                key={asset.key}
                className={`rounded-lg border px-2 py-2 ${isIsolated ? 'border-teal-800 bg-teal-950/20' : 'border-transparent hover:bg-slate-900/60'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isVisible}
                      aria-label={isVisible ? `Hide ${asset.label}` : `Show ${asset.label}`}
                      data-testid={`toggle-${asset.key}`}
                      disabled={!asset.available}
                      onClick={() => handleToggle(asset.key)}
                      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400 disabled:cursor-not-allowed disabled:opacity-40 ${
                        isVisible
                          ? 'border-teal-500 bg-teal-500/30'
                          : 'border-slate-700 bg-slate-800'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
                          isVisible ? 'left-[18px] bg-teal-300' : 'left-0.5 bg-slate-500'
                        }`}
                      />
                    </button>
                    <div className="min-w-0">
                      <p
                        className={`truncate text-sm ${isVisible ? 'text-slate-100' : 'text-slate-400'}`}
                      >
                        {asset.label}
                        {opacity < 0.999 && (
                          <span className="ml-1 text-xs text-slate-500">
                            {Math.round(opacity * 100)}%
                          </span>
                        )}
                      </p>
                      {rowStatus === 'loading' && <p className="text-xs text-teal-400">Loading…</p>}
                      {rowStatus === 'error' && (
                        <p className="text-xs text-red-400" data-testid={`error-${asset.key}`}>
                          {errorMessage || 'Failed to load.'}{' '}
                          <button
                            type="button"
                            data-testid={`retry-${asset.key}`}
                            onClick={() => handleRetry(asset.key)}
                            className="underline hover:text-red-300"
                          >
                            Retry
                          </button>
                        </p>
                      )}
                      {!asset.available && <p className="text-xs text-slate-600">Unavailable</p>}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Set ${asset.label} opacity`}
                      aria-pressed={isOpacityOpen}
                      data-testid={`opacity-toggle-${asset.key}`}
                      onClick={() => setOpenOpacityKey(isOpacityOpen ? null : asset.key)}
                      className={`rounded px-2 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400 ${
                        isOpacityOpen
                          ? 'bg-slate-700 text-slate-100'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      Opacity
                    </button>
                    <button
                      type="button"
                      aria-label={`Isolate ${asset.label}`}
                      aria-pressed={isIsolated}
                      data-testid={`isolate-${asset.key}`}
                      disabled={!asset.available}
                      onClick={() => isolateSystem(asset.key)}
                      className={`rounded px-2 py-1 text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400 disabled:opacity-40 ${
                        isIsolated
                          ? 'bg-teal-500/20 text-teal-300'
                          : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      Solo
                    </button>
                  </div>
                </div>

                {isOpacityOpen && (
                  <div className="mt-2 flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Math.round(opacity * 100)}
                      onChange={e => setSystemOpacity(asset.key, Number(e.target.value) / 100)}
                      data-testid={`opacity-${asset.key}`}
                      aria-label={`Set ${asset.label} opacity`}
                      className="h-1 w-full cursor-pointer appearance-none rounded bg-slate-700 accent-teal-400"
                    />
                    <span
                      className="w-10 shrink-0 text-right text-xs text-slate-400"
                      data-testid={`opacity-value-${asset.key}`}
                    >
                      {Math.round(opacity * 100)}%
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            data-testid="reset-view"
            aria-label="Reset anatomy view"
            onClick={resetView}
            className="flex-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400"
          >
            Reset view
          </button>
          <button
            type="button"
            data-testid="reset-camera"
            aria-label="Reset camera"
            onClick={onResetCamera}
            className="flex-1 rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-900 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-400"
          >
            Reset camera
          </button>
        </div>
      </section>

      {selectedStructure && (
        <section
          className="rounded-xl border border-teal-900/60 bg-teal-950/20 p-4"
          data-testid="selection-panel"
        >
          <h2 className="text-xs font-semibold uppercase tracking-widest text-teal-500">
            Selected structure
          </h2>
          <p
            className="mt-2 break-words font-mono text-xs leading-5 text-slate-200"
            data-testid="selected-structure-name"
          >
            {selectedStructure.name}
          </p>
          <p className="mt-1 text-xs text-slate-500" data-testid="selected-system">
            System: {getAnatomySystem(selectedStructure.systemKey).label}
          </p>
          <p
            className="mt-1 break-words font-mono text-xs leading-5 text-slate-400"
            data-testid="selected-ontology"
          >
            Ontology:{' '}
            {selectedStructure.ontologyId
              ? selectedStructure.ontologyId
              : 'Ontology ID not available'}
          </p>
          <button
            type="button"
            data-testid="clear-selection"
            onClick={() => selectStructure(null)}
            className="mt-3 rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
          >
            Clear selection
          </button>
        </section>
      )}
    </div>
  );
}
