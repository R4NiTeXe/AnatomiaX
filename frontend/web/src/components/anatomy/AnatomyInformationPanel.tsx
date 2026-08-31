import { useAnatomyState } from './AnatomyStateContext';
import { getAnatomyInformation } from './anatomyInformation';
import { getAnatomySystem } from './anatomyAssetConfig';

export default function AnatomyInformationPanel(): JSX.Element | null {
  const { selectedStructure } = useAnatomyState();

  if (!selectedStructure) return null;

  const info = getAnatomyInformation(selectedStructure);

  const systemLabel = getAnatomySystem(selectedStructure.systemKey).label;

  return (
    <section
      className="flex min-h-[220px] max-h-[50vh] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40"
      data-testid="anatomy-information-panel"
      aria-label="Anatomy information"
      aria-live="polite"
    >
      <div className="border-b border-slate-800 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-slate-400">
          Anatomy information
        </h2>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-3"
        data-testid="anatomy-information-content"
      >
        {!info ? (
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
        )}
      </div>
    </section>
  );
}
