import { useState } from 'react';
import { motion } from 'motion/react';
import { useGLTF } from '@react-three/drei';
import { DURATIONS, EASE } from '@/components/motion';
import { useProgressSnapshot } from '@/features/progress/hooks/useProgress';
import { useAnatomyState } from './AnatomyStateContext';
import { getAnatomySystem, maleAnatomyAssets } from './anatomyAssetConfig';
import { getAnatomyInformationByStructureKey } from './anatomyInformation';
import { parseStudiedKey, resolveAnatomyAssetUrl } from '@anatomiax/anatomy-core';
import { buildLearningModules, sessionPositionFor } from '@/features/progress/components/modules';

type AnatomySystemPanelProps = {
  onResetCamera: () => void;
};

// STEP 8.50: derived study-sequence navigator. Position, previous, and next
// all derive from the module order plus studied keys — no stored session, so
// refresh, back/forward, and deep-links resolve identically. Order is
// navigational only, never a medical claim.
function SessionNavigator({ structureKey }: { structureKey: string }): JSX.Element | null {
  const { selectStructure, visibleSystems, toggleSystem, recentHistory } = useAnatomyState();
  const snapshotQuery = useProgressSnapshot();
  const studiedKeys = [
    ...(snapshotQuery.data?.studiedKeys ?? []),
    ...recentHistory.map(item => item.structureKey),
  ];
  const position = sessionPositionFor(buildLearningModules(), structureKey, studiedKeys);
  if (!position) return null;

  const go = (key: string | null) => {
    if (!key) return;
    const target = parseStudiedKey(key);
    if (!target) return;
    if (!visibleSystems[target.systemKey]) toggleSystem(target.systemKey);
    selectStructure(target);
  };

  const buttonClass =
    'flex-1 rounded-lg border border-slate-700 px-2 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="mt-3 border-t border-slate-800 pt-3" data-testid="session-navigator">
      <p
        className="text-xs tabular-nums text-slate-500"
        data-testid="session-position"
        aria-label={`Structure ${position.index + 1} of ${position.total} in ${position.module.title}`}
      >
        {position.index + 1} of {position.total} · {position.module.title}
      </p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={!position.previousKey}
          title={position.previousKey ? undefined : 'At the start of this module'}
          aria-label={`Previous structure in ${position.module.title}`}
          data-testid="session-prev"
          onClick={() => go(position.previousKey)}
          className={buttonClass}
        >
          ← Prev
        </button>
        <button
          type="button"
          disabled={!position.nextKey}
          title={position.nextKey ? undefined : 'No further unstudied structures'}
          aria-label={`Next unstudied structure in ${position.module.title}`}
          data-testid="session-next"
          onClick={() => go(position.nextKey)}
          className={buttonClass}
        >
          Next →
        </button>
      </div>
    </div>
  );
}

// STEP 8.40: "have I covered this?" signal from verified studied state —
// local recent history (immediate) plus the persisted snapshot (same
// react-query cache as AnatomyProgressSync, so zero extra requests).
function SelectedStudiedMark({ structureKey }: { structureKey: string }): JSX.Element | null {
  const { recentHistory } = useAnatomyState();
  const snapshotQuery = useProgressSnapshot();
  const studied =
    recentHistory.some(item => item.structureKey === structureKey) ||
    (snapshotQuery.data?.studiedKeys ?? []).includes(structureKey);
  if (!studied) return null;
  return (
    <span
      className="shrink-0 rounded bg-teal-500/20 px-2 py-0.5 text-xs font-medium text-teal-200"
      data-testid="selected-studied"
    >
      ✓ Studied
    </span>
  );
}

// STEP 8.40: verified location context from GLB lineage (same parent rule
// as the explorer tree). Renders only when it adds information beyond the
// system line — never invented, never for bare model roots.
function SelectedParentLine({
  structureKey,
  objectName,
}: {
  structureKey: string;
  objectName: string;
}): JSX.Element | null {
  const { registry } = useAnatomyState();
  const parentRaw = registry.findByStructureKey(structureKey)?.lineage?.[1];
  if (!parentRaw || parentRaw === 'VH_M' || parentRaw === 'VH_F') return null;
  const humanize = (raw: string): string => raw.replace(/^VH_[MF]_/, '').replace(/_/g, ' ');
  const parent = humanize(parentRaw);
  if (!parent || parent.toLowerCase() === humanize(objectName).toLowerCase()) return null;
  return (
    <p className="mt-1 text-xs text-slate-500" data-testid="selected-parent">
      Located in: {parent}
    </p>
  );
}

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
    startQuiz,
    selectedBodyModel,
  } = useAnatomyState();

  const [openOpacityKey, setOpenOpacityKey] = useState<string | null>(null);

  const handleRetry = (key: (typeof maleAnatomyAssets)[number]['key']) => {
    // STEP 8.46: clear the CURRENT model's asset path — the male catalog
    // path left female failures cached, so retries re-threw instantly.
    // STEP 8.54: same key the loader uses, via the central resolver.
    useGLTF.clear(resolveAnatomyAssetUrl(selectedBodyModel, key));
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
                      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed disabled:opacity-40 ${
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
                        <p
                          className="text-xs text-red-400"
                          data-testid={`error-${asset.key}`}
                          role="status"
                        >
                          {errorMessage || 'Failed to load.'}{' '}
                          <button
                            type="button"
                            data-testid={`retry-${asset.key}`}
                            onClick={() => handleRetry(asset.key)}
                            className="rounded underline hover:text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
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
                      className={`rounded px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 ${
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
                      className={`rounded px-2 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:opacity-40 ${
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
            className="flex-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            Reset view
          </button>
          <button
            type="button"
            data-testid="reset-camera"
            aria-label="Reset camera"
            onClick={onResetCamera}
            className="flex-1 rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:bg-slate-900 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            Reset camera
          </button>
        </div>
      </section>

      {selectedStructure && (
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: DURATIONS.fast, ease: EASE.standard }}
          className="rounded-xl border border-teal-900/60 bg-teal-950/20 p-4 shadow-glow-sm"
          data-testid="selection-panel"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-teal-500">
              Selected structure
            </h2>
            <SelectedStudiedMark structureKey={selectedStructure.structureKey} />
          </div>
          <p
            className="mt-2 break-words font-mono text-xs leading-5 text-slate-200"
            data-testid="selected-structure-name"
          >
            {selectedStructure.name}
          </p>
          <p className="mt-1 text-xs text-slate-500" data-testid="selected-system">
            System: {getAnatomySystem(selectedStructure.systemKey).label}
          </p>
          <SelectedParentLine
            structureKey={selectedStructure.structureKey}
            objectName={selectedStructure.objectName}
          />
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
            className="mt-3 rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
          >
            Clear selection
          </button>
          {getAnatomyInformationByStructureKey(selectedStructure.structureKey) ? (
            <button
              type="button"
              data-testid="quiz-this-structure"
              onClick={() => {
                // STEP 8.37: guided next action — startQuiz already builds
                // question 1 from the current selection; bring the quiz into
                // view and focus so keyboard/SR users land in context.
                // (Global reduced-motion CSS makes the scroll instant.)
                startQuiz();
                const quiz = document.querySelector('[data-testid="anatomy-quiz"]');
                if (quiz instanceof HTMLElement) {
                  quiz.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
                  quiz.focus({ preventScroll: true });
                }
              }}
              className="mt-2 w-full rounded-lg bg-teal-500/20 px-3 py-1.5 text-xs font-medium text-teal-300 transition-colors hover:bg-teal-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              Quiz on this structure
            </button>
          ) : (
            // STEP 8.41: no verified record means startQuiz cannot target
            // this structure — say so instead of promising a generic quiz.
            <p className="mt-2 text-xs text-slate-500" data-testid="quiz-unavailable-note">
              Quiz isn&apos;t available for this structure yet.
            </p>
          )}
          <SessionNavigator structureKey={selectedStructure.structureKey} />
        </motion.section>
      )}
    </div>
  );
}
