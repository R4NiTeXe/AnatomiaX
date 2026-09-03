import { useAnatomyState } from './AnatomyStateContext';
import { getAnatomyInformation } from './anatomyInformation';
import { getAnatomySystem } from './anatomyAssetConfig';

export default function AnatomyInformationPanel(): JSX.Element | null {
  const { selectedStructure, hoveredStructure, recentHistory, selectStructure } = useAnatomyState();

  const displayStructure = hoveredStructure || selectedStructure;

  if (!displayStructure && recentHistory.length === 0) return null;

  const info = displayStructure ? getAnatomyInformation(displayStructure) : undefined;
  const systemLabel = displayStructure ? getAnatomySystem(displayStructure.systemKey).label : '';
  const isHoverPreview =
    !!hoveredStructure && hoveredStructure.structureKey !== selectedStructure?.structureKey;

  return (
    <section
      className="flex min-h-[220px] max-h-[50vh] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40"
      data-testid="anatomy-information-panel"
      aria-label="Anatomy information"
      aria-live="polite"
    >
      <div className="border-b border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
            Anatomy information
          </h2>
          {isHoverPreview && (
            <span className="px-2 py-0.5 text-xs text-teal-300 bg-teal-500/20 rounded">
              Hover preview
            </span>
          )}
          {recentHistory.length > 0 && (
            <span
              className="px-2 py-0.5 text-xs text-slate-400 bg-slate-800/50 rounded"
              data-testid="anatomy-recent-badge"
            >
              Recent
            </span>
          )}
        </div>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
        data-testid="anatomy-information-content"
      >
        {displayStructure ? (
          !info ? (
            <p className="text-sm text-slate-400" data-testid="anatomy-information-unavailable">
              Information unavailable
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <h3
                  className="text-sm font-semibold text-slate-100"
                  data-testid="anatomy-information-canonical-name"
                >
                  {info.canonicalName}
                </h3>
                <p className="mt-1 text-xs text-slate-400" data-testid="anatomy-information-system">
                  System: {systemLabel}
                </p>
                <p
                  className="text-xs capitalize text-slate-400"
                  data-testid="anatomy-information-body-model"
                >
                  Body model: {info.bodyModel}
                </p>
                {info.ontologyId && (
                  <p
                    className="mt-1 break-words font-mono text-xs text-slate-400"
                    data-testid="anatomy-information-ontology"
                  >
                    Ontology: {info.ontologyId}
                  </p>
                )}
              </div>

              <p
                className="text-sm leading-5 text-slate-200"
                data-testid="anatomy-information-description"
              >
                {info.description}
              </p>

              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Function
                </p>
                <p
                  className="mt-1 text-sm leading-5 text-slate-300"
                  data-testid="anatomy-information-function"
                >
                  {info.function}
                </p>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
                  Source
                </p>
                <p className="mt-1 text-xs text-slate-400" data-testid="anatomy-information-source">
                  {info.source}
                </p>
                <a
                  href={info.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 break-all text-xs text-teal-400 underline hover:text-teal-300"
                  data-testid="anatomy-information-source-url"
                >
                  {info.sourceUrl}
                </a>
                <p
                  className="mt-2 text-xs text-slate-500"
                  data-testid="anatomy-information-last-verified"
                >
                  Last verified: {info.lastVerified}
                </p>
                {info.license && (
                  <p
                    className="mt-1 text-xs text-slate-500"
                    data-testid="anatomy-information-license"
                  >
                    License: {info.license}
                  </p>
                )}
              </div>
            </div>
          )
        ) : (
          <p className="text-sm text-slate-400" data-testid="anatomy-information-empty">
            Select a structure to see details
          </p>
        )}

        {/* Recent history section — always visible when history exists, not hidden by hover */}
        {recentHistory.length > 0 && (
          <div className="border-t border-slate-800 pt-3 mt-3">
            <p
              className="text-xs font-semibold uppercase tracking-widest text-slate-500 mb-2"
              data-testid="anatomy-recent-heading"
            >
              Recent
            </p>
            <ul className="flex flex-col gap-2" data-testid="anatomy-recent-list">
              {recentHistory.map((item, index) => {
                const handleSelect = () => {
                  selectStructure({
                    structureKey: item.structureKey,
                    name: item.name,
                    objectName: item.objectName,
                    systemKey: item.systemKey,
                    bodyModel: item.bodyModel,
                    ontologyId: item.ontologyId,
                  });
                };
                return (
                  <li
                    key={`${item.structureKey}-${index}`}
                    onClick={handleSelect}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelect();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${getAnatomyInformation(item)?.canonicalName || item.name}, ${getAnatomySystem(item.systemKey as never).label}`}
                    className="cursor-pointer px-2 py-1.5 rounded bg-slate-800/50 hover:bg-slate-700/50 text-sm text-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                    data-testid={`anatomy-recent-item-${index}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-slate-100">
                        {getAnatomyInformation(item)?.canonicalName || item.name}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {getAnatomySystem(item.systemKey as never).label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
