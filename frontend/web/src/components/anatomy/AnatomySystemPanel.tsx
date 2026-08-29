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
    status,
    errorMessages,
    skinOpacity,
    setSkinOpacity,
    selectedStructure,
    selectStructure,
    retrySystem,
    setSystemStatus,
  } = useAnatomyState();

  const handleRetry = (key: (typeof maleAnatomyAssets)[number]['key']) => {
    useGLTF.clear(getAnatomySystem(key).path);
    retrySystem(key);
  };

  const handleToggle = (key: (typeof maleAnatomyAssets)[number]['key']) => {
    if (visibleSystems[key] && status[key] === 'loading') {
      // Hiding mid-load: cancel pending state so the row does not stay stuck.
      setSystemStatus(key, 'idle');
    }
    toggleSystem(key);
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Anatomy systems
        </h2>
        <ul className="mt-3 flex flex-col gap-1">
          {maleAnatomyAssets.map(asset => {
            const rowStatus = status[asset.key];
            const errorMessage = errorMessages[asset.key];
            return (
              <li
                key={asset.key}
                className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-900/60"
              >
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm ${
                      visibleSystems[asset.key] ? 'text-slate-100' : 'text-slate-400'
                    }`}
                  >
                    {asset.label}
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
                <button
                  type="button"
                  role="switch"
                  aria-checked={visibleSystems[asset.key]}
                  aria-label={`Toggle ${asset.label}`}
                  data-testid={`toggle-${asset.key}`}
                  disabled={!asset.available}
                  onClick={() => handleToggle(asset.key)}
                  className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                    visibleSystems[asset.key]
                      ? 'border-teal-500 bg-teal-500/30'
                      : 'border-slate-700 bg-slate-800'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all ${
                      visibleSystems[asset.key]
                        ? 'left-[18px] bg-teal-300'
                        : 'left-0.5 bg-slate-500'
                    }`}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Skin transparency
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(skinOpacity * 100)}
            onChange={e => setSkinOpacity(Number(e.target.value) / 100)}
            data-testid="skin-opacity"
            aria-label="Skin transparency"
            className="h-1 w-full cursor-pointer appearance-none rounded bg-slate-700 accent-teal-400"
          />
          <span
            className="w-10 shrink-0 text-right text-xs text-slate-400"
            data-testid="skin-opacity-value"
          >
            {Math.round(skinOpacity * 100)}%
          </span>
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

      <button
        type="button"
        data-testid="reset-camera"
        onClick={onResetCamera}
        className="rounded-lg border border-slate-800 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-900 hover:text-white"
      >
        Reset camera
      </button>
    </div>
  );
}
