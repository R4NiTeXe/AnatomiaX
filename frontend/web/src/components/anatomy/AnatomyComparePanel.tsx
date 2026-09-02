import { useAnatomyState } from './AnatomyStateContext';
import { getAnatomyInformation } from './anatomyInformation';
import { getAnatomySystem } from './anatomyAssetConfig';

function CompareCard({
  structure,
  label,
}: {
  structure: NonNullable<ReturnType<typeof useAnatomyState>['compareStructure']>;
  label: string;
}) {
  const info = getAnatomyInformation(structure);
  const systemLabel = getAnatomySystem(structure.systemKey).label;
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{label}</p>
      {!info ? (
        <>
          <p className="text-sm font-semibold text-slate-100">{structure.name}</p>
          <p className="text-xs text-slate-400">System: {systemLabel}</p>
          <p className="text-xs capitalize text-slate-400">Body model: {structure.bodyModel}</p>
          {structure.ontologyId && (
            <p className="break-words font-mono text-xs text-slate-400">
              Ontology: {structure.ontologyId}
            </p>
          )}
          <p className="text-sm text-slate-400">Information unavailable</p>
        </>
      ) : (
        <>
          <h3 className="text-sm font-semibold text-slate-100">{info.canonicalName}</h3>
          <p className="text-xs text-slate-400">System: {systemLabel}</p>
          <p className="text-xs capitalize text-slate-400">Body model: {info.bodyModel}</p>
          {info.ontologyId && (
            <p className="break-words font-mono text-xs text-slate-400">
              Ontology: {info.ontologyId}
            </p>
          )}
          <p className="text-sm leading-5 text-slate-200">{info.description}</p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Function
            </p>
            <p className="mt-1 text-sm leading-5 text-slate-300">{info.function}</p>
          </div>
          <div className="border-t border-slate-800 pt-2">
            <p className="text-xs text-slate-400">{info.source}</p>
            <a
              href={info.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all text-xs text-teal-400 underline"
            >
              {info.sourceUrl}
            </a>
            <p className="mt-1 text-xs text-slate-500">Last verified: {info.lastVerified}</p>
            {info.license && <p className="text-xs text-slate-500">License: {info.license}</p>}
          </div>
        </>
      )}
    </div>
  );
}

export default function AnatomyComparePanel(): JSX.Element | null {
  const { selectedStructure, compareStructure, clearCompare } = useAnatomyState();

  if (!selectedStructure || !compareStructure) return null;

  const isSame =
    selectedStructure.bodyModel === compareStructure.bodyModel &&
    selectedStructure.structureKey === compareStructure.structureKey;
  if (isSame) return null;

  return (
    <section
      className="rounded-xl border border-violet-900/50 bg-violet-950/20"
      data-testid="anatomy-compare-panel"
      aria-label="Compare anatomy"
    >
      <div className="flex items-center justify-between border-b border-violet-900/30 px-4 py-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-violet-300">Compare</h2>
        <button
          type="button"
          onClick={clearCompare}
          aria-label="Clear comparison"
          data-testid="anatomy-compare-clear"
          className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200"
        >
          Clear compare
        </button>
      </div>
      <div className="grid gap-3 p-3 md:grid-cols-2">
        <CompareCard structure={selectedStructure} label="Primary" />
        <CompareCard structure={compareStructure} label="Compare" />
      </div>
    </section>
  );
}
